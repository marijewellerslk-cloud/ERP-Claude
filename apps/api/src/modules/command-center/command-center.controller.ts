import { Request, Response, NextFunction } from 'express';
import * as commandCenterService from './command-center.service.js';
import * as smartService from './command-center-smart.service.js';
import * as fraudService from './fraud-prevention.service.js';

export async function getAccessibleStores(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const storeIds = await commandCenterService.getAccessibleStores(userId, userRole);
    const hierarchy = await commandCenterService.getStoreHierarchy(storeIds);

    res.json({
      data: {
        storeIds,
        hierarchy,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const storeIds = await commandCenterService.getAccessibleStores(userId, userRole);
    const overview = await commandCenterService.getCommandCenterOverview(storeIds);

    res.json({ data: overview });
  } catch (error) {
    next(error);
  }
}

export async function getSalesComparison(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Default to last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    if (req.query.startDate) {
      startDate.setTime(new Date(req.query.startDate as string).getTime());
    }
    if (req.query.endDate) {
      endDate.setTime(new Date(req.query.endDate as string).getTime());
    }

    const storeIds = await commandCenterService.getAccessibleStores(userId, userRole);
    const salesData = await commandCenterService.getSalesComparison(storeIds, startDate, endDate);
    const summary = await commandCenterService.getSalesSummaryByStore(storeIds, startDate, endDate);

    res.json({
      data: {
        dailySales: salesData,
        summary,
        dateRange: { startDate, endDate },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getInventoryComparison(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const storeIds = await commandCenterService.getAccessibleStores(userId, userRole);
    const inventory = await commandCenterService.getInventoryByStore(storeIds);

    res.json({ data: inventory });
  } catch (error) {
    next(error);
  }
}

export async function getEmployeeOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const storeIds = await commandCenterService.getAccessibleStores(userId, userRole);
    const employeeData = await commandCenterService.getEmployeeOverview(storeIds);
    const pendingLeaves = await commandCenterService.getPendingLeaveRequests(storeIds);

    res.json({
      data: {
        byStore: employeeData,
        pendingLeaveRequests: pendingLeaves,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const storeIds = await commandCenterService.getAccessibleStores(userId, userRole);
    const alerts = await commandCenterService.getAlerts(storeIds);

    res.json({ data: alerts });
  } catch (error) {
    next(error);
  }
}

export async function getPayrollOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const storeIds = await commandCenterService.getAccessibleStores(userId, userRole);
    const payrollData = await commandCenterService.getPayrollOverview(storeIds, month, year);

    res.json({
      data: {
        month,
        year,
        byStore: payrollData,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// FINANCIAL DASHBOARD
// ============================================================================

export async function getFinancialOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const storeIds = await commandCenterService.getAccessibleStores(userId, userRole);
    const financials = await commandCenterService.getFinancialOverview(storeIds);

    res.json({ data: financials });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// GOLD LOAN DASHBOARD
// ============================================================================

export async function getLoanDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const storeIds = await commandCenterService.getAccessibleStores(userId, userRole);
    const loanData = await commandCenterService.getLoanDashboard(storeIds);

    res.json({ data: loanData });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// ORDERS & REPAIRS DASHBOARD
// ============================================================================

export async function getOrdersAndRepairs(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const storeIds = await commandCenterService.getAccessibleStores(userId, userRole);
    const ordersData = await commandCenterService.getOrdersAndRepairs(storeIds);

    res.json({ data: ordersData });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// CUSTOMER ANALYTICS
// ============================================================================

export async function getCustomerAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const storeIds = await commandCenterService.getAccessibleStores(userId, userRole);
    const customerData = await commandCenterService.getCustomerAnalytics(storeIds);

    res.json({ data: customerData });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// ACTIVITY FEED
// ============================================================================

export async function getActivityFeed(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const storeIds = await commandCenterService.getAccessibleStores(userId, userRole);
    const activities = await commandCenterService.getActivityFeed(storeIds, limit);

    res.json({ data: activities });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// ENHANCED ALERTS
// ============================================================================

export async function getEnhancedAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const storeIds = await commandCenterService.getAccessibleStores(userId, userRole);
    const alerts = await commandCenterService.getEnhancedAlerts(storeIds);

    res.json({ data: alerts });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// SMART ANALYTICS — BUSINESS INTELLIGENCE
// ============================================================================

async function getStoreIdsFromReq(req: Request, res: Response): Promise<string[] | null> {
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  if (!userId || !userRole) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return commandCenterService.getAccessibleStores(userId, userRole);
}

export async function getDeadStock(req: Request, res: Response, next: NextFunction) {
  try {
    const storeIds = await getStoreIdsFromReq(req, res);
    if (!storeIds) return;
    const data = await smartService.getDeadStock(storeIds);
    res.json({ data });
  } catch (error) { next(error); }
}

export async function getProfitMarginHeatmap(req: Request, res: Response, next: NextFunction) {
  try {
    const storeIds = await getStoreIdsFromReq(req, res);
    if (!storeIds) return;
    const data = await smartService.getProfitMarginHeatmap(storeIds);
    res.json({ data });
  } catch (error) { next(error); }
}

export async function getPeakHoursAnalysis(req: Request, res: Response, next: NextFunction) {
  try {
    const storeIds = await getStoreIdsFromReq(req, res);
    if (!storeIds) return;
    const data = await smartService.getPeakHoursAnalysis(storeIds);
    res.json({ data });
  } catch (error) { next(error); }
}

export async function getStorePerformanceRanking(req: Request, res: Response, next: NextFunction) {
  try {
    const storeIds = await getStoreIdsFromReq(req, res);
    if (!storeIds) return;
    const data = await smartService.getStorePerformanceRanking(storeIds);
    res.json({ data });
  } catch (error) { next(error); }
}

export async function getSalesForecast(req: Request, res: Response, next: NextFunction) {
  try {
    const storeIds = await getStoreIdsFromReq(req, res);
    if (!storeIds) return;
    const data = await smartService.getSalesForecast(storeIds);
    res.json({ data });
  } catch (error) { next(error); }
}

// ============================================================================
// SMART ANALYTICS — GOLD INTELLIGENCE
// ============================================================================

export async function getGoldExposureDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const storeIds = await getStoreIdsFromReq(req, res);
    if (!storeIds) return;
    const data = await smartService.getGoldExposureDashboard(storeIds);
    res.json({ data });
  } catch (error) { next(error); }
}

export async function getKarigarEfficiencyScores(req: Request, res: Response, next: NextFunction) {
  try {
    const storeIds = await getStoreIdsFromReq(req, res);
    if (!storeIds) return;
    const data = await smartService.getKarigarEfficiencyScores(storeIds);
    res.json({ data });
  } catch (error) { next(error); }
}

export async function getKarigarGoldReconciliation(req: Request, res: Response, next: NextFunction) {
  try {
    const storeIds = await getStoreIdsFromReq(req, res);
    if (!storeIds) return;
    const data = await smartService.getKarigarGoldReconciliation(storeIds);
    res.json({ data });
  } catch (error) { next(error); }
}

// ============================================================================
// SMART ANALYTICS — PEOPLE INTELLIGENCE
// ============================================================================

export async function getSalespersonLeaderboard(req: Request, res: Response, next: NextFunction) {
  try {
    const storeIds = await getStoreIdsFromReq(req, res);
    if (!storeIds) return;
    const data = await smartService.getSalespersonLeaderboard(storeIds);
    res.json({ data });
  } catch (error) { next(error); }
}

export async function getAttendancePatternAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const storeIds = await getStoreIdsFromReq(req, res);
    if (!storeIds) return;
    const data = await smartService.getAttendancePatternAlerts(storeIds);
    res.json({ data });
  } catch (error) { next(error); }
}

// ============================================================================
// FRAUD PREVENTION
// ============================================================================

export async function getAnomalyAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const storeIds = await getStoreIdsFromReq(req, res);
    if (!storeIds) return;
    const data = await fraudService.getAnomalyAlerts(storeIds);
    res.json({ data });
  } catch (error) { next(error); }
}

export async function getCashFlowForecast(req: Request, res: Response, next: NextFunction) {
  try {
    const storeIds = await getStoreIdsFromReq(req, res);
    if (!storeIds) return;
    const data = await fraudService.getCashFlowForecast(storeIds);
    res.json({ data });
  } catch (error) { next(error); }
}

export async function getLoanRiskMonitor(req: Request, res: Response, next: NextFunction) {
  try {
    const storeIds = await getStoreIdsFromReq(req, res);
    if (!storeIds) return;
    const data = await fraudService.getLoanRiskMonitor(storeIds);
    res.json({ data });
  } catch (error) { next(error); }
}

export async function getFraudRiskScore(req: Request, res: Response, next: NextFunction) {
  try {
    const storeIds = await getStoreIdsFromReq(req, res);
    if (!storeIds) return;
    const data = await fraudService.getFraudRiskScore(storeIds);
    res.json({ data });
  } catch (error) { next(error); }
}

