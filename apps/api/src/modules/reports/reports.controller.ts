import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { dailySummaryService } from '../../services/daily-summary.service.js';
import { dailyBriefingService } from '../../services/daily-briefing.service.js';
import { schedulerService } from '../../services/scheduler.service.js';
import { activityLogger } from '../../services/activity-logger.service.js';
import { marginReportsService } from '../../services/margin-reports.service.js';
import { stockValuationService } from '../../services/stock-valuation.service.js';
import { logger } from '../../utils/logger.js';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { activitySummaries, dailySummaries } from '../../db/schema.js';

export class ReportsController {
  // Get daily summary for a specific date
  async getDailySummary(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { date } = req.query;
      const targetDate = date ? new Date(date as string) : new Date();

      const summary = await dailySummaryService.getDailySummary(req.user.storeId, targetDate);

      if (!summary) {
        // Generate it if it doesn't exist
        await dailySummaryService.generateDailySummary(req.user.storeId, targetDate);
        const newSummary = await dailySummaryService.getDailySummary(req.user.storeId, targetDate);

        return res.json({
          success: true,
          data: newSummary,
        });
      }

      res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      logger.error('Get daily summary error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_SUMMARY_FAILED',
          message: 'Failed to get daily summary',
        },
      });
    }
  }

  // Get summaries for a date range
  async getSummariesInRange(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'startDate and endDate are required',
          },
        });
      }

      const summaries = await dailySummaryService.getSummariesInRange(
        req.user.storeId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json({
        success: true,
        data: summaries,
      });
    } catch (error: any) {
      logger.error('Get summaries in range error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_SUMMARIES_FAILED',
          message: 'Failed to get summaries',
        },
      });
    }
  }

  // Get activity log for a specific date
  async getActivityLog(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { date, category, userId, limit = '100' } = req.query;

      const targetDate = date ? new Date(date as string) : new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const conditions = [
        eq(activitySummaries.storeId, req.user.storeId),
        gte(activitySummaries.activityDate, startOfDay),
        lte(activitySummaries.activityDate, endOfDay),
      ];

      if (category) {
        conditions.push(eq(activitySummaries.category, category as any));
      }

      if (userId) {
        conditions.push(eq(activitySummaries.userId, userId as string));
      }

      const activities = await db.query.activitySummaries.findMany({
        where: and(...conditions),
        with: {
          user: {
            columns: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: [desc(activitySummaries.activityDate)],
        limit: parseInt(limit as string),
      });

      res.json({
        success: true,
        data: activities,
      });
    } catch (error: any) {
      logger.error('Get activity log error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_ACTIVITY_LOG_FAILED',
          message: 'Failed to get activity log',
        },
      });
    }
  }

  // Manually trigger daily briefing
  async triggerDailyBriefing(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      // Check if user has wildcard permission (superadmin)
      if (!req.user.permissions.includes('*:*')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only superadmins can trigger daily briefings manually',
          },
        });
      }

      const { date } = req.body;
      const targetDate = date ? new Date(date) : undefined;

      await schedulerService.triggerDailyBriefing(req.user.storeId, targetDate);

      res.json({
        success: true,
        message: 'Daily briefing triggered successfully',
      });
    } catch (error: any) {
      logger.error('Trigger daily briefing error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'TRIGGER_BRIEFING_FAILED',
          message: error.message || 'Failed to trigger daily briefing',
        },
      });
    }
  }

  // Get scheduler status
  async getSchedulerStatus(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const status = schedulerService.getStatus();

      res.json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      logger.error('Get scheduler status error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_STATUS_FAILED',
          message: 'Failed to get scheduler status',
        },
      });
    }
  }

  // ============================================================================
  // MARGIN & ROI REPORTS
  // ============================================================================

  // Get dashboard metrics
  async getDashboardMetrics(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const metrics = await marginReportsService.getDashboardMetrics(req.user.storeId);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error: any) {
      logger.error('Get dashboard metrics error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_METRICS_FAILED',
          message: 'Failed to get dashboard metrics',
        },
      });
    }
  }

  // Get margin analysis
  async getMarginAnalysis(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { startDate, endDate, categoryId } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'startDate and endDate are required',
          },
        });
      }

      const analysis = await marginReportsService.getMarginAnalysis(
        req.user.storeId,
        new Date(startDate as string),
        new Date(endDate as string),
        categoryId as string | undefined
      );

      res.json({
        success: true,
        data: analysis,
      });
    } catch (error: any) {
      logger.error('Get margin analysis error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_MARGIN_ANALYSIS_FAILED',
          message: 'Failed to get margin analysis',
        },
      });
    }
  }

  // Get category performance
  async getCategoryPerformance(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'startDate and endDate are required',
          },
        });
      }

      const report = await marginReportsService.getCategoryPerformance(
        req.user.storeId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Get category performance error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_CATEGORY_PERFORMANCE_FAILED',
          message: 'Failed to get category performance',
        },
      });
    }
  }

  // Get salesperson performance
  async getSalespersonPerformance(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'startDate and endDate are required',
          },
        });
      }

      const report = await marginReportsService.getSalespersonPerformance(
        req.user.storeId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Get salesperson performance error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_SALESPERSON_PERFORMANCE_FAILED',
          message: 'Failed to get salesperson performance',
        },
      });
    }
  }

  // Get metal profit/loss report
  async getMetalProfitLoss(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'startDate and endDate are required',
          },
        });
      }

      const report = await marginReportsService.getMetalProfitLoss(
        req.user.storeId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Get metal P&L error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_METAL_PL_FAILED',
          message: 'Failed to get metal profit/loss report',
        },
      });
    }
  }

  // Get ROI ranking
  async getROIRanking(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { startDate, endDate, limit = '20', order = 'best' } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'startDate and endDate are required',
          },
        });
      }

      const ranking = await marginReportsService.getROIRanking(
        req.user.storeId,
        new Date(startDate as string),
        new Date(endDate as string),
        parseInt(limit as string),
        order as 'best' | 'worst'
      );

      res.json({
        success: true,
        data: ranking,
      });
    } catch (error: any) {
      logger.error('Get ROI ranking error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_ROI_RANKING_FAILED',
          message: 'Failed to get ROI ranking',
        },
      });
    }
  }

  // Get stock aging report
  async getStockAgingReport(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { thresholdDays = '180' } = req.query;

      const report = await stockValuationService.getStockAgingReport(
        req.user.storeId,
        parseInt(thresholdDays as string)
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Get stock aging report error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_STOCK_AGING_FAILED',
          message: 'Failed to get stock aging report',
        },
      });
    }
  }

  // Get slow-moving items
  async getSlowMovingItems(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { thresholdDays = '90', limit = '50' } = req.query;

      const items = await marginReportsService.getSlowMovingItems(
        req.user.storeId,
        parseInt(thresholdDays as string),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: items,
      });
    } catch (error: any) {
      logger.error('Get slow-moving items error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_SLOW_MOVING_FAILED',
          message: 'Failed to get slow-moving items',
        },
      });
    }
  }

  // Get valuation summary
  async getValuationSummary(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const summary = await stockValuationService.getValuationSummary(req.user.storeId);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      logger.error('Get valuation summary error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_VALUATION_SUMMARY_FAILED',
          message: 'Failed to get valuation summary',
        },
      });
    }
  }

  // Trigger inventory revaluation
  async triggerRevaluation(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const report = await stockValuationService.revalueInventory(req.user.storeId);

      res.json({
        success: true,
        data: report,
        message: `Revalued ${report.itemsRevalued} items`,
      });
    } catch (error: any) {
      logger.error('Trigger revaluation error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'REVALUATION_FAILED',
          message: error.message || 'Failed to revalue inventory',
        },
      });
    }
  }
}

export const reportsController = new ReportsController();
