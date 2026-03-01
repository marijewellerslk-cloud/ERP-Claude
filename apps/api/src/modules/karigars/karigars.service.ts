import { db } from '../../config/database.js';
import {
  karigars,
  karigarTransactions,
  jobCards,
  stores,
} from '../../db/schema.js';
import { eq, and, desc, sql, like, or } from 'drizzle-orm';
import { metalAccountingService } from '../../services/metal-accounting.service.js';
import { logger } from '../../utils/logger.js';

export interface CreateKarigarInput {
  storeId: string;
  name: string;
  phone?: string;
  address?: string;
  specialization?: string;
  skillLevel?: 'junior' | 'standard' | 'senior' | 'master';
  baseLabourRate?: number;
  rateType?: 'per_gram' | 'per_piece' | 'fixed';
  wastageAllowance?: number;
  joiningDate?: Date;
  notes?: string;
}

export interface UpdateKarigarInput {
  name?: string;
  phone?: string;
  address?: string;
  specialization?: string;
  skillLevel?: string;
  baseLabourRate?: number;
  rateType?: string;
  wastageAllowance?: number;
  status?: 'active' | 'inactive' | 'blocked';
  notes?: string;
}

export interface KarigarTransactionInput {
  karigarId: string;
  storeId: string;
  jobCardId?: string;
  transactionType: string;
  goldAmount?: number;
  goldPurity?: number;
  cashAmount?: number;
  paymentMethod?: string;
  paymentReference?: string;
  description: string;
  transactionDate?: Date;
  createdBy: string;
}

class KarigarsService {
  /**
   * Generate unique karigar code
   */
  private async generateKarigarCode(storeId: string): Promise<string> {
    const [store] = await db
      .select({ code: stores.code })
      .from(stores)
      .where(eq(stores.id, storeId));

    const storeCode = store?.code || 'MJ';

    // Get count of karigars for this store
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(karigars)
      .where(eq(karigars.storeId, storeId));

    const count = parseInt(result?.count?.toString() || '0') + 1;
    return `${storeCode}-KG${count.toString().padStart(4, '0')}`;
  }

  /**
   * Create a new karigar
   */
  async createKarigar(input: CreateKarigarInput): Promise<any> {
    try {
      const karigarCode = await this.generateKarigarCode(input.storeId);

      const [karigar] = await db
        .insert(karigars)
        .values({
          storeId: input.storeId,
          karigarCode,
          name: input.name,
          phone: input.phone,
          address: input.address,
          specialization: input.specialization,
          skillLevel: input.skillLevel || 'standard',
          baseLabourRate: input.baseLabourRate?.toString(),
          rateType: input.rateType || 'per_gram',
          wastageAllowance: input.wastageAllowance?.toString() || '2.00',
          joiningDate: input.joiningDate,
          notes: input.notes,
          goldBalance: '0',
          fineGoldBalance: '0',
          pendingLabour: '0',
          advanceBalance: '0',
          status: 'active',
        })
        .returning();

      logger.info('Karigar created', { karigarId: karigar.id, karigarCode });
      return karigar;
    } catch (error) {
      logger.error('Failed to create karigar', { error, input });
      throw error;
    }
  }

  /**
   * Get karigar by ID with balances
   */
  async getKarigarById(karigarId: string): Promise<any> {
    try {
      const [karigar] = await db
        .select()
        .from(karigars)
        .where(eq(karigars.id, karigarId));

      if (!karigar) {
        return null;
      }

      // Get active job cards count
      const [jobCardsData] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(jobCards)
        .where(
          and(
            eq(jobCards.karigarId, karigarId),
            or(eq(jobCards.status, 'issued'), eq(jobCards.status, 'in_progress'))
          )
        );

      // Get recent transactions
      const recentTransactions = await db
        .select()
        .from(karigarTransactions)
        .where(eq(karigarTransactions.karigarId, karigarId))
        .orderBy(desc(karigarTransactions.transactionDate))
        .limit(5);

      return {
        ...karigar,
        activeJobCards: parseInt(jobCardsData?.count?.toString() || '0'),
        recentTransactions,
      };
    } catch (error) {
      logger.error('Failed to get karigar', { error, karigarId });
      throw error;
    }
  }

