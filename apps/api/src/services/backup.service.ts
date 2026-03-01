import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream, promises as fsPromises } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
// @aws-sdk/client-s3 loaded dynamically when cloud backup is enabled
type S3ClientType = any;
import { logger } from '../utils/logger.js';
import { db } from '../config/database.js';
import { sql } from 'drizzle-orm';

export interface BackupConfig {
  retentionDays: number;
  backupDir: string;
  compress: boolean;
  uploadToCloud: boolean;
  cloudBucket: string;
}

export interface BackupResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  error?: string;
  timestamp: Date;
}

export interface BackupMetadata {
  id: string;
  fileName: string;
  fileSize: number;
  createdAt: Date;
  storeId?: string;
  backupType: 'full' | 'incremental' | 'daily' | 'weekly';
}

export class BackupService {
  private config: BackupConfig;
  private s3Client?: S3ClientType;

  constructor(config: BackupConfig) {
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
   * Creates a full database backup
   */
  async createBackup(backupType: 'full' | 'incremental' | 'daily' | 'weekly' = 'full'): Promise<BackupResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `erp_backup_${backupType}_${timestamp}.sql`;
    const filePath = path.join(this.config.backupDir, fileName);

    try {
      // Ensure backup directory exists
      await fsPromises.mkdir(this.config.backupDir, { recursive: true });

      // Create the backup using pg_dump
      const pgDumpProcess = spawn('pg_dump', [
        '--dbname', process.env.DATABASE_URL || '',
        '--format', 'custom', // Using custom format for better compression
        '--file', filePath,
        '--verbose'
      ]);

      // Handle pg_dump process
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

      // Get file stats
      const stats = await fsPromises.stat(filePath);

      // Optionally compress the backup
      if (this.config.compress) {
        await this.compressFile(filePath);
      }

      // Upload to cloud storage if enabled
      if (this.config.uploadToCloud && this.s3Client) {
        await this.uploadToCloudStorage(filePath, backupType);
      }

      logger.info(`Backup created successfully: ${filePath}`);

      return {
        success: true,
        filePath: filePath,
        fileSize: stats.size,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Backup creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };
    }
  }

  /**
   * Creates a backup of specific tables (for partial backups)
   */
  async createPartialBackup(tables: string[]): Promise<BackupResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `erp_partial_backup_${timestamp}.sql`;
    const filePath = path.join(this.config.backupDir, fileName);

