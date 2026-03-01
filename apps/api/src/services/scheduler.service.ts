import cron, { ScheduledTask } from 'node-cron';
import { eq, lte } from 'drizzle-orm';
import { db } from '../config/database.js';
import { stores, activitySummaries, auditLogs } from '../db/schema.js';
import { dailyBriefingService } from './daily-briefing.service.js';
import { emailService } from './email.service.js';
import { wishlistService } from './wishlist.service.js';
import { buyingHabitsService } from './buying-habits.service.js';
import { leadService } from './lead.service.js';
import { stockValuationService } from './stock-valuation.service.js';
import { goldPawningService } from './gold-pawning.service.js';
import { loanNotificationService } from './loan-notification.service.js';
import {
  exportTransactions,
  exportActiveInventory,
  exportActiveLoans,
  exportDailySummary,
  exportMetalPosition,
  generateExcelFile,
  uploadToMinIO,
  sheetsToRows,
} from './excel-export.service.js';
import { googleSheetsExportService } from './google-sheets-export.service.js';
import { logger } from '../utils/logger.js';

export class SchedulerService {
  private jobs: Map<string, ScheduledTask> = new Map();

  /**
   * Initialize all scheduled jobs
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing scheduler service...');

      // Daily briefing at 8:00 AM every day
      this.scheduleDailyBriefings();

      // Process pending emails every 5 minutes
      this.schedulePendingEmailProcessor();

      // Clean up old logs monthly (1st of every month at 2 AM)
      this.scheduleLogCleanup();

      // CRM Jobs
      // Expire old wishlists daily at midnight
      this.scheduleWishlistExpiration();

      // Recalculate buying habits weekly (Sundays at 3 AM)
      this.scheduleBuyingHabitsRecalculation();

      // Check for lead follow-ups daily at 9 AM
      this.scheduleLeadFollowUpReminders();

      // Nightly inventory valuation at 1 AM
      this.scheduleNightlyValuation();

      // Gold Pawning Jobs
      // Daily LTV recalculation at 6 AM
      this.scheduleDailyLtvRecalculation();

      // Daily interest accrual at 2 AM
      this.scheduleDailyInterestAccrual();

      // Margin call checks every 4 hours
      this.scheduleMarginCallChecks();

      // Maturity and payment reminders at 9:30 AM
      this.scheduleLoanReminders();

      // Daily Excel snapshots at 7:00 PM
      this.scheduleDailyExcelSnapshots();

      logger.info('Scheduler service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize scheduler service', { error });
      throw error;
    }
  }

  /**
   * Schedule daily briefing emails
   * Runs at 8:00 AM every day
   */
  private scheduleDailyBriefings(): void {
    const task = cron.schedule(
      '0 8 * * *',
      async () => {
        try {
          logger.info('Running scheduled daily briefings');

          // Get all active stores
          const activeStores = await db.query.stores.findMany({
            where: eq(stores.isActive, true),
          });

          // Send briefing for each store
          for (const store of activeStores) {
            try {
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);

              await dailyBriefingService.sendDailyBriefing(store.id, yesterday);
              logger.info('Daily briefing sent', { storeId: store.id, storeName: store.name });
            } catch (error) {
              logger.error('Failed to send daily briefing for store', {
                error,
                storeId: store.id,
                storeName: store.name,
              });
            }
          }

          logger.info('Completed scheduled daily briefings');
        } catch (error) {
          logger.error('Error in daily briefings job', { error });
        }
      },
      {
        timezone: 'Asia/Colombo', // Sri Lankan timezone
      }
    );

    task.start();

