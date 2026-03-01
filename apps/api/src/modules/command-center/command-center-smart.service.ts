import { db } from '../../config/database.js';
import {
    stores,
    inventoryItems,
    invoices,
    invoiceItems,
    employees,
    attendance,
    goldLoans,
    pledgedGold,
    karigarTransactions,
    karigars,
    inventoryCategories,
} from '../../db/schema.js';
import { eq, and, desc, gte, lte, sql, inArray, asc, lt } from 'drizzle-orm';

// ============================================================================
// BUSINESS INTELLIGENCE
// ============================================================================

/**
 * Dead Stock Detector
 * Finds items sitting unsold beyond threshold days.
 * Groups by aging bucket: 60-90, 90-180, 180+ days.
 */
export async function getDeadStock(storeIds: string[]) {
    if (storeIds.length === 0) return { buckets: [], totalCostTiedUp: 0 };

    const now = new Date();
    const d60 = new Date(now); d60.setDate(d60.getDate() - 60);
    const d90 = new Date(now); d90.setDate(d90.getDate() - 90);
    const d180 = new Date(now); d180.setDate(d180.getDate() - 180);

    // Items still available, grouped by aging bucket
    const agingData = await db
        .select({
            storeId: inventoryItems.storeId,
            storeName: stores.name,
            bucket: sql<string>`
        CASE
          WHEN ${inventoryItems.createdAt} <= ${d180} THEN '180+'
          WHEN ${inventoryItems.createdAt} <= ${d90} THEN '90-180'
          WHEN ${inventoryItems.createdAt} <= ${d60} THEN '60-90'
          ELSE 'under_60'
        END
      `,
            itemCount: sql<number>`count(*)::int`,
            totalCost: sql<string>`COALESCE(sum(${inventoryItems.calculatedCost}), 0)`,
            totalWeight: sql<string>`COALESCE(sum(${inventoryItems.grossWeight}), 0)`,
            avgDaysInStock: sql<number>`avg(EXTRACT(EPOCH FROM (now() - ${inventoryItems.createdAt})) / 86400)::int`,
        })
        .from(inventoryItems)
        .innerJoin(stores, eq(inventoryItems.storeId, stores.id))
        .where(
            and(
                inArray(inventoryItems.storeId, storeIds),
                eq(inventoryItems.status, 'available'),
                eq(inventoryItems.isActive, true),
                lte(inventoryItems.createdAt, d60) // Only items older than 60 days
            )
        )
        .groupBy(inventoryItems.storeId, stores.name, sql`
      CASE
        WHEN ${inventoryItems.createdAt} <= ${d180} THEN '180+'
        WHEN ${inventoryItems.createdAt} <= ${d90} THEN '90-180'
        WHEN ${inventoryItems.createdAt} <= ${d60} THEN '60-90'
        ELSE 'under_60'
      END
    `)
        .orderBy(sql`
      CASE
        WHEN ${inventoryItems.createdAt} <= ${d180} THEN 1
        WHEN ${inventoryItems.createdAt} <= ${d90} THEN 2
        ELSE 3
      END
    `);

    // Top 20 oldest unsold items
    const oldestItems = await db
        .select({
            id: inventoryItems.id,
            sku: inventoryItems.sku,
            name: inventoryItems.name,
            storeName: stores.name,
            daysInStock: sql<number>`EXTRACT(EPOCH FROM (now() - ${inventoryItems.createdAt})) / 86400`,
            cost: inventoryItems.calculatedCost,
            grossWeight: inventoryItems.grossWeight,
            purity: inventoryItems.purity,
        })
        .from(inventoryItems)
        .innerJoin(stores, eq(inventoryItems.storeId, stores.id))
        .where(
            and(
                inArray(inventoryItems.storeId, storeIds),
                eq(inventoryItems.status, 'available'),
                eq(inventoryItems.isActive, true),
                lte(inventoryItems.createdAt, d60)
            )
        )
        .orderBy(asc(inventoryItems.createdAt))
        .limit(20);

    const totalCostTiedUp = agingData.reduce(
        (sum, b) => sum + parseFloat(b.totalCost || '0'), 0
    );

    return {
        buckets: agingData.map(b => ({
            storeId: b.storeId,
            storeName: b.storeName,
            bucket: b.bucket,
            itemCount: b.itemCount,
            totalCost: parseFloat(b.totalCost || '0'),
            totalWeight: parseFloat(b.totalWeight || '0'),
            avgDaysInStock: b.avgDaysInStock,
        })),
        oldestItems: oldestItems.map(i => ({
            ...i,
            daysInStock: Math.round(parseFloat(i.daysInStock as any) || 0),
            cost: parseFloat(i.cost || '0'),
            grossWeight: parseFloat(i.grossWeight || '0'),
        })),
        totalCostTiedUp,
    };
}

