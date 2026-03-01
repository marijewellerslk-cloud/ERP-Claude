/**
 * Margin Reports Service
 * Comprehensive ROI, margin analysis, and performance reporting
 */

import { db } from '../config/database.js';
import {
  invoices,
  invoiceItems,
  inventoryItems,
  inventoryCategories,
  users,
  reportSnapshots,
} from '../db/schema.js';
import { eq, and, gte, lte, desc, sql, isNotNull } from 'drizzle-orm';
import { stockValuationService } from './stock-valuation.service.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface MarginAnalysis {
  itemId: string;
  sku: string;
  name: string;
  category: string | null;
  soldDate: Date;
  holdingDays: number;
  costPrice: number;
  salePrice: number;
  grossProfit: number;
  grossMarginPercent: number;
  roi: number;
  metalProfitGrams: number;
}

export interface CategoryReport {
  categoryId: string | null;
  categoryName: string;
  itemsSold: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossMarginPercent: number;
  totalWeightSold: number;
  avgHoldingDays: number;
  avgRoi: number;
  bestPerformer: {
    sku: string;
    name: string;
    roi: number;
  } | null;
  worstPerformer: {
    sku: string;
    name: string;
    roi: number;
  } | null;
}

export interface SalespersonReport {
  salespersonId: string;
  salespersonName: string;
  salesCount: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossMarginPercent: number;
  avgTransactionValue: number;
  commissionEarned: number;
  topCategories: Array<{ category: string; revenue: number }>;
}

export interface MetalPLReport {
  periodStart: Date;
  periodEnd: Date;
  goldPurchased: number;
  goldSold: number;
  goldWastage: number;
  netGoldMovement: number;
  fineGoldPurchased: number;
  fineGoldSold: number;
  fineGoldProfit: number;
  purchaseValue: number;
  salesValue: number;
  currencyProfit: number;
  avgPurchaseRate: number;
  avgSaleRate: number;
  rateSpread: number;
}

