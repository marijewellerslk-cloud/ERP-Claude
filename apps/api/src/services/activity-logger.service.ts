import { db } from '../config/database.js';
import { activitySummaries, auditLogs } from '../db/schema.js';
import { logger } from '../utils/logger.js';

interface LogActivityParams {
  storeId: string;
  userId: string;
  category: 'sales' | 'inventory' | 'customer' | 'finance' | 'system';
  activityType: string;
  description: string;
  entityType?: string;
  entityId?: string;
  quantityChange?: number;
  amountChange?: number;
  metadata?: Record<string, any>;
}

interface LogAuditParams {
  userId: string;
  storeId: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export class ActivityLoggerService {
  /**
   * Log an activity summary for daily reports
   */
  async logActivity(params: LogActivityParams): Promise<void> {
    try {
      await db.insert(activitySummaries).values({
        storeId: params.storeId,
        userId: params.userId,
        activityDate: new Date(),
        category: params.category,
        activityType: params.activityType,
        description: params.description,
        entityType: params.entityType,
        entityId: params.entityId,
        quantityChange: params.quantityChange,
        amountChange: params.amountChange?.toString(),
        metadata: params.metadata,
      });

      logger.debug('Activity logged', {
        userId: params.userId,
        activityType: params.activityType,
      });
    } catch (error) {
      logger.error('Failed to log activity', { error, params });
      // Don't throw - activity logging shouldn't break the main flow
    }
  }

  /**
   * Log an audit event for compliance tracking
   */
  async logAudit(params: LogAuditParams): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        userId: params.userId,
        storeId: params.storeId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValues: params.oldValues,
        newValues: params.newValues,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });

      logger.debug('Audit log created', {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
      });
    } catch (error) {
      logger.error('Failed to create audit log', { error, params });
      // Don't throw - audit logging shouldn't break the main flow
    }
  }

  /**
   * Convenience method for inventory activities
   */
  async logInventoryActivity(
    storeId: string,
    userId: string,
    activityType: 'item_added' | 'item_updated' | 'item_removed' | 'batch_created' | 'batch_completed',
    description: string,
    options?: {
      entityId?: string;
      quantityChange?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    await this.logActivity({
      storeId,
      userId,
      category: 'inventory',
      activityType,
      description,
      entityType: activityType.includes('item') ? 'inventory_item' : 'batch',
      entityId: options?.entityId,
      quantityChange: options?.quantityChange,
      metadata: options?.metadata,
    });
  }

  /**
   * Convenience method for sales activities
   */
  async logSalesActivity(
    storeId: string,
    userId: string,
    activityType: 'invoice_created' | 'payment_received' | 'sale_completed',
    description: string,
    options?: {
      entityId?: string;
      amountChange?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    await this.logActivity({
      storeId,
      userId,
      category: 'sales',
      activityType,
      description,
      entityType: 'invoice',
      entityId: options?.entityId,
      amountChange: options?.amountChange,
      metadata: options?.metadata,
    });
  }

  /**
   * Convenience method for customer activities
   */
  async logCustomerActivity(
    storeId: string,
    userId: string,
    activityType: 'customer_created' | 'customer_updated' | 'loyalty_points_earned',
    description: string,
    options?: {
      entityId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    await this.logActivity({
      storeId,
      userId,
      category: 'customer',
      activityType,
      description,
      entityType: 'customer',
      entityId: options?.entityId,
      metadata: options?.metadata,
    });
  }

  /**
   * Convenience method for financial activities
   */
  async logFinanceActivity(
    storeId: string,
    userId: string,
    activityType: 'payment_made' | 'payment_received' | 'expense_recorded',
    description: string,
    options?: {
      entityId?: string;
      amountChange?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    await this.logActivity({
      storeId,
      userId,
      category: 'finance',
      activityType,
      description,
      entityType: 'payment',
      entityId: options?.entityId,
      amountChange: options?.amountChange,
      metadata: options?.metadata,
    });
  }
}

export const activityLogger = new ActivityLoggerService();
