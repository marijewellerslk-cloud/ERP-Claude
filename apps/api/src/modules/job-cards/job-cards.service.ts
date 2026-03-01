import { db } from '../../config/database.js';
import {
  jobCards,
  karigars,
  karigarTransactions,
  scrapInventory,
  stores,
  customOrders,
} from '../../db/schema.js';
import { eq, and, desc, sql, like, or, gte, lte } from 'drizzle-orm';
import { metalAccountingService } from '../../services/metal-accounting.service.js';
import { karigarsService } from '../karigars/karigars.service.js';
import { logger } from '../../utils/logger.js';

export interface CreateJobCardInput {
  storeId: string;
  karigarId: string;
  customOrderId?: string;
  jobType: 'new_piece' | 'repair' | 'polish' | 'resize' | 'remake';
  itemDescription?: string;
  category?: string;
  metalIssued: number;
  metalPurity: number;
  metalType?: string;
  stonesIssued?: any[];
  otherMaterialsIssued?: any;
  expectedCompletionDate?: Date;
  labourCharge?: number;
  notes?: string;
  issuedBy: string;
}

export interface RecordReturnInput {
  finishedWeight: number;
  scrapReturned: number;
  qualityRating?: number;
  notes?: string;
  receivedBy: string;
}

class JobCardsService {
  /**
   * Generate unique job number
   */
  private async generateJobNumber(storeId: string): Promise<string> {
    const [store] = await db
      .select({ code: stores.code })
      .from(stores)
      .where(eq(stores.id, storeId));

    const storeCode = store?.code || 'MJ';
    const date = new Date();
    const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}`;

    // Get count of job cards for this month
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(jobCards)
      .where(
        and(
          eq(jobCards.storeId, storeId),
          gte(jobCards.createdAt, startOfMonth)
        )
      );

    const count = parseInt(result?.count?.toString() || '0') + 1;
    return `${storeCode}-JC${dateStr}${count.toString().padStart(4, '0')}`;
  }

  /**
   * Create a new job card and issue metal to karigar
   */
  async createJobCard(input: CreateJobCardInput): Promise<any> {
    try {
      const jobNumber = await this.generateJobNumber(input.storeId);

      // Calculate fine gold equivalent
      const fineGoldIssued = metalAccountingService.convertToFineGold(
        input.metalIssued,
        input.metalPurity
      );

      // Get karigar's wastage allowance
      const [karigar] = await db
        .select({ wastageAllowance: karigars.wastageAllowance })
        .from(karigars)
        .where(eq(karigars.id, input.karigarId));

      const allowedWastagePercentage = parseFloat(karigar?.wastageAllowance || '2.00');
      const allowedWastage = (input.metalIssued * allowedWastagePercentage) / 100;

      // Create job card
      const [jobCard] = await db
        .insert(jobCards)
        .values({
          jobNumber,
          storeId: input.storeId,
          karigarId: input.karigarId,
          customOrderId: input.customOrderId,
          jobType: input.jobType,
          itemDescription: input.itemDescription,
          category: input.category,
          metalIssued: input.metalIssued.toString(),
          metalPurity: input.metalPurity.toString(),
          fineGoldIssued: fineGoldIssued.toString(),
          metalType: input.metalType || 'gold',
          issueDate: new Date(),
          issuedBy: input.issuedBy,
          stonesIssued: input.stonesIssued,
          otherMaterialsIssued: input.otherMaterialsIssued,
          expectedCompletionDate: input.expectedCompletionDate,
          labourCharge: input.labourCharge?.toString(),
          allowedWastage: allowedWastage.toString(),
          notes: input.notes,
          status: 'issued',
        })
        .returning();

      // Record metal issue transaction for karigar
      await karigarsService.recordTransaction({
        karigarId: input.karigarId,
        storeId: input.storeId,
        jobCardId: jobCard.id,
        transactionType: 'metal_issue',
        goldAmount: input.metalIssued,
        goldPurity: input.metalPurity,
        description: `Metal issued for Job ${jobNumber}: ${input.metalIssued}g @ ${input.metalPurity}% purity`,
        createdBy: input.issuedBy,
      });

      logger.info('Job card created', { jobCardId: jobCard.id, jobNumber });
      return jobCard;
    } catch (error) {
      logger.error('Failed to create job card', { error, input });
      throw error;
    }
  }

  /**
   * Get job card by ID
   */
  async getJobCardById(jobCardId: string): Promise<any> {
    try {
      const [jobCard] = await db
        .select({
          jobCard: jobCards,
          karigar: {
            id: karigars.id,
            name: karigars.name,
            karigarCode: karigars.karigarCode,
            phone: karigars.phone,
          },
        })
        .from(jobCards)
        .leftJoin(karigars, eq(jobCards.karigarId, karigars.id))
        .where(eq(jobCards.id, jobCardId));

      if (!jobCard) {
        return null;
      }

      // Get related transactions
      const transactions = await db
        .select()
        .from(karigarTransactions)
        .where(eq(karigarTransactions.jobCardId, jobCardId))
        .orderBy(desc(karigarTransactions.transactionDate));

      return {
        ...jobCard.jobCard,
        karigar: jobCard.karigar,
        transactions,
      };
    } catch (error) {
      logger.error('Failed to get job card', { error, jobCardId });
      throw error;
    }
  }

  /**
   * List job cards with filters
   */
  async listJobCards(params: {
    storeId: string;
    karigarId?: string;
    status?: string;
    jobType?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ jobCards: any[]; total: number; page: number; limit: number }> {
    try {
      const { storeId, karigarId, status, jobType, startDate, endDate, search, page = 1, limit = 20 } = params;

      const conditions = [eq(jobCards.storeId, storeId)];

      if (karigarId) {
        conditions.push(eq(jobCards.karigarId, karigarId));
      }

      if (status) {
        conditions.push(eq(jobCards.status, status));
      }

      if (jobType) {
        conditions.push(eq(jobCards.jobType, jobType));
      }

      if (startDate) {
        conditions.push(gte(jobCards.issueDate, startDate));
      }

      if (endDate) {
        conditions.push(lte(jobCards.issueDate, endDate));
      }

      if (search) {
        conditions.push(
          or(
            like(jobCards.jobNumber, `%${search}%`),
            like(jobCards.itemDescription || '', `%${search}%`)
          ) as any
        );
      }

      const offset = (page - 1) * limit;

      const [jobCardList, countResult] = await Promise.all([
        db
          .select({
            jobCard: jobCards,
            karigarName: karigars.name,
            karigarCode: karigars.karigarCode,
          })
          .from(jobCards)
          .leftJoin(karigars, eq(jobCards.karigarId, karigars.id))
          .where(and(...conditions))
          .orderBy(desc(jobCards.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(jobCards)
          .where(and(...conditions)),
      ]);

      return {
        jobCards: jobCardList.map((row) => ({
          ...row.jobCard,
          karigarName: row.karigarName,
          karigarCode: row.karigarCode,
        })),
        total: parseInt(countResult[0]?.count?.toString() || '0'),
        page,
        limit,
      };
    } catch (error) {
      logger.error('Failed to list job cards', { error, params });
      throw error;
    }
  }

  /**
   * Record metal return from karigar
   */
  async recordReturn(jobCardId: string, input: RecordReturnInput): Promise<any> {
    try {
      // Get job card details
      const [jobCard] = await db
        .select()
        .from(jobCards)
        .where(eq(jobCards.id, jobCardId));

      if (!jobCard) {
        throw new Error('Job card not found');
      }

      if (jobCard.status !== 'issued' && jobCard.status !== 'in_progress') {
        throw new Error('Job card is not in a valid state for return');
      }

      const metalIssued = parseFloat(jobCard.metalIssued || '0');
      const metalPurity = parseFloat(jobCard.metalPurity || '91.67');
      const allowedWastage = parseFloat(jobCard.allowedWastage || '0');

      // Calculate actual wastage
      const actualWastage = metalIssued - input.finishedWeight - input.scrapReturned;
      const wastagePercentage = (actualWastage / metalIssued) * 100;

      // Calculate excess wastage (if any)
      const excessWastage = Math.max(0, actualWastage - allowedWastage);

      // Calculate wastage deduction value (if excess)
      let wastageDeductionValue = 0;
      if (excessWastage > 0) {
        const goldRate = await metalAccountingService.getLatestGoldRate(jobCard.storeId);
        wastageDeductionValue = excessWastage * goldRate;
      }

      // Update job card
      const [updatedJobCard] = await db
        .update(jobCards)
        .set({
          finishedWeight: input.finishedWeight.toString(),
          scrapReturned: input.scrapReturned.toString(),
          actualWastage: actualWastage.toString(),
          wastagePercentage: wastagePercentage.toFixed(2),
          excessWastage: excessWastage.toString(),
          wastageDeductionValue: wastageDeductionValue.toString(),
          returnDate: new Date(),
          receivedBy: input.receivedBy,
          qualityRating: input.qualityRating,
          actualCompletionDate: new Date(),
          status: 'returned',
          notes: input.notes ? `${jobCard.notes || ''}\nReturn note: ${input.notes}` : jobCard.notes,
          updatedAt: new Date(),
        })
        .where(eq(jobCards.id, jobCardId))
        .returning();

      // Record metal return transaction
      await karigarsService.recordTransaction({
        karigarId: jobCard.karigarId,
        storeId: jobCard.storeId,
        jobCardId: jobCardId,
        transactionType: 'metal_return',
        goldAmount: input.finishedWeight,
        goldPurity: metalPurity,
        description: `Finished piece returned for Job ${jobCard.jobNumber}: ${input.finishedWeight}g`,
        createdBy: input.receivedBy,
      });

      // Record scrap return if any
      if (input.scrapReturned > 0) {
        await karigarsService.recordTransaction({
          karigarId: jobCard.karigarId,
          storeId: jobCard.storeId,
          jobCardId: jobCardId,
          transactionType: 'scrap_return',
          goldAmount: input.scrapReturned,
          goldPurity: metalPurity,
          description: `Scrap returned for Job ${jobCard.jobNumber}: ${input.scrapReturned}g`,
          createdBy: input.receivedBy,
        });

        // Add scrap to scrap inventory
        await db.insert(scrapInventory).values({
          storeId: jobCard.storeId,
          scrapType: 'filings',
          metalType: jobCard.metalType || 'gold',
          grossWeight: input.scrapReturned.toString(),
          estimatedPurity: metalPurity.toString(),
          estimatedFineWeight: metalAccountingService.convertToFineGold(input.scrapReturned, metalPurity).toString(),
          sourceJobCardId: jobCardId,
          sourceKarigarId: jobCard.karigarId,
          sourceDescription: `Scrap from Job ${jobCard.jobNumber}`,
          collectedAt: new Date(),
          collectedBy: input.receivedBy,
          status: 'accumulated',
        });
      }

      // Record wastage deduction if excess
      if (excessWastage > 0 && wastageDeductionValue > 0) {
        await karigarsService.recordTransaction({
          karigarId: jobCard.karigarId,
          storeId: jobCard.storeId,
          jobCardId: jobCardId,
          transactionType: 'wastage_debit',
          cashAmount: wastageDeductionValue,
          description: `Excess wastage deduction for Job ${jobCard.jobNumber}: ${excessWastage.toFixed(3)}g = ₹${wastageDeductionValue.toFixed(2)}`,
          createdBy: input.receivedBy,
        });
      }

      // Credit labour charge
      const labourCharge = parseFloat(jobCard.labourCharge || '0');
      if (labourCharge > 0) {
        await karigarsService.recordTransaction({
          karigarId: jobCard.karigarId,
          storeId: jobCard.storeId,
          jobCardId: jobCardId,
          transactionType: 'labour_credit',
          cashAmount: labourCharge,
          description: `Labour charge credited for Job ${jobCard.jobNumber}: ₹${labourCharge.toFixed(2)}`,
          createdBy: input.receivedBy,
        });
      }

      logger.info('Job card return recorded', {
        jobCardId,
        finishedWeight: input.finishedWeight,
        scrapReturned: input.scrapReturned,
        actualWastage,
        excessWastage,
      });

      return updatedJobCard;
    } catch (error) {
      logger.error('Failed to record return', { error, jobCardId, input });
      throw error;
    }
  }

  /**
   * Settle job card (mark labour as paid)
   */
  async settleJobCard(jobCardId: string, paidAmount: number, userId: string): Promise<any> {
    try {
      const [jobCard] = await db
        .select()
        .from(jobCards)
        .where(eq(jobCards.id, jobCardId));

      if (!jobCard) {
        throw new Error('Job card not found');
      }

      const currentPaid = parseFloat(jobCard.labourPaid || '0');
      const newPaidTotal = currentPaid + paidAmount;
      const labourCharge = parseFloat(jobCard.labourCharge || '0');

      const newStatus = newPaidTotal >= labourCharge ? 'settled' : jobCard.status;

      const [updated] = await db
        .update(jobCards)
        .set({
          labourPaid: newPaidTotal.toString(),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(jobCards.id, jobCardId))
        .returning();

      logger.info('Job card settled', { jobCardId, paidAmount, newPaidTotal });
      return updated;
    } catch (error) {
      logger.error('Failed to settle job card', { error, jobCardId, paidAmount });
      throw error;
    }
  }

  /**
   * Update job card status
   */
  async updateStatus(jobCardId: string, status: string): Promise<any> {
    try {
      const [updated] = await db
        .update(jobCards)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(jobCards.id, jobCardId))
        .returning();

      logger.info('Job card status updated', { jobCardId, status });
      return updated;
    } catch (error) {
      logger.error('Failed to update job card status', { error, jobCardId, status });
      throw error;
    }
  }

  /**
   * Get job card statistics for a store
   */
  async getStoreStatistics(storeId: string): Promise<any> {
    try {
      const [stats] = await db
        .select({
          totalJobCards: sql<number>`COUNT(*)`,
          issuedCount: sql<number>`SUM(CASE WHEN ${jobCards.status} = 'issued' THEN 1 ELSE 0 END)`,
          inProgressCount: sql<number>`SUM(CASE WHEN ${jobCards.status} = 'in_progress' THEN 1 ELSE 0 END)`,
          returnedCount: sql<number>`SUM(CASE WHEN ${jobCards.status} = 'returned' THEN 1 ELSE 0 END)`,
          settledCount: sql<number>`SUM(CASE WHEN ${jobCards.status} = 'settled' THEN 1 ELSE 0 END)`,
          totalMetalIssued: sql<number>`COALESCE(SUM(${jobCards.metalIssued}), 0)`,
          totalFinishedWeight: sql<number>`COALESCE(SUM(${jobCards.finishedWeight}), 0)`,
          totalScrapReturned: sql<number>`COALESCE(SUM(${jobCards.scrapReturned}), 0)`,
          totalWastage: sql<number>`COALESCE(SUM(${jobCards.actualWastage}), 0)`,
          totalLabourCharge: sql<number>`COALESCE(SUM(${jobCards.labourCharge}), 0)`,
          totalLabourPaid: sql<number>`COALESCE(SUM(${jobCards.labourPaid}), 0)`,
        })
        .from(jobCards)
        .where(eq(jobCards.storeId, storeId));

      return {
        totalJobCards: parseInt(stats?.totalJobCards?.toString() || '0'),
        byStatus: {
          issued: parseInt(stats?.issuedCount?.toString() || '0'),
          inProgress: parseInt(stats?.inProgressCount?.toString() || '0'),
          returned: parseInt(stats?.returnedCount?.toString() || '0'),
          settled: parseInt(stats?.settledCount?.toString() || '0'),
        },
        metalStats: {
          totalIssued: parseFloat(stats?.totalMetalIssued?.toString() || '0'),
          totalFinished: parseFloat(stats?.totalFinishedWeight?.toString() || '0'),
          totalScrap: parseFloat(stats?.totalScrapReturned?.toString() || '0'),
          totalWastage: parseFloat(stats?.totalWastage?.toString() || '0'),
        },
        labourStats: {
          totalCharged: parseFloat(stats?.totalLabourCharge?.toString() || '0'),
          totalPaid: parseFloat(stats?.totalLabourPaid?.toString() || '0'),
          pending: parseFloat(stats?.totalLabourCharge?.toString() || '0') - parseFloat(stats?.totalLabourPaid?.toString() || '0'),
        },
      };
    } catch (error) {
      logger.error('Failed to get job card statistics', { error, storeId });
      throw error;
    }
  }
}

export const jobCardsService = new JobCardsService();
