import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { backupService } from '../../services/backup.service.js';
import { restoreService } from '../../services/restore.service.js';
import { logger } from '../../utils/logger.js';

export class BackupController {
  /**
   * Creates a new backup
   */
  async createBackup(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { backupType = 'full', tables } = req.body;
      
      if (req.user?.role !== 'super_admin' && req.user?.role !== 'store_manager') {
        res.status(403).json({ error: 'Insufficient permissions to create backups' });
        return;
      }

      let result;
      if (backupType === 'partial' && Array.isArray(tables)) {
        result = await backupService.createPartialBackup(tables);
      } else {
        result = await backupService.createBackup(backupType);
      }

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Backup created successfully',
          data: {
            filePath: result.filePath,
            fileSize: result.fileSize,
            timestamp: result.timestamp
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          message: 'Backup creation failed'
        });
      }
    } catch (error) {
      logger.error('Error creating backup:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  /**
   * Lists available backups
   */
  async listBackups(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (req.user?.role !== 'super_admin' && req.user?.role !== 'store_manager') {
        res.status(403).json({ error: 'Insufficient permissions to view backups' });
        return;
      }

      const backups = await backupService.listBackups();
      
      res.status(200).json({
        success: true,
        data: backups
      });
    } catch (error) {
      logger.error('Error listing backups:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  /**
   * Gets backup statistics
   */
  async getBackupStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (req.user?.role !== 'super_admin' && req.user?.role !== 'store_manager') {
        res.status(403).json({ error: 'Insufficient permissions to view backup stats' });
        return;
      }

      const stats = await backupService.getBackupStats();
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error getting backup stats:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  /**
   * Performs a health check before backup
   */
  async performHealthCheck(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (req.user?.role !== 'super_admin' && req.user?.role !== 'store_manager') {
        res.status(403).json({ error: 'Insufficient permissions to perform health check' });
        return;
      }

      const health = await backupService.performHealthCheck();
      
      res.status(200).json({
        success: true,
        data: health
      });
    } catch (error) {
      logger.error('Error performing health check:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  /**
   * Cleans up old backups based on retention policy
   */
  async cleanupOldBackups(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (req.user?.role !== 'super_admin') {
        res.status(403).json({ error: 'Insufficient permissions to cleanup backups' });
        return;
      }

      await backupService.cleanupOldBackups();
      
      res.status(200).json({
        success: true,
        message: 'Old backups cleaned up successfully'
      });
    } catch (error) {
      logger.error('Error cleaning up backups:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  /**
   * Restores database from a backup
   */
  async restoreFromBackup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (req.user?.role !== 'super_admin') {
        res.status(403).json({ error: 'Insufficient permissions to perform restoration' });
        return;
      }

      const { backupFileName, dryRun = false } = req.body;

      if (!backupFileName) {
        res.status(400).json({
          success: false,
          error: 'Backup file name is required'
        });
        return;
      }

      if (dryRun) {
        // Perform a dry run of the restore
        const result = await restoreService.dryRunRestore(backupFileName);
        res.status(result.success ? 200 : 500).json(result);
      } else {
        // Perform actual restore
        const result = await restoreService.restoreFromBackup(backupFileName, dryRun);
        res.status(result.success ? 200 : 500).json(result);
      }
    } catch (error) {
      logger.error('Error during restore operation:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  /**
   * Gets information about a specific backup file
   */
  async getBackupInfo(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (req.user?.role !== 'super_admin' && req.user?.role !== 'store_manager') {
        res.status(403).json({ error: 'Insufficient permissions to view backup info' });
        return;
      }

      const backupFileName = req.query.backupFileName;

      if (!backupFileName) {
        res.status(400).json({
          success: false,
          error: 'Backup file name is required'
        });
        return;
      }

      const fileName = typeof backupFileName === 'string' ? backupFileName : backupFileName[0];
      
      const info = await restoreService.getBackupFileInfo(fileName);
      
      if (!info) {
        res.status(404).json({
          success: false,
          error: 'Backup file not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: info
      });
    } catch (error) {
      logger.error('Error getting backup info:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }
}

export const backupController = new BackupController();