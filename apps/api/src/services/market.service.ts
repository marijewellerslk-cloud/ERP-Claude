import { db } from '../config/database.js';
import { marketData } from '../db/schema.js';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

// 1 Troy Ounce = 31.1035 grams
const TROY_OUNCE_TO_GRAMS = 31.1035;
// 22K purity factor (world gold is typically quoted in 24K/999)
const PURITY_22K_FACTOR = 91.67 / 99.9;

export interface MarketDataInput {
    date: string; // ISO date string 'YYYY-MM-DD'
    worldGoldPriceUsd?: number; // USD per Troy Ounce
    seaStreetPriceLkr?: number; // LKR per Gram (22K)
    lkrUsdtRate?: number; // 1 USDT = X LKR
    notes?: string;
}

export interface MarketDataRecord {
    id: string;
    date: string;
    worldGoldPriceUsd: number | null;
    seaStreetPriceLkr: number | null;
    lkrUsdtRate: number | null;
    worldGoldPriceLkrGram: number | null;
    spreadPercentage: number | null;
    notes: string | null;
    createdAt: string;
}

export class MarketService {
    /**
     * Convert world gold price (USD/oz, 24K) to LKR per gram (22K)
     */
    private calculateWorldPriceLkrGram(
        worldPriceUsdOz: number,
        lkrUsdtRate: number
    ): number {
        // Step 1: USD/oz → USD/gram (24K)
        const usdPerGram24K = worldPriceUsdOz / TROY_OUNCE_TO_GRAMS;
        // Step 2: USD/gram → LKR/gram (24K)
        const lkrPerGram24K = usdPerGram24K * lkrUsdtRate;
        // Step 3: 24K → 22K equivalent
        const lkrPerGram22K = lkrPerGram24K * PURITY_22K_FACTOR;
        return Math.round(lkrPerGram22K * 100) / 100;
    }

    /**
     * Calculate spread % between Sea Street and derived World price
     */
    private calculateSpread(
        seaStreetLkr: number,
        worldPriceLkrGram: number
    ): number {
        if (worldPriceLkrGram === 0) return 0;
        return ((seaStreetLkr - worldPriceLkrGram) / worldPriceLkrGram) * 100;
    }

    /**
     * Create or update daily market data
     */
    async upsertDailyRate(
        data: MarketDataInput,
        userId: string
    ): Promise<MarketDataRecord> {
        try {
            // Normalize date to start of day
            const dateObj = new Date(data.date);
            dateObj.setHours(0, 0, 0, 0);

            // Calculate derived fields
            let worldGoldPriceLkrGram: number | null = null;
            let spreadPercentage: number | null = null;

            if (data.worldGoldPriceUsd && data.lkrUsdtRate) {
                worldGoldPriceLkrGram = this.calculateWorldPriceLkrGram(
                    data.worldGoldPriceUsd,
                    data.lkrUsdtRate
                );
            }

            if (data.seaStreetPriceLkr && worldGoldPriceLkrGram) {
                spreadPercentage = this.calculateSpread(
                    data.seaStreetPriceLkr,
                    worldGoldPriceLkrGram
                );
            }

            // Check if entry already exists for this date
            const existing = await db
                .select({ id: marketData.id })
                .from(marketData)
                .where(eq(marketData.date, dateObj))
                .limit(1);

            let result;

            if (existing.length > 0) {
                // Update existing record
                [result] = await db
                    .update(marketData)
                    .set({
                        worldGoldPriceUsd: data.worldGoldPriceUsd?.toFixed(2) ?? null,
                        seaStreetPriceLkr: data.seaStreetPriceLkr?.toFixed(2) ?? null,
                        lkrUsdtRate: data.lkrUsdtRate?.toFixed(4) ?? null,
                        worldGoldPriceLkrGram: worldGoldPriceLkrGram?.toFixed(2) ?? null,
                        spreadPercentage: spreadPercentage?.toFixed(4) ?? null,
                        notes: data.notes ?? null,
                        updatedAt: new Date(),
                    })
                    .where(eq(marketData.id, existing[0].id))
                    .returning();
            } else {
                // Insert new record
                [result] = await db
                    .insert(marketData)
                    .values({
                        date: dateObj,
                        worldGoldPriceUsd: data.worldGoldPriceUsd?.toFixed(2) ?? null,
                        seaStreetPriceLkr: data.seaStreetPriceLkr?.toFixed(2) ?? null,
                        lkrUsdtRate: data.lkrUsdtRate?.toFixed(4) ?? null,
                        worldGoldPriceLkrGram: worldGoldPriceLkrGram?.toFixed(2) ?? null,
                        spreadPercentage: spreadPercentage?.toFixed(4) ?? null,
                        notes: data.notes ?? null,
                        createdBy: userId,
                    })
                    .returning();
            }

            logger.info('Market data upserted', { date: data.date, userId });

            return this.mapToRecord(result);
        } catch (error) {
            logger.error('Failed to upsert market data', { error, data });
            throw error;
        }
    }

    /**
     * Get market data for a date range
     */
    async getRates(
        startDate?: string,
        endDate?: string,
        limit?: number
    ): Promise<MarketDataRecord[]> {
        try {
            const conditions = [];

            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                conditions.push(gte(marketData.date, start));
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                conditions.push(lte(marketData.date, end));
            }

            const query = db
                .select()
                .from(marketData)
                .where(conditions.length > 0 ? and(...conditions) : undefined)
                .orderBy(desc(marketData.date))
                .limit(limit || 365);

            const results = await query;
            return results.map(this.mapToRecord);
        } catch (error) {
            logger.error('Failed to get market rates', { error, startDate, endDate });
            throw error;
        }
    }

    /**
     * Get the latest market data entry
     */
    async getLatestRate(): Promise<MarketDataRecord | null> {
        try {
            const [result] = await db
                .select()
                .from(marketData)
                .orderBy(desc(marketData.date))
                .limit(1);

            return result ? this.mapToRecord(result) : null;
        } catch (error) {
            logger.error('Failed to get latest market rate', { error });
            throw error;
        }
    }

    /**
     * Delete a market data entry
     */
    async deleteRate(id: string): Promise<void> {
        try {
            await db.delete(marketData).where(eq(marketData.id, id));
            logger.info('Market data deleted', { id });
        } catch (error) {
            logger.error('Failed to delete market data', { error, id });
            throw error;
        }
    }

    /**
     * Map DB row to a clean record
     */
    private mapToRecord(row: any): MarketDataRecord {
        return {
            id: row.id,
            date: row.date instanceof Date ? row.date.toISOString() : row.date,
            worldGoldPriceUsd: row.worldGoldPriceUsd ? parseFloat(row.worldGoldPriceUsd) : null,
            seaStreetPriceLkr: row.seaStreetPriceLkr ? parseFloat(row.seaStreetPriceLkr) : null,
            lkrUsdtRate: row.lkrUsdtRate ? parseFloat(row.lkrUsdtRate) : null,
            worldGoldPriceLkrGram: row.worldGoldPriceLkrGram ? parseFloat(row.worldGoldPriceLkrGram) : null,
            spreadPercentage: row.spreadPercentage ? parseFloat(row.spreadPercentage) : null,
            notes: row.notes,
            createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
        };
    }
}

export const marketService = new MarketService();
