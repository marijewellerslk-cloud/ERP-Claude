import { db } from '../../config/database.js';
import { scrapInventory, meltingRecords, karigars, jobCards } from '../../db/schema.js';
import { eq, and, desc, sql, gte, lte, inArray } from 'drizzle-orm';
import { metalAccountingService } from '../../services/metal-accounting.service.js';

export class ScrapService {
  /**
   * Generate unique scrap code
   */
  private async generateScrapCode(storeId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(2, 10).replace(/-/g, '');

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(scrapInventory)
      .where(
        and(
          eq(scrapInventory.storeId, storeId),
          gte(scrapInventory.createdAt, new Date(today.setHours(0, 0, 0, 0)))
        )
      );

    const sequence = (result?.count || 0) + 1;
    return `SCR-${dateStr}-${sequence.toString().padStart(3, '0')}`;
  }

  /**
   * Generate unique melting number
   */
  private async generateMeltingNumber(storeId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(2, 10).replace(/-/g, '');

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(meltingRecords)
      .where(
        and(
          eq(meltingRecords.storeId, storeId),
          gte(meltingRecords.createdAt, new Date(today.setHours(0, 0, 0, 0)))
        )
      );

    const sequence = (result?.count || 0) + 1;
    return `MLT-${dateStr}-${sequence.toString().padStart(3, '0')}`;
  }

  /**
   * Add scrap to inventory
   */
  async addScrap(input: {
    storeId: string;
    scrapType: string;
    metalType?: string;
    grossWeight: number;
    estimatedPurity?: number;
    sourceJobCardId?: string;
    sourceKarigarId?: string;
    sourceDescription?: string;
    goldRateAtCollection?: number;
    notes?: string;
    collectedBy: string;
  }) {
    const scrapCode = await this.generateScrapCode(input.storeId);

    // Calculate fine gold equivalent
    const estimatedFineWeight = input.estimatedPurity
      ? metalAccountingService.convertToFineGold(input.grossWeight, input.estimatedPurity)
      : null;

    // Calculate estimated value
    const estimatedValue =
      input.goldRateAtCollection && estimatedFineWeight
        ? estimatedFineWeight * input.goldRateAtCollection
        : null;

    const [scrap] = await db
      .insert(scrapInventory)
      .values({
        storeId: input.storeId,
        scrapCode,
        scrapType: input.scrapType,
        metalType: input.metalType || 'gold',
        grossWeight: input.grossWeight.toFixed(3),
        estimatedPurity: input.estimatedPurity?.toFixed(2),
        estimatedFineWeight: estimatedFineWeight?.toFixed(4),
        sourceJobCardId: input.sourceJobCardId,
        sourceKarigarId: input.sourceKarigarId,
        sourceDescription: input.sourceDescription,
        estimatedValue: estimatedValue?.toFixed(2),
        goldRateAtCollection: input.goldRateAtCollection?.toFixed(2),
        status: 'accumulated',
        collectedBy: input.collectedBy,
        notes: input.notes,
      })
      .returning();

    return scrap;
  }

