import { db } from '../config/database.js';
import {
  inventoryItems,
  suppliers,
  supplierAccountTransactions,
  karigars,
  goldRates,
  stores
} from '../db/schema.js';
import { eq, and, sql, desc, sum, isNull, not, gt } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

// Standard purity percentages
export const PURITY_MAP: Record<string, number> = {
  '24K': 99.9,
  '999': 99.9,
  '22K': 91.67,
  '916': 91.67,
  '18K': 75.0,
  '750': 75.0,
  '14K': 58.5,
  '585': 58.5,
  '9K': 37.5,
  '375': 37.5,
};

// Fine gold base (24K = 99.9%)
const FINE_GOLD_PURITY = 99.9;

export interface MetalPosition {
  storeId: string;
  storeName: string;
  storeCode: string;
  // Inventory Holdings
  inventoryGold: {
    totalGrossWeight: number;
    totalNetWeight: number;
    totalFineGold: number;
    byPurity: Record<string, { weight: number; fineGold: number; count: number }>;
    totalValue: number;
  };
  // Gold with Karigars
  karigarGold: {
    totalWeight: number;
    totalFineGold: number;
    karigarCount: number;
  };
  // Supplier Liabilities (Gold Owed)
  supplierGoldOwed: {
    totalWeight: number;
    totalFineGold: number;
    supplierCount: number;
  };
  // Net Position
  netPosition: {
    totalFineGold: number;
    estimatedValue: number;
  };
}

export interface MetalPositionSummary {
  stores: MetalPosition[];
  totals: {
    inventoryFineGold: number;
    karigarFineGold: number;
    supplierOwedFineGold: number;
    netFineGold: number;
    totalEstimatedValue: number;
  };
  goldRate: number;
  calculatedAt: Date;
}

export class MetalAccountingService {
  /**
   * Convert weight to fine gold equivalent based on purity
   * @param weight - Weight in grams
   * @param purity - Purity as percentage (e.g., 91.67 for 22K) or string (e.g., '22K')
   * @returns Fine gold equivalent in grams
   */
  convertToFineGold(weight: number, purity: number | string): number {
    let purityPercentage: number;

    if (typeof purity === 'string') {
      // Check if it's a known purity code
      purityPercentage = PURITY_MAP[purity.toUpperCase()] || parseFloat(purity);
    } else {
      purityPercentage = purity;
    }

    if (isNaN(purityPercentage) || purityPercentage <= 0) {
      logger.warn('Invalid purity for fine gold conversion', { weight, purity });
      return 0;
    }

    // Convert to fine gold: (weight * purity) / 100
    // Then normalize to 24K base
    const fineGold = (weight * purityPercentage) / FINE_GOLD_PURITY;
    return Math.round(fineGold * 10000) / 10000; // Round to 4 decimal places
  }

  /**
   * Get purity percentage from string representation
   * @param purityStr - Purity string like '22K', '916', '18K', etc.
   * @returns Purity as percentage
   */
  getPurityPercentage(purityStr: string): number {
    if (!purityStr) return 0;

    const normalized = purityStr.toUpperCase().trim();

    if (PURITY_MAP[normalized]) {
      return PURITY_MAP[normalized];
    }

    // Try to parse as number
    const parsed = parseFloat(purityStr);
    if (!isNaN(parsed)) {
      // If less than 100, assume it's already a percentage
      // If 916, 750, etc., convert to percentage
      if (parsed > 100) {
        return parsed / 10; // 916 -> 91.6
      }
      return parsed;
    }

    return 0;
  }

  /**
   * Calculate fine gold from purity string (handles common formats)
   */
  calculateFineGoldFromPurityString(weight: number, purityStr: string | null): number {
    if (!purityStr || !weight) return 0;

    const purityPercentage = this.getPurityPercentage(purityStr);
    return this.convertToFineGold(weight, purityPercentage);
  }

  /**
   * Get the latest gold rate for calculations
   */
  async getLatestGoldRate(): Promise<number> {
    try {
      const conditions = [eq(goldRates.purity, '22K')];

      const [rate] = await db
        .select()
        .from(goldRates)
        .where(and(...conditions))
        .orderBy(desc(goldRates.date))
        .limit(1);

      return rate ? parseFloat(rate.ratePerGram) : 0;
    } catch (error) {
      logger.error('Failed to get latest gold rate', { error, storeId });
      return 0;
    }
  }

