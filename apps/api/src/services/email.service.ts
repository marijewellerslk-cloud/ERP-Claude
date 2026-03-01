import nodemailer from 'nodemailer';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../config/database.js';
import { emailNotifications } from '../db/schema.js';
import { logger } from '../utils/logger.js';

interface SendEmailParams {
  storeId: string;
  recipients: string[];
  subject: string;
  htmlContent: string;
  notificationType: 'daily_briefing' | 'weekly_report' | 'alert' | 'notification';
  templateData?: Record<string, any>;
  scheduledFor?: Date;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      // Check if email configuration is available
      const emailHost = process.env.EMAIL_HOST || process.env.SMTP_HOST;
      const emailPort = process.env.EMAIL_PORT || process.env.SMTP_PORT;
      const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
      const emailPassword = process.env.EMAIL_PASSWORD || process.env.SMTP_PASSWORD;

      if (!emailHost || !emailPort || !emailUser || !emailPassword) {
        logger.warn('Email configuration not found. Email notifications will be logged but not sent.');
        logger.warn('Please set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, and EMAIL_PASSWORD environment variables.');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: emailHost,
        port: parseInt(emailPort),
        secure: emailPort === '465', // true for 465, false for other ports
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      });

      logger.info('Email transporter initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email transporter', { error });
    }
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  /**
   * Send an email notification
   */
  async sendEmail(params: SendEmailParams): Promise<void> {
    try {
      // Create email notification record
      const [notification] = await db
        .insert(emailNotifications)
        .values({
          storeId: params.storeId,
          notificationType: params.notificationType,
          subject: params.subject,
          recipients: params.recipients,
          templateData: params.templateData,
          status: 'pending',
          scheduledFor: params.scheduledFor,
        })
        .returning();

      // If scheduled for future, don't send now
      if (params.scheduledFor && params.scheduledFor > new Date()) {
        logger.info('Email scheduled for future delivery', {
          notificationId: notification.id,
          scheduledFor: params.scheduledFor,
        });
        return;
      }

      // Send email
      await this.sendEmailNow(notification.id, params);
    } catch (error) {
      logger.error('Failed to send email', { error, params });
      throw error;
    }
  }

  private async sendEmailNow(notificationId: string, params: SendEmailParams): Promise<void> {
    try {
      if (!this.transporter) {
        // Log the email but don't actually send it
        logger.info('Email would be sent (transporter not configured)', {
          notificationId,
          recipients: params.recipients,
          subject: params.subject,
        });

        await db
          .update(emailNotifications)
          .set({
            status: 'sent',
            sentAt: new Date(),
          })
          .where(eq(emailNotifications.id, notificationId));

        return;
      }

      const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'noreply@marijewellers.com';

      await this.transporter.sendMail({
        from: `"MARI Jewellers ERP" <${fromEmail}>`,
        to: params.recipients.join(', '),
        subject: params.subject,
        html: params.htmlContent,
      });

      await db
        .update(emailNotifications)
        .set({
          status: 'sent',
          sentAt: new Date(),
        })
        .where(eq(emailNotifications.id, notificationId));

      logger.info('Email sent successfully', {
        notificationId,
        recipients: params.recipients,
      });
    } catch (error: any) {
      await db
        .update(emailNotifications)
        .set({
          status: 'failed',
          errorMessage: error.message || 'Unknown error',
        })
        .where(eq(emailNotifications.id, notificationId));

      logger.error('Failed to send email', { error, notificationId });
      throw error;
    }
  }

  /**
   * Process pending scheduled emails
   */
  async processPendingEmails(): Promise<void> {
    try {
      const pendingEmails = await db.query.emailNotifications.findMany({
        where: and(
          eq(emailNotifications.status, 'pending'),
          // Only process emails scheduled for now or past
          sql`${emailNotifications.scheduledFor} <= NOW()`
        ),
        limit: 50,
      });

      for (const email of pendingEmails) {
        try {
          await this.sendEmailNow(email.id, {
            storeId: email.storeId,
            recipients: email.recipients as string[],
            subject: email.subject,
            htmlContent: '', // Would need to regenerate from templateData
            notificationType: email.notificationType as any,
            templateData: email.templateData as any,
          });
        } catch (error) {
          logger.error('Failed to process pending email', { error, emailId: email.id });
        }
      }

      logger.info('Processed pending emails', { count: pendingEmails.length });
    } catch (error) {
      logger.error('Failed to process pending emails', { error });
    }
  }

  /**
   * Get email notification history
   */
  async getNotificationHistory(storeId: string, limit: number = 50) {
    const notifications = await db.query.emailNotifications.findMany({
      where: eq(emailNotifications.storeId, storeId),
      orderBy: [desc(emailNotifications.createdAt)],
      limit,
    });

    return notifications;
  }
}

export const emailService = new EmailService();