  /**
   * List scrap inventory
   */
  async listScrap(params: {
    storeId: string;
    status?: string;
    scrapType?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [eq(scrapInventory.storeId, params.storeId)];

    if (params.status) {
      conditions.push(eq(scrapInventory.status, params.status));
    }
    if (params.scrapType) {
      conditions.push(eq(scrapInventory.scrapType, params.scrapType));
    }

    const items = await db
      .select()
      .from(scrapInventory)
      .where(and(...conditions))
      .orderBy(desc(scrapInventory.collectedAt))
      .limit(params.limit || 100)
      .offset(params.offset || 0);

    // Get totals
    const [totals] = await db
      .select({
        totalWeight: sql<number>`coalesce(sum(${scrapInventory.grossWeight}), 0)`,
        totalFineWeight: sql<number>`coalesce(sum(${scrapInventory.estimatedFineWeight}), 0)`,
        totalValue: sql<number>`coalesce(sum(${scrapInventory.estimatedValue}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(scrapInventory)
      .where(and(...conditions));

    return {
      items,
      totals: {
        totalWeight: parseFloat(totals?.totalWeight?.toString() || '0'),
        totalFineWeight: parseFloat(totals?.totalFineWeight?.toString() || '0'),
        totalValue: parseFloat(totals?.totalValue?.toString() || '0'),
        count: parseInt(totals?.count?.toString() || '0'),
      },
    };
  }

  /**
   * Get scrap statistics
   */
  async getScrapStatistics(storeId: string) {
    const [accumulated] = await db
      .select({
        totalWeight: sql<number>`coalesce(sum(${scrapInventory.grossWeight}), 0)`,
        totalFineWeight: sql<number>`coalesce(sum(${scrapInventory.estimatedFineWeight}), 0)`,
        totalValue: sql<number>`coalesce(sum(${scrapInventory.estimatedValue}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(scrapInventory)
      .where(
        and(eq(scrapInventory.storeId, storeId), eq(scrapInventory.status, 'accumulated'))
      );

    const [melted] = await db
      .select({
        totalWeight: sql<number>`coalesce(sum(${scrapInventory.grossWeight}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(scrapInventory)
      .where(
        and(eq(scrapInventory.storeId, storeId), eq(scrapInventory.status, 'melted'))
      );

    const byType = await db
      .select({
        scrapType: scrapInventory.scrapType,
        totalWeight: sql<number>`coalesce(sum(${scrapInventory.grossWeight}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(scrapInventory)
      .where(
        and(eq(scrapInventory.storeId, storeId), eq(scrapInventory.status, 'accumulated'))
      )
      .groupBy(scrapInventory.scrapType);

    return {
      accumulated: {
        totalWeight: parseFloat(accumulated?.totalWeight?.toString() || '0'),
        totalFineWeight: parseFloat(accumulated?.totalFineWeight?.toString() || '0'),
        totalValue: parseFloat(accumulated?.totalValue?.toString() || '0'),
        count: parseInt(accumulated?.count?.toString() || '0'),
      },
      melted: {
        totalWeight: parseFloat(melted?.totalWeight?.toString() || '0'),
        count: parseInt(melted?.count?.toString() || '0'),
      },
      byType: byType.map((t) => ({
        type: t.scrapType,
        weight: parseFloat(t.totalWeight?.toString() || '0'),
        count: parseInt(t.count?.toString() || '0'),
      })),
    };
  }

  /**
   * Create a melting record
   */
  async createMeltingRecord(input: {
    storeId: string;
    scrapIds: string[];
    inputPurity?: number;
    refinerName?: string;
    notes?: string;
    createdBy: string;
  }) {
    const meltingNumber = await this.generateMeltingNumber(input.storeId);

    // Get the scrap items
    const scrapItems = await db
      .select()
      .from(scrapInventory)
      .where(
        and(
          inArray(scrapInventory.id, input.scrapIds),
          eq(scrapInventory.status, 'accumulated')
        )
      );

    if (scrapItems.length === 0) {
      throw new Error('No valid scrap items found');
    }

    // Calculate totals
    const inputWeight = scrapItems.reduce(
      (sum, item) => sum + parseFloat(item.grossWeight),
      0
    );
    const inputFineGold = scrapItems.reduce(
      (sum, item) => sum + parseFloat(item.estimatedFineWeight || '0'),
      0
    );

    // Create the melting record
    const [record] = await db
      .insert(meltingRecords)
      .values({
        storeId: input.storeId,
        meltingNumber,
        meltingDate: new Date(),
        inputWeight: inputWeight.toFixed(3),
        inputPurity: input.inputPurity?.toFixed(2),
        inputFineGold: inputFineGold.toFixed(4),
        scrapItems: JSON.stringify(scrapItems.map((s) => s.id)),
        refinerName: input.refinerName,
        status: 'pending',
        notes: input.notes,
        createdBy: input.createdBy,
      })
      .returning();

    // Mark scrap items as in-process
    await db
      .update(scrapInventory)
      .set({ status: 'in_process', updatedAt: new Date() })
      .where(inArray(scrapInventory.id, input.scrapIds));

    return record;
  }

  /**
   * Complete a melting record
   */
  async completeMeltingRecord(
    meltingId: string,
    input: {
      outputWeight: number;
      outputPurity: number;
      refiningCost?: number;
      refinerInvoice?: string;
      notes?: string;
    }
  ) {
    // Get the melting record
    const [record] = await db
      .select()
      .from(meltingRecords)
      .where(eq(meltingRecords.id, meltingId));

    if (!record) {
      throw new Error('Melting record not found');
    }

    if (record.status === 'completed') {
      throw new Error('Melting record already completed');
    }

    const inputWeight = parseFloat(record.inputWeight);
    const outputFineGold = metalAccountingService.convertToFineGold(
      input.outputWeight,
      input.outputPurity
    );

    const meltingLoss = inputWeight - input.outputWeight;
    const meltingLossPercentage = (meltingLoss / inputWeight) * 100;
    const recoveryPercentage = (input.outputWeight / inputWeight) * 100;

    // Update the melting record
    const [updated] = await db
      .update(meltingRecords)
      .set({
        outputWeight: input.outputWeight.toFixed(3),
        outputPurity: input.outputPurity.toFixed(2),
        outputFineGold: outputFineGold.toFixed(4),
        recoveryPercentage: recoveryPercentage.toFixed(2),
        meltingLoss: meltingLoss.toFixed(4),
        meltingLossPercentage: meltingLossPercentage.toFixed(2),
        refiningCost: input.refiningCost?.toFixed(2),
        refinerInvoice: input.refinerInvoice,
        status: 'completed',
        completedAt: new Date(),
        notes: input.notes || record.notes,
        updatedAt: new Date(),
      })
      .where(eq(meltingRecords.id, meltingId))
      .returning();

    // Mark scrap items as melted
    const scrapIds = JSON.parse(record.scrapItems as string) as string[];
    await db
      .update(scrapInventory)
      .set({ status: 'melted', updatedAt: new Date() })
      .where(inArray(scrapInventory.id, scrapIds));

    return updated;
  }

  /**
   * List melting records
   */
  async listMeltingRecords(params: {
    storeId: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [eq(meltingRecords.storeId, params.storeId)];

    if (params.status) {
      conditions.push(eq(meltingRecords.status, params.status));
    }

    const records = await db
      .select()
      .from(meltingRecords)
      .where(and(...conditions))
      .orderBy(desc(meltingRecords.meltingDate))
      .limit(params.limit || 100)
      .offset(params.offset || 0);

    return records;
  }

  /**
   * Get melting record by ID
   */
  async getMeltingRecord(meltingId: string) {
    const [record] = await db
      .select()
      .from(meltingRecords)
      .where(eq(meltingRecords.id, meltingId));

    if (!record) {
      return null;
    }

    // Get associated scrap items
    let scrapItems: any[] = [];
    if (record.scrapItems) {
      const scrapIds = JSON.parse(record.scrapItems as string) as string[];
      scrapItems = await db
        .select()
        .from(scrapInventory)
        .where(inArray(scrapInventory.id, scrapIds));
    }

    return { ...record, scrapItemDetails: scrapItems };
  }

  /**
   * Get melting statistics
   */
  async getMeltingStatistics(storeId: string) {
    const [pending] = await db
      .select({ count: sql<number>`count(*)` })
      .from(meltingRecords)
      .where(
        and(eq(meltingRecords.storeId, storeId), eq(meltingRecords.status, 'pending'))
      );

    const [completed] = await db
      .select({
        count: sql<number>`count(*)`,
        totalInput: sql<number>`coalesce(sum(${meltingRecords.inputWeight}), 0)`,
        totalOutput: sql<number>`coalesce(sum(${meltingRecords.outputWeight}), 0)`,
        totalCost: sql<number>`coalesce(sum(${meltingRecords.refiningCost}), 0)`,
        avgRecovery: sql<number>`coalesce(avg(${meltingRecords.recoveryPercentage}), 0)`,
      })
      .from(meltingRecords)
      .where(
        and(eq(meltingRecords.storeId, storeId), eq(meltingRecords.status, 'completed'))
      );

    return {
      pending: parseInt(pending?.count?.toString() || '0'),
      completed: {
        count: parseInt(completed?.count?.toString() || '0'),
        totalInput: parseFloat(completed?.totalInput?.toString() || '0'),
        totalOutput: parseFloat(completed?.totalOutput?.toString() || '0'),
        totalCost: parseFloat(completed?.totalCost?.toString() || '0'),
        avgRecovery: parseFloat(completed?.avgRecovery?.toString() || '0'),
      },
    };
  }
}

export const scrapService = new ScrapService();