/**
 * Profit Margin Heatmap
 * Analyzes margins by category from actual sold invoice items.
 */
export async function getProfitMarginHeatmap(storeIds: string[]) {
    if (storeIds.length === 0) return [];

    const margins = await db
        .select({
            categoryName: sql<string>`COALESCE(${inventoryCategories.name}, 'Uncategorized')`,
            storeName: stores.name,
            storeId: invoices.storeId,
            itemsSold: sql<number>`count(*)::int`,
            totalRevenue: sql<string>`COALESCE(sum(${invoiceItems.lineTotal}), 0)`,
            totalCost: sql<string>`COALESCE(sum(${invoiceItems.unitCost}), 0)`,
            totalMargin: sql<string>`COALESCE(sum(${invoiceItems.grossMargin}), 0)`,
            avgMarginPercent: sql<string>`COALESCE(avg(${invoiceItems.grossMarginPercent}), 0)`,
            avgROI: sql<string>`COALESCE(avg(${invoiceItems.effectiveROI}), 0)`,
        })
        .from(invoiceItems)
        .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
        .innerJoin(stores, eq(invoices.storeId, stores.id))
        .leftJoin(inventoryItems, eq(invoiceItems.inventoryItemId, inventoryItems.id))
        .leftJoin(inventoryCategories, eq(inventoryItems.categoryId, inventoryCategories.id))
        .where(
            and(
                inArray(invoices.storeId, storeIds),
                eq(invoices.status, 'completed'),
                sql`${invoiceItems.grossMargin} IS NOT NULL`
            )
        )
        .groupBy(sql`COALESCE(${inventoryCategories.name}, 'Uncategorized')`, stores.name, invoices.storeId)
        .orderBy(desc(sql`COALESCE(avg(${invoiceItems.grossMarginPercent}), 0)`));

    return margins.map(m => ({
        categoryName: m.categoryName,
        storeName: m.storeName,
        storeId: m.storeId,
        itemsSold: m.itemsSold,
        totalRevenue: parseFloat(m.totalRevenue || '0'),
        totalCost: parseFloat(m.totalCost || '0'),
        totalMargin: parseFloat(m.totalMargin || '0'),
        avgMarginPercent: parseFloat(m.avgMarginPercent || '0'),
        avgROI: parseFloat(m.avgROI || '0'),
    }));
}

/**
 * Peak Hours Analysis
 * Sales distribution by hour of day and day of week.
 */
