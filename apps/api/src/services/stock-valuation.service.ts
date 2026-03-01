import { db } from '../config/database.js';
import { inventoryItems, goldRates } from '../db/schema.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { calculateFineGoldEquivalent } from '../utils/metal-utils.js';
import { logger } from '../utils/logger.js';

export class StockValuationService {
  /**
   * Revalues all inventory items based on the latest gold rates
   */
  async revalueInventory(storeId: string) {
    try {
      // Get the latest gold rate for the store
      const latestGoldRate = await db
        .select()
        .from(goldRates)
        .where(and(
          eq(goldRates.goldType, '24K'),
          eq(goldRates.storeId, storeId)
        ))
        .orderBy(desc(goldRates.date))
        .limit(1);

      if (!latestGoldRate || latestGoldRate.length === 0) {
        throw new Error('No gold rate found for revaluation');
      }

      const currentGoldRate = latestGoldRate[0].ratePerGram;
      const currentDate = new Date();

      // Get all inventory items for the store that are not sold
      const items = await db
        .select()
        .from(inventoryItems)
        .where(and(
          eq(inventoryItems.storeId, storeId),
          sql`${inventoryItems.status} != 'sold'`
        ));

      const updates = [];
      for (const item of items) {
        // Calculate current market value based on the rate-based method
        const netWeight = parseFloat(item.netWeight || item.grossWeight || '0');
        const purityFactor = this.parsePurity(item.purity);
        
        // For rate-based method: (Gold Rate per Sovereign / 8) * Weight * (Rate Percentage / 100)
        // Assuming 8g sovereign and using costRatePercentage if available
        let currentMarketValue: number;
        
        if (item.costRatePercentage) {
          // Use rate-based method if costRatePercentage is available
          const ratePercentage = parseFloat(item.costRatePercentage);
          currentMarketValue = (currentGoldRate / 8) * netWeight * (ratePercentage / 100);
        } else {
          // Fall back to traditional method: fine gold weight * current rate
          const fineGoldWeight = calculateFineGoldEquivalent(
            netWeight,
            item.purity,
            item.metalType as 'gold' | 'silver' | 'platinum' || 'gold'
          );
          currentMarketValue = fineGoldWeight * currentGoldRate;
        }

        // Calculate original cost if not already available
        const originalCost = item.calculatedCost ? parseFloat(item.calculatedCost) : 0;
        const unrealizedGainLoss = currentMarketValue - originalCost;

        updates.push(
          db
            .update(inventoryItems)
            .set({
              currentMarketValue: currentMarketValue.toFixed(2),
              unrealizedGainLoss: unrealizedGainLoss.toFixed(2),
              lastValuationDate: currentDate,
              updatedAt: new Date(),
            })
            .where(eq(inventoryItems.id, item.id))
        );
      }

      // Execute all updates in a transaction
      if (updates.length > 0) {
        await Promise.all(updates);
      }

      logger.info(`Revalued ${updates.length} items for store ${storeId} at rate ${currentGoldRate}`);

      return {
        success: true,
        itemsUpdated: updates.length,
        goldRateUsed: currentGoldRate,
        valuationDate: currentDate,
      };
    } catch (error) {
      logger.error('Error during inventory revaluation:', error);
      throw error;
    }
  }

  /**
   * Revalues all stores
   */
  async revalueAllStores() {
    // Get all stores
    const { stores } = await import('../db/schema.js');
    const allStores = await db.select().from(stores);

    const results = [];
    for (const store of allStores) {
      try {
        const result = await this.revalueInventory(store.id);
        results.push(result);
      } catch (error) {
        logger.error(`Error revaluing store ${store.id}:`, error);
        results.push({
          success: false,
          storeId: store.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Gets current market value for a specific item
   */
  async getCurrentMarketValue(itemId: string) {
    const item = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, itemId))
      .limit(1);

    if (!item || item.length === 0) {
      throw new Error('Item not found');
    }

    const inventoryItem = item[0];

    // Get the latest gold rate for the store
    const latestGoldRate = await db
      .select()
      .from(goldRates)
      .where(and(
        eq(goldRates.goldType, '24K'),
        eq(goldRates.storeId, inventoryItem.storeId)
      ))
      .orderBy(desc(goldRates.date))
      .limit(1);

    if (!latestGoldRate || latestGoldRate.length === 0) {
      throw new Error('No gold rate found for revaluation');
    }

    const currentGoldRate = latestGoldRate[0].ratePerGram;
    const netWeight = parseFloat(inventoryItem.netWeight || inventoryItem.grossWeight || '0');
    const purityFactor = this.parsePurity(inventoryItem.purity);

    let currentMarketValue: number;
    
    if (inventoryItem.costRatePercentage) {
      // Use rate-based method
      const ratePercentage = parseFloat(inventoryItem.costRatePercentage);
      currentMarketValue = (currentGoldRate / 8) * netWeight * (ratePercentage / 100);
    } else {
      // Use traditional method
      const fineGoldWeight = calculateFineGoldEquivalent(
        netWeight,
        inventoryItem.purity,
        inventoryItem.metalType as 'gold' | 'silver' | 'platinum' || 'gold'
      );
      currentMarketValue = fineGoldWeight * currentGoldRate;
    }

    const originalCost = inventoryItem.calculatedCost ? parseFloat(inventoryItem.calculatedCost) : 0;
    const unrealizedGainLoss = currentMarketValue - originalCost;

    return {
      itemId: inventoryItem.id,
      originalCost,
      currentMarketValue,
      unrealizedGainLoss,
      goldRateUsed: currentGoldRate,
      lastValuationDate: new Date(),
    };
  }

  /**
   * Parses purity string to decimal factor
   */
  private parsePurity(purity: string | null | undefined): number {
    if (!purity) return 0;

    const normalized = purity.toLowerCase().trim();
    
    // Handle common purity formats
    if (normalized.includes('24k') || normalized.includes('999')) return 0.999;
    if (normalized.includes('22k') || normalized.includes('916')) return 0.916;
    if (normalized.includes('18k') || normalized.includes('750')) return 0.750;
    if (normalized.includes('14k') || normalized.includes('585')) return 0.585;
    
    // Try to parse as percentage
    const percentage = parseFloat(normalized.replace(/[^\d.]/g, ''));
    if (!isNaN(percentage) && percentage > 0 && percentage <= 100) {
      return percentage / 100;
    }
    
    return 0;
  }
}

export const stockValuationService = new StockValuationService();