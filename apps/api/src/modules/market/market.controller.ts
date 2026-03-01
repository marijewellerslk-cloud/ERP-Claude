import { Request, Response } from 'express';
import { marketService } from '../../services/market.service.js';
import { logger } from '../../utils/logger.js';

class MarketController {
    /**
     * Create or update daily market rate
     * POST /market/rates
     */
    async upsertRate(req: Request, res: Response): Promise<void> {
        try {
            const { date, worldGoldPriceUsd, seaStreetPriceLkr, lkrUsdtRate, notes } = req.body;
            const user = (req as any).user;

            if (!date) {
                res.status(400).json({
                    success: false,
                    error: 'Date is required',
                });
                return;
            }

            // At least one rate must be provided
            if (!worldGoldPriceUsd && !seaStreetPriceLkr && !lkrUsdtRate) {
                res.status(400).json({
                    success: false,
                    error: 'At least one rate value must be provided',
                });
                return;
            }

            const result = await marketService.upsertDailyRate(
                {
                    date,
                    worldGoldPriceUsd: worldGoldPriceUsd ? parseFloat(worldGoldPriceUsd) : undefined,
                    seaStreetPriceLkr: seaStreetPriceLkr ? parseFloat(seaStreetPriceLkr) : undefined,
                    lkrUsdtRate: lkrUsdtRate ? parseFloat(lkrUsdtRate) : undefined,
                    notes,
                },
                user.userId
            );

            res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            logger.error('Failed to upsert market rate', { error });
            res.status(500).json({
                success: false,
                error: 'Failed to save market rate',
            });
        }
    }

    /**
     * Get market rate history
     * GET /market/rates?startDate=&endDate=&limit=
     */
    async getRates(req: Request, res: Response): Promise<void> {
        try {
            const { startDate, endDate, limit } = req.query;

            const rates = await marketService.getRates(
                startDate as string | undefined,
                endDate as string | undefined,
                limit ? parseInt(limit as string) : undefined
            );

            res.json({
                success: true,
                data: rates,
                count: rates.length,
            });
        } catch (error) {
            logger.error('Failed to get market rates', { error });
            res.status(500).json({
                success: false,
                error: 'Failed to get market rates',
            });
        }
    }

    /**
     * Get latest market rate
     * GET /market/rates/latest
     */
    async getLatestRate(_req: Request, res: Response): Promise<void> {
        try {
            const rate = await marketService.getLatestRate();

            res.json({
                success: true,
                data: rate,
            });
        } catch (error) {
            logger.error('Failed to get latest market rate', { error });
            res.status(500).json({
                success: false,
                error: 'Failed to get latest market rate',
            });
        }
    }

    /**
     * Delete a market data entry
     * DELETE /market/rates/:id
     */
    async deleteRate(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            await marketService.deleteRate(id);

            res.json({
                success: true,
                message: 'Market data deleted',
            });
        } catch (error) {
            logger.error('Failed to delete market rate', { error });
            res.status(500).json({
                success: false,
                error: 'Failed to delete market rate',
            });
        }
    }
}

export const marketController = new MarketController();