export async function getPeakHoursAnalysis(storeIds: string[]) {
    if (storeIds.length === 0) return { byHour: [], byDayOfWeek: [] };

    // Last 90 days
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const byHour = await db
        .select({
            hour: sql<number>`EXTRACT(HOUR FROM ${invoices.invoiceDate})::int`,
            salesCount: sql<number>`count(*)::int`,
            totalRevenue: sql<string>`COALESCE(sum(${invoices.totalAmount}), 0)`,
            avgTicket: sql<string>`COALESCE(avg(${invoices.totalAmount}), 0)`,
        })
        .from(invoices)
        .where(
            and(
                inArray(invoices.storeId, storeIds),
                eq(invoices.status, 'completed'),
                gte(invoices.invoiceDate, since)
            )
        )
        .groupBy(sql`EXTRACT(HOUR FROM ${invoices.invoiceDate})`)
        .orderBy(sql`EXTRACT(HOUR FROM ${invoices.invoiceDate})`);

    const byDayOfWeek = await db
        .select({
            dayOfWeek: sql<number>`EXTRACT(DOW FROM ${invoices.invoiceDate})::int`,
            dayName: sql<string>`TO_CHAR(${invoices.invoiceDate}, 'Day')`,
            salesCount: sql<number>`count(*)::int`,
            totalRevenue: sql<string>`COALESCE(sum(${invoices.totalAmount}), 0)`,
            avgTicket: sql<string>`COALESCE(avg(${invoices.totalAmount}), 0)`,
        })
        .from(invoices)
        .where(
            and(
                inArray(invoices.storeId, storeIds),
                eq(invoices.status, 'completed'),
                gte(invoices.invoiceDate, since)
            )
        )
        .groupBy(sql`EXTRACT(DOW FROM ${invoices.invoiceDate})`, sql`TO_CHAR(${invoices.invoiceDate}, 'Day')`)
        .orderBy(sql`EXTRACT(DOW FROM ${invoices.invoiceDate})`);

    return {
        byHour: byHour.map(h => ({
            hour: h.hour,
            salesCount: h.salesCount,
            totalRevenue: parseFloat(h.totalRevenue || '0'),
            avgTicket: parseFloat(h.avgTicket || '0'),
        })),
        byDayOfWeek: byDayOfWeek.map(d => ({
            dayOfWeek: d.dayOfWeek,
            dayName: (d.dayName || '').trim(),
            salesCount: d.salesCount,
            totalRevenue: parseFloat(d.totalRevenue || '0'),
            avgTicket: parseFloat(d.avgTicket || '0'),
        })),
    };
}

/**
 * Store Performance Ranking
 * Ranks stores by revenue per employee, avg ticket size, items per invoice.
 */
export async function getStorePerformanceRanking(storeIds: string[]) {
    if (storeIds.length === 0) return [];

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const storePerf = await Promise.all(
        storeIds.map(async (storeId) => {
            const [storeInfo] = await db
                .select({ name: stores.name, code: stores.code })
                .from(stores)
                .where(eq(stores.id, storeId));

            // Employee count
            const [empCount] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(employees)
                .where(and(eq(employees.storeId, storeId), eq(employees.status, 'active')));

            // Month's sales metrics
            const [salesMetrics] = await db
                .select({
                    invoiceCount: sql<number>`count(*)::int`,
                    totalRevenue: sql<string>`COALESCE(sum(${invoices.totalAmount}), 0)`,
                    avgTicket: sql<string>`COALESCE(avg(${invoices.totalAmount}), 0)`,
                })
                .from(invoices)
                .where(
                    and(
                        eq(invoices.storeId, storeId),
                        eq(invoices.status, 'completed'),
                        gte(invoices.invoiceDate, startOfMonth)
                    )
                );

            // Items per invoice
            const [itemMetrics] = await db
                .select({
                    avgItems: sql<string>`COALESCE(avg(item_count), 0)`,
                })
                .from(
                    db.select({
                        item_count: sql<number>`count(*)`,
                    })
                        .from(invoiceItems)
                        .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
                        .where(
                            and(
                                eq(invoices.storeId, storeId),
                                eq(invoices.status, 'completed'),
                                gte(invoices.invoiceDate, startOfMonth)
                            )
                        )
                        .groupBy(invoices.id)
                        .as('invoice_item_counts')
                );

            const empTotal = empCount?.count || 1;
            const revenue = parseFloat(salesMetrics?.totalRevenue || '0');

            return {
                storeId,
                storeName: storeInfo?.name || 'Unknown',
                storeCode: storeInfo?.code || 'N/A',
                employeeCount: empTotal,
                monthRevenue: revenue,
                revenuePerEmployee: revenue / empTotal,
                invoiceCount: salesMetrics?.invoiceCount || 0,
                avgTicketSize: parseFloat(salesMetrics?.avgTicket || '0'),
                avgItemsPerInvoice: parseFloat(itemMetrics?.avgItems || '0'),
            };
        })
    );

    // Sort by revenue per employee descending
    return storePerf.sort((a, b) => b.revenuePerEmployee - a.revenuePerEmployee);
}

/**
 * Sales Forecasting
 * Uses simple moving average of last 90 days to project next 7/30 days.
 */
