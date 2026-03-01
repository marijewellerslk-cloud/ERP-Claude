import { db } from '../../config/database.js';
import {
  stores,
  inventoryItems,
  invoices,
  invoiceItems,
  customers,
  employees,
  attendance,
  payroll,
  leaveRequests,
  repairs,
  goldLoans,
  customOrders,
  accounts,
  bankAccounts,
  expenses,
  pledgedGold,
  loanPayments,
  loyaltyTransactions,
  salaryAdvances,
} from '../../db/schema.js';
import { eq, and, desc, gte, lte, sql, inArray, or, isNull, asc } from 'drizzle-orm';

// ============================================================================
// STORE HIERARCHY
// ============================================================================

export async function getAccessibleStores(userId: string, userRole: string): Promise<string[]> {
  // Super admin can access all stores
  if (userRole === 'super_admin') {
    const allStores = await db.select({ id: stores.id }).from(stores);
    return allStores.map(s => s.id);
  }

  // Owner can access their assigned store and all child stores
  if (userRole === 'owner') {
    // Get user's assigned stores
    const userStores = await db
      .select({ storeId: sql<string>`store_id` })
      .from(sql`user_roles`)
      .where(sql`user_id = ${userId}`);

    const storeIds = userStores.map(s => s.storeId);

    if (storeIds.length === 0) return [];

    // Get child stores (stores where parentStoreId matches any of user's stores)
    const childStores = await db
      .select({ id: stores.id })
      .from(stores)
      .where(
        or(
          inArray(stores.id, storeIds),
          inArray(stores.parentStoreId, storeIds)
        )
      );

    return childStores.map(s => s.id);
  }

  // Other roles only see their assigned store
  const userStores = await db
    .select({ storeId: sql<string>`store_id` })
    .from(sql`user_roles`)
    .where(sql`user_id = ${userId}`);

  return userStores.map(s => s.storeId);
}

export async function getStoreHierarchy(storeIds: string[]) {
  const storeList = await db
    .select({
      id: stores.id,
      name: stores.name,
      code: stores.code,
      address: stores.address,
      phone: stores.phone,
      parentStoreId: stores.parentStoreId,
      isActive: stores.isActive,
    })
    .from(stores)
    .where(inArray(stores.id, storeIds));

  // Build hierarchy tree
  const storeMap = new Map(storeList.map(s => [s.id, { ...s, children: [] as any[] }]));

  const rootStores: any[] = [];

  storeList.forEach(store => {
    const storeNode = storeMap.get(store.id)!;
    if (store.parentStoreId && storeMap.has(store.parentStoreId)) {
      storeMap.get(store.parentStoreId)!.children.push(storeNode);
    } else {
      rootStores.push(storeNode);
    }
  });

  return rootStores;
}

// ============================================================================
// AGGREGATED OVERVIEW
// ============================================================================

export async function getCommandCenterOverview(storeIds: string[]) {
  if (storeIds.length === 0) {
    return { stores: [], totals: {} };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Get store-wise metrics
  const storeMetrics = await Promise.all(
    storeIds.map(async (storeId) => {
      const [storeInfo] = await db
        .select({ name: stores.name, code: stores.code })
        .from(stores)
        .where(eq(stores.id, storeId));

      // Today's sales (using invoices)
      const [todaySales] = await db
        .select({
          count: sql<number>`count(*)::int`,
          total: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)::numeric(12,2)`,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.storeId, storeId),
            gte(invoices.invoiceDate, today),
            eq(invoices.status, 'completed')
          )
        );

      // Month's sales
      const [monthSales] = await db
        .select({
          count: sql<number>`count(*)::int`,
          total: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)::numeric(12,2)`,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.storeId, storeId),
            gte(invoices.invoiceDate, startOfMonth),
            eq(invoices.status, 'completed')
          )
        );

      // Inventory count and value
      const [inventory] = await db
        .select({
          count: sql<number>`count(*)::int`,
          value: sql<number>`coalesce(sum(${inventoryItems.costPrice}), 0)::numeric(12,2)`,
        })
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.storeId, storeId),
            eq(inventoryItems.status, 'in_stock')
          )
        );

      // Active employees
      const [employeeCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(employees)
        .where(
          and(
            eq(employees.storeId, storeId),
            eq(employees.status, 'active')
          )
        );

      // Today's attendance
      const [attendanceCount] = await db
        .select({
          present: sql<number>`count(case when ${attendance.status} in ('present', 'late') then 1 end)::int`,
          absent: sql<number>`count(case when ${attendance.status} = 'absent' then 1 end)::int`,
        })
        .from(attendance)
        .where(
          and(
            eq(attendance.storeId, storeId),
            gte(attendance.date, today)
          )
        );

      // Pending items
      const [pendingRepairs] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(repairs)
        .where(
          and(
            eq(repairs.storeId, storeId),
            inArray(repairs.status, ['pending', 'in_progress'])
          )
        );

      const [pendingOrders] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(customOrders)
        .where(
          and(
            eq(customOrders.storeId, storeId),
            inArray(customOrders.status, ['pending', 'in_progress', 'ready'])
          )
        );

      const [activeLoans] = await db
        .select({
          count: sql<number>`count(*)::int`,
          value: sql<number>`coalesce(sum(${goldLoans.loanAmount}), 0)::numeric(12,2)`,
        })
        .from(goldLoans)
        .where(
          and(
            eq(goldLoans.storeId, storeId),
            eq(goldLoans.status, 'active')
          )
        );

      return {
        storeId,
        storeName: storeInfo?.name || 'Unknown',
        storeCode: storeInfo?.code || 'N/A',
        todaySales: {
          count: todaySales?.count || 0,
          total: parseFloat(todaySales?.total as any) || 0,
        },
        monthSales: {
          count: monthSales?.count || 0,
          total: parseFloat(monthSales?.total as any) || 0,
        },
        inventory: {
          count: inventory?.count || 0,
          value: parseFloat(inventory?.value as any) || 0,
        },
        employees: {
          total: employeeCount?.count || 0,
          presentToday: attendanceCount?.present || 0,
          absentToday: attendanceCount?.absent || 0,
        },
        pending: {
          repairs: pendingRepairs?.count || 0,
          customOrders: pendingOrders?.count || 0,
        },
        loans: {
          active: activeLoans?.count || 0,
          value: parseFloat(activeLoans?.value as any) || 0,
        },
      };
    })
  );

  // Calculate totals
  const totals = storeMetrics.reduce(
    (acc, store) => ({
      todaySalesCount: acc.todaySalesCount + store.todaySales.count,
      todaySalesTotal: acc.todaySalesTotal + store.todaySales.total,
      monthSalesCount: acc.monthSalesCount + store.monthSales.count,
      monthSalesTotal: acc.monthSalesTotal + store.monthSales.total,
      inventoryCount: acc.inventoryCount + store.inventory.count,
      inventoryValue: acc.inventoryValue + store.inventory.value,
      totalEmployees: acc.totalEmployees + store.employees.total,
      presentToday: acc.presentToday + store.employees.presentToday,
      pendingRepairs: acc.pendingRepairs + store.pending.repairs,
      pendingOrders: acc.pendingOrders + store.pending.customOrders,
      activeLoans: acc.activeLoans + store.loans.active,
      loanValue: acc.loanValue + store.loans.value,
    }),
    {
      todaySalesCount: 0,
      todaySalesTotal: 0,
      monthSalesCount: 0,
      monthSalesTotal: 0,
      inventoryCount: 0,
      inventoryValue: 0,
      totalEmployees: 0,
      presentToday: 0,
      pendingRepairs: 0,
      pendingOrders: 0,
      activeLoans: 0,
      loanValue: 0,
    }
  );

  return {
    stores: storeMetrics,
    totals,
  };
}

