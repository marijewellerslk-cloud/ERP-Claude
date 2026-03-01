import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { db } from '../config/database.js';
import {
  dailySummaries,
  activitySummaries,
  invoices,
  inventoryBatches,
  inventoryItems,
  inventoryBatchItems,
  payments,
  purchasePayments,
  customers,
  users,
} from '../db/schema.js';
import { logger } from '../utils/logger.js';

export class DailySummaryService {
  /**
   * Generate daily summary for a specific store and date
   */
  async generateDailySummary(storeId: string, date: Date = new Date()): Promise<void> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      logger.info('Generating daily summary', { storeId, date: startOfDay });

      // Check if summary already exists
      const existing = await db.query.dailySummaries.findFirst({
        where: and(
          eq(dailySummaries.storeId, storeId),
          eq(dailySummaries.summaryDate, startOfDay)
        ),
      });

      if (existing) {
        logger.info('Daily summary already exists, updating', { summaryId: existing.id });
        await this.updateDailySummary(existing.id, storeId, startOfDay, endOfDay);
      } else {
        await this.createDailySummary(storeId, startOfDay, endOfDay);
      }

      logger.info('Daily summary generated successfully', { storeId, date: startOfDay });
    } catch (error) {
      logger.error('Failed to generate daily summary', { error, storeId, date });
      throw error;
    }
  }

  private async createDailySummary(
    storeId: string,
    startOfDay: Date,
    endOfDay: Date
  ): Promise<void> {
    const metrics = await this.calculateMetrics(storeId, startOfDay, endOfDay);

    await db.insert(dailySummaries).values({
      storeId,
      summaryDate: startOfDay,
      ...metrics,
    });
  }

  private async updateDailySummary(
    summaryId: string,
    storeId: string,
    startOfDay: Date,
    endOfDay: Date
  ): Promise<void> {
    const metrics = await this.calculateMetrics(storeId, startOfDay, endOfDay);

    await db
      .update(dailySummaries)
      .set({
        ...metrics,
        generatedAt: new Date(),
      })
      .where(eq(dailySummaries.id, summaryId));
  }

  private async calculateMetrics(storeId: string, startOfDay: Date, endOfDay: Date) {
    // Sales metrics
    const salesMetrics = await this.calculateSalesMetrics(storeId, startOfDay, endOfDay);

    // Inventory metrics
    const inventoryMetrics = await this.calculateInventoryMetrics(storeId, startOfDay, endOfDay);

    // Financial metrics
    const financialMetrics = await this.calculateFinancialMetrics(storeId, startOfDay, endOfDay);

    // Activity metrics
    const activityMetrics = await this.calculateActivityMetrics(storeId, startOfDay, endOfDay);

    // Top selling categories
    const topSellingCategories = await this.getTopSellingCategories(storeId, startOfDay, endOfDay);

    // Top customers
    const topCustomers = await this.getTopCustomers(storeId, startOfDay, endOfDay);

    // Inventory changes
    const inventoryChanges = await this.getInventoryChanges(storeId, startOfDay, endOfDay);

    return {
      ...salesMetrics,
      ...inventoryMetrics,
      ...financialMetrics,
      ...activityMetrics,
      topSellingCategories,
      topCustomers,
      inventoryChanges,
    };
  }

  private async calculateSalesMetrics(storeId: string, startOfDay: Date, endOfDay: Date) {
    const salesData = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${invoices.totalAmount}), 0)`,
        totalInvoices: sql<number>`COUNT(*)::int`,
        totalCustomers: sql<number>`COUNT(DISTINCT ${invoices.customerId})::int`,
        averageInvoiceValue: sql<number>`COALESCE(AVG(${invoices.totalAmount}), 0)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.storeId, storeId),
          gte(invoices.invoiceDate, startOfDay),
          lte(invoices.invoiceDate, endOfDay),
          eq(invoices.status, 'paid')
        )
      );

    const result = salesData[0];
    return {
      totalSales: result.totalSales.toString(),
      totalInvoices: result.totalInvoices,
      totalCustomers: result.totalCustomers,
      averageInvoiceValue: result.averageInvoiceValue.toString(),
    };
  }

  private async calculateInventoryMetrics(storeId: string, startOfDay: Date, endOfDay: Date) {
    // Items added
    const itemsAddedData = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
        totalGrossWeight: sql<number>`COALESCE(SUM(${inventoryItems.grossWeight}), 0)`,
      })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.storeId, storeId),
          gte(inventoryItems.createdAt, startOfDay),
          lte(inventoryItems.createdAt, endOfDay)
        )
      );

    // Batches created and completed
    const batchesCreated = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(inventoryBatches)
      .where(
        and(
          eq(inventoryBatches.storeId, storeId),
          gte(inventoryBatches.createdAt, startOfDay),
          lte(inventoryBatches.createdAt, endOfDay)
        )
      );

    const batchesCompleted = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(inventoryBatches)
      .where(
        and(
          eq(inventoryBatches.storeId, storeId),
          gte(inventoryBatches.completedAt, startOfDay),
          lte(inventoryBatches.completedAt, endOfDay),
          sql`${inventoryBatches.status} IN ('completed', 'discrepancy')`
        )
      );

    return {
      itemsAdded: itemsAddedData[0].count,
      itemsSold: 0, // Will be calculated when sales module is integrated
      batchesCreated: batchesCreated[0].count,
      batchesCompleted: batchesCompleted[0].count,
      totalGrossWeightAdded: itemsAddedData[0].totalGrossWeight.toString(),
      totalGrossWeightSold: '0', // Will be calculated when sales module is integrated
    };
  }

  private async calculateFinancialMetrics(storeId: string, startOfDay: Date, endOfDay: Date) {
    // Payments received (sales)
    const paymentsReceivedData = await db
      .select({
        total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
      })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(
        and(
          eq(invoices.storeId, storeId),
          gte(payments.paymentDate, startOfDay),
          lte(payments.paymentDate, endOfDay)
        )
      );

    // Payments made (purchases)
    const paymentsMadeData = await db
      .select({
        total: sql<number>`COALESCE(SUM(${purchasePayments.amount}), 0)`,
      })
      .from(purchasePayments)
      .innerJoin(inventoryBatches, eq(purchasePayments.batchId, inventoryBatches.id))
      .where(
        and(
          eq(inventoryBatches.storeId, storeId),
          gte(purchasePayments.paymentDate, startOfDay),
          lte(purchasePayments.paymentDate, endOfDay)
        )
      );

    // Outstanding receivables (total)
    const receivablesData = await db
      .select({
        total: sql<number>`COALESCE(SUM(${invoices.totalAmount} - ${invoices.paidAmount}), 0)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.storeId, storeId),
          sql`${invoices.status} IN ('pending', 'partial')`
        )
      );

    // Outstanding payables (total)
    const payablesData = await db
      .select({
        total: sql<number>`COALESCE(SUM(${inventoryBatches.outstandingBalance}), 0)`,
      })
      .from(inventoryBatches)
      .where(
        and(
          eq(inventoryBatches.storeId, storeId),
          sql`${inventoryBatches.paymentStatus} IN ('pending', 'partial')`
        )
      );

    return {
      totalPaymentsReceived: paymentsReceivedData[0].total.toString(),
      totalPaymentsMade: paymentsMadeData[0].total.toString(),
      outstandingReceivables: receivablesData[0].total.toString(),
      outstandingPayables: payablesData[0].total.toString(),
    };
  }

  private async calculateActivityMetrics(storeId: string, startOfDay: Date, endOfDay: Date) {
    const activityData = await db
      .select({
        totalActivities: sql<number>`COUNT(*)::int`,
        activeUsers: sql<number>`COUNT(DISTINCT ${activitySummaries.userId})::int`,
      })
      .from(activitySummaries)
      .where(
        and(
          eq(activitySummaries.storeId, storeId),
          gte(activitySummaries.activityDate, startOfDay),
          lte(activitySummaries.activityDate, endOfDay)
        )
      );

    return {
      totalActivities: activityData[0].totalActivities,
      activeUsers: activityData[0].activeUsers,
    };
  }

  private async getTopSellingCategories(storeId: string, startOfDay: Date, endOfDay: Date) {
    // Placeholder - will be implemented when sales module is complete
    return [];
  }

  private async getTopCustomers(storeId: string, startOfDay: Date, endOfDay: Date) {
    // Get top 5 customers by sales value
    const topCustomersData = await db
      .select({
        customerId: invoices.customerId,
        customerName: customers.fullName,
        totalPurchase: sql<number>`SUM(${invoices.totalAmount})`,
        invoiceCount: sql<number>`COUNT(*)::int`,
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .where(
        and(
          eq(invoices.storeId, storeId),
          gte(invoices.invoiceDate, startOfDay),
          lte(invoices.invoiceDate, endOfDay),
          eq(invoices.status, 'paid')
        )
      )
      .groupBy(invoices.customerId, customers.fullName)
      .orderBy(desc(sql`SUM(${invoices.totalAmount})`))
      .limit(5);

    return topCustomersData.map((c) => ({
      customerId: c.customerId,
      name: c.customerName,
      totalPurchase: parseFloat(c.totalPurchase.toString()),
      invoiceCount: c.invoiceCount,
    }));
  }

  private async getInventoryChanges(storeId: string, startOfDay: Date, endOfDay: Date) {
    const batches = await db.query.inventoryBatches.findMany({
      where: and(
        eq(inventoryBatches.storeId, storeId),
        gte(inventoryBatches.createdAt, startOfDay),
        lte(inventoryBatches.createdAt, endOfDay)
      ),
      columns: {
        id: true,
        batchNumber: true,
        status: true,
        actualTotalItems: true,
        actualTotalWeight: true,
      },
    });

    return batches.map((batch) => ({
      batchNumber: batch.batchNumber,
      status: batch.status,
      itemsAdded: batch.actualTotalItems,
      totalWeight: parseFloat(batch.actualTotalWeight),
    }));
  }

  /**
   * Get daily summary for a specific date
   */
  async getDailySummary(storeId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const summary = await db.query.dailySummaries.findFirst({
      where: and(
        eq(dailySummaries.storeId, storeId),
        eq(dailySummaries.summaryDate, startOfDay)
      ),
    });

    return summary;
  }

  /**
   * Get summaries for a date range
   */
  async getSummariesInRange(storeId: string, startDate: Date, endDate: Date) {
    const summaries = await db.query.dailySummaries.findMany({
      where: and(
        eq(dailySummaries.storeId, storeId),
        gte(dailySummaries.summaryDate, startDate),
        lte(dailySummaries.summaryDate, endDate)
      ),
      orderBy: [desc(dailySummaries.summaryDate)],
    });

    return summaries;
  }
}

export const dailySummaryService = new DailySummaryService();