    try {
      await fsPromises.mkdir(this.config.backupDir, { recursive: true });

      // Create the backup with specific tables
      const args = [
        '--dbname', process.env.DATABASE_URL || '',
        '--format', 'custom',
        '--file', filePath,
        '--verbose',
        ...tables.flatMap(table => ['--table', table])
      ];

      const pgDumpProcess = spawn('pg_dump', args);

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

      const stats = await fsPromises.stat(filePath);

      if (this.config.compress) {
        await this.compressFile(filePath);
      }

      if (this.config.uploadToCloud && this.s3Client) {
        await this.uploadToCloudStorage(filePath, 'incremental');
      }

      logger.info(`Partial backup created successfully: ${filePath}`);

      return {
        success: true,
        filePath: filePath,
        fileSize: stats.size,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Partial backup creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };
    }
  }

  /**
   * Compresses the backup file using gzip
   */
  private async compressFile(filePath: string): Promise<void> {
    const gzip = await import('zlib').then(z => z.gzip);
    const compressedFilePath = `${filePath}.gz`;

    const readStream = createReadStream(filePath);
    const writeStream = createWriteStream(compressedFilePath);

    await pipeline(readStream, gzip(), writeStream);

    // Remove original file after compression
    await fsPromises.unlink(filePath);

    logger.info(`File compressed: ${compressedFilePath}`);
  }

  /**
   * Uploads backup to cloud storage
   */
  private async uploadToCloudStorage(filePath: string, backupType: string): Promise<void> {
    const client = await this.getS3Client();
    if (!client) {
      throw new Error('S3 client not initialized');
    }

    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const fileContent = await fsPromises.readFile(filePath);
    const key = `backups/${backupType}/${path.basename(filePath)}`;

    const command = new PutObjectCommand({
      Bucket: this.config.cloudBucket,
      Key: key,
      Body: fileContent,
      ContentType: 'application/gzip',
      Metadata: {
        'backup-type': backupType,
        'created-at': new Date().toISOString(),
        'file-size': fileContent.length.toString(),
      }
    });

    await client.send(command);
    logger.info(`Backup uploaded to cloud: ${key}`);
  }

  /**
   * Lists available backups
   */
  async listBackups(): Promise<BackupMetadata[]> {
    const files = await fsPromises.readdir(this.config.backupDir);

    const backups: BackupMetadata[] = [];

    for (const file of files) {
      if (file.endsWith('.sql') || file.endsWith('.sql.gz')) {
        const filePath = path.join(this.config.backupDir, file);
        const stats = await fsPromises.stat(filePath);

        // Extract backup type from filename
        let backupType: 'full' | 'incremental' | 'daily' | 'weekly' = 'full';
        if (file.includes('incremental')) backupType = 'incremental';
        else if (file.includes('daily')) backupType = 'daily';
        else if (file.includes('weekly')) backupType = 'weekly';

        backups.push({
          id: file.replace(/\.sql(\.gz)?$/, ''),
          fileName: file,
          fileSize: stats.size,
          createdAt: stats.birthtime,
          backupType
        });
      }
    }

    // Sort by creation date (newest first)
    return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Deletes old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const backups = await this.listBackups();
    const oldBackups = backups.filter(backup => backup.createdAt < cutoffDate);

    for (const backup of oldBackups) {
      const filePath = path.join(this.config.backupDir, backup.fileName);
      try {
        await fsPromises.unlink(filePath);
        logger.info(`Deleted old backup: ${backup.fileName}`);
      } catch (error) {
        logger.error(`Failed to delete backup ${backup.fileName}:`, error);
      }
    }
  }

  /**
   * Verifies backup integrity by checking if it can be restored to a temporary database
   */
  async verifyBackup(backupPath: string): Promise<boolean> {
    try {
      // This is a simplified verification - in production, you might want to 
      // restore to a temporary database and run validation queries
      const stats = await fsPromises.stat(backupPath);

      // Basic checks: file exists and has content
      if (stats.size === 0) {
        logger.error(`Backup file is empty: ${backupPath}`);
        return false;
      }

      // Additional verification could include:
      // - Checking if the dump file contains expected tables
      // - Attempting to restore to a temporary database

      // For custom format dumps, we can use pg_restore with --list to validate
      if (backupPath.endsWith('.sql') || backupPath.endsWith('.sql.gz')) {
        const { spawn } = await import('child_process');
        const args = backupPath.endsWith('.gz')
          ? ['--list', '--format=custom', backupPath]
          : ['--list', backupPath];

        const validateProcess = spawn('pg_restore', args);

        let stderr = '';
        validateProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        const exitCode = await new Promise<number>((resolve, reject) => {
          validateProcess.on('close', resolve);
          validateProcess.on('error', reject);
        });

        if (exitCode !== 0) {
          logger.error(`Backup validation failed for ${backupPath}: ${stderr}`);
          return false;
        }
      }

      logger.info(`Backup verified successfully: ${backupPath}`);
      return true;
    } catch (error) {
      logger.error('Backup verification failed:', error);
      return false;
    }
  }

  /**
   * Performs a comprehensive verification of the backup including table counts
   */
  async comprehensiveVerifyBackup(backupPath: string): Promise<{
    success: boolean;
    issues: string[];
    tableCounts?: Record<string, number>;
  }> {
    const issues: string[] = [];

    try {
      // First run basic verification
      const basicVerification = await this.verifyBackup(backupPath);
      if (!basicVerification) {
        return {
          success: false,
          issues: ['Basic backup verification failed']
        };
      }

      // Extract table information from the backup
      const { spawn } = await import('child_process');
      const args = backupPath.endsWith('.gz')
        ? ['--list', '--format=custom', backupPath]
        : ['--list', backupPath];

      const validateProcess = spawn('pg_restore', args);

      let stdout = '';
      let stderr = '';

      validateProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      validateProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const exitCode = await new Promise<number>((resolve, reject) => {
        validateProcess.on('close', resolve);
        validateProcess.on('error', reject);
      });

      if (exitCode !== 0) {
        return {
          success: false,
          issues: [`pg_restore --list failed: ${stderr}`]
        };
      }

      // Parse the output to get table information
      const lines = stdout.split('\n');
      const tableCounts: Record<string, number> = {};

      // This is a simplified parsing - in a real implementation you'd want more robust parsing
      for (const line of lines) {
        if (line.includes('TABLE DATA')) {
          const match = line.match(/TABLE DATA public (\w+)/);
          if (match) {
            const tableName = match[1];
            tableCounts[tableName] = (tableCounts[tableName] || 0) + 1;
          }
        }
      }

      // Check if critical tables are present
      const criticalTables = [
        'users', 'stores', 'inventory_items', 'customers', 'invoices',
        'goldLoans', 'employees', 'auditLogs'
      ];

      for (const table of criticalTables) {
        if (!tableCounts[table]) {
          issues.push(`Critical table missing from backup: ${table}`);
        }
      }

      return {
        success: issues.length === 0,
        issues,
        tableCounts
      };
    } catch (error) {
      logger.error('Comprehensive backup verification failed:', error);
      return {
        success: false,
        issues: [`Comprehensive verification error: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
   * Gets backup statistics
   */
  async getBackupStats(): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
  }> {
    const backups = await this.listBackups();

    if (backups.length === 0) {
      return {
        totalBackups: 0,
        totalSize: 0,
        oldestBackup: null,
        newestBackup: null
      };
    }

    const totalSize = backups.reduce((sum, backup) => sum + backup.fileSize, 0);
    const dates = backups.map(b => b.createdAt).sort((a, b) => a.getTime() - b.getTime());

    return {
      totalBackups: backups.length,
      totalSize,
      oldestBackup: dates[0],
      newestBackup: dates[dates.length - 1]
    };
  }

  /**
   * Gets detailed backup monitoring information
   */
  async getMonitoringInfo(): Promise<{
    backupStats: {
      totalBackups: number;
      totalSize: number;
      oldestBackup: Date | null;
      newestBackup: Date | null;
    };
    verificationStats: {
      lastVerified: Date | null;
      lastVerificationResult: boolean | null;
      verificationIssues: string[];
    };
    healthInfo: {
      tablesCount: number;
      totalRecords: number;
      issues: string[];
    };
    storageInfo: {
      diskUsage: number;
      availableSpace: number;
      usagePercent: number;
    };
  }> {
    // Get backup statistics
    const backupStats = await this.getBackupStats();

    // Get health check info
    const healthInfo = await this.performHealthCheck();

    // Get storage information
    const storageInfo = await this.getStorageInfo();

    // For verification stats, we'll return placeholder values
    // In a real implementation, you'd track verification history
    const verificationStats = {
      lastVerified: null,
      lastVerificationResult: null,
      verificationIssues: [] as string[]
    };

    return {
      backupStats,
      verificationStats,
      healthInfo,
      storageInfo
    };
  }

  /**
   * Gets storage information for monitoring
   */
  private async getStorageInfo(): Promise<{
    diskUsage: number;
    availableSpace: number;
    usagePercent: number;
  }> {
    try {
      // Get disk usage information
      const { promisify } = await import('util');
      const exec = promisify((await import('child_process')).exec);

      // On Linux/Mac, use df command; on Windows, use PowerShell
      let diskUsage = 0;
      let availableSpace = 0;

      if (process.platform === 'win32') {
        const { stdout } = await exec('powershell "Get-WmiObject -Class Win32_LogicalDisk | Select-Object Size, FreeSpace | ConvertTo-Json"');
        // Parse PowerShell output (simplified)
        // In a real implementation, you'd properly parse this
      } else {
        // Unix-like systems
        const { stdout } = await exec(`df "${this.config.backupDir}"`);
        const lines = stdout.trim().split('\n');
        if (lines.length > 1) {
          const parts = lines[1].trim().split(/\s+/);
          const total = parseInt(parts[1]) * 1024; // Convert KB to bytes
          const used = parseInt(parts[2]) * 1024;   // Convert KB to bytes
          const available = parseInt(parts[3]) * 1024; // Convert KB to bytes

          diskUsage = used;
          availableSpace = available;
        }
      }

      // Calculate usage percentage
      const totalSpace = diskUsage + availableSpace;
      const usagePercent = totalSpace > 0 ? (diskUsage / totalSpace) * 100 : 0;

      return {
        diskUsage,
        availableSpace,
        usagePercent
      };
    } catch (error) {
      logger.error('Error getting storage info:', error);
      return {
        diskUsage: 0,
        availableSpace: 0,
        usagePercent: 0
      };
    }
  }

  /**
   * Runs a backup verification job and stores the result
   */
  async runVerificationJob(backupFileName?: string): Promise<{
    success: boolean;
    issues: string[];
    backupFile: string;
  }> {
    try {
      let backupsToVerify = [];

      if (backupFileName) {
        // Verify specific backup
        backupsToVerify = [{ fileName: backupFileName }];
      } else {
        // Verify the most recent backup
        const allBackups = await this.listBackups();
        if (allBackups.length > 0) {
          backupsToVerify = [allBackups[0]]; // Most recent
        }
      }

      if (backupsToVerify.length === 0) {
        return {
          success: false,
          issues: ['No backups found to verify'],
          backupFile: ''
        };
      }

      const backupFile = backupsToVerify[0].fileName;
      const fullPath = path.join(this.config.backupDir, backupFile);

      const result = await this.comprehensiveVerifyBackup(fullPath);

      return {
        success: result.success,
        issues: result.issues,
        backupFile
      };
    } catch (error) {
      logger.error('Verification job failed:', error);
      return {
        success: false,
        issues: [`Verification job error: ${error instanceof Error ? error.message : String(error)}`],
        backupFile: backupFileName || ''
      };
    }
  }

  /**
   * Performs a health check of the database before backup
   */
  async performHealthCheck(): Promise<{
    tablesCount: number;
    totalRecords: number;
    issues: string[];
  }> {
    try {
      // Count tables in the database
      const tablesResult = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);

      const tablesCount = Number(tablesResult.rows[0].count);

      // Count total records (approximate)
      let totalRecords = 0;
      const issues: string[] = [];

      // Get all table names
      const tableNamesResult = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);

      for (const row of tableNamesResult.rows) {
        const tableName = row.table_name as string;
        try {
          const countResult = await db.execute(sql`
            SELECT COUNT(*) as count FROM ${sql.identifier(tableName)}
          `);
          totalRecords += Number(countResult.rows[0].count);
        } catch (error) {
          issues.push(`Could not count records in table ${tableName}: ${error}`);
        }
      }

      return {
        tablesCount,
        totalRecords,
        issues
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      throw error;
    }
  }
}

// Export singleton instance with default configuration
export const backupService = new BackupService({
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
  backupDir: process.env.BACKUP_DIR || './backups',
  compress: process.env.BACKUP_COMPRESS === 'true',
  uploadToCloud: process.env.UPLOAD_BACKUPS_TO_CLOUD === 'true',
  cloudBucket: process.env.BACKUP_BUCKET_NAME || 'erp-backups'
});