export interface DashboardMetrics {
  today: {
    sales: number;
    revenue: number;
    profit: number;
    marginPercent: number;
  };
  thisWeek: {
    sales: number;
    revenue: number;
    profit: number;
    marginPercent: number;
  };
  thisMonth: {
    sales: number;
    revenue: number;
    profit: number;
    marginPercent: number;
  };
  topCategories: CategoryReport[];
  topSalespeople: SalespersonReport[];
  stockHealth: {
    totalItems: number;
    totalValue: number;
    deadStockCount: number;
    deadStockValue: number;
    avgAge: number;
  };
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class MarginReportsService {
  /**
   * Get margin analysis for sold items in a date range
   */
  async getMarginAnalysis(
    storeId: string,
    startDate: Date,
    endDate: Date,
    categoryId?: string
  ): Promise<MarginAnalysis[]> {
    // Join with invoices for date filtering
    const results = await db
      .select({
        itemId: inventoryItems.id,
        sku: inventoryItems.sku,
        name: inventoryItems.name,
        categoryId: inventoryItems.categoryId,
        categoryName: inventoryCategories.name,
        soldAt: inventoryItems.soldAt,
        createdAt: inventoryItems.createdAt,
        costPrice: inventoryItems.calculatedCost,
        salePrice: invoiceItems.lineTotal,
        netWeight: inventoryItems.netWeight,
        fineGoldEquivalent: inventoryItems.fineGoldEquivalent,
        goldRateAtPurchase: inventoryItems.dailyGoldRate,
      })
      .from(invoiceItems)
      .innerJoin(inventoryItems, eq(invoiceItems.inventoryItemId, inventoryItems.id))
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .leftJoin(inventoryCategories, eq(inventoryItems.categoryId, inventoryCategories.id))
      .where(
        and(
          eq(inventoryItems.storeId, storeId),
          eq(inventoryItems.status, 'sold'),
          gte(invoices.createdAt, startDate),
          lte(invoices.createdAt, endDate),
          ...(categoryId ? [eq(inventoryItems.categoryId, categoryId)] : [])
        )
      )
      .orderBy(desc(invoices.createdAt));

    return results.map((row) => {
      const cost = parseFloat(row.costPrice || '0');
      const sale = parseFloat(row.salePrice || '0');
      const profit = sale - cost;
      const marginPercent = sale > 0 ? (profit / sale) * 100 : 0;
      const roi = cost > 0 ? (profit / cost) * 100 : 0;
      const holdingDays = row.soldAt && row.createdAt
        ? Math.ceil((row.soldAt.getTime() - row.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Calculate metal profit in grams
      const fineGold = parseFloat(row.fineGoldEquivalent || '0');
      const goldRate = parseFloat(row.goldRateAtPurchase || '0');
      const metalProfitGrams = goldRate > 0 ? profit / goldRate : 0;

      return {
        itemId: row.itemId,
        sku: row.sku,
        name: row.name,
        category: row.categoryName,
        soldDate: row.soldAt!,
        holdingDays,
        costPrice: cost,
        salePrice: sale,
        grossProfit: profit,
        grossMarginPercent: Math.round(marginPercent * 100) / 100,
        roi: Math.round(roi * 100) / 100,
        metalProfitGrams: Math.round(metalProfitGrams * 1000) / 1000,
      };
    });
  }

  /**
   * Get category performance report
   */
  async getCategoryPerformance(
    storeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CategoryReport[]> {
    // Get aggregated data by category
    const categoryData = await db
      .select({
        categoryId: inventoryItems.categoryId,
        categoryName: inventoryCategories.name,
        itemsSold: sql<number>`COUNT(DISTINCT ${inventoryItems.id})`,
        totalRevenue: sql<number>`COALESCE(SUM(${invoiceItems.lineTotal}), 0)`,
        totalCost: sql<number>`COALESCE(SUM(${inventoryItems.calculatedCost}), 0)`,
        totalWeight: sql<number>`COALESCE(SUM(${inventoryItems.netWeight}), 0)`,
        avgHoldingDays: sql<number>`AVG(EXTRACT(DAY FROM ${inventoryItems.soldAt} - ${inventoryItems.createdAt}))`,
      })
      .from(invoiceItems)
      .innerJoin(inventoryItems, eq(invoiceItems.inventoryItemId, inventoryItems.id))
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .leftJoin(inventoryCategories, eq(inventoryItems.categoryId, inventoryCategories.id))
      .where(
        and(
          eq(inventoryItems.storeId, storeId),
          eq(inventoryItems.status, 'sold'),
          gte(invoices.createdAt, startDate),
          lte(invoices.createdAt, endDate)
        )
      )
      .groupBy(inventoryItems.categoryId, inventoryCategories.name);

    const reports: CategoryReport[] = [];

    for (const cat of categoryData) {
      const revenue = parseFloat(cat.totalRevenue?.toString() || '0');
      const cost = parseFloat(cat.totalCost?.toString() || '0');
      const profit = revenue - cost;
      const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;
      const avgRoi = cost > 0 ? (profit / cost) * 100 : 0;

      // Get best and worst performers
      const performers = await this.getCategoryPerformers(storeId, cat.categoryId, startDate, endDate);

      reports.push({
        categoryId: cat.categoryId,
        categoryName: cat.categoryName || 'Uncategorized',
        itemsSold: parseInt(cat.itemsSold?.toString() || '0'),
        totalRevenue: revenue,
        totalCost: cost,
        grossProfit: profit,
        grossMarginPercent: Math.round(marginPercent * 100) / 100,
        totalWeightSold: parseFloat(cat.totalWeight?.toString() || '0'),
        avgHoldingDays: Math.round(parseFloat(cat.avgHoldingDays?.toString() || '0')),
        avgRoi: Math.round(avgRoi * 100) / 100,
        bestPerformer: performers.best,
        worstPerformer: performers.worst,
      });
    }

    return reports.sort((a, b) => b.grossProfit - a.grossProfit);
  }

  /**
   * Get best and worst performers in a category
   */
  private async getCategoryPerformers(
    storeId: string,
    categoryId: string | null,
    startDate: Date,
    endDate: Date
  ): Promise<{ best: CategoryReport['bestPerformer']; worst: CategoryReport['worstPerformer'] }> {
    const conditions = [
      eq(inventoryItems.storeId, storeId),
      eq(inventoryItems.status, 'sold'),
      gte(inventoryItems.soldAt!, startDate),
      lte(inventoryItems.soldAt!, endDate),
    ];

    if (categoryId) {
      conditions.push(eq(inventoryItems.categoryId, categoryId));
    }

    const items = await db
      .select({
        sku: inventoryItems.sku,
        name: inventoryItems.name,
        cost: inventoryItems.calculatedCost,
        sale: inventoryItems.soldPrice,
      })
      .from(inventoryItems)
      .where(and(...conditions))
      .limit(100);

    let best: { sku: string; name: string; roi: number } | null = null;
    let worst: { sku: string; name: string; roi: number } | null = null;

    for (const item of items) {
      const cost = parseFloat(item.cost || '0');
      const sale = parseFloat(item.sale || '0');
      const roi = cost > 0 ? ((sale - cost) / cost) * 100 : 0;

      if (!best || roi > best.roi) {
        best = { sku: item.sku, name: item.name, roi: Math.round(roi * 100) / 100 };
      }
      if (!worst || roi < worst.roi) {
        worst = { sku: item.sku, name: item.name, roi: Math.round(roi * 100) / 100 };
      }
    }

    return { best, worst };
  }

  /**
   * Get salesperson performance report
   */
  async getSalespersonPerformance(
    storeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SalespersonReport[]> {
    const salespersonData = await db
      .select({
        salespersonId: invoices.createdBy,
        salespersonName: users.fullName,
        salesCount: sql<number>`COUNT(DISTINCT ${invoices.id})`,
        totalRevenue: sql<number>`COALESCE(SUM(${invoices.totalAmount}), 0)`,
        totalCost: sql<number>`COALESCE(SUM(${invoiceItems.unitCost} * ${invoiceItems.quantity}), 0)`,
        commissionEarned: sql<number>`0`,
      })
      .from(invoices)
      .leftJoin(invoiceItems, eq(invoiceItems.invoiceId, invoices.id))
      .leftJoin(users, eq(invoices.createdBy, users.id))
      .where(
        and(
          eq(invoices.storeId, storeId),
          eq(invoices.paymentStatus, 'completed'),
          isNotNull(invoices.createdBy),
          gte(invoices.createdAt, startDate),
          lte(invoices.createdAt, endDate)
        )
      )
      .groupBy(invoices.createdBy, users.fullName);

    const reports: SalespersonReport[] = [];

    for (const sp of salespersonData) {
      if (!sp.salespersonId) continue;

      const revenue = parseFloat(sp.totalRevenue?.toString() || '0');
      const cost = parseFloat(sp.totalCost?.toString() || '0');
      const profit = revenue - cost;
      const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;
      const salesCount = parseInt(sp.salesCount?.toString() || '0');
      const avgTransaction = salesCount > 0 ? revenue / salesCount : 0;

      // Get top categories for this salesperson
      const topCategories = await this.getSalespersonTopCategories(
        storeId,
        sp.salespersonId,
        startDate,
        endDate
      );

      reports.push({
        salespersonId: sp.salespersonId,
        salespersonName: sp.salespersonName || 'Unknown',
        salesCount,
        totalRevenue: revenue,
        totalCost: cost,
        grossProfit: profit,
        grossMarginPercent: Math.round(marginPercent * 100) / 100,
        avgTransactionValue: Math.round(avgTransaction * 100) / 100,
        commissionEarned: parseFloat(sp.commissionEarned?.toString() || '0'),
        topCategories,
      });
    }

    return reports.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  /**
   * Get top categories for a salesperson
   */
  private async getSalespersonTopCategories(
    storeId: string,
    salespersonId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ category: string; revenue: number }>> {
    const categoryData = await db
      .select({
        categoryName: inventoryCategories.name,
        revenue: sql<number>`COALESCE(SUM(${invoiceItems.lineTotal}), 0)`,
      })
      .from(invoices)
      .innerJoin(invoiceItems, eq(invoiceItems.invoiceId, invoices.id))
      .innerJoin(inventoryItems, eq(invoiceItems.inventoryItemId, inventoryItems.id))
      .leftJoin(inventoryCategories, eq(inventoryItems.categoryId, inventoryCategories.id))
      .where(
        and(
          eq(invoices.storeId, storeId),
          eq(invoices.createdBy, salespersonId),
          eq(invoices.paymentStatus, 'completed'),
          gte(invoices.createdAt, startDate),
          lte(invoices.createdAt, endDate)
        )
      )
      .groupBy(inventoryCategories.name)
      .orderBy(desc(sql`COALESCE(SUM(${invoiceItems.lineTotal}), 0)`))
      .limit(5);

    return categoryData.map((c) => ({
      category: c.categoryName || 'Uncategorized',
      revenue: parseFloat(c.revenue?.toString() || '0'),
    }));
  }

  /**
   * Get metal profit/loss report
   */
  async getMetalProfitLoss(
    storeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<MetalPLReport> {
    // Get purchases (from batches/inventory items created in period)
    const purchases = await db
      .select({
        totalWeight: sql<number>`COALESCE(SUM(${inventoryItems.netWeight}), 0)`,
        totalFineGold: sql<number>`COALESCE(SUM(${inventoryItems.fineGoldEquivalent}), 0)`,
        totalValue: sql<number>`COALESCE(SUM(${inventoryItems.calculatedCost}), 0)`,
      })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.storeId, storeId),
          eq(inventoryItems.metalType, 'gold'),
          gte(inventoryItems.createdAt, startDate),
          lte(inventoryItems.createdAt, endDate)
        )
      );

    // Get sales
    const sales = await db
      .select({
        totalWeight: sql<number>`COALESCE(SUM(${inventoryItems.netWeight}), 0)`,
        totalFineGold: sql<number>`COALESCE(SUM(${inventoryItems.fineGoldEquivalent}), 0)`,
        totalValue: sql<number>`COALESCE(SUM(${inventoryItems.soldPrice}), 0)`,
        totalCost: sql<number>`COALESCE(SUM(${inventoryItems.calculatedCost}), 0)`,
      })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.storeId, storeId),
          eq(inventoryItems.metalType, 'gold'),
          eq(inventoryItems.status, 'sold'),
          gte(inventoryItems.soldAt!, startDate),
          lte(inventoryItems.soldAt!, endDate)
        )
      );

    const purchaseWeight = parseFloat(purchases[0]?.totalWeight?.toString() || '0');
    const purchaseFineGold = parseFloat(purchases[0]?.totalFineGold?.toString() || '0');
    const purchaseValue = parseFloat(purchases[0]?.totalValue?.toString() || '0');

    const salesWeight = parseFloat(sales[0]?.totalWeight?.toString() || '0');
    const salesFineGold = parseFloat(sales[0]?.totalFineGold?.toString() || '0');
    const salesValue = parseFloat(sales[0]?.totalValue?.toString() || '0');
    const salesCost = parseFloat(sales[0]?.totalCost?.toString() || '0');

    const avgPurchaseRate = purchaseFineGold > 0 ? purchaseValue / purchaseFineGold : 0;
    const avgSaleRate = salesFineGold > 0 ? salesValue / salesFineGold : 0;

    return {
      periodStart: startDate,
      periodEnd: endDate,
      goldPurchased: purchaseWeight,
      goldSold: salesWeight,
      goldWastage: 0, // Would need to integrate with job cards
      netGoldMovement: purchaseWeight - salesWeight,
      fineGoldPurchased: purchaseFineGold,
      fineGoldSold: salesFineGold,
      fineGoldProfit: salesFineGold - (salesCost / avgPurchaseRate || 0),
      purchaseValue,
      salesValue,
      currencyProfit: salesValue - salesCost,
      avgPurchaseRate: Math.round(avgPurchaseRate * 100) / 100,
      avgSaleRate: Math.round(avgSaleRate * 100) / 100,
      rateSpread: Math.round((avgSaleRate - avgPurchaseRate) * 100) / 100,
    };
  }

  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(storeId: string): Promise<DashboardMetrics> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get period metrics
    const [todayMetrics, weekMetrics, monthMetrics] = await Promise.all([
      this.getPeriodMetrics(storeId, todayStart, now),
      this.getPeriodMetrics(storeId, weekStart, now),
      this.getPeriodMetrics(storeId, monthStart, now),
    ]);

    // Get top categories (this month)
    const topCategories = await this.getCategoryPerformance(storeId, monthStart, now);

    // Get top salespeople (this month)
    const topSalespeople = await this.getSalespersonPerformance(storeId, monthStart, now);

    // Get stock health from valuation service
    const agingReport = await stockValuationService.getStockAgingReport(storeId);

    return {
      today: todayMetrics,
      thisWeek: weekMetrics,
      thisMonth: monthMetrics,
      topCategories: topCategories.slice(0, 5),
      topSalespeople: topSalespeople.slice(0, 5),
      stockHealth: {
        totalItems: agingReport.totalItems,
        totalValue: agingReport.totalValue,
        deadStockCount: agingReport.deadStockItems.length,
        deadStockValue: agingReport.deadStockItems.reduce((sum, item) => sum + item.calculatedCost, 0),
        avgAge: agingReport.averageAge,
      },
    };
  }