  /**
   * Get comprehensive metal position for a store or all stores
   */
  async getMetalPosition(storeId?: string): Promise<MetalPositionSummary> {
    try {
      // Get stores to process
      const storeConditions = storeId ? eq(stores.id, storeId) : eq(stores.isActive, true);
      const storeList = await db
        .select({
          id: stores.id,
          name: stores.name,
          code: stores.code,
        })
        .from(stores)
        .where(storeConditions);

      const goldRate = await this.getLatestGoldRate();
      const positions: MetalPosition[] = [];

      for (const store of storeList) {
        const position = await this.getStoreMetalPosition(store.id, store.name, store.code || '');
        positions.push(position);
      }

      // Calculate totals
      const totals = {
        inventoryFineGold: positions.reduce((sum, p) => sum + p.inventoryGold.totalFineGold, 0),
        karigarFineGold: positions.reduce((sum, p) => sum + p.karigarGold.totalFineGold, 0),
        supplierOwedFineGold: positions.reduce((sum, p) => sum + p.supplierGoldOwed.totalFineGold, 0),
        netFineGold: 0,
        totalEstimatedValue: 0,
      };

      totals.netFineGold = totals.inventoryFineGold + totals.karigarFineGold - totals.supplierOwedFineGold;
      totals.totalEstimatedValue = totals.netFineGold * goldRate;

      return {
        stores: positions,
        totals,
        goldRate,
        calculatedAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to get metal position', { error, storeId });
      throw error;
    }
  }

  /**
   * Get metal position for a specific store
   */
  private async getStoreMetalPosition(
    storeId: string,
    storeName: string,
    storeCode: string
  ): Promise<MetalPosition> {
    const goldRate = await this.getLatestGoldRate();

    // Get inventory gold holdings
    const inventoryData = await db
      .select({
        purity: inventoryItems.purity,
        grossWeight: sql<number>`COALESCE(SUM(${inventoryItems.grossWeight}), 0)`,
        netWeight: sql<number>`COALESCE(SUM(${inventoryItems.netWeight}), 0)`,
        fineGold: sql<number>`COALESCE(SUM(${inventoryItems.fineGoldEquivalent}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.storeId, storeId),
          eq(inventoryItems.status, 'available'),
          eq(inventoryItems.isActive, true),
          eq(inventoryItems.metalType, 'gold')
        )
      )
      .groupBy(inventoryItems.purity);

    // Build purity breakdown
    const byPurity: Record<string, { weight: number; fineGold: number; count: number }> = {};
    let totalGrossWeight = 0;
    let totalNetWeight = 0;
    let totalFineGold = 0;

    for (const row of inventoryData) {
      const purity = row.purity || 'Unknown';
      const weight = parseFloat(row.netWeight?.toString() || '0');
      const fineGold = parseFloat(row.fineGold?.toString() || '0');
      const count = parseInt(row.count?.toString() || '0');

      byPurity[purity] = { weight, fineGold, count };
      totalGrossWeight += parseFloat(row.grossWeight?.toString() || '0');
      totalNetWeight += weight;
      totalFineGold += fineGold;
    }

    // Get gold with karigars
    const [karigarData] = await db
      .select({
        totalWeight: sql<number>`COALESCE(SUM(${karigars.goldBalance}), 0)`,
        totalFineGold: sql<number>`COALESCE(SUM(${karigars.fineGoldBalance}), 0)`,
        karigarCount: sql<number>`COUNT(*)`,
      })
      .from(karigars)
      .where(
        and(
          eq(karigars.storeId, storeId),
          eq(karigars.status, 'active'),
          gt(karigars.goldBalance, 0)
        )
      );

    // Get gold owed to suppliers
    const [supplierData] = await db
      .select({
        totalWeight: sql<number>`COALESCE(SUM(${suppliers.goldBalanceGrams}), 0)`,
        supplierCount: sql<number>`COUNT(*)`,
      })
      .from(suppliers)
      .where(
        and(
          eq(suppliers.storeId, storeId),
          eq(suppliers.isActive, true),
          gt(suppliers.goldBalanceGrams, 0)
        )
      );

    const karigarGold = {
      totalWeight: parseFloat(karigarData?.totalWeight?.toString() || '0'),
      totalFineGold: parseFloat(karigarData?.totalFineGold?.toString() || '0'),
      karigarCount: parseInt(karigarData?.karigarCount?.toString() || '0'),
    };

    const supplierOwedWeight = parseFloat(supplierData?.totalWeight?.toString() || '0');
    const supplierGoldOwed = {
      totalWeight: supplierOwedWeight,
      // Estimate fine gold (assuming 22K for supplier gold)
      totalFineGold: this.convertToFineGold(supplierOwedWeight, 91.67),
      supplierCount: parseInt(supplierData?.supplierCount?.toString() || '0'),
    };

    // Calculate net position
    const netFineGold = totalFineGold + karigarGold.totalFineGold - supplierGoldOwed.totalFineGold;

    return {
      storeId,
      storeName,
      storeCode,
      inventoryGold: {
        totalGrossWeight,
        totalNetWeight,
        totalFineGold,
        byPurity,
        totalValue: totalFineGold * goldRate,
      },
      karigarGold,
      supplierGoldOwed,
      netPosition: {
        totalFineGold: netFineGold,
        estimatedValue: netFineGold * goldRate,
      },
    };
  }

  /**
   * Update fine gold equivalent for an inventory item
   */
  async updateInventoryFineGold(itemId: string): Promise<void> {
    try {
      const [item] = await db
        .select({
          netWeight: inventoryItems.netWeight,
          purity: inventoryItems.purity,
        })
        .from(inventoryItems)
        .where(eq(inventoryItems.id, itemId));

      if (!item) {
        logger.warn('Item not found for fine gold update', { itemId });
        return;
      }

      const netWeight = parseFloat(item.netWeight?.toString() || '0');
      const fineGold = this.calculateFineGoldFromPurityString(netWeight, item.purity);

      await db
        .update(inventoryItems)
        .set({
          fineGoldEquivalent: fineGold.toFixed(4),
          updatedAt: new Date(),
        })
        .where(eq(inventoryItems.id, itemId));

      logger.debug('Updated fine gold for item', { itemId, fineGold });
    } catch (error) {
      logger.error('Failed to update fine gold for item', { error, itemId });
      throw error;
    }
  }

  /**
   * Backfill fine gold equivalent for all inventory items
   */
  async backfillFineGoldForAllItems(storeId?: string): Promise<{ updated: number; errors: number }> {
    try {
      const conditions = [
        eq(inventoryItems.metalType, 'gold'),
        isNull(inventoryItems.fineGoldEquivalent),
      ];

      if (storeId) {
        conditions.push(eq(inventoryItems.storeId, storeId));
      }

      const items = await db
        .select({
          id: inventoryItems.id,
          netWeight: inventoryItems.netWeight,
          purity: inventoryItems.purity,
        })
        .from(inventoryItems)
        .where(and(...conditions));

      let updated = 0;
      let errors = 0;

      for (const item of items) {
        try {
          const netWeight = parseFloat(item.netWeight?.toString() || '0');
          const fineGold = this.calculateFineGoldFromPurityString(netWeight, item.purity);

          if (fineGold > 0) {
            await db
              .update(inventoryItems)
              .set({
                fineGoldEquivalent: fineGold.toFixed(4),
                updatedAt: new Date(),
              })
              .where(eq(inventoryItems.id, item.id));
            updated++;
          }
        } catch (err) {
          errors++;
          logger.error('Failed to update item fine gold', { error: err, itemId: item.id });
        }
      }

      logger.info('Fine gold backfill completed', { updated, errors, total: items.length });
      return { updated, errors };
    } catch (error) {
      logger.error('Failed to backfill fine gold', { error, storeId });
      throw error;
    }
  }

  /**
   * Record a supplier transaction with fine gold calculation
   */
  async calculateTransactionFineGold(
    goldWeight: number,
    purityStr: string | null
  ): Promise<{ fineGold: number; purityPercentage: number }> {
    const purityPercentage = purityStr ? this.getPurityPercentage(purityStr) : 91.67; // Default to 22K
    const fineGold = this.convertToFineGold(goldWeight, purityPercentage);

    return { fineGold, purityPercentage };
  }

  /**
   * Get metal P&L for a period (profit/loss in grams)
   */
  async getMetalProfitLoss(
    storeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    goldPurchased: number;
    goldSold: number;
    goldUsedInManufacturing: number;
    wastage: number;
    netMetalChange: number;
    fineGoldEquivalent: {
      purchased: number;
      sold: number;
      manufactured: number;
      wastage: number;
      netChange: number;
    };
  }> {
    // This would need to aggregate from various sources
    // For now, return a placeholder structure
    return {
      goldPurchased: 0,
      goldSold: 0,
      goldUsedInManufacturing: 0,
      wastage: 0,
      netMetalChange: 0,
      fineGoldEquivalent: {
        purchased: 0,
        sold: 0,
        manufactured: 0,
        wastage: 0,
        netChange: 0,
      },
    };
  }
}

// Export singleton instance
export const metalAccountingService = new MetalAccountingService();