// ============================================================================
// SALES COMPARISON
// ============================================================================

export async function getSalesComparison(storeIds: string[], startDate: Date, endDate: Date) {
  if (storeIds.length === 0) return [];

  const salesData = await db
    .select({
      storeId: invoices.storeId,
      storeName: stores.name,
      storeCode: stores.code,
      date: sql<string>`date_trunc('day', ${invoices.invoiceDate})::date`,
      salesCount: sql<number>`count(*)::int`,
      totalAmount: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)::numeric(12,2)`,
      avgAmount: sql<number>`coalesce(avg(${invoices.totalAmount}), 0)::numeric(12,2)`,
    })
    .from(invoices)
    .innerJoin(stores, eq(invoices.storeId, stores.id))
    .where(
      and(
        inArray(invoices.storeId, storeIds),
        gte(invoices.invoiceDate, startDate),
        lte(invoices.invoiceDate, endDate),
        eq(invoices.status, 'completed')
      )
    )
    .groupBy(invoices.storeId, stores.name, stores.code, sql`date_trunc('day', ${invoices.invoiceDate})::date`)
    .orderBy(sql`date_trunc('day', ${invoices.invoiceDate})::date`);

  return salesData;
}

export async function getSalesSummaryByStore(storeIds: string[], startDate: Date, endDate: Date) {
  if (storeIds.length === 0) return [];

  return db
    .select({
      storeId: invoices.storeId,
      storeName: stores.name,
      storeCode: stores.code,
      totalSales: sql<number>`count(*)::int`,
      totalAmount: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)::numeric(12,2)`,
      avgSaleAmount: sql<number>`coalesce(avg(${invoices.totalAmount}), 0)::numeric(12,2)`,
    })
    .from(invoices)
    .innerJoin(stores, eq(invoices.storeId, stores.id))
    .where(
      and(
        inArray(invoices.storeId, storeIds),
        gte(invoices.invoiceDate, startDate),
        lte(invoices.invoiceDate, endDate),
        eq(invoices.status, 'completed')
      )
    )
    .groupBy(invoices.storeId, stores.name, stores.code)
    .orderBy(desc(sql`coalesce(sum(${invoices.totalAmount}), 0)`));
}

// ============================================================================
// INVENTORY COMPARISON
// ============================================================================

export async function getInventoryByStore(storeIds: string[]) {
  if (storeIds.length === 0) return [];

  return db
    .select({
      storeId: inventoryItems.storeId,
      storeName: stores.name,
      storeCode: stores.code,
      totalItems: sql<number>`count(*)::int`,
      inStockItems: sql<number>`count(case when ${inventoryItems.status} = 'in_stock' then 1 end)::int`,
      soldItems: sql<number>`count(case when ${inventoryItems.status} = 'sold' then 1 end)::int`,
      totalValue: sql<number>`coalesce(sum(case when ${inventoryItems.status} = 'in_stock' then ${inventoryItems.costPrice} else 0 end), 0)::numeric(12,2)`,
      totalWeight: sql<number>`coalesce(sum(case when ${inventoryItems.status} = 'in_stock' then ${inventoryItems.netWeight} else 0 end), 0)::numeric(10,3)`,
    })
    .from(inventoryItems)
    .innerJoin(stores, eq(inventoryItems.storeId, stores.id))
    .where(inArray(inventoryItems.storeId, storeIds))
    .groupBy(inventoryItems.storeId, stores.name, stores.code);
}

// ============================================================================
// EMPLOYEE OVERVIEW
// ============================================================================

export async function getEmployeeOverview(storeIds: string[]) {
  if (storeIds.length === 0) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return db
    .select({
      storeId: employees.storeId,
      storeName: stores.name,
      storeCode: stores.code,
      totalEmployees: sql<number>`count(distinct ${employees.id})::int`,
      activeEmployees: sql<number>`count(distinct case when ${employees.status} = 'active' then ${employees.id} end)::int`,
      presentToday: sql<number>`count(distinct case when ${attendance.status} in ('present', 'late') then ${employees.id} end)::int`,
      onLeaveToday: sql<number>`count(distinct case when ${attendance.status} = 'on_leave' then ${employees.id} end)::int`,
    })
    .from(employees)
    .innerJoin(stores, eq(employees.storeId, stores.id))
    .leftJoin(
      attendance,
      and(
        eq(attendance.employeeId, employees.id),
        gte(attendance.date, today)
      )
    )
    .where(inArray(employees.storeId, storeIds))
    .groupBy(employees.storeId, stores.name, stores.code);
}

