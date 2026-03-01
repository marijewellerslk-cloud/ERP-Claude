import cron from 'node-cron';
import { backupService } from '../../services/backup.service.js';
import { logger } from '../../utils/logger.js';

export class BackupSchedulerService {
  private dailyBackupJob: cron.ScheduledTask | null = null;
  private weeklyBackupJob: cron.ScheduledTask | null = null;
  private cleanupJob: cron.ScheduledTask | null = null;

  /**
   * Initializes the backup scheduler
   */
  async initialize(): Promise<void> {
    // Schedule daily backup at 2 AM
    this.dailyBackupJob = cron.schedule(process.env.DAILY_BACKUP_TIME || '0 2 * * *', async () => {
      logger.info('Starting scheduled daily backup...');
      try {
        const result = await backupService.createBackup('daily');
        if (result.success) {
          logger.info('Daily backup completed successfully');
        } else {
          logger.error('Daily backup failed:', result.error);
        }
      } catch (error) {
        logger.error('Error during scheduled daily backup:', error);
      }
    });

    // Schedule weekly backup on Sundays at 3 AM
    this.weeklyBackupJob = cron.schedule(process.env.WEEKLY_BACKUP_TIME || '0 3 * * 0', async () => {
      logger.info('Starting scheduled weekly backup...');
      try {
        const result = await backupService.createBackup('weekly');
        if (result.success) {
          logger.info('Weekly backup completed successfully');
        } else {
          logger.error('Weekly backup failed:', result.error);
        }
      } catch (error) {
        logger.error('Error during scheduled weekly backup:', error);
      }
    });

    // Schedule cleanup job to run daily at 4 AM
    this.cleanupJob = cron.schedule(process.env.CLEANUP_JOB_TIME || '0 4 * * *', async () => {
      logger.info('Starting scheduled backup cleanup...');
      try {
        await backupService.cleanupOldBackups();
        logger.info('Backup cleanup completed successfully');
      } catch (error) {
        logger.error('Error during scheduled backup cleanup:', error);
      }
    });

    logger.info('Backup scheduler initialized');
  }

  /**
   * Starts the backup scheduler
   */
  start(): void {
    if (this.dailyBackupJob) this.dailyBackupJob.start();
    if (this.weeklyBackupJob) this.weeklyBackupJob.start();
    if (this.cleanupJob) this.cleanupJob.start();
    
    logger.info('Backup scheduler started');
  }

  /**
   * Stops the backup scheduler
   */
  stop(): void {
    if (this.dailyBackupJob) this.dailyBackupJob.stop();
    if (this.weeklyBackupJob) this.weeklyBackupJob.stop();
    if (this.cleanupJob) this.cleanupJob.stop();
    
    logger.info('Backup scheduler stopped');
  }

  /**
   * Manually triggers a backup
   */
  async triggerBackup(type: 'full' | 'daily' | 'weekly' | 'incremental'): Promise<boolean> {
    try {
      const result = await backupService.createBackup(type);
      return result.success;
    } catch (error) {
      logger.error('Error triggering manual backup:', error);
      return false;
    }
  }

  /**
   * Gets scheduler status
   */
  getStatus(): {
    dailyScheduled: boolean;
    weeklyScheduled: boolean;
    cleanupScheduled: boolean;
    dailyRunning: boolean;
    weeklyRunning: boolean;
    cleanupRunning: boolean;
  } {
    return {
      dailyScheduled: !!this.dailyBackupJob,
      weeklyScheduled: !!this.weeklyBackupJob,
      cleanupScheduled: !!this.cleanupJob,
      dailyRunning: this.dailyBackupJob?.isRunning() ?? false,
      weeklyRunning: this.weeklyBackupJob?.isRunning() ?? false,
      cleanupRunning: this.cleanupJob?.isRunning() ?? false,
    };
  }
}

export const backupSchedulerService = new BackupSchedulerService();