  /**
   * Get metrics for a specific period
   */
  private async getPeriodMetrics(
    storeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ sales: number; revenue: number; profit: number; marginPercent: number }> {
    const [data] = await db
      .select({
        sales: sql<number>`COUNT(DISTINCT ${invoices.id})`,
        revenue: sql<number>`COALESCE(SUM(${invoices.totalAmount}), 0)`,
        cost: sql<number>`COALESCE(SUM(${invoiceItems.unitCost} * ${invoiceItems.quantity}), 0)`,
      })
      .from(invoices)
      .leftJoin(invoiceItems, eq(invoiceItems.invoiceId, invoices.id))
      .where(
        and(
          eq(invoices.storeId, storeId),
          eq(invoices.paymentStatus, 'paid'),
          gte(invoices.createdAt, startDate),
          lte(invoices.createdAt, endDate)
        )
      );

    const sales = parseInt(data?.sales?.toString() || '0');
    const revenue = parseFloat(data?.revenue?.toString() || '0');
    const cost = parseFloat(data?.cost?.toString() || '0');
    const profit = revenue - cost;
    const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      sales,
      revenue: Math.round(revenue * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      marginPercent: Math.round(marginPercent * 100) / 100,
    };
  }

  /**
   * Generate and store daily report snapshot
   */
  async generateDailySnapshot(storeId: string, date: Date): Promise<void> {
    const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    const metrics = await this.getPeriodMetrics(storeId, startDate, endDate);
    const categoryBreakdown = await this.getCategoryPerformance(storeId, startDate, endDate);
    const salespersonBreakdown = await this.getSalespersonPerformance(storeId, startDate, endDate);

    // Upsert the snapshot
    await db
      .insert(reportSnapshots)
      .values({
        storeId,
        reportType: 'daily_sales',
        reportDate: startDate,
        periodStart: startDate,
        periodEnd: endDate,
        metrics: metrics,
        breakdownByCategory: categoryBreakdown,
        breakdownBySalesperson: salespersonBreakdown,
      })
      .onConflictDoUpdate({
        target: [reportSnapshots.storeId, reportSnapshots.reportType, reportSnapshots.reportDate],
        set: {
          metrics: metrics,
          breakdownByCategory: categoryBreakdown,
          breakdownBySalesperson: salespersonBreakdown,
        },
      });

    logger.info('Daily report snapshot generated', { storeId, date: startDate });
  }