export async function getSalesForecast(storeIds: string[]) {
    if (storeIds.length === 0) return { dailyAvg: 0, forecast7Day: 0, forecast30Day: 0, trend: [] };

    const d90 = new Date();
    d90.setDate(d90.getDate() - 90);

    // Daily sales over last 90 days
    const dailySales = await db
        .select({
            day: sql<string>`date_trunc('day', ${invoices.invoiceDate})::date`,
            count: sql<number>`count(*)::int`,
            total: sql<string>`COALESCE(sum(${invoices.totalAmount}), 0)`,
        })
        .from(invoices)
        .where(
            and(
                inArray(invoices.storeId, storeIds),
                eq(invoices.status, 'completed'),
                gte(invoices.invoiceDate, d90)
            )
        )
        .groupBy(sql`date_trunc('day', ${invoices.invoiceDate})::date`)
        .orderBy(sql`date_trunc('day', ${invoices.invoiceDate})::date`);

    const totals = dailySales.map(d => parseFloat(d.total || '0'));
    const overallAvg = totals.length > 0
        ? totals.reduce((s, v) => s + v, 0) / totals.length
        : 0;

    // Last 7-day average vs previous 7-day for trend
    const last7 = totals.slice(-7);
    const prev7 = totals.slice(-14, -7);
    const last7Avg = last7.length > 0 ? last7.reduce((s, v) => s + v, 0) / last7.length : 0;
    const prev7Avg = prev7.length > 0 ? prev7.reduce((s, v) => s + v, 0) / prev7.length : 0;
    const trendPercent = prev7Avg > 0 ? ((last7Avg - prev7Avg) / prev7Avg) * 100 : 0;

    return {
        dailyAvg: Math.round(overallAvg),
        forecast7Day: Math.round(last7Avg * 7),
        forecast30Day: Math.round(last7Avg * 30),
        trendPercent: Math.round(trendPercent * 10) / 10,
        trendDirection: trendPercent > 2 ? 'up' : trendPercent < -2 ? 'down' : 'stable',
        dailyTrend: dailySales.map(d => ({
            date: d.day,
            count: d.count,
            total: parseFloat(d.total || '0'),
        })),
    };
}

// ============================================================================
// GOLD-SPECIFIC INTELLIGENCE
// ============================================================================

/**
 * Gold Exposure Dashboard
 * Total gold grams across inventory, loans, karigar outstanding.
 */
