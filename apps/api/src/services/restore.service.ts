import { spawn } from 'child_process';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
// @aws-sdk/client-s3 loaded dynamically when cloud restore is needed
type S3ClientType = any;
import { logger } from '../utils/logger.js';

export interface RestoreConfig {
  backupDir: string;
  tempRestoreDir: string;
  uploadToCloud: boolean;
  cloudBucket: string;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  error?: string;
  timestamp: Date;
}

export class RestoreService {
  private config: RestoreConfig;
  private s3Client?: S3ClientType;

  constructor(config: RestoreConfig) {
    this.config = config;
  }

  private async getS3Client() {
    if (this.s3Client) return this.s3Client;
    if (!this.config.uploadToCloud) return null;
    const { S3Client } = await import('@aws-sdk/client-s3');
    this.s3Client = new S3Client({
      endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || '',
        secretAccessKey: process.env.MINIO_SECRET_KEY || '',
      },
    });
    return this.s3Client;
  }

  /**
   * Restores database from a backup file
   */
  async restoreFromBackup(backupFileName: string, dryRun: boolean = false): Promise<RestoreResult> {
    try {
      // Determine if the backup is in local storage or cloud
      let backupPath: string | undefined;
      let isCompressed = false;
      
      // Check if backup exists locally
      const localBackupPath = path.join(this.config.backupDir, backupFileName);
      try {
        await import('fs').then(fs => fs.promises.access(localBackupPath));
        backupPath = localBackupPath;
        isCompressed = backupFileName.endsWith('.gz');
      } catch {
        // Backup not found locally, check cloud storage
        if (this.s3Client) {
          backupPath = await this.downloadFromCloud(backupFileName);
          isCompressed = backupFileName.endsWith('.gz');
        } else {
          throw new Error(`Backup file not found: ${backupFileName}`);
        }
      }

      if (!backupPath) {
        throw new Error(`Backup file not found: ${backupFileName}`);
      }

      if (dryRun) {
        // Just validate the backup file
        const isValid = await this.validateBackup(backupPath);
        if (!isValid) {
          throw new Error('Backup file validation failed');
        }
        return {
          success: true,
          message: 'Dry run successful - backup file is valid',
          timestamp: new Date()
        };
      }

      // Prepare restore command based on format
      let restoreProcess;
      if (isCompressed) {
        // For compressed files, we need to decompress and pipe to pg_restore
        const gunzip = await import('zlib').then(z => z.createGunzip());
        const readStream = createReadStream(backupPath);
        
        restoreProcess = spawn('pg_restore', [
          '--dbname', process.env.DATABASE_URL || '',
          '--clean', // Drop objects before recreating
          '--if-exists', // Use IF EXISTS when dropping
          '--verbose',
          '--exit-on-error'
        ]);
        
        // Pipe the decompressed stream to pg_restore
        readStream.pipe(gunzip).pipe(restoreProcess.stdin);
      } else {
        // For uncompressed files, use pg_restore directly
        restoreProcess = spawn('pg_restore', [
          '--dbname', process.env.DATABASE_URL || '',
          '--clean',
          '--if-exists',
          '--verbose',
          '--exit-on-error',
          backupPath
        ]);
      }

      // Capture output and errors
      let stdout = '';
      let stderr = '';
      
      restoreProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      restoreProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const exitCode = await new Promise<number>((resolve, reject) => {
        restoreProcess.on('close', resolve);
        restoreProcess.on('error', reject);
      });

      if (exitCode !== 0) {
        throw new Error(`pg_restore failed with exit code ${exitCode}: ${stderr}`);
      }

      logger.info(`Database restored successfully from: ${backupFileName}`);

      return {
        success: true,
        message: `Database restored successfully from: ${backupFileName}`,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Restore operation failed:', error);
      return {
        success: false,
        message: 'Restore operation failed',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };
    }
  }

  /**
   * Downloads backup from cloud storage
   */
  private async downloadFromCloud(backupFileName: string): Promise<string> {
    const client = await this.getS3Client();
    if (!client) {
      throw new Error('S3 client not initialized');
    }

    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const key = `backups/${backupFileName}`;
    const filePath = path.join(this.config.tempRestoreDir, backupFileName);

    // Ensure temp directory exists
    await import('fs').then(fs => fs.promises.mkdir(this.config.tempRestoreDir, { recursive: true }));

    const command = new GetObjectCommand({
      Bucket: this.config.cloudBucket,
      Key: key
    });

    const response = await client.send(command);
    
    // Write the file to temp directory
    const writeStream = import('fs').then(fs => fs.createWriteStream(filePath));
    await pipeline(response.Body as NodeJS.ReadableStream, await writeStream);
    
    return filePath;
  }

  /**
   * Validates backup file integrity
   */
  private async validateBackup(backupPath: string): Promise<boolean> {
    try {
      // For custom format dumps, we can use pg_restore with --list to validate
      const validateProcess = spawn('pg_restore', [
        '--list',
        backupPath
      ]);

      let stderr = '';
      validateProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const exitCode = await new Promise<number>((resolve, reject) => {
        validateProcess.on('close', resolve);
        validateProcess.on('error', reject);
      });

      // Exit code 0 means the file is valid
      return exitCode === 0;
    } catch (error) {
      logger.error('Backup validation failed:', error);
      return false;
    }
  }

  /**
   * Lists available backups from cloud storage
   */
  async listCloudBackups(): Promise<string[]> {
    const client = await this.getS3Client();
    if (!client) {
      throw new Error('S3 client not initialized');
    }

    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const command = new ListObjectsV2Command({
      Bucket: this.config.cloudBucket,
      Prefix: 'backups/'
    });

    const response = await client.send(command);
    
    if (response.Contents) {
      return response.Contents
        .filter(obj => obj.Key?.endsWith('.sql') || obj.Key?.endsWith('.sql.gz'))
        .map(obj => obj.Key!)
        .map(key => key.replace('backups/', '')); // Remove prefix
    }
    
    return [];
  }

  /**
   * Gets backup file info
   */
  async getBackupFileInfo(backupFileName: string): Promise<{
    existsLocally: boolean;
    existsInCloud: boolean;
    size?: number;
    lastModified?: Date;
  } | null> {
    // Check local existence
    let existsLocally = false;
    let localSize: number | undefined;
    
    try {
      const localPath = path.join(this.config.backupDir, backupFileName);
      const stats = await import('fs').then(fs => fs.promises.stat(localPath));
      existsLocally = true;
      localSize = stats.size;
    } catch {
      existsLocally = false;
    }

    // Check cloud existence
    let existsInCloud = false;
    let cloudSize: number | undefined;
    let lastModified: Date | undefined;
    
    if (this.s3Client) {
      try {
        const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
        const command = new HeadObjectCommand({
          Bucket: this.config.cloudBucket,
          Key: `backups/${backupFileName}`
        });
        
        const response = await this.s3Client.send(command);
        existsInCloud = true;
        cloudSize = response.ContentLength;
        lastModified = response.LastModified;
      } catch {
        existsInCloud = false;
      }
    }

    if (!existsLocally && !existsInCloud) {
      return null;
    }

    return {
      existsLocally,
      existsInCloud,
      size: localSize || cloudSize,
      lastModified
    };
  }

  /**
   * Performs a dry run of the restore operation without actually restoring
   */
  async dryRunRestore(backupFileName: string): Promise<RestoreResult> {
    try {
      // First check if backup exists
      const fileInfo = await this.getBackupFileInfo(backupFileName);
      if (!fileInfo) {
        return {
          success: false,
          message: 'Backup file not found',
          error: `Backup file does not exist: ${backupFileName}`,
          timestamp: new Date()
        };
      }

      // Download the backup if it's in cloud storage
      let backupPath: string;
      if (fileInfo.existsLocally) {
        backupPath = path.join(this.config.backupDir, backupFileName);
      } else {
        backupPath = await this.downloadFromCloud(backupFileName);
      }

      // Validate the backup file
      const isValid = await this.validateBackup(backupPath);
      if (!isValid) {
        return {
          success: false,
          message: 'Backup file validation failed',
          error: 'The backup file appears to be corrupted or invalid',
          timestamp: new Date()
        };
      }

      // For a dry run, we just validate that the file is valid
      return {
        success: true,
        message: 'Dry run successful - backup file is valid and can be restored',
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Dry run restore failed:', error);
      return {
        success: false,
        message: 'Dry run restore failed',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };
    }
  }

  /**
   * Restores specific tables from a backup (partial restore)
   */
  async restoreSpecificTables(backupFileName: string, tables: string[]): Promise<RestoreResult> {
    try {
      // Check if backup exists
      const fileInfo = await this.getBackupFileInfo(backupFileName);
      if (!fileInfo) {
        throw new Error(`Backup file not found: ${backupFileName}`);
      }

      // Download the backup if it's in cloud storage
      let backupPath: string;
      if (fileInfo.existsLocally) {
        backupPath = path.join(this.config.backupDir, backupFileName);
      } else {
        backupPath = await this.downloadFromCloud(backupFileName);
      }

      // Prepare restore command with specific tables
      const { spawn } = await import('child_process');
      const args = [
        '--dbname', process.env.DATABASE_URL || '',
        '--clean',
        '--if-exists',
        '--verbose',
        '--exit-on-error',
        ...tables.flatMap(table => ['--table', `public.${table}`]),
        backupPath
      ];

      const restoreProcess = spawn('pg_restore', args);

      let stdout = '';
      let stderr = '';
      
      restoreProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      restoreProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const exitCode = await new Promise<number>((resolve, reject) => {
        restoreProcess.on('close', resolve);
        restoreProcess.on('error', reject);
      });

      if (exitCode !== 0) {
        throw new Error(`pg_restore failed with exit code ${exitCode}: ${stderr}`);
      }

      logger.info(`Specific tables restored successfully from: ${backupFileName}`);

      return {
        success: true,
        message: `Specific tables (${tables.join(', ')}) restored successfully from: ${backupFileName}`,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Partial restore operation failed:', error);
      return {
        success: false,
        message: 'Partial restore operation failed',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };
    }
  }

  /**
   * Creates a restore point before performing a restore operation
   */
  async createRestorePoint(): Promise<{ success: boolean; restorePointId: string; message: string }> {
    try {
      // Create a quick backup before the restore
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const restorePointFileName = `restore_point_${timestamp}.sql`;
      const restorePointPath = path.join(this.config.backupDir, restorePointFileName);

      // Ensure backup directory exists
      await import('fs').then(fs => fs.promises.mkdir(this.config.backupDir, { recursive: true }));

      // Create the backup using pg_dump
      const { spawn } = await import('child_process');
      const pgDumpProcess = spawn('pg_dump', [
        '--dbname', process.env.DATABASE_URL || '',
        '--format', 'custom',
        '--file', restorePointPath,
        '--verbose'
      ]);

      let stderr = '';
      pgDumpProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const exitCode = await new Promise<number>((resolve, reject) => {
        pgDumpProcess.on('close', resolve);
        pgDumpProcess.on('error', reject);
      });

      if (exitCode !== 0) {
        throw new Error(`pg_dump failed with exit code ${exitCode}: ${stderr}`);
      }

      logger.info(`Restore point created: ${restorePointPath}`);

      return {
        success: true,
        restorePointId: restorePointFileName,
        message: `Restore point created successfully: ${restorePointFileName}`
      };
    } catch (error) {
      logger.error('Failed to create restore point:', error);
      return {
        success: false,
        restorePointId: '',
        message: `Failed to create restore point: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

// Export singleton instance with default configuration
export const restoreService = new RestoreService({
  backupDir: process.env.BACKUP_DIR || './backups',
  tempRestoreDir: process.env.TEMP_RESTORE_DIR || './temp_restores',
  uploadToCloud: process.env.UPLOAD_BACKUPS_TO_CLOUD === 'true',
  cloudBucket: process.env.BACKUP_BUCKET_NAME || 'erp-backups'
});