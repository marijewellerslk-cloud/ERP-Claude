import { db } from '../config/database.js';
import {
  loanNotifications,
  notificationTemplates,
  goldLoans,
  customers,
} from '../db/schema.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

interface NotificationTemplate {
  id: string;
  storeId: string | null;
  templateCode: string;
  templateName: string;
  channel: string;
  subject: string | null;
  bodyTemplate: string;
  variables: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface SendNotificationResult {
  id: string;
  loanId: string;
  customerId: string;
  notificationType: string;
  channel: string;
  content: string;
  status: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
}

interface BulkReminderResult {
  sent: number;
  failed: number;
  details: Array<{
    loanId: string;
    loanNumber: string;
    customerName: string;
    status: 'sent' | 'failed';
    error?: string;
  }>;
}

// ============================================================================
// SERVICE
// ============================================================================

export class LoanNotificationService {
  // --------------------------------------------------------------------------
  // Template Management
  // --------------------------------------------------------------------------

  /**
   * Get notification templates, optionally filtered by channel.
   */
  async getTemplates(channel?: string): Promise<NotificationTemplate[]> {
    try {
      const conditions = [eq(notificationTemplates.isActive, true)];

      if (channel) {
        conditions.push(eq(notificationTemplates.channel, channel));
      }

      const templates = await db
        .select()
        .from(notificationTemplates)
        .where(and(...conditions))
        .orderBy(notificationTemplates.templateCode);

      return templates;
    } catch (error) {
      logger.error('Failed to fetch notification templates', { error, channel });
      throw new Error('Failed to fetch notification templates');
    }
  }

  // --------------------------------------------------------------------------
  // Send Single Notification
  // --------------------------------------------------------------------------

  /**
   * Send a notification for a specific loan.
   *
   * Looks up the customer contact details from the loan record, fetches
   * the matching template (by notificationType + channel), replaces
   * template variables with actual loan data, and logs the notification
   * to the loan_notifications table with status='pending'.
   *
   * If `overrideContent` is provided, it is used instead of the rendered
   * template body.
   */
  async sendLoanNotification(
    loanId: string,
    notificationType: string,
    channel: string,
    overrideContent?: string
  ): Promise<SendNotificationResult> {
    try {
      // 1. Fetch the loan
      const [loan] = await db
        .select()
        .from(goldLoans)
        .where(eq(goldLoans.id, loanId))
        .limit(1);

      if (!loan) {
        throw new Error(`Loan not found: ${loanId}`);
      }

      // 2. Fetch the customer
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, loan.customerId))
        .limit(1);

      if (!customer) {
        throw new Error(`Customer not found for loan: ${loanId}`);
      }

      // 3. Determine the notification content
      let content: string;
      let templateId: string | null = null;

      if (overrideContent) {
        content = overrideContent;
      } else {
        // Look up matching template
        const [template] = await db
          .select()
          .from(notificationTemplates)
          .where(
            and(
              eq(notificationTemplates.templateCode, notificationType),
              eq(notificationTemplates.channel, channel),
              eq(notificationTemplates.isActive, true)
            )
          )
          .limit(1);

        if (!template) {
          throw new Error(
            `No active template found for type="${notificationType}" channel="${channel}"`
          );
        }

        templateId = template.id;

        // Build variable map from loan and customer data
        const variables = this.buildVariableMap(loan, customer);
        content = this.renderTemplate(template.bodyTemplate, variables);
      }

      // 4. Determine recipient details based on channel
      const recipientPhone =
        channel === 'whatsapp'
          ? customer.whatsapp || customer.phone
          : channel === 'sms'
            ? customer.phone
            : null;

      const recipientEmail = channel === 'email' ? customer.email : null;

      // 5. Log the notification with status='pending'
      const [notification] = await db
        .insert(loanNotifications)
        .values({
          loanId,
          customerId: customer.id,
          notificationType,
          channel,
          templateId,
          recipientPhone,
          recipientEmail,
          content,
          status: 'pending',
        })
        .returning();

      logger.info('Loan notification created', {
        notificationId: notification.id,
        loanId,
        notificationType,
        channel,
        recipientPhone,
        recipientEmail,
      });