export async function getGoldExposureDashboard(storeIds: string[]) {
    if (storeIds.length === 0) return {};

    // Gold in inventory
    const [inventoryGold] = await db
        .select({
            count: sql<number>`count(*)::int`,
            grossWeight: sql<string>`COALESCE(sum(${inventoryItems.grossWeight}), 0)`,
            netWeight: sql<string>`COALESCE(sum(${inventoryItems.netWeight}), 0)`,
            fineGold: sql<string>`COALESCE(sum(${inventoryItems.fineGoldEquivalent}), 0)`,
            marketValue: sql<string>`COALESCE(sum(${inventoryItems.currentMarketValue}), 0)`,
        })
        .from(inventoryItems)
        .where(
            and(
                inArray(inventoryItems.storeId, storeIds),
                eq(inventoryItems.metalType, 'gold'),
                eq(inventoryItems.status, 'available'),
                eq(inventoryItems.isActive, true)
            )
        );

    // Gold in loan pledges
    const [loanGold] = await db
        .select({
            count: sql<number>`count(*)::int`,
            grossWeight: sql<string>`COALESCE(sum(${pledgedGold.grossWeight}), 0)`,
            netWeight: sql<string>`COALESCE(sum(${pledgedGold.netWeight}), 0)`,
            appraised: sql<string>`COALESCE(sum(${pledgedGold.appraisedValue}), 0)`,
        })
        .from(pledgedGold)
        .innerJoin(goldLoans, eq(pledgedGold.loanId, goldLoans.id))
        .where(
            and(
                inArray(goldLoans.storeId, storeIds),
                eq(goldLoans.status, 'active')
            )
        );

    // Gold with karigars (net balance: issued - returned)
    const karigarGold = await db
        .select({
            totalIssued: sql<string>`COALESCE(sum(CASE WHEN ${karigarTransactions.transactionType} IN ('metal_issue') THEN ${karigarTransactions.goldAmount} ELSE 0 END), 0)`,
            totalReturned: sql<string>`COALESCE(sum(CASE WHEN ${karigarTransactions.transactionType} IN ('metal_return', 'scrap_return') THEN ${karigarTransactions.goldAmount} ELSE 0 END), 0)`,
            totalFineIssued: sql<string>`COALESCE(sum(CASE WHEN ${karigarTransactions.transactionType} IN ('metal_issue') THEN ${karigarTransactions.fineGoldAmount} ELSE 0 END), 0)`,
            totalFineReturned: sql<string>`COALESCE(sum(CASE WHEN ${karigarTransactions.transactionType} IN ('metal_return', 'scrap_return') THEN ${karigarTransactions.fineGoldAmount} ELSE 0 END), 0)`,
        })
        .from(karigarTransactions)
        .where(inArray(karigarTransactions.storeId, storeIds));

    const karigarBalance = {
        goldOutstanding: parseFloat(karigarGold[0]?.totalIssued || '0') - parseFloat(karigarGold[0]?.totalReturned || '0'),
        fineGoldOutstanding: parseFloat(karigarGold[0]?.totalFineIssued || '0') - parseFloat(karigarGold[0]?.totalFineReturned || '0'),
    };

    const totalGrossGrams =
        parseFloat(inventoryGold?.grossWeight || '0') +
        parseFloat(loanGold?.grossWeight || '0') +
        Math.abs(karigarBalance.goldOutstanding);

    return {
        inventory: {
            items: inventoryGold?.count || 0,
            grossWeight: parseFloat(inventoryGold?.grossWeight || '0'),
            netWeight: parseFloat(inventoryGold?.netWeight || '0'),
            fineGold: parseFloat(inventoryGold?.fineGold || '0'),
            marketValue: parseFloat(inventoryGold?.marketValue || '0'),
        },
        loans: {
            pledgeCount: loanGold?.count || 0,
            grossWeight: parseFloat(loanGold?.grossWeight || '0'),
            netWeight: parseFloat(loanGold?.netWeight || '0'),
            appraisedValue: parseFloat(loanGold?.appraised || '0'),
        },
        karigar: karigarBalance,
        totalExposure: {
            totalGrossGrams,
            breakdown: {
                inventoryPercent: totalGrossGrams > 0
                    ? (parseFloat(inventoryGold?.grossWeight || '0') / totalGrossGrams) * 100 : 0,
                loansPercent: totalGrossGrams > 0
                    ? (parseFloat(loanGold?.grossWeight || '0') / totalGrossGrams) * 100 : 0,
                karigarPercent: totalGrossGrams > 0
                    ? (Math.abs(karigarBalance.goldOutstanding) / totalGrossGrams) * 100 : 0,
            },
        },
    };
}

/**
 * Karigar Efficiency Scores
 * Wastage %, avg turnaround, gold balance per karigar.
 */
