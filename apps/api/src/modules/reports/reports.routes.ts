import { Router } from 'express';
import { reportsController } from './reports.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

// Constants defined locally to avoid import issues
const RESOURCES = {
  REPORTS: 'reports',
} as const;

const ACTIONS = {
  READ: 'read',
  EXPORT: 'export',
} as const;

const router = Router();

// All reports routes require authentication
router.use(authenticate);

// Daily summary routes
router.get(
  '/daily-summary',
  requirePermission(RESOURCES.REPORTS, ACTIONS.READ),
  (req, res) => reportsController.getDailySummary(req, res)
);

router.get(
  '/daily-summaries',
  requirePermission(RESOURCES.REPORTS, ACTIONS.READ),
  (req, res) => reportsController.getSummariesInRange(req, res)
);

// Activity log routes
router.get(
  '/activity-log',
  requirePermission(RESOURCES.REPORTS, ACTIONS.READ),
  (req, res) => reportsController.getActivityLog(req, res)
);

// Daily briefing routes
router.post(
  '/trigger-briefing',
  requirePermission(RESOURCES.REPORTS, ACTIONS.EXPORT),
  (req, res) => reportsController.triggerDailyBriefing(req, res)
);

// Scheduler status
router.get(
  '/scheduler-status',
  requirePermission(RESOURCES.REPORTS, ACTIONS.READ),
  (req, res) => reportsController.getSchedulerStatus(req, res)
);

// ============================================================================
// MARGIN & ROI REPORTS
// ============================================================================

// Dashboard metrics (today, week, month overview)
router.get(
  '/dashboard-metrics',
  requirePermission(RESOURCES.REPORTS, ACTIONS.READ),
  (req, res) => reportsController.getDashboardMetrics(req, res)
);

// Margin analysis for sold items
router.get(
  '/margin-analysis',
  requirePermission(RESOURCES.REPORTS, ACTIONS.READ),
  (req, res) => reportsController.getMarginAnalysis(req, res)
);

// Category performance report
router.get(
  '/category-performance',
  requirePermission(RESOURCES.REPORTS, ACTIONS.READ),
  (req, res) => reportsController.getCategoryPerformance(req, res)
);

// Salesperson performance report
router.get(
  '/salesperson-performance',
  requirePermission(RESOURCES.REPORTS, ACTIONS.READ),
  (req, res) => reportsController.getSalespersonPerformance(req, res)
);

// Metal profit/loss report
router.get(
  '/metal-profit-loss',
  requirePermission(RESOURCES.REPORTS, ACTIONS.READ),
  (req, res) => reportsController.getMetalProfitLoss(req, res)
);

// ROI ranking (best/worst performers)
router.get(
  '/roi-ranking',
  requirePermission(RESOURCES.REPORTS, ACTIONS.READ),
  (req, res) => reportsController.getROIRanking(req, res)
);

// ============================================================================
// STOCK VALUATION & AGING REPORTS
// ============================================================================

// Stock aging report
router.get(
  '/stock-aging',
  requirePermission(RESOURCES.REPORTS, ACTIONS.READ),
  (req, res) => reportsController.getStockAgingReport(req, res)
);

// Slow-moving items
router.get(
  '/slow-moving',
  requirePermission(RESOURCES.REPORTS, ACTIONS.READ),
  (req, res) => reportsController.getSlowMovingItems(req, res)
);

// Valuation summary
router.get(
  '/valuation-summary',
  requirePermission(RESOURCES.REPORTS, ACTIONS.READ),
  (req, res) => reportsController.getValuationSummary(req, res)
);

// Trigger inventory revaluation (Mark-to-Market)
router.post(
  '/trigger-revaluation',
  requirePermission(RESOURCES.REPORTS, ACTIONS.EXPORT),
  (req, res) => reportsController.triggerRevaluation(req, res)
);

export default router;
