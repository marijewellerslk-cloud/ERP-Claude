import { Request, Response } from 'express';
import { jobCardsService } from './job-cards.service.js';
import { logger } from '../../utils/logger.js';

class JobCardsController {
  /**
   * Create a new job card
   */
  async createJobCard(req: Request, res: Response): Promise<void> {
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

      if (!req.body.karigarId) {
        res.status(400).json({
          success: false,
          error: 'Karigar ID is required',
        });
        return;
      }

      if (!req.body.metalIssued || req.body.metalIssued <= 0) {
        res.status(400).json({
          success: false,
          error: 'Valid metal weight is required',
        });
        return;
      }

      const jobCard = await jobCardsService.createJobCard({
        ...req.body,
        storeId,
        issuedBy: user.id,
        metalPurity: req.body.metalPurity || 91.67, // Default to 22K
      });

      res.status(201).json({
        success: true,
        data: jobCard,
      });
    } catch (error) {
      logger.error('Failed to create job card', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to create job card',
      });
    }
  }

  /**
   * Get job card by ID
   */
  async getJobCard(req: Request, res: Response): Promise<void> {
    try {
      const { jobCardId } = req.params;

      const jobCard = await jobCardsService.getJobCardById(jobCardId);

      if (!jobCard) {
        res.status(404).json({
          success: false,
          error: 'Job card not found',
        });
        return;
      }

      res.json({
        success: true,
        data: jobCard,
      });
    } catch (error) {
      logger.error('Failed to get job card', { error, jobCardId: req.params.jobCardId });
      res.status(500).json({
        success: false,
        error: 'Failed to get job card',
      });
    }
  }

  /**
   * List job cards
   */
  async listJobCards(req: Request, res: Response): Promise<void> {
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

      const result = await jobCardsService.listJobCards({
        storeId,
        karigarId: req.query.karigarId as string,
        status: req.query.status as string,
        jobType: req.query.jobType as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        search: req.query.search as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      });

      res.json({
        success: true,
        data: result.jobCards,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error) {
      logger.error('Failed to list job cards', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to list job cards',
      });
    }
  }

  /**
   * Record metal return
   */
  async recordReturn(req: Request, res: Response): Promise<void> {
    try {
      const { jobCardId } = req.params;
      const user = (req as any).user;

      if (req.body.finishedWeight === undefined || req.body.finishedWeight < 0) {
        res.status(400).json({
          success: false,
          error: 'Valid finished weight is required',
        });
        return;
      }

      const jobCard = await jobCardsService.recordReturn(jobCardId, {
        finishedWeight: parseFloat(req.body.finishedWeight),
        scrapReturned: parseFloat(req.body.scrapReturned) || 0,
        qualityRating: req.body.qualityRating,
        notes: req.body.notes,
        receivedBy: user.id,
      });

      res.json({
        success: true,
        data: jobCard,
      });
    } catch (error: any) {
      logger.error('Failed to record return', { error, jobCardId: req.params.jobCardId });
      res.status(error.message === 'Job card not found' ? 404 : 500).json({
        success: false,
        error: error.message || 'Failed to record return',
      });
    }
  }

  /**
   * Settle job card
   */
  async settleJobCard(req: Request, res: Response): Promise<void> {
    try {
      const { jobCardId } = req.params;
      const user = (req as any).user;

      if (!req.body.paidAmount || req.body.paidAmount <= 0) {
        res.status(400).json({
          success: false,
          error: 'Valid paid amount is required',
        });
        return;
      }

      const jobCard = await jobCardsService.settleJobCard(
        jobCardId,
        parseFloat(req.body.paidAmount),
        user.id
      );

      res.json({
        success: true,
        data: jobCard,
      });
    } catch (error: any) {
      logger.error('Failed to settle job card', { error, jobCardId: req.params.jobCardId });
      res.status(error.message === 'Job card not found' ? 404 : 500).json({
        success: false,
        error: error.message || 'Failed to settle job card',
      });
    }
  }

  /**
   * Update job card status
   */
  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { jobCardId } = req.params;
      const { status } = req.body;

      if (!status) {
        res.status(400).json({
          success: false,
          error: 'Status is required',
        });
        return;
      }

      const validStatuses = ['issued', 'in_progress', 'returned', 'inspected', 'settled', 'cancelled'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        });
        return;
      }

      const jobCard = await jobCardsService.updateStatus(jobCardId, status);

      res.json({
        success: true,
        data: jobCard,
      });
    } catch (error) {
      logger.error('Failed to update status', { error, jobCardId: req.params.jobCardId });
      res.status(500).json({
        success: false,
        error: 'Failed to update status',
      });
    }
  }

  /**
   * Get store statistics
   */
  async getStatistics(req: Request, res: Response): Promise<void> {
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

      const stats = await jobCardsService.getStoreStatistics(storeId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to get statistics', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get statistics',
      });
    }
  }
}

export const jobCardsController = new JobCardsController();