export async function getPendingLeaveRequests(storeIds: string[]) {
  if (storeIds.length === 0) return [];

  return db
    .select({
      id: leaveRequests.id,
      employeeId: leaveRequests.employeeId,
      employeeName: employees.fullName,
      storeName: stores.name,
      storeCode: stores.code,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      totalDays: leaveRequests.totalDays,
      reason: leaveRequests.reason,
      createdAt: leaveRequests.createdAt,
    })
    .from(leaveRequests)
    .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
    .innerJoin(stores, eq(leaveRequests.storeId, stores.id))
    .where(
      and(
        inArray(leaveRequests.storeId, storeIds),
        eq(leaveRequests.status, 'pending')
      )
    )
    .orderBy(leaveRequests.createdAt);
}

// ============================================================================
// ALERTS
// ============================================================================

export async function getAlerts(storeIds: string[]) {
  if (storeIds.length === 0) return [];

  const alerts: {
    type: string;
    severity: 'high' | 'medium' | 'low';
    message: string;
    storeId: string;
    storeName: string;
    count?: number;
  }[] = [];

  // Check for low attendance today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const storeId of storeIds) {
    const [storeInfo] = await db
      .select({ name: stores.name })
      .from(stores)
      .where(eq(stores.id, storeId));

    const storeName = storeInfo?.name || 'Unknown Store';

    // Low attendance alert
    const [empCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(employees)
      .where(and(eq(employees.storeId, storeId), eq(employees.status, 'active')));

    const [presentCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(attendance)
      .where(
        and(
          eq(attendance.storeId, storeId),
          gte(attendance.date, today),
          inArray(attendance.status, ['present', 'late'])
        )
      );

    const totalEmployees = empCount?.count || 0;
    const presentEmployees = presentCount?.count || 0;

    if (totalEmployees > 0 && presentEmployees < totalEmployees * 0.5) {
      alerts.push({
        type: 'low_attendance',
        severity: 'high',
        message: `Only ${presentEmployees} of ${totalEmployees} employees present`,
        storeId,
        storeName,
        count: presentEmployees,
      });
    }

    // Pending repairs alert
    const [pendingRepairs] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(repairs)
      .where(
        and(
          eq(repairs.storeId, storeId),
          eq(repairs.status, 'pending')
        )
      );

    if ((pendingRepairs?.count || 0) > 5) {
      alerts.push({
        type: 'pending_repairs',
        severity: 'medium',
        message: `${pendingRepairs?.count} repairs pending`,
        storeId,
        storeName,
        count: pendingRepairs?.count,
      });
    }

    // Overdue loans alert
    const [overdueLoans] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(goldLoans)
      .where(
        and(
          eq(goldLoans.storeId, storeId),
          eq(goldLoans.status, 'active'),
          lte(goldLoans.expiryDate, today)
        )
      );

    if ((overdueLoans?.count || 0) > 0) {
      alerts.push({
        type: 'overdue_loans',
        severity: 'high',
        message: `${overdueLoans?.count} loans have expired`,
        storeId,
        storeName,
        count: overdueLoans?.count,
      });
    }

    // Pending leave requests
    const [pendingLeaves] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.storeId, storeId),
          eq(leaveRequests.status, 'pending')
        )
      );

    if ((pendingLeaves?.count || 0) > 0) {
      alerts.push({
        type: 'pending_leave',
        severity: 'low',
        message: `${pendingLeaves?.count} leave requests pending approval`,
        storeId,
        storeName,
        count: pendingLeaves?.count,
      });
    }
  }

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}

// ============================================================================
// PAYROLL OVERVIEW
// ============================================================================

export async function getPayrollOverview(storeIds: string[], month: number, year: number) {
  if (storeIds.length === 0) return [];

  return db
    .select({
      storeId: payroll.storeId,
      storeName: stores.name,
      storeCode: stores.code,
      totalEmployees: sql<number>`count(*)::int`,
      totalSalary: sql<number>`coalesce(sum(${payroll.netSalary}), 0)::numeric(12,2)`,
      draftCount: sql<number>`count(case when ${payroll.status} = 'draft' then 1 end)::int`,
      approvedCount: sql<number>`count(case when ${payroll.status} = 'approved' then 1 end)::int`,
      paidCount: sql<number>`count(case when ${payroll.status} = 'paid' then 1 end)::int`,
    })
    .from(payroll)
    .innerJoin(stores, eq(payroll.storeId, stores.id))
    .where(
      and(
        inArray(payroll.storeId, storeIds),
        eq(payroll.month, month),
        eq(payroll.year, year)
      )
    )
    .groupBy(payroll.storeId, stores.name, stores.code);
}

// ============================================================================
// FINANCIAL DASHBOARD
// ============================================================================