    this.jobs.set('daily-briefings', task);
    logger.info('Scheduled daily briefings job (8:00 AM daily)');
  }

  /**
   * Process pending scheduled emails
   * Runs every 5 minutes
   */
  private schedulePendingEmailProcessor(): void {
    const task = cron.schedule(
      '*/5 * * * *',
      async () => {
        try {
          await emailService.processPendingEmails();
        } catch (error) {
          logger.error('Error in pending email processor job', { error });
        }
      },
      {
        timezone: 'Asia/Colombo',
      }
    );

    task.start();

    this.jobs.set('pending-emails', task);
    logger.info('Scheduled pending email processor (every 5 minutes)');
  }

  /**
   * Clean up old activity logs and audit logs
   * Runs on 1st of every month at 2 AM
   */
  private scheduleLogCleanup(): void {
    const task = cron.schedule(
      '0 2 1 * *',
      async () => {
        try {
          logger.info('Running scheduled log cleanup');

          // Delete activity summaries older than 90 days
          const ninetyDaysAgo = new Date();
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

          await db
            .delete(activitySummaries)
            .where(lte(activitySummaries.createdAt, ninetyDaysAgo));

          // Delete audit logs older than 180 days
          const oneEightyDaysAgo = new Date();
          oneEightyDaysAgo.setDate(oneEightyDaysAgo.getDate() - 180);

          await db
            .delete(auditLogs)
            .where(lte(auditLogs.createdAt, oneEightyDaysAgo));

          logger.info('Log cleanup completed');
        } catch (error) {
          logger.error('Error in log cleanup job', { error });
        }
      },
      {
        timezone: 'Asia/Colombo',
      }
    );

    task.start();

    this.jobs.set('log-cleanup', task);
    logger.info('Scheduled log cleanup job (monthly on 1st at 2:00 AM)');
  }

  /**
   * Manually trigger daily briefing for a specific store
   */
  async triggerDailyBriefing(storeId: string, date?: Date): Promise<void> {
    const targetDate = date || new Date();
    targetDate.setDate(targetDate.getDate() - 1); // Yesterday by default

    await dailyBriefingService.sendDailyBriefing(storeId, targetDate);
  }

  /**
   * Stop all scheduled jobs
   */
  stopAll(): void {
    this.jobs.forEach((task, name) => {
      task.stop();
      logger.info('Stopped scheduled job', { jobName: name });
    });
    this.jobs.clear();
  }

  /**
   * Get status of all scheduled jobs
   */
  getStatus() {
    return Array.from(this.jobs.entries()).map(([name, task]) => ({
      name,
      running: task.getStatus() === 'scheduled',
    }));
  }

  // ============================================================================
  // CRM SCHEDULED JOBS
  // ============================================================================

  /**
   * Expire old wishlists
   * Runs daily at midnight
   */
  private scheduleWishlistExpiration(): void {
    const task = cron.schedule(
      '0 0 * * *',
      async () => {
        try {
          logger.info('Running scheduled wishlist expiration');
          const expiredCount = await wishlistService.expireOldWishlists();
          logger.info('Wishlist expiration completed', { expiredCount });
        } catch (error) {
          logger.error('Error in wishlist expiration job', { error });
        }
      },
      {
        timezone: 'Asia/Colombo',
      }
    );

    task.start();
    this.jobs.set('wishlist-expiration', task);
    logger.info('Scheduled wishlist expiration job (daily at midnight)');
  }

  /**
   * Recalculate buying habits and RFM scores
   * Runs weekly on Sundays at 3 AM
   */
  private scheduleBuyingHabitsRecalculation(): void {
    const task = cron.schedule(
      '0 3 * * 0',
      async () => {
        try {
          logger.info('Running scheduled buying habits recalculation');

          // Get all active stores
          const activeStores = await db.query.stores.findMany({
            where: eq(stores.isActive, true),
          });

          for (const store of activeStores) {
            try {
              await buyingHabitsService.recalculateAllCustomers(store.id);
              logger.info('Buying habits recalculated', { storeId: store.id });
            } catch (error) {
              logger.error('Failed to recalculate buying habits for store', {
                error,
                storeId: store.id,
              });
            }
          }

          logger.info('Buying habits recalculation completed');
        } catch (error) {
          logger.error('Error in buying habits recalculation job', { error });
        }
      },
      {
        timezone: 'Asia/Colombo',
      }
    );

    task.start();
    this.jobs.set('buying-habits-recalculation', task);
    logger.info('Scheduled buying habits recalculation job (Sundays at 3 AM)');
  }

  /**
   * Check for overdue lead follow-ups
   * Runs daily at 9 AM
   */
  private scheduleLeadFollowUpReminders(): void {
    const task = cron.schedule(
      '0 9 * * *',
      async () => {
        try {
          logger.info('Running scheduled lead follow-up check');

          // Get all active stores
          const activeStores = await db.query.stores.findMany({
            where: eq(stores.isActive, true),
          });

          let totalOverdue = 0;

          for (const store of activeStores) {
            try {
              const overdueLeads = await leadService.getLeadsNeedingFollowUp(store.id);
              totalOverdue += overdueLeads.length;

              if (overdueLeads.length > 0) {
                logger.info('Overdue lead follow-ups found', {
                  storeId: store.id,
                  count: overdueLeads.length,
                });
                // Could send notification to store managers here
              }
            } catch (error) {
              logger.error('Failed to check lead follow-ups for store', {
                error,
                storeId: store.id,
              });
            }
          }

          logger.info('Lead follow-up check completed', { totalOverdue });
        } catch (error) {
          logger.error('Error in lead follow-up check job', { error });
        }
      },
      {
        timezone: 'Asia/Colombo',
      }
    );

    task.start();
    this.jobs.set('lead-followup-check', task);
    logger.info('Scheduled lead follow-up check job (daily at 9 AM)');
  }

  /**
   * Manually trigger buying habits recalculation for a store
   */
  async triggerBuyingHabitsRecalculation(storeId: string): Promise<void> {
    await buyingHabitsService.recalculateAllCustomers(storeId);
  }

  // ============================================================================
  // STOCK VALUATION JOBS
  // ============================================================================

  /**
   * Nightly inventory revaluation (Mark-to-Market)
   * Runs daily at 1 AM
   */
  private scheduleNightlyValuation(): void {
    const task = cron.schedule(
      '0 1 * * *',
      async () => {
        try {
          logger.info('Running scheduled nightly inventory valuation');

          const reports = await stockValuationService.revalueAllStores();

          let totalItemsRevalued = 0;
          let totalGainLoss = 0;

          for (const report of reports) {
            totalItemsRevalued += report.itemsRevalued;
            totalGainLoss += report.totalUnrealizedGainLoss;

            logger.info('Store valuation completed', {
              storeId: report.storeId,
              storeName: report.storeName,
              itemsRevalued: report.itemsRevalued,
              unrealizedGainLoss: report.totalUnrealizedGainLoss,
            });

            // Alert if significant loss (> 5% of inventory value)
            if (report.gainLossPercentage < -5) {
              logger.warn('Significant unrealized loss detected', {
                storeId: report.storeId,
                storeName: report.storeName,
                lossPercentage: report.gainLossPercentage,
                lossAmount: report.totalUnrealizedGainLoss,
              });
            }
          }

          logger.info('Nightly inventory valuation completed', {
            storesProcessed: reports.length,
            totalItemsRevalued,
            totalUnrealizedGainLoss: totalGainLoss,
          });
        } catch (error) {
          logger.error('Error in nightly valuation job', { error });
        }
      },
      {
        timezone: 'Asia/Colombo',
      }
    );

    task.start();
    this.jobs.set('nightly-valuation', task);
    logger.info('Scheduled nightly inventory valuation job (daily at 1 AM)');
  }

  /**
   * Manually trigger inventory valuation for a store
   */
  async triggerInventoryValuation(storeId: string): Promise<any> {
    return await stockValuationService.revalueInventory(storeId);
  }

  /**
   * Manually trigger inventory valuation for all stores
   */
  async triggerAllStoresValuation(): Promise<any[]> {
    return await stockValuationService.revalueAllStores();
  }
  // ============================================================================
  // GOLD PAWNING SCHEDULED JOBS
  // ============================================================================

  /**
   * Daily LTV recalculation for all active loans
   * Runs daily at 6 AM - recalculates LTV based on latest gold rates
   */
  private scheduleDailyLtvRecalculation(): void {
    const task = cron.schedule(
      '0 6 * * *',
      async () => {
        try {
          logger.info('Running scheduled daily LTV recalculation');

          const activeStores = await db.query.stores.findMany({
            where: eq(stores.isActive, true),
          });

          let totalChecked = 0;
          let totalCallsCreated = 0;

          for (const store of activeStores) {
            try {
              // checkMarginCalls internally recalculates LTV for each loan
              const result = await goldPawningService.checkMarginCalls(store.id);
              totalChecked += result.checked;
              totalCallsCreated += result.callsCreated;

              logger.info('Store LTV recalculation completed', {
                storeId: store.id,
                storeName: store.name,
                checked: result.checked,
                callsCreated: result.callsCreated,
              });
            } catch (error) {
              logger.error('Failed LTV recalculation for store', {
                error,
                storeId: store.id,
              });
            }
          }

          logger.info('Daily LTV recalculation completed', {
            totalChecked,
            totalCallsCreated,
          });
        } catch (error) {
          logger.error('Error in daily LTV recalculation job', { error });
        }
      },
      {
        timezone: 'Asia/Colombo',
      }
    );

    task.start();
    this.jobs.set('daily-ltv-recalculation', task);
    logger.info('Scheduled daily LTV recalculation job (6:00 AM daily)');
  }

  /**
   * Daily interest accrual for all active gold loans
   * Runs daily at 2 AM
   */
  private scheduleDailyInterestAccrual(): void {
    const task = cron.schedule(
      '0 2 * * *',
      async () => {
        try {
          logger.info('Running scheduled daily interest accrual');

          const activeStores = await db.query.stores.findMany({
            where: eq(stores.isActive, true),
          });

          let totalProcessed = 0;
          let totalErrors = 0;

          for (const store of activeStores) {
            try {
              const result = await goldPawningService.accrueInterestForAllLoans(store.id);
              totalProcessed += result.processed;
              totalErrors += result.errors;

              logger.info('Store interest accrual completed', {
                storeId: store.id,
                storeName: store.name,
                processed: result.processed,
                errors: result.errors,
              });
            } catch (error) {
              logger.error('Failed interest accrual for store', {
                error,
                storeId: store.id,
              });
            }
          }

          logger.info('Daily interest accrual completed', {
            totalProcessed,
            totalErrors,
          });
        } catch (error) {
          logger.error('Error in daily interest accrual job', { error });
        }
      },
      {
        timezone: 'Asia/Colombo',
      }
    );

    task.start();
    this.jobs.set('daily-interest-accrual', task);
    logger.info('Scheduled daily interest accrual job (2:00 AM daily)');
  }

  /**
   * Margin call checks every 4 hours
   * Checks for LTV breaches and creates margin calls
   */
  private scheduleMarginCallChecks(): void {
    const task = cron.schedule(
      '0 */4 * * *',
      async () => {
        try {
          logger.info('Running scheduled margin call checks');

          const activeStores = await db.query.stores.findMany({
            where: eq(stores.isActive, true),
          });

          let totalChecked = 0;
          let totalCallsCreated = 0;

          for (const store of activeStores) {
            try {
              const result = await goldPawningService.checkMarginCalls(store.id);
              totalChecked += result.checked;
              totalCallsCreated += result.callsCreated;

              if (result.callsCreated > 0) {
                logger.warn('New margin calls created', {
                  storeId: store.id,
                  storeName: store.name,
                  callsCreated: result.callsCreated,
                });
              }
            } catch (error) {
              logger.error('Failed margin call check for store', {
                error,
                storeId: store.id,
              });
            }
          }

          logger.info('Margin call checks completed', {
            totalChecked,
            totalCallsCreated,
          });
        } catch (error) {
          logger.error('Error in margin call checks job', { error });
        }
      },
      {
        timezone: 'Asia/Colombo',
      }
    );

    task.start();
    this.jobs.set('margin-call-checks', task);
    logger.info('Scheduled margin call checks job (every 4 hours)');
  }

  /**
   * Send loan maturity and payment reminders
   * Runs daily at 9:30 AM
   */
  private scheduleLoanReminders(): void {
    const task = cron.schedule(
      '30 9 * * *',
      async () => {
        try {
          logger.info('Running scheduled loan reminders');

          const activeStores = await db.query.stores.findMany({
            where: eq(stores.isActive, true),
          });

          for (const store of activeStores) {
            try {
              // Send maturity reminders for loans maturing in 7 days
              const maturingLoans = await goldPawningService.getMaturingLoans(store.id, 7);
              for (const loan of maturingLoans) {
                try {
                  await loanNotificationService.sendMaturityReminder(loan.loan.id);
                } catch (err) {
                  logger.error('Failed to send maturity reminder', {
                    loanId: loan.loan.id,
                    error: err,
                  });
                }
              }

              // Send overdue payment reminders
              const overdueLoans = await goldPawningService.getOverdueLoans(store.id);
              for (const loan of overdueLoans) {
                try {
                  await loanNotificationService.sendPaymentReminder(loan.loan.id);
                } catch (err) {
                  logger.error('Failed to send overdue reminder', {
                    loanId: loan.loan.id,
                    error: err,
                  });
                }
              }

              logger.info('Loan reminders sent for store', {
                storeId: store.id,
                maturing: maturingLoans.length,
                overdue: overdueLoans.length,
              });
            } catch (error) {
              logger.error('Failed to send loan reminders for store', {
                error,
                storeId: store.id,
              });
            }
          }

          logger.info('Loan reminders completed');
        } catch (error) {
          logger.error('Error in loan reminders job', { error });
        }
      },
      {
        timezone: 'Asia/Colombo',
      }
    );

    task.start();
    this.jobs.set('loan-reminders', task);
    logger.info('Scheduled loan reminders job (9:30 AM daily)');
  }
  // ============================================================================
  // DAILY EXCEL SNAPSHOT JOBS
  // ============================================================================

  /**
   * Schedule daily Excel snapshot generation
   * Runs at 7:00 PM (19:00) Asia/Colombo time
   */
  private scheduleDailyExcelSnapshots(): void {
    const task = cron.schedule(
      '0 19 * * *',
      async () => {
        try {
          logger.info('Running scheduled daily Excel snapshot generation');
          const files = await this.generateDailyExcelSnapshots();
          logger.info('Daily Excel snapshot generation completed', {
            filesGenerated: files.length,
            files,
          });
        } catch (error) {
          logger.error('Error in daily Excel snapshot job', { error });
          // Never crash — this is a supplementary backup
        }
      },
      {
        timezone: 'Asia/Colombo',
      }
    );

    task.start();
    this.jobs.set('daily-excel-snapshots', task);
    logger.info('Scheduled daily Excel snapshot job (7:00 PM daily)');
  }

  /**
   * Generate daily Excel snapshots for all stores.
   * Creates per-store + aggregate workbooks, uploads to MinIO,
   * pushes to Google Sheets, and optionally sends email notification.
   *
   * Can be triggered manually for any date.
   *
   * @param date - Target date (defaults to today)
   * @returns Array of uploaded file paths
   */
  async generateDailyExcelSnapshots(date?: Date): Promise<string[]> {
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const dateLabelForSheets = [
      String(targetDate.getDate()).padStart(2, '0'),
      String(targetDate.getMonth() + 1).padStart(2, '0'),
      String(targetDate.getFullYear()),
    ].join('-'); // DD-MM-YYYY

    const uploadedFiles: string[] = [];
    const allSheets: any[] = [];

    logger.info('Starting daily Excel snapshot generation', { date: dateStr });

    // Get all active stores
    const activeStores = await db.query.stores.findMany({
      where: eq(stores.isActive, true),
    });

    // --- Per-Store Reports ---
    for (const store of activeStores) {
      try {
        // 1. Transactions (today + last 7 days)
        const sevenDaysAgo = new Date(targetDate);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const txSheets = await exportTransactions(store.id, sevenDaysAgo, targetDate);
        const txFile = await generateExcelFile(
          txSheets,
          `mari_erp_transactions_${store.code}_${dateStr}.xlsx`
        );
        const txKey = await uploadToMinIO(txFile.filePath);
        if (txKey) uploadedFiles.push(txKey);
        allSheets.push(...txSheets);

        // 2. Active Inventory
        const invSheets = await exportActiveInventory(store.id);
        const invFile = await generateExcelFile(
          invSheets,
          `mari_erp_inventory_active_${store.code}_${dateStr}.xlsx`
        );
        const invKey = await uploadToMinIO(invFile.filePath);
        if (invKey) uploadedFiles.push(invKey);
        allSheets.push(...invSheets);

        // 3. Active Gold Loans
        const loanSheets = await exportActiveLoans(store.id);
        const loanFile = await generateExcelFile(
          loanSheets,
          `mari_erp_gold_loans_active_${store.code}_${dateStr}.xlsx`
        );
        const loanKey = await uploadToMinIO(loanFile.filePath);
        if (loanKey) uploadedFiles.push(loanKey);
        allSheets.push(...loanSheets);

        logger.info('Store Excel snapshots generated', {
          storeId: store.id,
          storeCode: store.code,
          files: 3,
        });
      } catch (storeError) {
        logger.error('Failed to generate Excel snapshots for store', {
          error: storeError,
          storeId: store.id,
          storeCode: store.code,
        });
        // Continue with other stores
      }
    }

    // --- Aggregate Reports (Daily Summary + Metal Position) ---
    try {
      const aggregateSheets: any[] = [];

      // Daily Summary for each store
      for (const store of activeStores) {
        try {
          const summarySheets = await exportDailySummary(store.id, targetDate);
          // Prefix sheet name with store code
          summarySheets.forEach(
            (s: any) => (s.sheetName = `${store.code}_Summary`.substring(0, 31))
          );
          aggregateSheets.push(...summarySheets);
        } catch {
          logger.warn(`Failed daily summary for store ${store.code}`);
        }
      }

      // Metal Position (all stores)
      try {
        const metalSheets = await exportMetalPosition();
        aggregateSheets.push(...metalSheets);
      } catch {
        logger.warn('Failed to export metal position');
      }

      if (aggregateSheets.length > 0) {
        const aggFile = await generateExcelFile(
          aggregateSheets,
          `mari_erp_aggregate_${dateStr}.xlsx`
        );
        const aggKey = await uploadToMinIO(aggFile.filePath);
        if (aggKey) uploadedFiles.push(aggKey);
        allSheets.push(...aggregateSheets);
      }
    } catch (aggError) {
      logger.error('Failed to generate aggregate snapshot', { error: aggError });
    }

    // --- Google Sheets Push ---
    try {
      const sheetsResult = await googleSheetsExportService.pushToSheets(
        allSheets,
        dateLabelForSheets
      );
      if (sheetsResult.success) {
        logger.info('Google Sheets updated', {
          sheetsUpdated: sheetsResult.sheetsUpdated.length,
        });
      }
    } catch (sheetsError) {
      logger.warn('Google Sheets push failed (non-critical)', { error: sheetsError });
    }

    // --- Optional Email Notification ---
    try {
      const { emailService } = await import('./email.service.js');
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail && activeStores.length > 0) {
        await emailService.sendEmail({
          storeId: activeStores[0].id,
          recipients: [adminEmail],
          subject: `MARI ERP Daily Snapshots — ${dateLabelForSheets}`,
          htmlContent: `
            <h2>Daily Excel Snapshots Generated</h2>
            <p><strong>Date:</strong> ${dateLabelForSheets}</p>
            <p><strong>Files generated:</strong> ${uploadedFiles.length}</p>
            <ul>${uploadedFiles.map((f) => `<li>${f}</li>`).join('')}</ul>
            <p>Files are saved locally in <code>./daily-snapshots/${dateLabelForSheets}/</code> and uploaded to MinIO bucket <code>daily-snapshots</code>.</p>
          `,
          notificationType: 'notification',
        });
      }
    } catch (emailError) {
      logger.warn('Email notification failed (non-critical)', { error: emailError });
    }

    logger.info('Daily Excel snapshot generation complete', {
      totalFiles: uploadedFiles.length,
      date: dateStr,
    });

    return uploadedFiles;
  }
}

export const schedulerService = new SchedulerService();