      return {
        id: notification.id,
        loanId: notification.loanId,
        customerId: notification.customerId,
        notificationType: notification.notificationType,
        channel: notification.channel,
        content: notification.content,
        status: notification.status,
        recipientPhone: notification.recipientPhone,
        recipientEmail: notification.recipientEmail,
      };
    } catch (error) {
      logger.error('Failed to send loan notification', {
        error,
        loanId,
        notificationType,
        channel,
      });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Notification History
  // --------------------------------------------------------------------------

  /**
   * Get all notifications for a given loan, ordered newest first.
   */
  async getNotificationHistory(loanId: string) {
    try {
      const notifications = await db
        .select()
        .from(loanNotifications)
        .where(eq(loanNotifications.loanId, loanId))
        .orderBy(desc(loanNotifications.createdAt));

      return notifications;
    } catch (error) {
      logger.error('Failed to fetch notification history', { error, loanId });
      throw new Error('Failed to fetch notification history');
    }
  }

  // --------------------------------------------------------------------------
  // Bulk Reminders
  // --------------------------------------------------------------------------

  /**
   * Send bulk reminders for a store's active loans.
   *
   * - `payment_reminder`: targets active loans where the next EMI is due
   *    within the next 7 days (based on maturity date and tenure cycle).
   * - `maturity_warning`: targets active loans whose maturity date is
   *    within the next 30 days.
   *
   * Notifications are logged as status='pending' -- actual delivery via
   * WhatsApp/SMS/email can be integrated later.
   */
  async sendBulkReminders(
    storeId: string,
    type: 'payment_reminder' | 'maturity_warning'
  ): Promise<BulkReminderResult> {
    const result: BulkReminderResult = {
      sent: 0,
      failed: 0,
      details: [],
    };

    try {
      const now = new Date();

      let eligibleLoans;

      if (type === 'payment_reminder') {
        // Loans that are active and have an EMI/payment coming due within 7 days
        const sevenDaysFromNow = new Date(now);
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        eligibleLoans = await db
          .select({
            loan: goldLoans,
            customer: customers,
          })
          .from(goldLoans)
          .innerJoin(customers, eq(customers.id, goldLoans.customerId))
          .where(
            and(
              eq(goldLoans.storeId, storeId),
              eq(goldLoans.status, 'active'),
              sql`${goldLoans.maturityDate} IS NOT NULL`,
              // For payment reminders we look at loans that still have upcoming payments
              // Simple heuristic: loan is active and not yet matured
              sql`${goldLoans.maturityDate} > ${now}`
            )
          );
      } else {
        // maturity_warning: loans maturing within the next 30 days
        const thirtyDaysFromNow = new Date(now);
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        eligibleLoans = await db
          .select({
            loan: goldLoans,
            customer: customers,
          })
          .from(goldLoans)
          .innerJoin(customers, eq(customers.id, goldLoans.customerId))
          .where(
            and(
              eq(goldLoans.storeId, storeId),
              eq(goldLoans.status, 'active'),
              sql`${goldLoans.maturityDate} IS NOT NULL`,
              sql`${goldLoans.maturityDate} <= ${thirtyDaysFromNow}`,
              sql`${goldLoans.maturityDate} > ${now}`
            )
          );
      }

      logger.info(`Found ${eligibleLoans.length} loans for bulk ${type}`, {
        storeId,
        type,
      });

      // Send notification for each eligible loan
      for (const { loan, customer } of eligibleLoans) {
        const customerName = [customer.firstName, customer.lastName]
          .filter(Boolean)
          .join(' ');

        try {
          // Try WhatsApp first, fall back to SMS
          const channel = customer.whatsapp ? 'whatsapp' : 'sms';

          await this.sendLoanNotification(loan.id, type, channel);

          result.sent++;
          result.details.push({
            loanId: loan.id,
            loanNumber: loan.loanNumber,
            customerName,
            status: 'sent',
          });
        } catch (error) {
          result.failed++;
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';

          result.details.push({
            loanId: loan.id,
            loanNumber: loan.loanNumber,
            customerName,
            status: 'failed',
            error: errorMessage,
          });

          logger.warn('Failed to send bulk reminder for loan', {
            loanId: loan.id,
            loanNumber: loan.loanNumber,
            type,
            error: errorMessage,
          });
        }
      }

      logger.info('Bulk reminders completed', {
        storeId,
        type,
        sent: result.sent,
        failed: result.failed,
      });

      return result;
    } catch (error) {
      logger.error('Failed to send bulk reminders', { error, storeId, type });
      throw new Error('Failed to send bulk reminders');
    }
  }

  // --------------------------------------------------------------------------
  // Template Rendering
  // --------------------------------------------------------------------------

  /**
   * Replace {{variable}} patterns in template text with actual values.
   *
   * Any variables present in the template that are not in the provided
   * map are left as-is (i.e. the {{placeholder}} remains).
   */
  renderTemplate(
    templateBody: string,
    variables: Record<string, string>
  ): string {
    return templateBody.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  /**
   * Build a variable map from loan and customer data for template rendering.
   */
  private buildVariableMap(
    loan: typeof goldLoans.$inferSelect,
    customer: typeof customers.$inferSelect
  ): Record<string, string> {
    const customerName = [customer.firstName, customer.lastName]
      .filter(Boolean)
      .join(' ');

    const maturityDateFormatted = loan.maturityDate
      ? new Date(loan.maturityDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'N/A';

    const applicationDateFormatted = new Date(
      loan.applicationDate
    ).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    return {
      customerName,
      firstName: customer.firstName,
      lastName: customer.lastName || '',
      phone: customer.phone,
      email: customer.email || '',
      loanNumber: loan.loanNumber,
      loanAmount: parseFloat(loan.loanAmount).toLocaleString('en-IN'),
      interestRate: loan.interestRate,
      tenure: loan.tenure.toString(),
      monthlyEmi: loan.monthlyEmi
        ? parseFloat(loan.monthlyEmi).toLocaleString('en-IN')
        : 'N/A',
      maturityDate: maturityDateFormatted,
      applicationDate: applicationDateFormatted,
      status: loan.status,
      outstandingBalance: loan.outstandingBalance
        ? parseFloat(loan.outstandingBalance).toLocaleString('en-IN')
        : 'N/A',
      accruedInterest: loan.accruedInterest
        ? parseFloat(loan.accruedInterest).toLocaleString('en-IN')
        : '0',
      loanType: loan.loanType || 'bullet',
      ltvStatus: loan.ltvStatus || 'safe',
      currentLtv: loan.currentLtv || 'N/A',
      totalGoldValue: loan.totalGoldValue
        ? parseFloat(loan.totalGoldValue).toLocaleString('en-IN')
        : 'N/A',
    };
  }
}

export const loanNotificationService = new LoanNotificationService();
