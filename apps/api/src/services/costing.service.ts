/**
 * Inventory Costing Service
 * Implements FIFO, LIFO, and Weighted Average costing methods
 */

import { db } from '../config/database.js';
import { inventoryItems, inventoryBatches, inventoryBatchItems } from '../db/schema.js';
import { eq, and, asc, desc, inArray } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

export type CostingMethod = 'fifo' | 'lifo' | 'weighted_average' | 'specific_identification';

interface CostLayer {
  batchId: string;
  batchNumber: string;
  purchaseDate: Date;
  quantity: number;
  unitCost: number;
  totalCost: number;
  goldRateAtPurchase: number;
}

interface CostingResult {
  method: CostingMethod;
  costOfGoodsSold: number;
  costPerUnit: number;
  layersUsed: CostLayer[];
  remainingInventory: CostLayer[];
}

export class CostingService {
  private defaultMethod: CostingMethod = 'fifo';

  /**
   * Get cost of goods sold using specified costing method
   * @param storeId - Store ID
   * @param itemIds - Item IDs being sold
   * @param method - Costing method to use
   */
  async calculateCOGS(
    storeId: string,
    itemIds: string[],
    method: CostingMethod = this.defaultMethod
  ): Promise<CostingResult> {
    // Get items with their batch information
    const items = await db.query.inventoryItems.findMany({
      where: and(
        eq(inventoryItems.storeId, storeId),
        inArray(inventoryItems.id, itemIds)
      ),
      with: {
        batchItems: {
          with: {
            batch: true,
          },
        },
      },
    });

    if (items.length === 0) {
      return {
        method,
        costOfGoodsSold: 0,
        costPerUnit: 0,
        layersUsed: [],
        remainingInventory: [],
      };
    }

    // Build cost layers from batches
    const costLayers: CostLayer[] = [];
    for (const item of items) {
      const batchItem = item.batchItems[0];
      if (batchItem?.batch) {
        const batch = batchItem.batch;
        const unitCost = parseFloat(item.calculatedCost || item.costPrice || '0');
        const goldRate = parseFloat(batch.goldRatePerGram || '0');

        costLayers.push({
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          purchaseDate: batch.purchaseDate,
          quantity: 1,
          unitCost,
          totalCost: unitCost,
          goldRateAtPurchase: goldRate,
        });
      }
    }

    // Sort layers based on method
    let sortedLayers: CostLayer[];
    switch (method) {
      case 'fifo':
        // First In, First Out - oldest first
        sortedLayers = [...costLayers].sort(
          (a, b) => a.purchaseDate.getTime() - b.purchaseDate.getTime()
        );
        break;
      case 'lifo':
        // Last In, First Out - newest first
        sortedLayers = [...costLayers].sort(
          (a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime()
        );
        break;
      case 'weighted_average':
        // Use weighted average cost
        sortedLayers = this.calculateWeightedAverage(costLayers);
        break;
      case 'specific_identification':
        // Use the actual cost of each specific item
        sortedLayers = costLayers;
        break;
      default:
        sortedLayers = costLayers;
    }

    // Calculate total COGS
    const totalCOGS = sortedLayers.reduce((sum, layer) => sum + layer.totalCost, 0);
    const averageCost = sortedLayers.length > 0 ? totalCOGS / sortedLayers.length : 0;

    return {
      method,
      costOfGoodsSold: Math.round(totalCOGS * 100) / 100,
      costPerUnit: Math.round(averageCost * 100) / 100,
      layersUsed: sortedLayers,
      remainingInventory: [],
    };
  }

  /**
   * Calculate weighted average cost
   */
  private calculateWeightedAverage(layers: CostLayer[]): CostLayer[] {
    if (layers.length === 0) return [];

    const totalQuantity = layers.reduce((sum, l) => sum + l.quantity, 0);
    const totalCost = layers.reduce((sum, l) => sum + l.totalCost, 0);
    const weightedAverageCost = totalCost / totalQuantity;

    // Return layers with adjusted cost to weighted average
    return layers.map((layer) => ({
      ...layer,
      unitCost: weightedAverageCost,
      totalCost: weightedAverageCost * layer.quantity,
    }));
  }

  /**
   * Get inventory valuation using specified method
   * @param storeId - Store ID
   * @param categoryId - Optional category filter
   * @param method - Costing method
   */
  async getInventoryValuation(
    storeId: string,
    categoryId?: string,
    method: CostingMethod = this.defaultMethod
  ): Promise<{
    method: CostingMethod;
    totalValue: number;
    itemCount: number;
    layers: CostLayer[];
  }> {
    const conditions: any[] = [
      eq(inventoryItems.storeId, storeId),
      eq(inventoryItems.status, 'available'),
      eq(inventoryItems.isActive, true),
    ];

    if (categoryId) {
      conditions.push(eq(inventoryItems.categoryId, categoryId));
    }

    const items = await db.query.inventoryItems.findMany({
      where: and(...conditions),
      with: {
        batchItems: {
          with: {
            batch: true,
          },
        },
      },
    });

    const costLayers: CostLayer[] = [];
    for (const item of items) {
      const batchItem = item.batchItems[0];
      if (batchItem?.batch) {
        const batch = batchItem.batch;
        const unitCost = parseFloat(item.calculatedCost || item.costPrice || '0');

        costLayers.push({
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          purchaseDate: batch.purchaseDate,
          quantity: 1,
          unitCost,
          totalCost: unitCost,
          goldRateAtPurchase: parseFloat(batch.goldRatePerGram || '0'),
        });
      }
    }

    // Apply costing method
    let valuedLayers: CostLayer[];
    if (method === 'weighted_average') {
      valuedLayers = this.calculateWeightedAverage(costLayers);
    } else {
      valuedLayers = costLayers;
    }

    const totalValue = valuedLayers.reduce((sum, l) => sum + l.totalCost, 0);

    return {
      method,
      totalValue: Math.round(totalValue * 100) / 100,
      itemCount: items.length,
      layers: valuedLayers,
    };
  }

  /**
   * Get cost comparison between different methods
   */
  async compareCostingMethods(
    storeId: string,
    itemIds: string[]
  ): Promise<Record<CostingMethod, CostingResult>> {
    const methods: CostingMethod[] = ['fifo', 'lifo', 'weighted_average', 'specific_identification'];

    const results: Record<string, CostingResult> = {};

    for (const method of methods) {
      results[method] = await this.calculateCOGS(storeId, itemIds, method);
    }

    return results as Record<CostingMethod, CostingResult>;
  }

  /**
   * Calculate gross profit using specified costing method
   */
  async calculateGrossProfit(
    storeId: string,
    itemIds: string[],
    salePrice: number,
    method: CostingMethod = this.defaultMethod
  ): Promise<{
    salePrice: number;
    costOfGoodsSold: number;
    grossProfit: number;
    grossMarginPercent: number;
    method: CostingMethod;
  }> {
    const cogsResult = await this.calculateCOGS(storeId, itemIds, method);

    const grossProfit = salePrice - cogsResult.costOfGoodsSold;
    const grossMarginPercent = salePrice > 0 ? (grossProfit / salePrice) * 100 : 0;

    return {
      salePrice,
      costOfGoodsSold: cogsResult.costOfGoodsSold,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossMarginPercent: Math.round(grossMarginPercent * 100) / 100,
      method,
    };
  }

  /**
   * Get batch cost history for an item
   */
  async getItemCostHistory(itemId: string): Promise<{
    currentCost: number;
    purchaseHistory: Array<{
      batchNumber: string;
      purchaseDate: Date;
      cost: number;
      goldRate: number;
    }>;
  }> {
    const item = await db.query.inventoryItems.findFirst({
      where: eq(inventoryItems.id, itemId),
      with: {
        batchItems: {
          with: {
            batch: true,
          },
        },
      },
    });

    if (!item) {
      throw new Error('Item not found');
    }

    const currentCost = parseFloat(item.calculatedCost || item.costPrice || '0');
    const purchaseHistory = item.batchItems.map((bi) => ({
      batchNumber: bi.batch.batchNumber,
      purchaseDate: bi.batch.purchaseDate,
      cost: parseFloat(item.calculatedCost || item.costPrice || '0'),
      goldRate: parseFloat(bi.batch.goldRatePerGram || '0'),
    }));

    return {
      currentCost,
      purchaseHistory,
    };
  }
}

export const costingService = new CostingService();