export async function getFinancialOverview(storeIds: string[]) {
  if (storeIds.length === 0) {
    return { stores: [], totals: {} };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Get store-wise financial metrics
  const storeFinancials = await Promise.all(
    storeIds.map(async (storeId) => {
      const [storeInfo] = await db
        .select({ name: stores.name, code: stores.code })
        .from(stores)
        .where(eq(stores.id, storeId));

      // Cash balance (bank accounts with type 'cash')
      const [cashBalance] = await db
        .select({
          balance: sql<number>`coalesce(sum(${bankAccounts.currentBalance}), 0)::numeric(12,2)`,
        })
        .from(bankAccounts)
        .where(
          and(
            eq(bankAccounts.storeId, storeId),
            eq(bankAccounts.bankAccountType, 'cash'),
            eq(bankAccounts.isActive, true)
          )
        );

      // Bank balance (non-cash accounts)
      const [bankBalance] = await db
        .select({
          balance: sql<number>`coalesce(sum(${bankAccounts.currentBalance}), 0)::numeric(12,2)`,
        })
        .from(bankAccounts)
        .where(
          and(
            eq(bankAccounts.storeId, storeId),
            sql`${bankAccounts.bankAccountType} != 'cash'`,
            eq(bankAccounts.isActive, true)
          )
        );

      // Accounts Receivable (from accounts table - asset type receivables)
      const [receivables] = await db
        .select({
          balance: sql<number>`coalesce(sum(${accounts.currentBalance}), 0)::numeric(12,2)`,
        })
        .from(accounts)
        .where(
          and(
            eq(accounts.storeId, storeId),
            eq(accounts.accountSubType, 'accounts_receivable'),
            eq(accounts.isActive, true)
          )
        );

      // Accounts Payable (from accounts table - liability type payables)
      const [payables] = await db
        .select({
          balance: sql<number>`coalesce(sum(${accounts.currentBalance}), 0)::numeric(12,2)`,
        })
        .from(accounts)
        .where(
          and(
            eq(accounts.storeId, storeId),
            eq(accounts.accountSubType, 'accounts_payable'),
            eq(accounts.isActive, true)
          )
        );

      // Today's Income (completed invoices)
      const [todayIncome] = await db
        .select({
          amount: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)::numeric(12,2)`,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.storeId, storeId),
            gte(invoices.invoiceDate, today),
            eq(invoices.status, 'completed')
          )
        );

      // Today's Expenses
      const [todayExpenses] = await db
        .select({
          amount: sql<number>`coalesce(sum(${expenses.totalAmount}), 0)::numeric(12,2)`,
        })
        .from(expenses)
        .where(
          and(
            eq(expenses.storeId, storeId),
            gte(expenses.expenseDate, today)
          )
        );

      // Month's Income
      const [monthIncome] = await db
        .select({
          amount: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)::numeric(12,2)`,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.storeId, storeId),
            gte(invoices.invoiceDate, startOfMonth),
            eq(invoices.status, 'completed')
          )
        );

      // Month's Expenses
      const [monthExpenses] = await db
        .select({
          amount: sql<number>`coalesce(sum(${expenses.totalAmount}), 0)::numeric(12,2)`,
        })
        .from(expenses)
        .where(
          and(
            eq(expenses.storeId, storeId),
            gte(expenses.expenseDate, startOfMonth)
          )
        );

      // GST Liability (accounts with GST type)
      const [gstLiability] = await db
        .select({
          balance: sql<number>`coalesce(sum(${accounts.currentBalance}), 0)::numeric(12,2)`,
        })
        .from(accounts)
        .where(
          and(
            eq(accounts.storeId, storeId),
            sql`${accounts.accountCode} like '2201%'`, // GST Payable accounts
            eq(accounts.isActive, true)
          )
        );

      return {
        storeId,
        storeName: storeInfo?.name || 'Unknown',
        storeCode: storeInfo?.code || 'N/A',
        cashBalance: parseFloat(cashBalance?.balance as any) || 0,
        bankBalance: parseFloat(bankBalance?.balance as any) || 0,
        accountsReceivable: parseFloat(receivables?.balance as any) || 0,
        accountsPayable: parseFloat(payables?.balance as any) || 0,
        todayIncome: parseFloat(todayIncome?.amount as any) || 0,
        todayExpenses: parseFloat(todayExpenses?.amount as any) || 0,
        monthIncome: parseFloat(monthIncome?.amount as any) || 0,
        monthExpenses: parseFloat(monthExpenses?.amount as any) || 0,
        gstLiability: parseFloat(gstLiability?.balance as any) || 0,
      };
    })
  );

  // Calculate totals
  const totals = storeFinancials.reduce(
    (acc, store) => ({
      cashBalance: acc.cashBalance + store.cashBalance,
      bankBalance: acc.bankBalance + store.bankBalance,
      totalLiquidity: acc.totalLiquidity + store.cashBalance + store.bankBalance,
      accountsReceivable: acc.accountsReceivable + store.accountsReceivable,
      accountsPayable: acc.accountsPayable + store.accountsPayable,
      todayIncome: acc.todayIncome + store.todayIncome,
      todayExpenses: acc.todayExpenses + store.todayExpenses,
      todayProfit: acc.todayProfit + (store.todayIncome - store.todayExpenses),
      monthIncome: acc.monthIncome + store.monthIncome,
      monthExpenses: acc.monthExpenses + store.monthExpenses,
      monthProfit: acc.monthProfit + (store.monthIncome - store.monthExpenses),
      gstLiability: acc.gstLiability + store.gstLiability,
    }),
    {
      cashBalance: 0,
      bankBalance: 0,
      totalLiquidity: 0,
      accountsReceivable: 0,
      accountsPayable: 0,
      todayIncome: 0,
      todayExpenses: 0,
      todayProfit: 0,
      monthIncome: 0,
      monthExpenses: 0,
      monthProfit: 0,
      gstLiability: 0,
    }
  );

  return {
    stores: storeFinancials,
    totals,
  };
}

// ============================================================================
// GOLD LOAN DASHBOARD
// ============================================================================