  /**
   * List karigars with filters
   */
  async listKarigars(params: {
    storeId: string;
    status?: string;
    search?: string;
    specialization?: string;
    page?: number;
    limit?: number;
  }): Promise<{ karigars: any[]; total: number; page: number; limit: number }> {
    try {
      const { storeId, status, search, specialization, page = 1, limit = 20 } = params;

      const conditions = [eq(karigars.storeId, storeId)];

      if (status) {
        conditions.push(eq(karigars.status, status));
      }

      if (specialization) {
        conditions.push(eq(karigars.specialization, specialization));
      }

      if (search) {
        conditions.push(
          or(
            like(karigars.name, `%${search}%`),
            like(karigars.phone || '', `%${search}%`),
            like(karigars.karigarCode || '', `%${search}%`)
          ) as any
        );
      }

      const offset = (page - 1) * limit;

      const [karigarList, countResult] = await Promise.all([
        db
          .select()
          .from(karigars)
          .where(and(...conditions))
          .orderBy(desc(karigars.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(karigars)
          .where(and(...conditions)),
      ]);

      return {
        karigars: karigarList,
        total: parseInt(countResult[0]?.count?.toString() || '0'),
        page,
        limit,
      };
    } catch (error) {
      logger.error('Failed to list karigars', { error, params });
      throw error;
    }
  }

  /**
   * Update karigar
   */
  async updateKarigar(karigarId: string, input: UpdateKarigarInput): Promise<any> {
    try {
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.address !== undefined) updateData.address = input.address;
      if (input.specialization !== undefined) updateData.specialization = input.specialization;
      if (input.skillLevel !== undefined) updateData.skillLevel = input.skillLevel;
      if (input.baseLabourRate !== undefined) updateData.baseLabourRate = input.baseLabourRate.toString();
      if (input.rateType !== undefined) updateData.rateType = input.rateType;
      if (input.wastageAllowance !== undefined) updateData.wastageAllowance = input.wastageAllowance.toString();
      if (input.status !== undefined) updateData.status = input.status;
      if (input.notes !== undefined) updateData.notes = input.notes;

      const [updated] = await db
        .update(karigars)
        .set(updateData)
        .where(eq(karigars.id, karigarId))
        .returning();

      logger.info('Karigar updated', { karigarId });
      return updated;
    } catch (error) {
      logger.error('Failed to update karigar', { error, karigarId, input });
      throw error;
    }
  }

  /**
   * Get karigar ledger (transaction history)
   */
  async getKarigarLedger(
    karigarId: string,
    params: {
      startDate?: Date;
      endDate?: Date;
      transactionType?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ transactions: any[]; total: number; summary: any }> {
    try {
      const { startDate, endDate, transactionType, page = 1, limit = 50 } = params;

      const conditions = [eq(karigarTransactions.karigarId, karigarId)];

      if (startDate) {
        conditions.push(sql`${karigarTransactions.transactionDate} >= ${startDate}`);
      }

      if (endDate) {
        conditions.push(sql`${karigarTransactions.transactionDate} <= ${endDate}`);
      }

      if (transactionType) {
        conditions.push(eq(karigarTransactions.transactionType, transactionType));
      }

      const offset = (page - 1) * limit;

      const [transactions, countResult] = await Promise.all([
        db
          .select()
          .from(karigarTransactions)
          .where(and(...conditions))
          .orderBy(desc(karigarTransactions.transactionDate))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(karigarTransactions)
          .where(and(...conditions)),
      ]);

      // Get current balances
      const [karigar] = await db
        .select({
          goldBalance: karigars.goldBalance,
          fineGoldBalance: karigars.fineGoldBalance,
          pendingLabour: karigars.pendingLabour,
          advanceBalance: karigars.advanceBalance,
        })
        .from(karigars)
        .where(eq(karigars.id, karigarId));

      return {
        transactions,
        total: parseInt(countResult[0]?.count?.toString() || '0'),
        summary: {
          currentGoldBalance: parseFloat(karigar?.goldBalance || '0'),
          currentFineGoldBalance: parseFloat(karigar?.fineGoldBalance || '0'),
          pendingLabour: parseFloat(karigar?.pendingLabour || '0'),
          advanceBalance: parseFloat(karigar?.advanceBalance || '0'),
        },
      };
    } catch (error) {
      logger.error('Failed to get karigar ledger', { error, karigarId, params });
      throw error;
    }
  }

  /**
   * Record a transaction for a karigar
   */
  async recordTransaction(input: KarigarTransactionInput): Promise<any> {
    try {
      // Get current karigar balances
      const [karigar] = await db
        .select()
        .from(karigars)
        .where(eq(karigars.id, input.karigarId));

      if (!karigar) {
        throw new Error('Karigar not found');
      }

      let currentGoldBalance = parseFloat(karigar.goldBalance || '0');
      let currentFineGoldBalance = parseFloat(karigar.fineGoldBalance || '0');
      let currentCashBalance =
        parseFloat(karigar.pendingLabour || '0') - parseFloat(karigar.advanceBalance || '0');

      // Calculate fine gold amount
      const goldAmount = input.goldAmount || 0;
      const purity = input.goldPurity || 91.67; // Default 22K
      const fineGoldAmount = goldAmount
        ? metalAccountingService.convertToFineGold(goldAmount, purity)
        : 0;

      const cashAmount = input.cashAmount || 0;

      // Update running balances based on transaction type
      switch (input.transactionType) {
        case 'metal_issue':
          currentGoldBalance += goldAmount;
          currentFineGoldBalance += fineGoldAmount;
          break;
        case 'metal_return':
        case 'scrap_return':
          currentGoldBalance -= goldAmount;
          currentFineGoldBalance -= fineGoldAmount;
          break;
        case 'labour_credit':
          currentCashBalance += cashAmount;
          break;
        case 'wastage_debit':
          currentCashBalance -= cashAmount;
          break;
        case 'payment':
          currentCashBalance -= cashAmount;
          break;
        case 'advance':
          currentCashBalance -= cashAmount;
          break;
      }

      // Create transaction record
      const [transaction] = await db
        .insert(karigarTransactions)
        .values({
          karigarId: input.karigarId,
          storeId: input.storeId,
          jobCardId: input.jobCardId,
          transactionType: input.transactionType,
          goldAmount: goldAmount.toString(),
          fineGoldAmount: fineGoldAmount.toString(),
          goldPurity: purity.toString(),
          cashAmount: cashAmount.toString(),
          runningGoldBalance: currentGoldBalance.toString(),
          runningFineGoldBalance: currentFineGoldBalance.toString(),
          runningCashBalance: currentCashBalance.toString(),
          paymentMethod: input.paymentMethod,
          paymentReference: input.paymentReference,
          description: input.description,
          transactionDate: input.transactionDate || new Date(),
          createdBy: input.createdBy,
        })
        .returning();

      // Update karigar balances
      const newPendingLabour = currentCashBalance > 0 ? currentCashBalance : 0;
      const newAdvanceBalance = currentCashBalance < 0 ? Math.abs(currentCashBalance) : 0;

      await db
        .update(karigars)
        .set({
          goldBalance: currentGoldBalance.toString(),
          fineGoldBalance: currentFineGoldBalance.toString(),
          pendingLabour: newPendingLabour.toString(),
          advanceBalance: newAdvanceBalance.toString(),
          updatedAt: new Date(),
        })
        .where(eq(karigars.id, input.karigarId));

      logger.info('Karigar transaction recorded', {
        transactionId: transaction.id,
        karigarId: input.karigarId,
        type: input.transactionType,
      });

      return transaction;
    } catch (error) {
      logger.error('Failed to record karigar transaction', { error, input });
      throw error;
    }
  }

  /**
   * Get karigar summary statistics for a store
   */
  async getStoreSummary(storeId: string): Promise<any> {
    try {
      const [summary] = await db
        .select({
          totalKarigars: sql<number>`COUNT(*)`,
          activeKarigars: sql<number>`SUM(CASE WHEN ${karigars.status} = 'active' THEN 1 ELSE 0 END)`,
          totalGoldWithKarigars: sql<number>`COALESCE(SUM(${karigars.goldBalance}), 0)`,
          totalFineGoldWithKarigars: sql<number>`COALESCE(SUM(${karigars.fineGoldBalance}), 0)`,
          totalPendingLabour: sql<number>`COALESCE(SUM(${karigars.pendingLabour}), 0)`,
          totalAdvances: sql<number>`COALESCE(SUM(${karigars.advanceBalance}), 0)`,
        })
        .from(karigars)
        .where(eq(karigars.storeId, storeId));

      // Get active job cards count
      const [jobCardsCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(jobCards)
        .where(
          and(
            eq(jobCards.storeId, storeId),
            or(eq(jobCards.status, 'issued'), eq(jobCards.status, 'in_progress'))
          )
        );

      return {
        totalKarigars: parseInt(summary?.totalKarigars?.toString() || '0'),
        activeKarigars: parseInt(summary?.activeKarigars?.toString() || '0'),
        totalGoldWithKarigars: parseFloat(summary?.totalGoldWithKarigars?.toString() || '0'),
        totalFineGoldWithKarigars: parseFloat(summary?.totalFineGoldWithKarigars?.toString() || '0'),
        totalPendingLabour: parseFloat(summary?.totalPendingLabour?.toString() || '0'),
        totalAdvances: parseFloat(summary?.totalAdvances?.toString() || '0'),
        activeJobCards: parseInt(jobCardsCount?.count?.toString() || '0'),
      };
    } catch (error) {
      logger.error('Failed to get store karigar summary', { error, storeId });
      throw error;
    }
  }

  /**
   * Make a payment to karigar
   */
  async makePayment(
    karigarId: string,
    storeId: string,
    amount: number,
    paymentMethod: string,
    paymentReference: string | undefined,
    createdBy: string
  ): Promise<any> {
    return this.recordTransaction({
      karigarId,
      storeId,
      transactionType: 'payment',
      cashAmount: amount,
      paymentMethod,
      paymentReference,
      description: `Payment of ₹${amount.toFixed(2)} via ${paymentMethod}`,
      createdBy,
    });
  }

  /**
   * Record advance payment to karigar
   */
  async recordAdvance(
    karigarId: string,
    storeId: string,
    amount: number,
    paymentMethod: string,
    paymentReference: string | undefined,
    createdBy: string
  ): Promise<any> {
    return this.recordTransaction({
      karigarId,
      storeId,
      transactionType: 'advance',
      cashAmount: amount,
      paymentMethod,
      paymentReference,
      description: `Advance payment of ₹${amount.toFixed(2)} via ${paymentMethod}`,
      createdBy,
    });
  }
}

export const karigarsService = new KarigarsService();