export async function getKarigarEfficiencyScores(storeIds: string[]) {
    if (storeIds.length === 0) return [];

    const karigarData = await db
        .select({
            karigarId: karigars.id,
            karigarName: karigars.name,
            storeName: stores.name,
            totalIssued: sql<string>`COALESCE(sum(CASE WHEN ${karigarTransactions.transactionType} = 'metal_issue' THEN ${karigarTransactions.goldAmount} ELSE 0 END), 0)`,
            totalReturned: sql<string>`COALESCE(sum(CASE WHEN ${karigarTransactions.transactionType} = 'metal_return' THEN ${karigarTransactions.goldAmount} ELSE 0 END), 0)`,
            totalScrap: sql<string>`COALESCE(sum(CASE WHEN ${karigarTransactions.transactionType} = 'scrap_return' THEN ${karigarTransactions.goldAmount} ELSE 0 END), 0)`,
            totalWastage: sql<string>`COALESCE(sum(CASE WHEN ${karigarTransactions.transactionType} = 'wastage_debit' THEN ${karigarTransactions.goldAmount} ELSE 0 END), 0)`,
            transactionCount: sql<number>`count(*)::int`,
            latestBalance: sql<string>`(array_agg(${karigarTransactions.runningGoldBalance} ORDER BY ${karigarTransactions.transactionDate} DESC))[1]`,
        })
        .from(karigarTransactions)
        .innerJoin(karigars, eq(karigarTransactions.karigarId, karigars.id))
        .innerJoin(stores, eq(karigarTransactions.storeId, stores.id))
        .where(inArray(karigarTransactions.storeId, storeIds))
        .groupBy(karigars.id, karigars.name, stores.name);

    return karigarData.map(k => {
        const issued = parseFloat(k.totalIssued || '0');
        const returned = parseFloat(k.totalReturned || '0');
        const wastage = parseFloat(k.totalWastage || '0');
        const wastagePercent = issued > 0 ? (wastage / issued) * 100 : 0;

        return {
            karigarId: k.karigarId,
            karigarName: k.karigarName,
            storeName: k.storeName,
            goldIssued: issued,
            goldReturned: returned,
            scrapReturned: parseFloat(k.totalScrap || '0'),
            wastage,
            wastagePercent: Math.round(wastagePercent * 100) / 100,
            currentBalance: parseFloat(k.latestBalance || '0'),
            transactionCount: k.transactionCount,
            efficiencyRating: wastagePercent <= 2 ? 'excellent' : wastagePercent <= 5 ? 'good' : wastagePercent <= 10 ? 'average' : 'poor',
        };
    }).sort((a, b) => a.wastagePercent - b.wastagePercent);
}

/**
 * Karigar Gold Reconciliation
 * Issued vs returned vs finished goods weight with discrepancy flags.
 */
export async function getKarigarGoldReconciliation(storeIds: string[]) {
    if (storeIds.length === 0) return [];

    const reconciliation = await db
        .select({
            karigarId: karigars.id,
            karigarName: karigars.name,
            storeName: stores.name,
            totalIssued: sql<string>`COALESCE(sum(CASE WHEN ${karigarTransactions.transactionType} = 'metal_issue' THEN ${karigarTransactions.goldAmount} ELSE 0 END), 0)`,
            totalReturned: sql<string>`COALESCE(sum(CASE WHEN ${karigarTransactions.transactionType} IN ('metal_return', 'scrap_return') THEN ${karigarTransactions.goldAmount} ELSE 0 END), 0)`,
            totalWastage: sql<string>`COALESCE(sum(CASE WHEN ${karigarTransactions.transactionType} = 'wastage_debit' THEN ${karigarTransactions.goldAmount} ELSE 0 END), 0)`,
            runningBalance: sql<string>`(array_agg(${karigarTransactions.runningGoldBalance} ORDER BY ${karigarTransactions.transactionDate} DESC))[1]`,
        })
        .from(karigarTransactions)
        .innerJoin(karigars, eq(karigarTransactions.karigarId, karigars.id))
        .innerJoin(stores, eq(karigarTransactions.storeId, stores.id))
        .where(inArray(karigarTransactions.storeId, storeIds))
        .groupBy(karigars.id, karigars.name, stores.name);

    return reconciliation.map(r => {
        const issued = parseFloat(r.totalIssued || '0');
        const returned = parseFloat(r.totalReturned || '0');
        const wastage = parseFloat(r.totalWastage || '0');
        const balance = parseFloat(r.runningBalance || '0');
        const expectedBalance = issued - returned - wastage;
        const discrepancy = Math.abs(balance - expectedBalance);

        return {
            karigarId: r.karigarId,
            karigarName: r.karigarName,
            storeName: r.storeName,
            goldIssued: issued,
            goldReturned: returned,
            wastageAccounted: wastage,
            runningBalance: balance,
            expectedBalance: Math.round(expectedBalance * 1000) / 1000,
            discrepancy: Math.round(discrepancy * 1000) / 1000,
            hasDiscrepancy: discrepancy > 0.01, // Flag if more than 0.01g discrepancy
            status: discrepancy <= 0.01 ? 'reconciled' : discrepancy <= 0.5 ? 'minor_variance' : 'investigate',
        };
    });
}

