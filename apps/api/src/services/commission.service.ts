/**
 * Salesperson Commission Service
 * Handles commission calculation, tracking, and payouts
 */

import { db } from '../config/database.js';
import {
  commissionRates,
  commissionLedger,
  salespersonSummary,
  invoices,
  invoiceItems,
  users,
  inventoryItems,
} from '../db/schema.js';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

interface CommissionCalculation {
  invoiceId: string;
  salespersonId: string;
  saleAmount: number;
  commissionRate: number;
  commissionAmount: number;
  commissionType: string;
}

interface CommissionPayout {
  salespersonId: string;
  amount: number;
  paymentMethod: string;
  paymentReference?: string;
  description?: string;
}

export class CommissionService {
  /**
   * Calculate commission for an invoice
   * @param invoiceId - Invoice ID
   * @param salespersonId - Salesperson user ID
   * @param storeId - Store ID
   */
  async calculateCommission(
    invoiceId: string,
    salespersonId: string,
    storeId: string
  ): Promise<CommissionCalculation> {
    // Get invoice with items
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
      with: {
        invoiceItems: {
          with: {
            inventoryItem: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const saleAmount = parseFloat(invoice.totalAmount || '0');
    let totalCommission = 0;
    let appliedRate = 0;
    let commissionType = 'percentage';

    // Check for category-specific rates first
    for (const item of invoice.invoiceItems) {
      const categoryId = item.inventoryItem?.categoryId;
      const metalType = item.inventoryItem?.metalType;
      const itemAmount = parseFloat(item.lineTotal || '0');

      // Try to find a matching commission rate
      const rate = await this.findApplicableRate(storeId, categoryId, metalType, itemAmount);

      if (rate) {
        const itemCommission = this.calculateItemCommission(itemAmount, rate);
        totalCommission += itemCommission;
        appliedRate = parseFloat(rate.commissionPercent);
        commissionType = rate.commissionType || 'percentage';
      }
    }

    // If no category-specific rates, use default store rate
    if (totalCommission === 0) {
      const defaultRate = await this.getDefaultRate(storeId, saleAmount);
      if (defaultRate) {
        totalCommission = this.calculateItemCommission(saleAmount, defaultRate);
        appliedRate = parseFloat(defaultRate.commissionPercent);
        commissionType = defaultRate.commissionType || 'percentage';
      }
    }

    return {
      invoiceId,
      salespersonId,
      saleAmount,
      commissionRate: appliedRate,
      commissionAmount: Math.round(totalCommission * 100) / 100,
      commissionType,
    };
  }

  /**
   * Find applicable commission rate
   */
  private async findApplicableRate(
    storeId: string,
    categoryId: string | null | undefined,
    metalType: string | null | undefined,
    amount: number
  ) {
    const conditions: any[] = [
      eq(commissionRates.storeId, storeId),
      eq(commissionRates.isActive, true),
    ];

    // Try to find most specific match (category + metal type)
    if (categoryId && metalType) {
      const rate = await db.query.commissionRates.findFirst({
        where: and(
          ...conditions,
          eq(commissionRates.categoryId, categoryId),
          eq(commissionRates.metalType, metalType),
          sql`(${commissionRates.minSaleAmount} IS NULL OR ${commissionRates.minSaleAmount} <= ${amount})`,
          sql`(${commissionRates.maxSaleAmount} IS NULL OR ${commissionRates.maxSaleAmount} >= ${amount})`
        ),
      });
      if (rate) return rate;
    }

    // Try category only
    if (categoryId) {
      const rate = await db.query.commissionRates.findFirst({
        where: and(
          ...conditions,
          eq(commissionRates.categoryId, categoryId),
          sql`${commissionRates.metalType} IS NULL`,
          sql`(${commissionRates.minSaleAmount} IS NULL OR ${commissionRates.minSaleAmount} <= ${amount})`,
          sql`(${commissionRates.maxSaleAmount} IS NULL OR ${commissionRates.maxSaleAmount} >= ${amount})`
        ),
      });
      if (rate) return rate;
    }

    // Try metal type only
    if (metalType) {
      const rate = await db.query.commissionRates.findFirst({
        where: and(
          ...conditions,
          sql`${commissionRates.categoryId} IS NULL`,
          eq(commissionRates.metalType, metalType),
          sql`(${commissionRates.minSaleAmount} IS NULL OR ${commissionRates.minSaleAmount} <= ${amount})`,
          sql`(${commissionRates.maxSaleAmount} IS NULL OR ${commissionRates.maxSaleAmount} >= ${amount})`
        ),
      });
      if (rate) return rate;
    }

    return null;
  }

  /**
   * Get default store-wide commission rate
   */
  private async getDefaultRate(storeId: string, amount: number) {
    return db.query.commissionRates.findFirst({
      where: and(
        eq(commissionRates.storeId, storeId),
        eq(commissionRates.isActive, true),
        sql`${commissionRates.categoryId} IS NULL`,
        sql`${commissionRates.metalType} IS NULL`,
        sql`(${commissionRates.minSaleAmount} IS NULL OR ${commissionRates.minSaleAmount} <= ${amount})`,
        sql`(${commissionRates.maxSaleAmount} IS NULL OR ${commissionRates.maxSaleAmount} >= ${amount})`
      ),
    });
  }

  /**
   * Calculate commission for a single item based on rate
   */
  private calculateItemCommission(amount: number, rate: any): number {
    const percent = parseFloat(rate.commissionPercent || '0');
    const type = rate.commissionType || 'percentage';

    if (type === 'fixed') {
      return percent; // Fixed amount
    }

    // Percentage-based
    return (amount * percent) / 100;
  }

  /**
   * Record commission earned from a sale
   */
  async recordCommissionEarned(
    storeId: string,
    salespersonId: string,
    invoiceId: string,
    commissionAmount: number,
    userId: string
  ) {
    // Get current balance
    const lastEntry = await db.query.commissionLedger.findFirst({
      where: eq(commissionLedger.salespersonId, salespersonId),
      orderBy: [desc(commissionLedger.createdAt)],
    });

    const currentBalance = parseFloat(lastEntry?.runningBalance || '0');
    const newBalance = currentBalance + commissionAmount;

    // Create ledger entry
    const [entry] = await db
      .insert(commissionLedger)
      .values({
        storeId,
        salespersonId,
        invoiceId,
        transactionType: 'earned',
        amount: commissionAmount.toString(),
        runningBalance: newBalance.toString(),
        description: `Commission earned from sale`,
        createdBy: userId,
      })
      .returning();

    // Update monthly summary
    await this.updateMonthlySummary(storeId, salespersonId, commissionAmount, 0);

    logger.info('Commission recorded', {
      salespersonId,
      invoiceId,
      commissionAmount,
      newBalance,
    });

    return entry;
  }

  /**
   * Process commission payout
   */
  async processCommissionPayout(
    storeId: string,
    payout: CommissionPayout,
    userId: string
  ) {
    const { salespersonId, amount, paymentMethod, paymentReference, description } = payout;

    // Get current balance
    const lastEntry = await db.query.commissionLedger.findFirst({
      where: eq(commissionLedger.salespersonId, salespersonId),
      orderBy: [desc(commissionLedger.createdAt)],
    });

    const currentBalance = parseFloat(lastEntry?.runningBalance || '0');

    if (amount > currentBalance) {
      throw new Error(`Payout amount (${amount}) exceeds available balance (${currentBalance})`);
    }

    const newBalance = currentBalance - amount;

    // Create ledger entry
    const [entry] = await db
      .insert(commissionLedger)
      .values({
        storeId,
        salespersonId,
        transactionType: 'paid',
        amount: (-amount).toString(), // Negative for payout
        runningBalance: newBalance.toString(),
        description: description || 'Commission payout',
        paymentMethod,
        paymentReference,
        createdBy: userId,
      })
      .returning();

    // Update monthly summary
    await this.updateMonthlySummary(storeId, salespersonId, 0, amount);

    logger.info('Commission payout processed', {
      salespersonId,
      amount,
      paymentMethod,
      newBalance,
    });

    return entry;
  }

  /**
   * Update monthly summary
   */
  private async updateMonthlySummary(
    storeId: string,
    salespersonId: string,
    commissionEarned: number,
    commissionPaid: number
  ) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Try to update existing record
    const existingSummary = await db.query.salespersonSummary.findFirst({
      where: and(
        eq(salespersonSummary.storeId, storeId),
        eq(salespersonSummary.salespersonId, salespersonId),
        eq(salespersonSummary.periodMonth, month),
        eq(salespersonSummary.periodYear, year)
      ),
    });

    if (existingSummary) {
      const newEarned = parseFloat(existingSummary.totalCommissionEarned || '0') + commissionEarned;
      const newPaid = parseFloat(existingSummary.totalCommissionPaid || '0') + commissionPaid;
      const newPending = newEarned - newPaid;

      await db
        .update(salespersonSummary)
        .set({
          totalCommissionEarned: newEarned.toString(),
          totalCommissionPaid: newPaid.toString(),
          pendingCommission: newPending.toString(),
          totalTransactions: existingSummary.totalTransactions! + (commissionEarned > 0 ? 1 : 0),
          updatedAt: new Date(),
        })
        .where(eq(salespersonSummary.id, existingSummary.id));
    } else {
      await db.insert(salespersonSummary).values({
        storeId,
        salespersonId,
        periodMonth: month,
        periodYear: year,
        totalCommissionEarned: commissionEarned.toString(),
        totalCommissionPaid: commissionPaid.toString(),
        pendingCommission: (commissionEarned - commissionPaid).toString(),
        totalTransactions: commissionEarned > 0 ? 1 : 0,
      });
    }
  }

  /**
   * Get salesperson commission summary
   */
  async getSalespersonSummary(
    salespersonId: string,
    storeId?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    // Get current balance
    const lastEntry = await db.query.commissionLedger.findFirst({
      where: eq(commissionLedger.salespersonId, salespersonId),
      orderBy: [desc(commissionLedger.createdAt)],
    });

    const currentBalance = parseFloat(lastEntry?.runningBalance || '0');

    // Get monthly summaries
    const conditions: any[] = [eq(salespersonSummary.salespersonId, salespersonId)];

    if (storeId) {
      conditions.push(eq(salespersonSummary.storeId, storeId));
    }

    const monthlySummaries = await db.query.salespersonSummary.findMany({
      where: and(...conditions),
      orderBy: [desc(salespersonSummary.periodYear), desc(salespersonSummary.periodMonth)],
      limit: 12,
    });

    // Calculate totals
    const totals = monthlySummaries.reduce(
      (acc, s) => ({
        totalEarned: acc.totalEarned + parseFloat(s.totalCommissionEarned || '0'),
        totalPaid: acc.totalPaid + parseFloat(s.totalCommissionPaid || '0'),
        totalTransactions: acc.totalTransactions + (s.totalTransactions || 0),
      }),
      { totalEarned: 0, totalPaid: 0, totalTransactions: 0 }
    );

    return {
      currentBalance,
      ...totals,
      monthlySummaries,
    };
  }

  /**
   * Get commission ledger entries
   */
  async getCommissionLedger(
    salespersonId: string,
    storeId?: string,
    limit: number = 50,
    offset: number = 0
  ) {
    const conditions: any[] = [eq(commissionLedger.salespersonId, salespersonId)];

    if (storeId) {
      conditions.push(eq(commissionLedger.storeId, storeId));
    }

    const entries = await db.query.commissionLedger.findMany({
      where: and(...conditions),
      with: {
        invoice: true,
        store: true,
      },
      orderBy: [desc(commissionLedger.createdAt)],
      limit,
      offset,
    });

    return entries;
  }

  /**
   * Create or update commission rate
   */
  async setCommissionRate(
    storeId: string,
    data: {
      categoryId?: string;
      metalType?: string;
      minSaleAmount?: number;
      maxSaleAmount?: number;
      commissionPercent: number;
      commissionType?: string;
    }
  ) {
    // Check for existing rate with same criteria
    const conditions: any[] = [eq(commissionRates.storeId, storeId)];

    if (data.categoryId) {
      conditions.push(eq(commissionRates.categoryId, data.categoryId));
    } else {
      conditions.push(sql`${commissionRates.categoryId} IS NULL`);
    }

    if (data.metalType) {
      conditions.push(eq(commissionRates.metalType, data.metalType));
    } else {
      conditions.push(sql`${commissionRates.metalType} IS NULL`);
    }

    const existing = await db.query.commissionRates.findFirst({
      where: and(...conditions),
    });

    if (existing) {
      // Update existing
      const [updated] = await db
        .update(commissionRates)
        .set({
          minSaleAmount: data.minSaleAmount?.toString(),
          maxSaleAmount: data.maxSaleAmount?.toString(),
          commissionPercent: data.commissionPercent.toString(),
          commissionType: data.commissionType || 'percentage',
          updatedAt: new Date(),
        })
        .where(eq(commissionRates.id, existing.id))
        .returning();

      return updated;
    }

    // Create new
    const [created] = await db
      .insert(commissionRates)
      .values({
        storeId,
        categoryId: data.categoryId,
        metalType: data.metalType,
        minSaleAmount: data.minSaleAmount?.toString(),
        maxSaleAmount: data.maxSaleAmount?.toString(),
        commissionPercent: data.commissionPercent.toString(),
        commissionType: data.commissionType || 'percentage',
      })
      .returning();

    return created;
  }

  /**
   * Get all commission rates for a store
   */
  async getCommissionRates(storeId: string) {
    return db.query.commissionRates.findMany({
      where: eq(commissionRates.storeId, storeId),
      with: {
        category: true,
      },
      orderBy: [commissionRates.categoryId, commissionRates.metalType],
    });
  }

  /**
   * Get top performing salespeople
   */
  async getTopSalespeople(storeId: string, month?: number, year?: number, limit: number = 10) {
    const now = new Date();
    const targetMonth = month ?? now.getMonth() + 1;
    const targetYear = year ?? now.getFullYear();

    const summaries = await db.query.salespersonSummary.findMany({
      where: and(
        eq(salespersonSummary.storeId, storeId),
        eq(salespersonSummary.periodMonth, targetMonth),
        eq(salespersonSummary.periodYear, targetYear)
      ),
      with: {
        salesperson: true,
      },
      orderBy: [desc(salespersonSummary.totalSales)],
      limit,
    });

    return summaries.map((s) => ({
      salespersonId: s.salespersonId,
      salespersonName: s.salesperson?.fullName,
      totalSales: parseFloat(s.totalSales || '0'),
      totalTransactions: s.totalTransactions,
      commissionEarned: parseFloat(s.totalCommissionEarned || '0'),
      avgSaleAmount: parseFloat(s.avgSaleAmount || '0'),
    }));
  }
}

export const commissionService = new CommissionService();
