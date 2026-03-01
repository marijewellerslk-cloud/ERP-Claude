import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { inventoryItems, karigarTransactions } from '../../db/schema.js';
import { logger } from '../../utils/logger.js';

/**
 * Gold Ledger Service
 * 
 * SECURITY: This service is READ-ONLY. It derives gold position from
 * existing inventory and transaction data. No write operations.
 * No database credentials are ever exposed to external services.
 */
class GoldLedgerService {
    // Get overall gold position (in-stock vs sold)
    async getGoldPosition(storeId: string) {
        logger.debug(`Getting gold position for store ${storeId}`);

        // Gold in stock (available items)
        const [inStock] = await db
            .select({
                count: sql<number>`count(*)::int`,
                totalGrossWeight: sql<string>`COALESCE(sum(${inventoryItems.grossWeight}), 0)`,
                totalNetWeight: sql<string>`COALESCE(sum(${inventoryItems.netWeight}), 0)`,
                totalFineGold: sql<string>`COALESCE(sum(${inventoryItems.fineGoldEquivalent}), 0)`,
                totalValue: sql<string>`COALESCE(sum(${inventoryItems.currentMarketValue}), 0)`,
            })
            .from(inventoryItems)
            .where(
                and(
                    eq(inventoryItems.storeId, storeId),
                    eq(inventoryItems.metalType, 'gold'),
                    eq(inventoryItems.status, 'available'),
                    eq(inventoryItems.isActive, true)
                )
            );

        // Gold sold
        const [sold] = await db
            .select({
                count: sql<number>`count(*)::int`,
                totalGrossWeight: sql<string>`COALESCE(sum(${inventoryItems.grossWeight}), 0)`,
                totalNetWeight: sql<string>`COALESCE(sum(${inventoryItems.netWeight}), 0)`,
                totalFineGold: sql<string>`COALESCE(sum(${inventoryItems.fineGoldEquivalent}), 0)`,
                totalRevenue: sql<string>`COALESCE(sum(${inventoryItems.soldPrice}), 0)`,
            })
            .from(inventoryItems)
            .where(
                and(
                    eq(inventoryItems.storeId, storeId),
                    eq(inventoryItems.metalType, 'gold'),
                    eq(inventoryItems.status, 'sold')
                )
            );

        // Breakdown by purity (in-stock)
        const purityBreakdown = await db
            .select({
                purity: inventoryItems.purity,
                count: sql<number>`count(*)::int`,
                grossWeight: sql<string>`COALESCE(sum(${inventoryItems.grossWeight}), 0)`,
                netWeight: sql<string>`COALESCE(sum(${inventoryItems.netWeight}), 0)`,
                fineGold: sql<string>`COALESCE(sum(${inventoryItems.fineGoldEquivalent}), 0)`,
            })
            .from(inventoryItems)
            .where(
                and(
                    eq(inventoryItems.storeId, storeId),
                    eq(inventoryItems.metalType, 'gold'),
                    eq(inventoryItems.status, 'available'),
                    eq(inventoryItems.isActive, true)
                )
            )
            .groupBy(inventoryItems.purity)
            .orderBy(desc(sql`sum(${inventoryItems.grossWeight})`));

        return {
            inStock: {
                count: inStock?.count || 0,
                grossWeight: parseFloat(inStock?.totalGrossWeight || '0'),
                netWeight: parseFloat(inStock?.totalNetWeight || '0'),
                fineGoldEquivalent: parseFloat(inStock?.totalFineGold || '0'),
                currentMarketValue: parseFloat(inStock?.totalValue || '0'),
            },
            sold: {
                count: sold?.count || 0,
                grossWeight: parseFloat(sold?.totalGrossWeight || '0'),
                netWeight: parseFloat(sold?.totalNetWeight || '0'),
                fineGoldEquivalent: parseFloat(sold?.totalFineGold || '0'),
                totalRevenue: parseFloat(sold?.totalRevenue || '0'),
            },
            purityBreakdown: purityBreakdown.map(p => ({
                purity: p.purity || 'Unknown',
                count: p.count,
                grossWeight: parseFloat(p.grossWeight || '0'),
                netWeight: parseFloat(p.netWeight || '0'),
                fineGoldEquivalent: parseFloat(p.fineGold || '0'),
            })),
        };
    }

    // Get gold inventory items (detailed list)
    async getGoldInventory(
        storeId: string,
        filters: { purity?: string; status?: string } = {},
        limit = 50,
        offset = 0
    ) {
        const conditions = [
            eq(inventoryItems.storeId, storeId),
            eq(inventoryItems.metalType, 'gold'),
            eq(inventoryItems.isActive, true),
        ];

        if (filters.purity) {
            conditions.push(eq(inventoryItems.purity, filters.purity));
        }
        if (filters.status) {
            conditions.push(eq(inventoryItems.status, filters.status));
        } else {
            conditions.push(eq(inventoryItems.status, 'available'));
        }

        const items = await db
            .select({
                id: inventoryItems.id,
                sku: inventoryItems.sku,
                name: inventoryItems.name,
                purity: inventoryItems.purity,
                grossWeight: inventoryItems.grossWeight,
                netWeight: inventoryItems.netWeight,
                fineGoldEquivalent: inventoryItems.fineGoldEquivalent,
                currentMarketValue: inventoryItems.currentMarketValue,
                calculatedCost: inventoryItems.calculatedCost,
                status: inventoryItems.status,
                createdAt: inventoryItems.createdAt,
            })
            .from(inventoryItems)
            .where(and(...conditions))
            .orderBy(desc(inventoryItems.createdAt))
            .limit(limit)
            .offset(offset);

        const [countResult] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(inventoryItems)
            .where(and(...conditions));

        return {
            items,
            total: countResult?.count || 0,
            limit,
            offset,
        };
    }

    // Get karigar gold movements (gold given to and received from karigars)
    async getKarigarGoldMovements(storeId: string) {
        // karigarTransactions uses goldAmount and fineGoldAmount (not grossWeight/metalType)
        const movements = await db
            .select({
                transactionType: karigarTransactions.transactionType,
                totalGoldAmount: sql<string>`COALESCE(sum(${karigarTransactions.goldAmount}), 0)`,
                totalFineGold: sql<string>`COALESCE(sum(${karigarTransactions.fineGoldAmount}), 0)`,
                count: sql<number>`count(*)::int`,
            })
            .from(karigarTransactions)
            .where(eq(karigarTransactions.storeId, storeId))
            .groupBy(karigarTransactions.transactionType);

        const result: Record<string, { goldAmount: number; fineGoldAmount: number; count: number }> = {};
        for (const m of movements) {
            result[m.transactionType] = {
                goldAmount: parseFloat(m.totalGoldAmount || '0'),
                fineGoldAmount: parseFloat(m.totalFineGold || '0'),
                count: m.count,
            };
        }

        return result;
    }
}

export const goldLedgerService = new GoldLedgerService();
