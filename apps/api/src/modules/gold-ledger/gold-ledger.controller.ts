import { Request, Response } from 'express';
import { goldLedgerService } from './gold-ledger.service.js';
import { logger } from '../../utils/logger.js';

interface AuthRequest extends Request {
    user?: {
        userId: string;
        storeId: string;
        email: string;
        permissions: string[];
    };
}

class GoldLedgerController {
    async getGoldPosition(req: AuthRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
                });
                return;
            }

            const position = await goldLedgerService.getGoldPosition(req.user.storeId);

            res.json({
                success: true,
                data: position,
            });
        } catch (error: any) {
            logger.error('Get gold position error:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'GET_GOLD_POSITION_FAILED',
                    message: 'Failed to fetch gold position',
                },
            });
        }
    }

    async getGoldInventory(req: AuthRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
                });
                return;
            }

            const { purity, status, limit, offset } = req.query;

            const result = await goldLedgerService.getGoldInventory(
                req.user.storeId,
                { purity: purity as string, status: status as string },
                limit ? parseInt(limit as string) : 50,
                offset ? parseInt(offset as string) : 0
            );

            res.json({
                success: true,
                data: result.items,
                pagination: {
                    total: result.total,
                    limit: result.limit,
                    offset: result.offset,
                },
            });
        } catch (error: any) {
            logger.error('Get gold inventory error:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'GET_GOLD_INVENTORY_FAILED',
                    message: 'Failed to fetch gold inventory',
                },
            });
        }
    }

    async getKarigarGoldMovements(req: AuthRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
                });
                return;
            }

            const movements = await goldLedgerService.getKarigarGoldMovements(req.user.storeId);

            res.json({
                success: true,
                data: movements,
            });
        } catch (error: any) {
            logger.error('Get karigar gold movements error:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'GET_KARIGAR_GOLD_FAILED',
                    message: 'Failed to fetch karigar gold movements',
                },
            });
        }
    }
}

export const goldLedgerController = new GoldLedgerController();
