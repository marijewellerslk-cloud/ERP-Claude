import { Request, Response } from 'express';
import { scrapService } from './scrap.service.js';
import { logger } from '../../utils/logger.js';

class ScrapController {
  /**
   * Add scrap to inventory
   */
  async addScrap(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const storeId = user.storeId;

      const scrap = await scrapService.addScrap({
        storeId,
        scrapType: req.body.scrapType,
        metalType: req.body.metalType,
        grossWeight: req.body.grossWeight,
        estimatedPurity: req.body.estimatedPurity,
        sourceJobCardId: req.body.sourceJobCardId,
        sourceKarigarId: req.body.sourceKarigarId,
        sourceDescription: req.body.sourceDescription,
        goldRateAtCollection: req.body.goldRateAtCollection,
        notes: req.body.notes,
        collectedBy: user.id,
      });

      res.status(201).json({
        success: true,
        data: scrap,
      });
    } catch (error: any) {
      logger.error('Failed to add scrap', { error });
      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to add scrap' },
      });
    }
  }

  /**
   * List scrap inventory
   */
  async listScrap(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const storeId = user.storeId;

      const { status, scrapType, limit, offset } = req.query;

      const result = await scrapService.listScrap({
        storeId,
        status: status as string,
        scrapType: scrapType as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      res.json({
        success: true,
        data: result.items,
        totals: result.totals,
      });
    } catch (error: any) {
      logger.error('Failed to list scrap', { error });
      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to list scrap' },
      });
    }
  }

  /**
   * Get scrap statistics
   */
  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const storeId = user.storeId;

      const stats = await scrapService.getScrapStatistics(storeId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Failed to get scrap statistics', { error });
      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to get statistics' },
      });
    }
  }

  /**
   * Create melting record
   */
  async createMeltingRecord(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const storeId = user.storeId;

      const record = await scrapService.createMeltingRecord({
        storeId,
        scrapIds: req.body.scrapIds,
        inputPurity: req.body.inputPurity,
        refinerName: req.body.refinerName,
        notes: req.body.notes,
        createdBy: user.id,
      });

      res.status(201).json({
        success: true,
        data: record,
      });
    } catch (error: any) {
      logger.error('Failed to create melting record', { error });
      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to create melting record' },
      });
    }
  }

  /**
   * Complete melting record
   */
  async completeMeltingRecord(req: Request, res: Response): Promise<void> {
    try {
      const { meltingId } = req.params;

      const record = await scrapService.completeMeltingRecord(meltingId, {
        outputWeight: req.body.outputWeight,
        outputPurity: req.body.outputPurity,
        refiningCost: req.body.refiningCost,
        refinerInvoice: req.body.refinerInvoice,
        notes: req.body.notes,
      });

      res.json({
        success: true,
        data: record,
      });
    } catch (error: any) {
      logger.error('Failed to complete melting record', { error });
      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to complete melting record' },
      });
    }
  }

  /**
   * List melting records
   */
  async listMeltingRecords(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const storeId = user.storeId;

      const { status, limit, offset } = req.query;

      const records = await scrapService.listMeltingRecords({
        storeId,
        status: status as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      res.json({
        success: true,
        data: records,
      });
    } catch (error: any) {
      logger.error('Failed to list melting records', { error });
      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to list melting records' },
      });
    }
  }

  /**
   * Get melting record by ID
   */
  async getMeltingRecord(req: Request, res: Response): Promise<void> {
    try {
      const { meltingId } = req.params;

      const record = await scrapService.getMeltingRecord(meltingId);

      if (!record) {
        res.status(404).json({
          success: false,
          error: { message: 'Melting record not found' },
        });
        return;
      }

      res.json({
        success: true,
        data: record,
      });
    } catch (error: any) {
      logger.error('Failed to get melting record', { error });
      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to get melting record' },
      });
    }
  }

  /**
   * Get melting statistics
   */
  async getMeltingStatistics(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const storeId = user.storeId;

      const stats = await scrapService.getMeltingStatistics(storeId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Failed to get melting statistics', { error });
      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to get statistics' },
      });
    }
  }
}

export const scrapController = new ScrapController();
