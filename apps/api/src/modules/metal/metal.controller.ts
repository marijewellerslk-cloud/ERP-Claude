import { Request, Response } from 'express';
import { metalAccountingService, PURITY_MAP } from '../../services/metal-accounting.service.js';
import { logger } from '../../utils/logger.js';

class MetalController {
  /**
   * Get metal position for all stores or a specific store
   */
  async getMetalPosition(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.query;
      const user = (req as any).user;

      // If not super admin, restrict to user's store
      const targetStoreId = user.role === 'super_admin' || user.role === 'owner'
        ? (storeId as string | undefined)
        : user.storeId;

      const position = await metalAccountingService.getMetalPosition(targetStoreId);

      res.json({
        success: true,
        data: position,
      });
    } catch (error) {
      logger.error('Failed to get metal position', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get metal position',
      });
    }
  }

  /**
   * Get metal position for a specific store
   */
  async getStoreMetalPosition(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const user = (req as any).user;

      // Verify access to store
      if (user.role !== 'super_admin' && user.role !== 'owner' && user.storeId !== storeId) {
        res.status(403).json({
          success: false,
          error: 'Access denied to this store',
        });
        return;
      }

      const position = await metalAccountingService.getMetalPosition(storeId);

      res.json({
        success: true,
        data: position.stores[0] || null,
      });
    } catch (error) {
      logger.error('Failed to get store metal position', { error, storeId: req.params.storeId });
      res.status(500).json({
        success: false,
        error: 'Failed to get store metal position',
      });
    }
  }

  /**
   * Convert gold weight to fine gold equivalent
   */
  async convertToFineGold(req: Request, res: Response): Promise<void> {
    try {
      const { weight, purity } = req.body;

      if (!weight || !purity) {
        res.status(400).json({
          success: false,
          error: 'Weight and purity are required',
        });
        return;
      }

      const fineGold = metalAccountingService.convertToFineGold(
        parseFloat(weight),
        purity
      );

      const purityPercentage = metalAccountingService.getPurityPercentage(purity.toString());

      res.json({
        success: true,
        data: {
          inputWeight: parseFloat(weight),
          inputPurity: purity,
          purityPercentage,
          fineGoldEquivalent: fineGold,
          calculation: `${weight}g × ${purityPercentage}% ÷ 99.9% = ${fineGold}g fine gold`,
        },
      });
    } catch (error) {
      logger.error('Failed to convert to fine gold', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to convert to fine gold',
      });
    }
  }

  /**
   * Get purity conversion reference table
   */
  async getPurityReference(_req: Request, res: Response): Promise<void> {
    try {
      const reference = Object.entries(PURITY_MAP).map(([code, percentage]) => ({
        code,
        percentage,
        fineGoldPer10g: metalAccountingService.convertToFineGold(10, percentage),
      }));

      res.json({
        success: true,
        data: {
          basePurity: 99.9,
          baseUnit: '24K (Fine Gold)',
          purities: reference,
        },
      });
    } catch (error) {
      logger.error('Failed to get purity reference', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get purity reference',
      });
    }
  }

  /**
   * Backfill fine gold equivalent for existing inventory items
   */
  async backfillFineGold(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.body;
      const user = (req as any).user;

      // Only super admin can run global backfill
      if (!storeId && user.role !== 'super_admin') {
        res.status(403).json({
          success: false,
          error: 'Only super admin can run global backfill',
        });
        return;
      }

      const result = await metalAccountingService.backfillFineGoldForAllItems(storeId);

      res.json({
        success: true,
        data: {
          message: 'Fine gold backfill completed',
          ...result,
        },
      });
    } catch (error) {
      logger.error('Failed to backfill fine gold', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to backfill fine gold',
      });
    }
  }

  /**
   * Get current gold rate
   */
  async getCurrentGoldRate(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.query;
      const user = (req as any).user;

      const targetStoreId = (storeId as string) || user.storeId;
      const rate = await metalAccountingService.getLatestGoldRate(targetStoreId);

      res.json({
        success: true,
        data: {
          rate,
          purity: '22K',
          unit: 'per gram',
          storeId: targetStoreId,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to get gold rate', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get gold rate',
      });
    }
  }
}

export const metalController = new MetalController();