// ============================================================================
// PEOPLE INTELLIGENCE
// ============================================================================

/**
 * Salesperson Leaderboard
 * Ranked by sales count and revenue this month.
 */
export async function getSalespersonLeaderboard(storeIds: string[]) {
    if (storeIds.length === 0) return [];

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const leaderboard = await db
        .select({
            userId: invoices.createdBy,
            storeName: stores.name,
            salesCount: sql<number>`count(*)::int`,
            totalRevenue: sql<string>`COALESCE(sum(${invoices.totalAmount}), 0)`,
            avgTicket: sql<string>`COALESCE(avg(${invoices.totalAmount}), 0)`,
            maxSale: sql<string>`COALESCE(max(${invoices.totalAmount}), 0)`,
        })
        .from(invoices)
        .innerJoin(stores, eq(invoices.storeId, stores.id))
        .where(
            and(
                inArray(invoices.storeId, storeIds),
                eq(invoices.status, 'completed'),
                gte(invoices.invoiceDate, startOfMonth)
            )
        )
        .groupBy(invoices.createdBy, stores.name)
        .orderBy(desc(sql`COALESCE(sum(${invoices.totalAmount}), 0)`));

    return leaderboard.map((s, index) => ({
        rank: index + 1,
        userId: s.userId,
        storeName: s.storeName,
        salesCount: s.salesCount,
        totalRevenue: parseFloat(s.totalRevenue || '0'),
        avgTicket: parseFloat(s.avgTicket || '0'),
        maxSale: parseFloat(s.maxSale || '0'),
    }));
}

/**
 * Attendance Pattern Alerts
 * Identifies employees with concerning attendance patterns.
 */
export async function getAttendancePatternAlerts(storeIds: string[]) {
    if (storeIds.length === 0) return [];

    const d30 = new Date();
    d30.setDate(d30.getDate() - 30);

    const patterns = await db
        .select({
            employeeId: employees.id,
            employeeName: employees.fullName,
            storeName: stores.name,
            totalDays: sql<number>`count(${attendance.id})::int`,
            presentDays: sql<number>`count(CASE WHEN ${attendance.status} = 'present' THEN 1 END)::int`,
            lateDays: sql<number>`count(CASE WHEN ${attendance.status} = 'late' THEN 1 END)::int`,
            absentDays: sql<number>`count(CASE WHEN ${attendance.status} = 'absent' THEN 1 END)::int`,
            leaveDays: sql<number>`count(CASE WHEN ${attendance.status} = 'on_leave' THEN 1 END)::int`,
        })
        .from(employees)
        .innerJoin(stores, eq(employees.storeId, stores.id))
        .leftJoin(
            attendance,
            and(
                eq(attendance.employeeId, employees.id),
                gte(attendance.date, d30)
            )
        )
        .where(
            and(
                inArray(employees.storeId, storeIds),
                eq(employees.status, 'active')
            )
        )
        .groupBy(employees.id, employees.fullName, stores.name);

    return patterns
        .map(p => {
            const attendanceRate = p.totalDays > 0
                ? ((p.presentDays + p.lateDays) / p.totalDays) * 100 : 100;
            const lateRate = p.totalDays > 0
                ? (p.lateDays / p.totalDays) * 100 : 0;

            const alerts: string[] = [];
            if (lateRate > 30) alerts.push('Frequent late arrivals');
            if (p.absentDays > 5) alerts.push(`${p.absentDays} absences in 30 days`);
            if (attendanceRate < 70) alerts.push('Low attendance rate');

            return {
                employeeId: p.employeeId,
                employeeName: p.employeeName,
                storeName: p.storeName,
                totalDays: p.totalDays,
                presentDays: p.presentDays,
                lateDays: p.lateDays,
                absentDays: p.absentDays,
                leaveDays: p.leaveDays,
                attendanceRate: Math.round(attendanceRate * 10) / 10,
                lateRate: Math.round(lateRate * 10) / 10,
                alerts,
                hasAlert: alerts.length > 0,
            };
        })
        .filter(p => p.hasAlert)
        .sort((a, b) => a.attendanceRate - b.attendanceRate);
}
