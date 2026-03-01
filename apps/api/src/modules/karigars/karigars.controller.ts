import { Request, Response } from 'express';
import { karigarsService } from './karigars.service.js';
import { logger } from '../../utils/logger.js';

class KarigarsController {
  /**
   * Create a new karigar
   */
  async createKarigar(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const storeId = req.body.storeId || user.storeId;

      if (!storeId) {
        res.status(400).json({
          success: false,
          error: 'Store ID is required',
        });
        return;
      }

      const karigar = await karigarsService.createKarigar({
        ...req.body,
        storeId,
      });

      res.status(201).json({
        success: true,
        data: karigar,
      });
    } catch (error) {
      logger.error('Failed to create karigar', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to create karigar',
      });
    }
  }

  /**
   * Get karigar by ID
   */
  async getKarigar(req: Request, res: Response): Promise<void> {
    try {
      const { karigarId } = req.params;

      const karigar = await karigarsService.getKarigarById(karigarId);

      if (!karigar) {
        res.status(404).json({
          success: false,
          error: 'Karigar not found',
        });
        return;
      }

      res.json({
        success: true,
        data: karigar,
      });
    } catch (error) {
      logger.error('Failed to get karigar', { error, karigarId: req.params.karigarId });
      res.status(500).json({
        success: false,
        error: 'Failed to get karigar',
      });
    }
  }

  /**
   * List karigars
   */
  async listKarigars(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const storeId = (req.query.storeId as string) || user.storeId;

      if (!storeId) {
        res.status(400).json({
          success: false,
          error: 'Store ID is required',
        });
        return;
      }

      const result = await karigarsService.listKarigars({
        storeId,
        status: req.query.status as string,
        search: req.query.search as string,
        specialization: req.query.specialization as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      });

      res.json({
        success: true,
        data: result.karigars,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error) {
      logger.error('Failed to list karigars', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to list karigars',
      });
    }
  }

  /**
   * Update karigar
   */
  async updateKarigar(req: Request, res: Response): Promise<void> {
    try {
      const { karigarId } = req.params;

      const karigar = await karigarsService.updateKarigar(karigarId, req.body);

      if (!karigar) {
        res.status(404).json({
          success: false,
          error: 'Karigar not found',
        });
        return;
      }

      res.json({
        success: true,
        data: karigar,
      });
    } catch (error) {
      logger.error('Failed to update karigar', { error, karigarId: req.params.karigarId });
      res.status(500).json({
        success: false,
        error: 'Failed to update karigar',
      });
    }
  }

  /**
   * Get karigar ledger
   */
  async getKarigarLedger(req: Request, res: Response): Promise<void> {
    try {
      const { karigarId } = req.params;

      const result = await karigarsService.getKarigarLedger(karigarId, {
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        transactionType: req.query.transactionType as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
      });

      res.json({
        success: true,
        data: result.transactions,
        summary: result.summary,
        meta: {
          total: result.total,
        },
      });
    } catch (error) {
      logger.error('Failed to get karigar ledger', { error, karigarId: req.params.karigarId });
      res.status(500).json({
        success: false,
        error: 'Failed to get karigar ledger',
      });
    }
  }

  /**
   * Record a payment to karigar
   */
  async makePayment(req: Request, res: Response): Promise<void> {
    try {
      const { karigarId } = req.params;
      const user = (req as any).user;
      const { amount, paymentMethod, paymentReference } = req.body;

      if (!amount || amount <= 0) {
        res.status(400).json({
          success: false,
          error: 'Valid amount is required',
        });
        return;
      }

      if (!paymentMethod) {
        res.status(400).json({
          success: false,
          error: 'Payment method is required',
        });
        return;
      }

      const transaction = await karigarsService.makePayment(
        karigarId,
        user.storeId,
        parseFloat(amount),
        paymentMethod,
        paymentReference,
        user.id
      );

      res.status(201).json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      logger.error('Failed to make payment', { error, karigarId: req.params.karigarId });
      res.status(500).json({
        success: false,
        error: 'Failed to make payment',
      });
    }
  }

  /**
   * Record an advance to karigar
   */
  async recordAdvance(req: Request, res: Response): Promise<void> {
    try {
      const { karigarId } = req.params;
      const user = (req as any).user;
      const { amount, paymentMethod, paymentReference } = req.body;

      if (!amount || amount <= 0) {
        res.status(400).json({
          success: false,
          error: 'Valid amount is required',
        });
        return;
      }

      if (!paymentMethod) {
        res.status(400).json({
          success: false,
          error: 'Payment method is required',
        });
        return;
      }

      const transaction = await karigarsService.recordAdvance(
        karigarId,
        user.storeId,
        parseFloat(amount),
        paymentMethod,
        paymentReference,
        user.id
      );

      res.status(201).json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      logger.error('Failed to record advance', { error, karigarId: req.params.karigarId });
      res.status(500).json({
        success: false,
        error: 'Failed to record advance',
      });
    }
  }

  /**
   * Get store summary for karigars
   */
  async getStoreSummary(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const storeId = (req.query.storeId as string) || user.storeId;

      if (!storeId) {
        res.status(400).json({
          success: false,
          error: 'Store ID is required',
        });
        return;
      }

      const summary = await karigarsService.getStoreSummary(storeId);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Failed to get store summary', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get store summary',
      });
    }
  }
}

export const karigarsController = new KarigarsController();
