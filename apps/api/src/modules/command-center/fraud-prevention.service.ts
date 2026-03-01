import { db } from '../../config/database.js';
import {
    stores,
    invoices,
    invoiceItems,
    inventoryItems,
    salesReturns,
    expenses,
    goldLoans,
    pledgedGold,
    payroll,
    accounts,
    bankAccounts,
    auditLogs,
    loginHistory,
    users,
} from '../../db/schema.js';
import { eq, and, desc, gte, lte, sql, inArray } from 'drizzle-orm';

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

/**
 * Anomaly Detection — Flags suspicious transaction patterns.
 * Covers: high discounts, high void/return rates, off-hours activity,
 * rapid repeat invoices, below-cost sales.
 */
export async function getAnomalyAlerts(storeIds: string[]) {
    if (storeIds.length === 0) return [];

    const alerts: {
        type: string;
        severity: 'critical' | 'high' | 'medium' | 'low';
        message: string;
        storeId: string;
        storeName: string;
        details: Record<string, any>;
    }[] = [];

    const d30 = new Date();
    d30.setDate(d30.getDate() - 30);

    for (const storeId of storeIds) {
        const [storeInfo] = await db
            .select({ name: stores.name })
            .from(stores)
            .where(eq(stores.id, storeId));
        const storeName = storeInfo?.name || 'Unknown';

        // 1. High discount invoices (>30% discount on any item)
        const highDiscounts = await db
            .select({
                invoiceId: invoices.id,
                invoiceNumber: invoices.invoiceNumber,
                createdBy: invoices.createdBy,
                totalAmount: invoices.totalAmount,
                discountAmount: invoices.discountAmount,
                createdAt: invoices.createdAt,
            })
            .from(invoices)
            .where(
                and(
                    eq(invoices.storeId, storeId),
                    gte(invoices.invoiceDate, d30),
                    sql`${invoices.discountAmount}::numeric > 0`,
                    sql`(${invoices.discountAmount}::numeric / NULLIF(${invoices.totalAmount}::numeric + ${invoices.discountAmount}::numeric, 0)) > 0.30`
                )
            )
            .limit(20);

        for (const inv of highDiscounts) {
            const discountPct = parseFloat(inv.discountAmount || '0') /
                (parseFloat(inv.totalAmount || '0') + parseFloat(inv.discountAmount || '0')) * 100;
            alerts.push({
                type: 'high_discount',
                severity: discountPct > 50 ? 'critical' : 'high',
                message: `Invoice ${inv.invoiceNumber}: ${Math.round(discountPct)}% discount applied`,
                storeId,
                storeName,
                details: {
                    invoiceId: inv.invoiceId,
                    invoiceNumber: inv.invoiceNumber,
                    discountPercent: Math.round(discountPct),
                    totalAmount: parseFloat(inv.totalAmount || '0'),
                    createdBy: inv.createdBy,
                    date: inv.createdAt,
                },
            });
        }

        // 2. High void/return rate per employee
        const returnRates = await db
            .select({
                createdBy: salesReturns.createdBy,
                returnCount: sql<number>`count(*)::int`,
            })
            .from(salesReturns)
            .where(
                and(
                    eq(salesReturns.storeId, storeId),
                    gte(salesReturns.createdAt, d30)
                )
            )
            .groupBy(salesReturns.createdBy);

        const salesCounts = await db
            .select({
                createdBy: invoices.createdBy,
                salesCount: sql<number>`count(*)::int`,
            })
            .from(invoices)
            .where(
                and(
                    eq(invoices.storeId, storeId),
                    eq(invoices.status, 'completed'),
                    gte(invoices.invoiceDate, d30)
                )
            )
            .groupBy(invoices.createdBy);

        const salesMap = new Map(salesCounts.map(s => [s.createdBy, s.salesCount]));

        for (const ret of returnRates) {
            const sales = salesMap.get(ret.createdBy) || 0;
            const returnRate = sales > 0 ? (ret.returnCount / sales) * 100 : 100;
            if (returnRate > 15) {
                alerts.push({
                    type: 'high_return_rate',
                    severity: returnRate > 30 ? 'critical' : 'high',
                    message: `Employee has ${Math.round(returnRate)}% return rate (${ret.returnCount} returns vs ${sales} sales)`,
                    storeId,
                    storeName,
                    details: {
                        userId: ret.createdBy,
                        returnCount: ret.returnCount,
                        salesCount: sales,
                        returnRate: Math.round(returnRate),
                    },
                });
            }
        }

        // 3. Off-hours transactions (before 8 AM or after 10 PM)
        const offHours = await db
            .select({
                count: sql<number>`count(*)::int`,
                earliest: sql<string>`min(${invoices.createdAt})`,
                latest: sql<string>`max(${invoices.createdAt})`,
            })
            .from(invoices)
            .where(
                and(
                    eq(invoices.storeId, storeId),
                    gte(invoices.invoiceDate, d30),
                    sql`(EXTRACT(HOUR FROM ${invoices.createdAt}) < 8 OR EXTRACT(HOUR FROM ${invoices.createdAt}) >= 22)`
                )
            );

        if ((offHours[0]?.count || 0) > 0) {
            alerts.push({
                type: 'off_hours_activity',
                severity: 'medium',
                message: `${offHours[0].count} transactions outside business hours (before 8 AM or after 10 PM)`,
                storeId,
                storeName,
                details: {
                    count: offHours[0].count,
                    earliest: offHours[0].earliest,
                    latest: offHours[0].latest,
                },
            });
        }

        // 4. Rapid repeat invoices — same customer, multiple invoices within 1 hour
        const rapidRepeats = await db
            .select({
                customerId: invoices.customerId,
                count: sql<number>`count(*)::int`,
                invoiceNumbers: sql<string>`string_agg(${invoices.invoiceNumber}, ', ')`,
            })
            .from(invoices)
            .where(
                and(
                    eq(invoices.storeId, storeId),
                    eq(invoices.status, 'completed'),
                    gte(invoices.invoiceDate, d30),
                    sql`${invoices.customerId} IS NOT NULL`
                )
            )
            .groupBy(invoices.customerId, sql`date_trunc('hour', ${invoices.createdAt})`)
            .having(sql`count(*) >= 3`);

        for (const rr of rapidRepeats) {
            alerts.push({
                type: 'rapid_repeat_invoice',
                severity: 'medium',
                message: `${rr.count} invoices for same customer within 1 hour (possible split-invoice)`,
                storeId,
                storeName,
                details: {
                    customerId: rr.customerId,
                    invoiceCount: rr.count,
                    invoiceNumbers: rr.invoiceNumbers,
                },
            });
        }

        // 5. Below-cost sales — items sold below their cost price
        const belowCost = await db
            .select({
                count: sql<number>`count(*)::int`,
                totalLoss: sql<string>`COALESCE(sum(${invoiceItems.unitCost}::numeric - ${invoiceItems.lineTotal}::numeric), 0)`,
            })
            .from(invoiceItems)
            .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
            .where(
                and(
                    eq(invoices.storeId, storeId),
                    eq(invoices.status, 'completed'),
                    gte(invoices.invoiceDate, d30),
                    sql`${invoiceItems.unitCost} IS NOT NULL`,
                    sql`${invoiceItems.lineTotal}::numeric < ${invoiceItems.unitCost}::numeric`
                )
            );

        if ((belowCost[0]?.count || 0) > 0) {
            alerts.push({
                type: 'below_cost_sale',
                severity: 'critical',
                message: `${belowCost[0].count} items sold below cost price (total loss: ₹${parseFloat(belowCost[0].totalLoss || '0').toLocaleString()})`,
                storeId,
                storeName,
                details: {
                    count: belowCost[0].count,
                    totalLoss: parseFloat(belowCost[0].totalLoss || '0'),
                },
            });
        }

        // 6. Failed login attempts (brute force indicator)
        const failedLogins = await db
            .select({
                count: sql<number>`count(*)::int`,
                distinctIPs: sql<number>`count(distinct ${loginHistory.ipAddress})::int`,
            })
            .from(loginHistory)
            .where(
                and(
                    eq(loginHistory.status, 'failed'),
                    gte(loginHistory.createdAt, d30)
                )
            );

        if ((failedLogins[0]?.count || 0) > 10) {
            alerts.push({
                type: 'failed_logins',
                severity: failedLogins[0].count > 50 ? 'critical' : 'medium',
                message: `${failedLogins[0].count} failed login attempts from ${failedLogins[0].distinctIPs} IPs in last 30 days`,
                storeId: 'system',
                storeName: 'System-wide',
                details: {
                    count: failedLogins[0].count,
                    distinctIPs: failedLogins[0].distinctIPs,
                },
            });
            break; // Only report once (system-wide)
        }
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return alerts;
}

// ============================================================================
// CASH FLOW FORECAST
// ============================================================================

/**
 * Cash Flow Forecast
 * Projects 30-day cash position from current balances, receivables, payables,
 * payroll due, and loan maturities.
 */
export async function getCashFlowForecast(storeIds: string[]) {
    if (storeIds.length === 0) return {};

    const today = new Date();
    const d30Future = new Date(today);
    d30Future.setDate(d30Future.getDate() + 30);

    // Current cash + bank balances
    const [currentCash] = await db
        .select({
            cash: sql<string>`COALESCE(sum(CASE WHEN ${bankAccounts.bankAccountType} = 'cash' THEN ${bankAccounts.currentBalance} ELSE 0 END), 0)`,
            bank: sql<string>`COALESCE(sum(CASE WHEN ${bankAccounts.bankAccountType} != 'cash' THEN ${bankAccounts.currentBalance} ELSE 0 END), 0)`,
        })
        .from(bankAccounts)
        .where(
            and(
                inArray(bankAccounts.storeId, storeIds),
                eq(bankAccounts.isActive, true)
            )
        );

    // Accounts receivable
    const [receivables] = await db
        .select({
            total: sql<string>`COALESCE(sum(${accounts.currentBalance}), 0)`,
        })
        .from(accounts)
        .where(
            and(
                inArray(accounts.storeId, storeIds),
                eq(accounts.accountSubType, 'accounts_receivable'),
                eq(accounts.isActive, true)
            )
        );

    // Accounts payable
    const [payables] = await db
        .select({
            total: sql<string>`COALESCE(sum(${accounts.currentBalance}), 0)`,
        })
        .from(accounts)
        .where(
            and(
                inArray(accounts.storeId, storeIds),
                eq(accounts.accountSubType, 'accounts_payable'),
                eq(accounts.isActive, true)
            )
        );

    // Upcoming payroll (unpaid for current month)
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const [upcomingPayroll] = await db
        .select({
            total: sql<string>`COALESCE(sum(${payroll.netSalary}), 0)`,
            count: sql<number>`count(*)::int`,
        })
        .from(payroll)
        .where(
            and(
                inArray(payroll.storeId, storeIds),
                eq(payroll.month, currentMonth),
                eq(payroll.year, currentYear),
                sql`${payroll.status} != 'paid'`
            )
        );

    // Loan maturities in next 30 days
    const [expiringLoans] = await db
        .select({
            count: sql<number>`count(*)::int`,
            totalLoanAmount: sql<string>`COALESCE(sum(${goldLoans.loanAmount}), 0)`,
        })
        .from(goldLoans)
        .where(
            and(
                inArray(goldLoans.storeId, storeIds),
                eq(goldLoans.status, 'active'),
                lte(goldLoans.expiryDate, d30Future),
                gte(goldLoans.expiryDate, today)
            )
        );

    // Average daily income (last 30 days)
    const d30Past = new Date(today);
    d30Past.setDate(d30Past.getDate() - 30);
    const [avgIncome] = await db
        .select({
            total: sql<string>`COALESCE(sum(${invoices.totalAmount}), 0)`,
            days: sql<number>`count(distinct date_trunc('day', ${invoices.invoiceDate}))::int`,
        })
        .from(invoices)
        .where(
            and(
                inArray(invoices.storeId, storeIds),
                eq(invoices.status, 'completed'),
                gte(invoices.invoiceDate, d30Past)
            )
        );

    // Average daily expenses (last 30 days)
    const [avgExpenses] = await db
        .select({
            total: sql<string>`COALESCE(sum(${expenses.totalAmount}), 0)`,
        })
        .from(expenses)
        .where(
            and(
                inArray(expenses.storeId, storeIds),
                gte(expenses.expenseDate, d30Past)
            )
        );

    const cashBalance = parseFloat(currentCash?.cash || '0');
    const bankBalance = parseFloat(currentCash?.bank || '0');
    const totalLiquidity = cashBalance + bankBalance;
    const receivableAmt = parseFloat(receivables?.total || '0');
    const payableAmt = parseFloat(payables?.total || '0');
    const payrollDue = parseFloat(upcomingPayroll?.total || '0');
    const incomeTotal = parseFloat(avgIncome?.total || '0');
    const expenseTotal = parseFloat(avgExpenses?.total || '0');
    const incomeDays = avgIncome?.days || 1;
    const dailyNetCashFlow = (incomeTotal / incomeDays) - (expenseTotal / 30);

    const projected30Day = totalLiquidity + (dailyNetCashFlow * 30) - payrollDue;
    const daysUntilShortfall = dailyNetCashFlow < 0
        ? Math.floor(totalLiquidity / Math.abs(dailyNetCashFlow))
        : null;

    return {
        currentPosition: {
            cashBalance,
            bankBalance,
            totalLiquidity,
        },
        obligations: {
            accountsPayable: payableAmt,
            payrollDue,
            payrollEmployees: upcomingPayroll?.count || 0,
            expiringLoans: expiringLoans?.count || 0,
            expiringLoanAmount: parseFloat(expiringLoans?.totalLoanAmount || '0'),
        },
        inflows: {
            accountsReceivable: receivableAmt,
            avgDailyIncome: Math.round(incomeTotal / incomeDays),
            projectedMonthlyIncome: Math.round((incomeTotal / incomeDays) * 30),
        },
        outflows: {
            avgDailyExpenses: Math.round(expenseTotal / 30),
            projectedMonthlyExpenses: Math.round(expenseTotal),
        },
        forecast: {
            dailyNetCashFlow: Math.round(dailyNetCashFlow),
            projected30DayBalance: Math.round(projected30Day),
            daysUntilShortfall,
            riskLevel: projected30Day < 0 ? 'critical' : projected30Day < totalLiquidity * 0.2 ? 'high' : projected30Day < totalLiquidity * 0.5 ? 'medium' : 'low',
        },
    };
}

// ============================================================================
// LOAN RISK MONITOR
// ============================================================================

/**
 * Loan Risk Monitor
 * Flags loans where gold value has dropped near or below LTV threshold.
 */
export async function getLoanRiskMonitor(storeIds: string[]) {
    if (storeIds.length === 0) return [];

    const today = new Date();

    // Get active loans with pledged gold value
    const loans = await db
        .select({
            loanId: goldLoans.id,
            loanNumber: goldLoans.loanNumber,
            storeName: stores.name,
            customerName: sql<string>`COALESCE(${goldLoans.customerName}, 'Unknown')`,
            loanAmount: goldLoans.loanAmount,
            interestRate: goldLoans.interestRateMonthly,
            expiryDate: goldLoans.expiryDate,
            totalPledgeValue: sql<string>`COALESCE(sum(${pledgedGold.appraisedValue}), 0)`,
            totalGoldWeight: sql<string>`COALESCE(sum(${pledgedGold.grossWeight}), 0)`,
        })
        .from(goldLoans)
        .innerJoin(stores, eq(goldLoans.storeId, stores.id))
        .leftJoin(pledgedGold, eq(pledgedGold.loanId, goldLoans.id))
        .where(
            and(
                inArray(goldLoans.storeId, storeIds),
                eq(goldLoans.status, 'active')
            )
        )
        .groupBy(goldLoans.id, goldLoans.loanNumber, stores.name, goldLoans.customerName,
            goldLoans.loanAmount, goldLoans.interestRateMonthly, goldLoans.expiryDate)
        .orderBy(desc(sql`${goldLoans.loanAmount}::numeric / NULLIF(sum(${pledgedGold.appraisedValue}), 0)`));

    return loans.map(loan => {
        const loanAmt = parseFloat(loan.loanAmount || '0');
        const pledgeVal = parseFloat(loan.totalPledgeValue || '0');
        const currentLTV = pledgeVal > 0 ? (loanAmt / pledgeVal) * 100 : 100;
        const isExpired = loan.expiryDate && new Date(loan.expiryDate) < today;
        const daysToExpiry = loan.expiryDate
            ? Math.ceil((new Date(loan.expiryDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            : null;

        let riskLevel: 'critical' | 'high' | 'medium' | 'low';
        if (isExpired || currentLTV > 90) riskLevel = 'critical';
        else if (currentLTV > 75 || (daysToExpiry !== null && daysToExpiry <= 7)) riskLevel = 'high';
        else if (currentLTV > 60 || (daysToExpiry !== null && daysToExpiry <= 30)) riskLevel = 'medium';
        else riskLevel = 'low';

        return {
            loanId: loan.loanId,
            loanNumber: loan.loanNumber,
            storeName: loan.storeName,
            customerName: loan.customerName,
            loanAmount: loanAmt,
            pledgeValue: pledgeVal,
            goldWeight: parseFloat(loan.totalGoldWeight || '0'),
            currentLTV: Math.round(currentLTV * 10) / 10,
            interestRate: parseFloat(loan.interestRate || '0'),
            expiryDate: loan.expiryDate,
            daysToExpiry,
            isExpired,
            riskLevel,
        };
    }).filter(l => l.riskLevel !== 'low'); // Only show risky loans
}

// ============================================================================
// FRAUD RISK SCORE
// ============================================================================

/**
 * Composite Fraud Risk Score per store.
 * Combines all anomaly signals into a 0-100 score.
 */
export async function getFraudRiskScore(storeIds: string[]) {
    if (storeIds.length === 0) return [];

    const d30 = new Date();
    d30.setDate(d30.getDate() - 30);

    const storeScores = await Promise.all(
        storeIds.map(async (storeId) => {
            const [storeInfo] = await db
                .select({ name: stores.name, code: stores.code })
                .from(stores)
                .where(eq(stores.id, storeId));

            let score = 0;
            const signals: { signal: string; weight: number; triggered: boolean }[] = [];

            // Signal 1: High discount invoices (weight: 20)
            const [highDiscountCount] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(invoices)
                .where(
                    and(
                        eq(invoices.storeId, storeId),
                        gte(invoices.invoiceDate, d30),
                        sql`${invoices.discountAmount}::numeric > 0`,
                        sql`(${invoices.discountAmount}::numeric / NULLIF(${invoices.totalAmount}::numeric + ${invoices.discountAmount}::numeric, 0)) > 0.30`
                    )
                );
            const hasHighDiscounts = (highDiscountCount?.count || 0) > 3;
            if (hasHighDiscounts) score += 20;
            signals.push({ signal: 'High discount invoices (>30%)', weight: 20, triggered: hasHighDiscounts });

            // Signal 2: Below-cost sales (weight: 25)
            const [belowCostCount] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(invoiceItems)
                .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
                .where(
                    and(
                        eq(invoices.storeId, storeId),
                        eq(invoices.status, 'completed'),
                        gte(invoices.invoiceDate, d30),
                        sql`${invoiceItems.unitCost} IS NOT NULL`,
                        sql`${invoiceItems.lineTotal}::numeric < ${invoiceItems.unitCost}::numeric`
                    )
                );
            const hasBelowCost = (belowCostCount?.count || 0) > 0;
            if (hasBelowCost) score += 25;
            signals.push({ signal: 'Below-cost sales', weight: 25, triggered: hasBelowCost });

            // Signal 3: Off-hours activity (weight: 15)
            const [offHoursCount] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(invoices)
                .where(
                    and(
                        eq(invoices.storeId, storeId),
                        gte(invoices.invoiceDate, d30),
                        sql`(EXTRACT(HOUR FROM ${invoices.createdAt}) < 8 OR EXTRACT(HOUR FROM ${invoices.createdAt}) >= 22)`
                    )
                );
            const hasOffHours = (offHoursCount?.count || 0) > 5;
            if (hasOffHours) score += 15;
            signals.push({ signal: 'Off-hours transactions', weight: 15, triggered: hasOffHours });

            // Signal 4: High return rate overall (weight: 20)
            const [totalSales] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(invoices)
                .where(
                    and(eq(invoices.storeId, storeId), eq(invoices.status, 'completed'), gte(invoices.invoiceDate, d30))
                );
            const [totalReturns] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(salesReturns)
                .where(
                    and(eq(salesReturns.storeId, storeId), gte(salesReturns.createdAt, d30))
                );
            const returnRate = (totalSales?.count || 0) > 0
                ? ((totalReturns?.count || 0) / (totalSales?.count || 1)) * 100 : 0;
            const hasHighReturns = returnRate > 15;
            if (hasHighReturns) score += 20;
            signals.push({ signal: `Return rate: ${Math.round(returnRate)}%`, weight: 20, triggered: hasHighReturns });

            // Signal 5: Audit log anomalies — unusual number of edits/deletes (weight: 20)
            const [auditAnomalies] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(auditLogs)
                .where(
                    and(
                        eq(auditLogs.storeId, storeId),
                        gte(auditLogs.createdAt, d30),
                        inArray(auditLogs.action, ['delete', 'update'])
                    )
                );
            // More than 100 edits/deletes in 30 days is suspicious
            const hasExcessiveEdits = (auditAnomalies?.count || 0) > 100;
            if (hasExcessiveEdits) score += 20;
            signals.push({ signal: `Excessive edits/deletes (${auditAnomalies?.count || 0})`, weight: 20, triggered: hasExcessiveEdits });

            let riskLevel: 'critical' | 'high' | 'medium' | 'low';
            if (score >= 60) riskLevel = 'critical';
            else if (score >= 40) riskLevel = 'high';
            else if (score >= 20) riskLevel = 'medium';
            else riskLevel = 'low';

            return {
                storeId,
                storeName: storeInfo?.name || 'Unknown',
                storeCode: storeInfo?.code || 'N/A',
                riskScore: score,
                riskLevel,
                signals,
                triggeredCount: signals.filter(s => s.triggered).length,
                totalSignals: signals.length,
            };
        })
    );

    return storeScores.sort((a, b) => b.riskScore - a.riskScore);
}
