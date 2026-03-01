import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import * as commandCenterController from './command-center.controller.js';

const router = Router();

const RESOURCES = {
  COMMAND_CENTER: 'command_center',
} as const;

const ACTIONS = {
  READ: 'read',
} as const;

// All routes require authentication
router.use(authenticate);

// Get accessible stores for the current user
router.get('/stores', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getAccessibleStores);

// Get aggregated overview across all accessible stores
router.get('/overview', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getOverview);

// Get sales comparison across stores
router.get('/sales', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getSalesComparison);

// Get inventory comparison across stores
router.get('/inventory', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getInventoryComparison);

// Get employee overview across stores
router.get('/employees', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getEmployeeOverview);

// Get alerts across all stores
router.get('/alerts', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getAlerts);

// Get payroll overview across stores
router.get('/payroll', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getPayrollOverview);

// Get financial dashboard across stores
router.get('/financials', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getFinancialOverview);

// Get gold loan dashboard across stores
router.get('/loans', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getLoanDashboard);

// Get orders and repairs dashboard across stores
router.get('/orders', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getOrdersAndRepairs);

// Get customer analytics across stores
router.get('/customers', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getCustomerAnalytics);

// Get activity feed across stores
router.get('/activity', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getActivityFeed);

// Get enhanced alerts with additional alert types
router.get('/enhanced-alerts', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getEnhancedAlerts);

// ============================================================================
// SMART ANALYTICS
// ============================================================================

router.get('/smart/dead-stock', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getDeadStock);
router.get('/smart/profit-margins', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getProfitMarginHeatmap);
router.get('/smart/peak-hours', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getPeakHoursAnalysis);
router.get('/smart/store-ranking', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getStorePerformanceRanking);
router.get('/smart/sales-forecast', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getSalesForecast);
router.get('/smart/gold-exposure', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getGoldExposureDashboard);
router.get('/smart/karigar-efficiency', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getKarigarEfficiencyScores);
router.get('/smart/karigar-reconciliation', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getKarigarGoldReconciliation);
router.get('/smart/salesperson-leaderboard', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getSalespersonLeaderboard);
router.get('/smart/attendance-patterns', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getAttendancePatternAlerts);

// ============================================================================
// FRAUD PREVENTION
// ============================================================================

router.get('/fraud/anomalies', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getAnomalyAlerts);
router.get('/fraud/cash-forecast', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getCashFlowForecast);
router.get('/fraud/loan-risk', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getLoanRiskMonitor);
router.get('/fraud/risk-score', requirePermission(RESOURCES.COMMAND_CENTER, ACTIONS.READ), commandCenterController.getFraudRiskScore);

export default router;