  /**
   * Get ROI ranking for items
   */
  async getROIRanking(
    storeId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 20,
    order: 'best' | 'worst' = 'best'
  ): Promise<MarginAnalysis[]> {
    const analysis = await this.getMarginAnalysis(storeId, startDate, endDate);

    const sorted = analysis.sort((a, b) =>
      order === 'best' ? b.roi - a.roi : a.roi - b.roi
    );

    return sorted.slice(0, limit);
  }

  /**
   * Get slow-moving items report
   */
  async getSlowMovingItems(
    storeId: string,
    thresholdDays: number = 90,
    limit: number = 50
  ): Promise<Array<{
    id: string;
    sku: string;
    name: string;
    category: string | null;
    ageInDays: number;
    cost: number;
    marketValue: number;
    unrealizedGainLoss: number;
  }>> {
    const items = await db
      .select({
        id: inventoryItems.id,
        sku: inventoryItems.sku,
        name: inventoryItems.name,
        categoryName: inventoryCategories.name,
        createdAt: inventoryItems.createdAt,
        cost: inventoryItems.calculatedCost,
        marketValue: inventoryItems.currentMarketValue,
        unrealizedGainLoss: inventoryItems.unrealizedGainLoss,
      })
      .from(inventoryItems)
      .leftJoin(inventoryCategories, eq(inventoryItems.categoryId, inventoryCategories.id))
      .where(
        and(
          eq(inventoryItems.storeId, storeId),
          eq(inventoryItems.status, 'available'),
          eq(inventoryItems.isActive, true),
          sql`${inventoryItems.createdAt} < NOW() - INTERVAL '${thresholdDays} days'`
        )
      )
      .orderBy(inventoryItems.createdAt)
      .limit(limit);

    return items.map((item) => {
      const ageInDays = Math.ceil(
        (Date.now() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.categoryName,
        ageInDays,
        cost: parseFloat(item.cost || '0'),
        marketValue: parseFloat(item.marketValue || item.cost || '0'),
        unrealizedGainLoss: parseFloat(item.unrealizedGainLoss || '0'),
      };
    });
  }
}

export const marginReportsService = new MarginReportsService();