export async function getLoanDashboard(storeIds: string[]) {
  if (storeIds.length === 0) {
    return { stores: [], totals: {}, maturingLoans: [], overdueLoans: [] };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Get store-wise loan metrics
  const storeLoanData = await Promise.all(
    storeIds.map(async (storeId) => {
      const [storeInfo] = await db
        .select({ name: stores.name, code: stores.code })
        .from(stores)
        .where(eq(stores.id, storeId));

      // Active loans count and value
      const [activeLoans] = await db
        .select({
          count: sql<number>`count(*)::int`,
          totalValue: sql<number>`coalesce(sum(${goldLoans.loanAmount}), 0)::numeric(12,2)`,
        })
        .from(goldLoans)
        .where(
          and(
            eq(goldLoans.storeId, storeId),
            eq(goldLoans.status, 'active')
          )
        );

      // Total gold pledged (weight and estimated value)
      const [goldPledged] = await db
        .select({
          totalWeight: sql<number>`coalesce(sum(${pledgedGold.netWeight}), 0)::numeric(10,3)`,
          totalValue: sql<number>`coalesce(sum(${pledgedGold.marketValue}), 0)::numeric(12,2)`,
        })
        .from(pledgedGold)
        .innerJoin(goldLoans, eq(pledgedGold.loanId, goldLoans.id))
        .where(
          and(
            eq(goldLoans.storeId, storeId),
            eq(goldLoans.status, 'active')
          )
        );

      // Overdue loans (past maturity date)
      const [overdueCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(goldLoans)
        .where(
          and(
            eq(goldLoans.storeId, storeId),
            eq(goldLoans.status, 'active'),
            lte(goldLoans.maturityDate, today)
          )
        );

      // Total interest collected this month
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const [interestCollected] = await db
        .select({
          amount: sql<number>`coalesce(sum(${loanPayments.interestAmount}), 0)::numeric(12,2)`,
        })
        .from(loanPayments)
        .innerJoin(goldLoans, eq(loanPayments.loanId, goldLoans.id))
        .where(
          and(
            eq(goldLoans.storeId, storeId),
            gte(loanPayments.paymentDate, startOfMonth)
          )
        );

      return {
        storeId,
        storeName: storeInfo?.name || 'Unknown',
        storeCode: storeInfo?.code || 'N/A',
        activeLoans: activeLoans?.count || 0,
        loanValue: parseFloat(activeLoans?.totalValue as any) || 0,
        goldWeight: parseFloat(goldPledged?.totalWeight as any) || 0,
        goldValue: parseFloat(goldPledged?.totalValue as any) || 0,
        overdueLoans: overdueCount?.count || 0,
        interestCollected: parseFloat(interestCollected?.amount as any) || 0,
      };
    })
  );

  // Get loans maturing in next 7 days across all stores
  const maturingLoans = await db
    .select({
      id: goldLoans.id,
      loanNumber: goldLoans.loanNumber,
      storeId: goldLoans.storeId,
      storeName: stores.name,
      customerId: goldLoans.customerId,
      customerName: customers.firstName,
      customerPhone: customers.phone,
      loanAmount: goldLoans.loanAmount,
      maturityDate: goldLoans.maturityDate,
    })
    .from(goldLoans)
    .innerJoin(stores, eq(goldLoans.storeId, stores.id))
    .leftJoin(customers, eq(goldLoans.customerId, customers.id))
    .where(
      and(
        inArray(goldLoans.storeId, storeIds),
        eq(goldLoans.status, 'active'),
        gte(goldLoans.maturityDate, today),
        lte(goldLoans.maturityDate, nextWeek)
      )
    )
    .orderBy(asc(goldLoans.maturityDate))
    .limit(20);

  // Get overdue loans across all stores
  const overdueLoans = await db
    .select({
      id: goldLoans.id,
      loanNumber: goldLoans.loanNumber,
      storeId: goldLoans.storeId,
      storeName: stores.name,
      customerId: goldLoans.customerId,
      customerName: customers.firstName,
      customerPhone: customers.phone,
      loanAmount: goldLoans.loanAmount,
      maturityDate: goldLoans.maturityDate,
      daysOverdue: sql<number>`(current_date - ${goldLoans.maturityDate}::date)::int`,
    })
    .from(goldLoans)
    .innerJoin(stores, eq(goldLoans.storeId, stores.id))
    .leftJoin(customers, eq(goldLoans.customerId, customers.id))
    .where(
      and(
        inArray(goldLoans.storeId, storeIds),
        eq(goldLoans.status, 'active'),
        lte(goldLoans.maturityDate, today)
      )
    )
    .orderBy(asc(goldLoans.maturityDate))
    .limit(20);

  // Calculate totals
  const totals = storeLoanData.reduce(
    (acc, store) => ({
      activeLoans: acc.activeLoans + store.activeLoans,
      loanValue: acc.loanValue + store.loanValue,
      goldWeight: acc.goldWeight + store.goldWeight,
      goldValue: acc.goldValue + store.goldValue,
      overdueLoans: acc.overdueLoans + store.overdueLoans,
      interestCollected: acc.interestCollected + store.interestCollected,
    }),
    {
      activeLoans: 0,
      loanValue: 0,
      goldWeight: 0,
      goldValue: 0,
      overdueLoans: 0,
      interestCollected: 0,
    }
  );

  return {
    stores: storeLoanData,
    totals,
    maturingLoans,
    overdueLoans,
  };
}

// ============================================================================
// ORDERS & REPAIRS DASHBOARD
// ============================================================================

export async function getOrdersAndRepairs(storeIds: string[]) {
  if (storeIds.length === 0) {
    return { stores: [], totals: {}, overdueOrders: [], overdueRepairs: [] };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get store-wise orders and repairs metrics
  const storeData = await Promise.all(
    storeIds.map(async (storeId) => {
      const [storeInfo] = await db
        .select({ name: stores.name, code: stores.code })
        .from(stores)
        .where(eq(stores.id, storeId));

      // Custom orders by status
      const ordersByStatus = await db
        .select({
          status: customOrders.status,
          count: sql<number>`count(*)::int`,
          value: sql<number>`coalesce(sum(${customOrders.estimatedTotal}), 0)::numeric(12,2)`,
        })
        .from(customOrders)
        .where(eq(customOrders.storeId, storeId))
        .groupBy(customOrders.status);

      const orderStats = {
        pending: 0,
        inProgress: 0,
        ready: 0,
        delivered: 0,
        totalValue: 0,
      };
      ordersByStatus.forEach((row) => {
        if (row.status === 'pending') orderStats.pending = row.count;
        else if (row.status === 'in_progress') orderStats.inProgress = row.count;
        else if (row.status === 'ready') orderStats.ready = row.count;
        else if (row.status === 'delivered') orderStats.delivered = row.count;
        orderStats.totalValue += parseFloat(row.value as any) || 0;
      });

      // Repairs by status
      const repairsByStatus = await db
        .select({
          status: repairs.status,
          count: sql<number>`count(*)::int`,
          value: sql<number>`coalesce(sum(${repairs.estimatedCost}), 0)::numeric(12,2)`,
        })
        .from(repairs)
        .where(eq(repairs.storeId, storeId))
        .groupBy(repairs.status);

      const repairStats = {
        pending: 0,
        inProgress: 0,
        ready: 0,
        delivered: 0,
        totalValue: 0,
      };
      repairsByStatus.forEach((row) => {
        if (row.status === 'pending') repairStats.pending = row.count;
        else if (row.status === 'in_progress') repairStats.inProgress = row.count;
        else if (row.status === 'ready') repairStats.ready = row.count;
        else if (row.status === 'delivered') repairStats.delivered = row.count;
        repairStats.totalValue += parseFloat(row.value as any) || 0;
      });

      // Overdue orders (past expected completion date)
      const [overdueOrderCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(customOrders)
        .where(
          and(
            eq(customOrders.storeId, storeId),
            inArray(customOrders.status, ['pending', 'in_progress']),
            lte(customOrders.expectedCompletionDate, today)
          )
        );

      // Overdue repairs
      const [overdueRepairCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(repairs)
        .where(
          and(
            eq(repairs.storeId, storeId),
            inArray(repairs.status, ['pending', 'in_progress']),
            lte(repairs.expectedCompletionDate, today)
          )
        );

      return {
        storeId,
        storeName: storeInfo?.name || 'Unknown',
        storeCode: storeInfo?.code || 'N/A',
        orders: orderStats,
        repairs: repairStats,
        overdueOrders: overdueOrderCount?.count || 0,
        overdueRepairs: overdueRepairCount?.count || 0,
      };
    })
  );

  // Get overdue orders across all stores
  const overdueOrders = await db
    .select({
      id: customOrders.id,
      orderNumber: customOrders.orderNumber,
      storeId: customOrders.storeId,
      storeName: stores.name,
      customerName: customers.firstName,
      designTitle: customOrders.designTitle,
      status: customOrders.status,
      expectedDate: customOrders.expectedCompletionDate,
      daysOverdue: sql<number>`(current_date - ${customOrders.expectedCompletionDate}::date)::int`,
    })
    .from(customOrders)
    .innerJoin(stores, eq(customOrders.storeId, stores.id))
    .leftJoin(customers, eq(customOrders.customerId, customers.id))
    .where(
      and(
        inArray(customOrders.storeId, storeIds),
        inArray(customOrders.status, ['pending', 'in_progress']),
        lte(customOrders.expectedCompletionDate, today)
      )
    )
    .orderBy(asc(customOrders.expectedCompletionDate))
    .limit(20);

  // Get overdue repairs across all stores
  const overdueRepairs = await db
    .select({
      id: repairs.id,
      repairNumber: repairs.repairNumber,
      storeId: repairs.storeId,
      storeName: stores.name,
      customerName: customers.firstName,
      itemDescription: repairs.itemDescription,
      status: repairs.status,
      expectedDate: repairs.expectedCompletionDate,
      daysOverdue: sql<number>`(current_date - ${repairs.expectedCompletionDate}::date)::int`,
    })
    .from(repairs)
    .innerJoin(stores, eq(repairs.storeId, stores.id))
    .leftJoin(customers, eq(repairs.customerId, customers.id))
    .where(
      and(
        inArray(repairs.storeId, storeIds),
        inArray(repairs.status, ['pending', 'in_progress']),
        lte(repairs.expectedCompletionDate, today)
      )
    )
    .orderBy(asc(repairs.expectedCompletionDate))
    .limit(20);

  // Calculate totals
  const totals = storeData.reduce(
    (acc, store) => ({
      pendingOrders: acc.pendingOrders + store.orders.pending,
      inProgressOrders: acc.inProgressOrders + store.orders.inProgress,
      readyOrders: acc.readyOrders + store.orders.ready,
      orderValue: acc.orderValue + store.orders.totalValue,
      pendingRepairs: acc.pendingRepairs + store.repairs.pending,
      inProgressRepairs: acc.inProgressRepairs + store.repairs.inProgress,
      readyRepairs: acc.readyRepairs + store.repairs.ready,
      repairValue: acc.repairValue + store.repairs.totalValue,
      overdueOrders: acc.overdueOrders + store.overdueOrders,
      overdueRepairs: acc.overdueRepairs + store.overdueRepairs,
    }),
    {
      pendingOrders: 0,
      inProgressOrders: 0,
      readyOrders: 0,
      orderValue: 0,
      pendingRepairs: 0,
      inProgressRepairs: 0,
      readyRepairs: 0,
      repairValue: 0,
      overdueOrders: 0,
      overdueRepairs: 0,
    }
  );

  return {
    stores: storeData,
    totals,
    overdueOrders,
    overdueRepairs,
  };
}

// ============================================================================
// CUSTOMER ANALYTICS
// ============================================================================

export async function getCustomerAnalytics(storeIds: string[]) {
  if (storeIds.length === 0) {
    return { stores: [], totals: {}, topCustomers: [], tierDistribution: [] };
  }

  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Get store-wise customer metrics
  const storeData = await Promise.all(
    storeIds.map(async (storeId) => {
      const [storeInfo] = await db
        .select({ name: stores.name, code: stores.code })
        .from(stores)
        .where(eq(stores.id, storeId));

      // Total customers
      const [totalCustomers] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(customers)
        .where(
          and(
            eq(customers.storeId, storeId),
            eq(customers.isActive, true)
          )
        );

      // New customers this month
      const [newCustomers] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(customers)
        .where(
          and(
            eq(customers.storeId, storeId),
            gte(customers.createdAt, startOfMonth)
          )
        );

      // Total loyalty points issued (active balance)
      const [loyaltyPoints] = await db
        .select({
          total: sql<number>`coalesce(sum(${customers.loyaltyPoints}), 0)::int`,
        })
        .from(customers)
        .where(eq(customers.storeId, storeId));

      // Points issued this month
      const [pointsIssued] = await db
        .select({
          total: sql<number>`coalesce(sum(case when ${loyaltyTransactions.type} = 'earned' then ${loyaltyTransactions.points} else 0 end), 0)::int`,
          redeemed: sql<number>`coalesce(sum(case when ${loyaltyTransactions.type} = 'redeemed' then ${loyaltyTransactions.points} else 0 end), 0)::int`,
        })
        .from(loyaltyTransactions)
        .where(
          and(
            eq(loyaltyTransactions.storeId, storeId),
            gte(loyaltyTransactions.createdAt, startOfMonth)
          )
        );

      // Customer tier distribution
      const tierDist = await db
        .select({
          tier: customers.tier,
          count: sql<number>`count(*)::int`,
        })
        .from(customers)
        .where(
          and(
            eq(customers.storeId, storeId),
            eq(customers.isActive, true)
          )
        )
        .groupBy(customers.tier);

      return {
        storeId,
        storeName: storeInfo?.name || 'Unknown',
        storeCode: storeInfo?.code || 'N/A',
        totalCustomers: totalCustomers?.count || 0,
        newCustomersThisMonth: newCustomers?.count || 0,
        totalLoyaltyPoints: loyaltyPoints?.total || 0,
        pointsIssuedThisMonth: pointsIssued?.total || 0,
        pointsRedeemedThisMonth: pointsIssued?.redeemed || 0,
        tierDistribution: tierDist,
      };
    })
  );

  // Get top 10 customers by lifetime value across all stores
  const topCustomers = await db
    .select({
      id: customers.id,
      name: sql<string>`${customers.firstName} || ' ' || coalesce(${customers.lastName}, '')`,
      phone: customers.phone,
      storeId: customers.storeId,
      storeName: stores.name,
      tier: customers.tier,
      loyaltyPoints: customers.loyaltyPoints,
      totalSpent: sql<number>`coalesce((
        select sum(${invoices.totalAmount})
        from ${invoices}
        where ${invoices.customerId} = ${customers.id}
        and ${invoices.status} = 'completed'
      ), 0)::numeric(12,2)`,
      purchaseCount: sql<number>`coalesce((
        select count(*)
        from ${invoices}
        where ${invoices.customerId} = ${customers.id}
        and ${invoices.status} = 'completed'
      ), 0)::int`,
    })
    .from(customers)
    .innerJoin(stores, eq(customers.storeId, stores.id))
    .where(
      and(
        inArray(customers.storeId, storeIds),
        eq(customers.isActive, true)
      )
    )
    .orderBy(desc(sql`(
      select sum(${invoices.totalAmount})
      from ${invoices}
      where ${invoices.customerId} = ${customers.id}
      and ${invoices.status} = 'completed'
    )`))
    .limit(10);

  // Aggregate tier distribution across all stores
  const tierDistribution = await db
    .select({
      tier: customers.tier,
      count: sql<number>`count(*)::int`,
    })
    .from(customers)
    .where(
      and(
        inArray(customers.storeId, storeIds),
        eq(customers.isActive, true)
      )
    )
    .groupBy(customers.tier);

  // Calculate totals
  const totals = storeData.reduce(
    (acc, store) => ({
      totalCustomers: acc.totalCustomers + store.totalCustomers,
      newCustomersThisMonth: acc.newCustomersThisMonth + store.newCustomersThisMonth,
      totalLoyaltyPoints: acc.totalLoyaltyPoints + store.totalLoyaltyPoints,
      pointsIssuedThisMonth: acc.pointsIssuedThisMonth + store.pointsIssuedThisMonth,
      pointsRedeemedThisMonth: acc.pointsRedeemedThisMonth + store.pointsRedeemedThisMonth,
    }),
    {
      totalCustomers: 0,
      newCustomersThisMonth: 0,
      totalLoyaltyPoints: 0,
      pointsIssuedThisMonth: 0,
      pointsRedeemedThisMonth: 0,
    }
  );

  return {
    stores: storeData,
    totals,
    topCustomers,
    tierDistribution,
  };
}

// ============================================================================
// ACTIVITY FEED
// ============================================================================

export async function getActivityFeed(storeIds: string[], limit: number = 50) {
  if (storeIds.length === 0) {
    return [];
  }

  const activities: {
    type: string;
    timestamp: Date;
    storeId: string;
    storeName: string;
    description: string;
    amount?: number;
    reference?: string;
  }[] = [];

  // Recent sales (last 24 hours)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const recentSales = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      storeId: invoices.storeId,
      storeName: stores.name,
      totalAmount: invoices.totalAmount,
      createdAt: invoices.createdAt,
      customerName: customers.firstName,
    })
    .from(invoices)
    .innerJoin(stores, eq(invoices.storeId, stores.id))
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .where(
      and(
        inArray(invoices.storeId, storeIds),
        gte(invoices.createdAt, yesterday),
        eq(invoices.status, 'completed')
      )
    )
    .orderBy(desc(invoices.createdAt))
    .limit(15);

  recentSales.forEach((sale) => {
    activities.push({
      type: 'sale',
      timestamp: sale.createdAt!,
      storeId: sale.storeId,
      storeName: sale.storeName,
      description: `Sale to ${sale.customerName || 'Walk-in'}`,
      amount: parseFloat(sale.totalAmount as any),
      reference: sale.invoiceNumber,
    });
  });

  // New customers (last 24 hours)
  const newCustomers = await db
    .select({
      id: customers.id,
      name: sql<string>`${customers.firstName} || ' ' || coalesce(${customers.lastName}, '')`,
      storeId: customers.storeId,
      storeName: stores.name,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .innerJoin(stores, eq(customers.storeId, stores.id))
    .where(
      and(
        inArray(customers.storeId, storeIds),
        gte(customers.createdAt, yesterday)
      )
    )
    .orderBy(desc(customers.createdAt))
    .limit(10);

  newCustomers.forEach((customer) => {
    activities.push({
      type: 'new_customer',
      timestamp: customer.createdAt!,
      storeId: customer.storeId,
      storeName: customer.storeName,
      description: `New customer: ${customer.name}`,
    });
  });

  // Recent attendance (today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const recentAttendance = await db
    .select({
      employeeName: employees.fullName,
      storeId: attendance.storeId,
      storeName: stores.name,
      checkIn: attendance.checkIn,
      checkOut: attendance.checkOut,
      status: attendance.status,
    })
    .from(attendance)
    .innerJoin(employees, eq(attendance.employeeId, employees.id))
    .innerJoin(stores, eq(attendance.storeId, stores.id))
    .where(
      and(
        inArray(attendance.storeId, storeIds),
        gte(attendance.date, today)
      )
    )
    .orderBy(desc(attendance.checkIn))
    .limit(15);

  recentAttendance.forEach((att) => {
    if (att.checkIn) {
      activities.push({
        type: 'clock_in',
        timestamp: att.checkIn,
        storeId: att.storeId,
        storeName: att.storeName,
        description: `${att.employeeName} clocked in`,
      });
    }
    if (att.checkOut) {
      activities.push({
        type: 'clock_out',
        timestamp: att.checkOut,
        storeId: att.storeId,
        storeName: att.storeName,
        description: `${att.employeeName} clocked out`,
      });
    }
  });

  // Recent custom orders created
  const recentOrders = await db
    .select({
      orderNumber: customOrders.orderNumber,
      storeId: customOrders.storeId,
      storeName: stores.name,
      designTitle: customOrders.designTitle,
      estimatedTotal: customOrders.estimatedTotal,
      createdAt: customOrders.createdAt,
    })
    .from(customOrders)
    .innerJoin(stores, eq(customOrders.storeId, stores.id))
    .where(
      and(
        inArray(customOrders.storeId, storeIds),
        gte(customOrders.createdAt, yesterday)
      )
    )
    .orderBy(desc(customOrders.createdAt))
    .limit(10);

  recentOrders.forEach((order) => {
    activities.push({
      type: 'custom_order',
      timestamp: order.createdAt!,
      storeId: order.storeId,
      storeName: order.storeName,
      description: `Custom order: ${order.designTitle || order.orderNumber}`,
      amount: parseFloat(order.estimatedTotal as any) || 0,
      reference: order.orderNumber,
    });
  });

  // Recent repairs
  const recentRepairs = await db
    .select({
      repairNumber: repairs.repairNumber,
      storeId: repairs.storeId,
      storeName: stores.name,
      itemDescription: repairs.itemDescription,
      estimatedCost: repairs.estimatedCost,
      createdAt: repairs.createdAt,
    })
    .from(repairs)
    .innerJoin(stores, eq(repairs.storeId, stores.id))
    .where(
      and(
        inArray(repairs.storeId, storeIds),
        gte(repairs.createdAt, yesterday)
      )
    )
    .orderBy(desc(repairs.createdAt))
    .limit(10);

  recentRepairs.forEach((repair) => {
    activities.push({
      type: 'repair',
      timestamp: repair.createdAt!,
      storeId: repair.storeId,
      storeName: repair.storeName,
      description: `Repair: ${repair.itemDescription || repair.repairNumber}`,
      amount: parseFloat(repair.estimatedCost as any) || 0,
      reference: repair.repairNumber,
    });
  });

  // Sort all activities by timestamp descending
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return activities.slice(0, limit);
}

// ============================================================================
// ENHANCED ALERTS (Additional alert types)
// ============================================================================

export async function getEnhancedAlerts(storeIds: string[]) {
  // Start with existing alerts
  const alerts = await getAlerts(storeIds);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  for (const storeId of storeIds) {
    const [storeInfo] = await db
      .select({ name: stores.name })
      .from(stores)
      .where(eq(stores.id, storeId));

    const storeName = storeInfo?.name || 'Unknown Store';

    // Low stock alerts (items with quantity below minimum)
    const [lowStock] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.storeId, storeId),
          eq(inventoryItems.status, 'in_stock'),
          sql`${inventoryItems.quantity} < ${inventoryItems.minStockLevel}`
        )
      );

    if ((lowStock?.count || 0) > 0) {
      alerts.push({
        type: 'low_stock',
        severity: 'medium',
        message: `${lowStock?.count} items below minimum stock level`,
        storeId,
        storeName,
        count: lowStock?.count,
      });
    }

    // Pending salary advances
    const [pendingAdvances] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(salaryAdvances)
      .where(
        and(
          eq(salaryAdvances.storeId, storeId),
          eq(salaryAdvances.status, 'pending')
        )
      );

    if ((pendingAdvances?.count || 0) > 0) {
      alerts.push({
        type: 'pending_advances',
        severity: 'low',
        message: `${pendingAdvances?.count} salary advance requests pending`,
        storeId,
        storeName,
        count: pendingAdvances?.count,
      });
    }

    // Custom orders past due date
    const [overdueOrders] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customOrders)
      .where(
        and(
          eq(customOrders.storeId, storeId),
          inArray(customOrders.status, ['pending', 'in_progress']),
          lte(customOrders.expectedCompletionDate, today)
        )
      );

    if ((overdueOrders?.count || 0) > 0) {
      alerts.push({
        type: 'overdue_orders',
        severity: 'high',
        message: `${overdueOrders?.count} custom orders are overdue`,
        storeId,
        storeName,
        count: overdueOrders?.count,
      });
    }

    // Loans maturing in 7 days
    const [maturingLoans] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(goldLoans)
      .where(
        and(
          eq(goldLoans.storeId, storeId),
          eq(goldLoans.status, 'active'),
          gte(goldLoans.maturityDate, today),
          lte(goldLoans.maturityDate, nextWeek)
        )
      );

    if ((maturingLoans?.count || 0) > 0) {
      alerts.push({
        type: 'maturing_loans',
        severity: 'medium',
        message: `${maturingLoans?.count} loans maturing in next 7 days`,
        storeId,
        storeName,
        count: maturingLoans?.count,
      });
    }

    // Pending expenses (unapproved)
    const [pendingExpenses] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(expenses)
      .where(
        and(
          eq(expenses.storeId, storeId),
          eq(expenses.approvalStatus, 'pending')
        )
      );

    if ((pendingExpenses?.count || 0) > 0) {
      alerts.push({
        type: 'pending_expenses',
        severity: 'low',
        message: `${pendingExpenses?.count} expenses pending approval`,
        storeId,
        storeName,
        count: pendingExpenses?.count,
      });
    }
  }

  // Re-sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}
