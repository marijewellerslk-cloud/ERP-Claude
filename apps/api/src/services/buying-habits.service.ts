import { db } from '../config/database.js';
import {
  customerBuyingHabits,
  customers,
  invoices,
  invoiceItems,
  inventoryItems,
  inventoryCategories,
} from '../db/schema.js';
import { eq, and, desc, sql, gte, lte, isNotNull, count, sum, avg, min, max } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

// RFM Segment definitions
const RFM_SEGMENTS = {
  champions: { name: 'Champions', description: 'Best customers, buy frequently, spend big' },
  loyal: { name: 'Loyal Customers', description: 'Consistent buyers with good spend' },
  potential: { name: 'Potential Loyalists', description: 'Recent customers with average frequency' },
  new: { name: 'New Customers', description: 'Just made first purchase' },
  promising: { name: 'Promising', description: 'Recent shoppers but low frequency' },
  need_attention: { name: 'Need Attention', description: 'Above average but haven\'t purchased recently' },
  about_to_sleep: { name: 'About to Sleep', description: 'Below average recency and frequency' },
  at_risk: { name: 'At Risk', description: 'Spent big but long time ago' },
  cant_lose: { name: 'Can\'t Lose', description: 'Made big purchases but haven\'t returned' },
  hibernating: { name: 'Hibernating', description: 'Low recency, frequency, and monetary' },
  lost: { name: 'Lost', description: 'Lowest recency, frequency, and monetary' },
};

// Budget tier thresholds (in INR)
const BUDGET_TIERS = {
  economy: { min: 0, max: 25000, label: 'Economy' },
  mid_range: { min: 25001, max: 100000, label: 'Mid Range' },
  premium: { min: 100001, max: 500000, label: 'Premium' },
  luxury: { min: 500001, max: Infinity, label: 'Luxury' },
};

class BuyingHabitsService {
  // Calculate and update buying habits for a specific customer
  async calculateCustomerHabits(customerId: string, storeId: string) {
    try {
      // Get all invoices for this customer
      const customerInvoices = await db.query.invoices.findMany({
        where: and(
          eq(invoices.customerId, customerId),
          eq(invoices.storeId, storeId),
          eq(invoices.paymentStatus, 'paid')
        ),
        with: {
          invoiceItems: {
            with: {
              inventoryItem: {
                with: {
                  category: true,
                },
              },
            },
          },
        },
        orderBy: [desc(invoices.invoiceDate)],
      });

      if (customerInvoices.length === 0) {
        // No purchases yet, create empty habits record
        await this.upsertBuyingHabits(customerId, storeId, {
          totalPurchases: 0,
          totalSpent: '0',
          rfmSegment: 'new',
        });
        return;
      }

      // Calculate metrics
      const totalPurchases = customerInvoices.length;
      const totalSpent = customerInvoices.reduce(
        (sum, inv) => sum + parseFloat(inv.finalAmount),
        0
      );
      const firstPurchaseDate = new Date(
        customerInvoices[customerInvoices.length - 1].invoiceDate
      );
      const lastPurchaseDate = new Date(customerInvoices[0].invoiceDate);

      // Calculate average days between purchases
      let averageDaysBetweenPurchases = 0;
      if (totalPurchases > 1) {
        const totalDays = Math.floor(
          (lastPurchaseDate.getTime() - firstPurchaseDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        averageDaysBetweenPurchases = Math.floor(totalDays / (totalPurchases - 1));
      }

      // Calculate metal type preferences
      const metalCounts: Record<string, number> = {};
      const categoryCounts: Record<string, { count: number; name: string }> = {};
      const occasionCounts: Record<string, number> = {};
      const purchaseMonths: number[] = [];
      let totalGoldWeight = 0;

      for (const invoice of customerInvoices) {
        // Track purchase month
        const month = new Date(invoice.invoiceDate).getMonth() + 1;
        purchaseMonths.push(month);

        // Track purchase occasion
        if (invoice.purchaseOccasion) {
          occasionCounts[invoice.purchaseOccasion] =
            (occasionCounts[invoice.purchaseOccasion] || 0) + 1;
        }

        for (const item of invoice.invoiceItems) {
          const invItem = item.inventoryItem;
          if (invItem) {
            // Track metal types
            if (invItem.metalType) {
              metalCounts[invItem.metalType] =
                (metalCounts[invItem.metalType] || 0) + 1;
            }

            // Track categories
            if (invItem.category) {
              if (!categoryCounts[invItem.categoryId!]) {
                categoryCounts[invItem.categoryId!] = {
                  count: 0,
                  name: invItem.category.name,
                };
              }
              categoryCounts[invItem.categoryId!].count++;
            }

            // Track gold weight
            if (invItem.metalType === 'gold' && invItem.grossWeight) {
              totalGoldWeight += parseFloat(invItem.grossWeight);
            }
          }
        }
      }

      // Convert counts to percentages
      const totalItems = Object.values(metalCounts).reduce((a, b) => a + b, 0) || 1;
      const preferredMetalTypes: Record<string, number> = {};
      for (const [metal, metalCount] of Object.entries(metalCounts)) {
        preferredMetalTypes[metal] = Math.round((metalCount / totalItems) * 100);
      }

      // Convert category counts to array with percentages
      const preferredCategories = Object.entries(categoryCounts)
        .map(([categoryId, data]) => ({
          categoryId,
          name: data.name,
          count: data.count,
          percentage: Math.round((data.count / totalItems) * 100),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Calculate occasion percentages
      const totalOccasions = Object.values(occasionCounts).reduce((a, b) => a + b, 0) || 1;
      const purchaseOccasions: Record<string, number> = {};
      for (const [occasion, occasionCount] of Object.entries(occasionCounts)) {
        purchaseOccasions[occasion] = Math.round((occasionCount / totalOccasions) * 100);
      }

      // Find most common purchase months
      const monthCounts: Record<number, number> = {};
      for (const m of purchaseMonths) {
        monthCounts[m] = (monthCounts[m] || 0) + 1;
      }
      const preferredPurchaseMonths = Object.entries(monthCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([m]) => parseInt(m));

      // Calculate budget metrics
      const invoiceAmounts = customerInvoices.map((inv) =>
        parseFloat(inv.finalAmount)
      );
      const averagePurchaseValue = totalSpent / totalPurchases;
      const minPurchaseValue = Math.min(...invoiceAmounts);
      const maxPurchaseValue = Math.max(...invoiceAmounts);

      // Determine budget tier
      let budgetTier = 'economy';
      if (averagePurchaseValue > BUDGET_TIERS.luxury.min) {
        budgetTier = 'luxury';
      } else if (averagePurchaseValue > BUDGET_TIERS.premium.min) {
        budgetTier = 'premium';
      } else if (averagePurchaseValue > BUDGET_TIERS.mid_range.min) {
        budgetTier = 'mid_range';
      }

      // Calculate RFM scores (will be calculated across all customers)
      const daysSinceLastPurchase = Math.floor(
        (Date.now() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate churn risk (0-100)
      const expectedNextPurchase =
        averageDaysBetweenPurchases > 0
          ? averageDaysBetweenPurchases
          : 90; // Default 90 days for single purchase
      const overdueDays = Math.max(0, daysSinceLastPurchase - expectedNextPurchase);
      const churnRiskScore = Math.min(100, (overdueDays / expectedNextPurchase) * 100);

      // Predict next purchase date
      const predictedNextPurchaseDate = new Date(
        lastPurchaseDate.getTime() +
          (averageDaysBetweenPurchases || 90) * 24 * 60 * 60 * 1000
      );

      // Calculate lifetime value (simple: average purchase * estimated future purchases)
      const estimatedYearlyPurchases =
        averageDaysBetweenPurchases > 0
          ? 365 / averageDaysBetweenPurchases
          : 4;
      const estimatedYearsAsCustomer = 5; // Assume 5-year customer lifespan
      const predictedLifetimeValue =
        averagePurchaseValue * estimatedYearlyPurchases * estimatedYearsAsCustomer;

      // Upsert buying habits
      await this.upsertBuyingHabits(customerId, storeId, {
        preferredMetalTypes,
        preferredCategories,
        purchaseOccasions,
        averagePurchaseValue: averagePurchaseValue.toFixed(2),
        minPurchaseValue: minPurchaseValue.toFixed(2),
        maxPurchaseValue: maxPurchaseValue.toFixed(2),
        budgetTier,
        totalPurchases,
        totalSpent: totalSpent.toFixed(2),
        totalGoldWeightPurchased: totalGoldWeight.toFixed(3),
        firstPurchaseDate,
        lastPurchaseDate,
        averageDaysBetweenPurchases,
        preferredPurchaseMonths,
        churnRiskScore: churnRiskScore.toFixed(2),
        predictedNextPurchaseDate,
        lifetimeValue: totalSpent.toFixed(2),
        predictedLifetimeValue: predictedLifetimeValue.toFixed(2),
        lastCalculatedAt: new Date(),
      });

      logger.info(`Updated buying habits for customer ${customerId}`);
    } catch (error) {
      logger.error(`Error calculating buying habits for customer ${customerId}:`, error);
      throw error;
    }
  }

  // Upsert buying habits record
  private async upsertBuyingHabits(
    customerId: string,
    storeId: string,
    data: Partial<{
      preferredMetalTypes: Record<string, number>;
      preferredCategories: { categoryId: string; name: string; count: number; percentage: number }[];
      purchaseOccasions: Record<string, number>;
      averagePurchaseValue: string;
      minPurchaseValue: string;
      maxPurchaseValue: string;
      budgetTier: string;
      recencyScore: number;
      frequencyScore: number;
      monetaryScore: number;
      rfmSegment: string;
      totalPurchases: number;
      totalSpent: string;
      totalGoldWeightPurchased: string;
      firstPurchaseDate: Date;
      lastPurchaseDate: Date;
      averageDaysBetweenPurchases: number;
      preferredPurchaseMonths: number[];
      preferredPurchaseDays: string[];
      churnRiskScore: string;
      predictedNextPurchaseDate: Date;
      lifetimeValue: string;
      predictedLifetimeValue: string;
      lastCalculatedAt: Date;
    }>
  ) {
    const existing = await db.query.customerBuyingHabits.findFirst({
      where: eq(customerBuyingHabits.customerId, customerId),
    });

    if (existing) {
      await db.update(customerBuyingHabits)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(customerBuyingHabits.id, existing.id));
    } else {
      await db.insert(customerBuyingHabits).values({
        customerId,
        storeId,
        ...data,
      });
    }
  }

  // Calculate RFM scores for all customers in a store
  async calculateRFMScores(storeId: string) {
    try {
      // Get all customers with purchase data
      const customerStats = await db
        .select({
          customerId: invoices.customerId,
          lastPurchaseDate: max(invoices.invoiceDate),
          purchaseCount: count(invoices.id),
          totalSpent: sum(invoices.finalAmount),
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.storeId, storeId),
            eq(invoices.paymentStatus, 'paid'),
            isNotNull(invoices.customerId)
          )
        )
        .groupBy(invoices.customerId);

      if (customerStats.length === 0) {
        return;
      }

      // Calculate quartiles for RFM scoring
      const recencies = customerStats.map((c) => {
        const lastDate = c.lastPurchaseDate ? new Date(c.lastPurchaseDate) : new Date();
        return Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      });
      const frequencies = customerStats.map((c) => Number(c.purchaseCount));
      const monetaries = customerStats.map((c) => parseFloat(c.totalSpent || '0'));

      // Sort for quartile calculation
      recencies.sort((a, b) => a - b);
      frequencies.sort((a, b) => b - a);
      monetaries.sort((a, b) => b - a);

      // Calculate quartile boundaries
      const getQuartile = (arr: number[], value: number, inverse = false): number => {
        const len = arr.length;
        const q1 = arr[Math.floor(len * 0.25)];
        const q2 = arr[Math.floor(len * 0.5)];
        const q3 = arr[Math.floor(len * 0.75)];

        if (inverse) {
          // For recency, lower is better
          if (value <= q1) return 5;
          if (value <= q2) return 4;
          if (value <= q3) return 3;
          if (value <= arr[len - 1]) return 2;
          return 1;
        } else {
          // For frequency and monetary, higher is better
          if (value >= q1) return 5;
          if (value >= q2) return 4;
          if (value >= q3) return 3;
          if (value > 0) return 2;
          return 1;
        }
      };

      // Update each customer's RFM scores
      for (const stat of customerStats) {
        if (!stat.customerId) continue;

        const lastDate = stat.lastPurchaseDate ? new Date(stat.lastPurchaseDate) : new Date();
        const daysSinceLastPurchase = Math.floor(
          (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const purchaseCount = Number(stat.purchaseCount);
        const totalSpent = parseFloat(stat.totalSpent || '0');

        const recencyScore = getQuartile(recencies, daysSinceLastPurchase, true);
        const frequencyScore = getQuartile(frequencies, purchaseCount);
        const monetaryScore = getQuartile(monetaries, totalSpent);

        // Determine RFM segment
        const rfmSegment = this.getRFMSegment(recencyScore, frequencyScore, monetaryScore);

        // Update buying habits
        await db.update(customerBuyingHabits)
          .set({
            recencyScore,
            frequencyScore,
            monetaryScore,
            rfmSegment,
            updatedAt: new Date(),
          })
          .where(eq(customerBuyingHabits.customerId, stat.customerId));
      }

      logger.info(`Updated RFM scores for ${customerStats.length} customers in store ${storeId}`);
    } catch (error) {
      logger.error(`Error calculating RFM scores:`, error);
      throw error;
    }
  }

  // Determine RFM segment based on scores
  private getRFMSegment(r: number, f: number, m: number): string {
    // Champions: R=5, F>=4, M>=4
    if (r >= 4 && f >= 4 && m >= 4) return 'champions';

    // Loyal Customers: R>=3, F>=3, M>=3
    if (r >= 3 && f >= 3 && m >= 3) return 'loyal';

    // Potential Loyalists: R>=4, F>=2, M>=2
    if (r >= 4 && f >= 2 && m >= 2) return 'potential';

    // New Customers: R>=4, F=1
    if (r >= 4 && f === 1) return 'new';

    // Promising: R>=3, F<=2, M<=2
    if (r >= 3 && f <= 2 && m <= 2) return 'promising';

    // Need Attention: R=3, F>=2, M>=2
    if (r === 3 && f >= 2 && m >= 2) return 'need_attention';

    // About to Sleep: R=2, F<=2
    if (r === 2 && f <= 2) return 'about_to_sleep';

    // At Risk: R<=2, F>=3, M>=3
    if (r <= 2 && f >= 3 && m >= 3) return 'at_risk';

    // Can't Lose: R<=2, F>=4, M>=4
    if (r <= 2 && f >= 4 && m >= 4) return 'cant_lose';

    // Hibernating: R=2, F=2
    if (r === 2 && f === 2) return 'hibernating';

    // Lost: R=1
    if (r === 1) return 'lost';

    return 'need_attention';
  }

  // Get customer's buying habits
  async getCustomerHabits(customerId: string) {
    const habits = await db.query.customerBuyingHabits.findFirst({
      where: eq(customerBuyingHabits.customerId, customerId),
    });

    if (habits && habits.rfmSegment) {
      return {
        ...habits,
        rfmSegmentInfo: RFM_SEGMENTS[habits.rfmSegment as keyof typeof RFM_SEGMENTS],
        budgetTierInfo: habits.budgetTier
          ? BUDGET_TIERS[habits.budgetTier as keyof typeof BUDGET_TIERS]
          : null,
      };
    }

    return habits;
  }

  // Get segment distribution for a store
  async getSegmentDistribution(storeId: string) {
    const distribution = await db
      .select({
        segment: customerBuyingHabits.rfmSegment,
        count: count(customerBuyingHabits.id),
        totalLifetimeValue: sum(customerBuyingHabits.lifetimeValue),
      })
      .from(customerBuyingHabits)
      .where(eq(customerBuyingHabits.storeId, storeId))
      .groupBy(customerBuyingHabits.rfmSegment);

    return distribution.map((d) => ({
      ...d,
      segmentInfo: d.segment ? RFM_SEGMENTS[d.segment as keyof typeof RFM_SEGMENTS] : null,
    }));
  }

  // Get customers at risk of churning
  async getAtRiskCustomers(storeId: string, churnThreshold = 70) {
    return db.query.customerBuyingHabits.findMany({
      where: and(
        eq(customerBuyingHabits.storeId, storeId),
        gte(customerBuyingHabits.churnRiskScore, churnThreshold.toString())
      ),
      with: {
        customer: true,
      },
      orderBy: [desc(customerBuyingHabits.churnRiskScore)],
      limit: 50,
    });
  }

  // Get customers by segment
  async getCustomersBySegment(storeId: string, segment: string) {
    return db.query.customerBuyingHabits.findMany({
      where: and(
        eq(customerBuyingHabits.storeId, storeId),
        eq(customerBuyingHabits.rfmSegment, segment)
      ),
      with: {
        customer: true,
      },
      orderBy: [desc(customerBuyingHabits.lifetimeValue)],
    });
  }

  // Get customers by budget tier
  async getCustomersByBudgetTier(storeId: string, tier: string) {
    return db.query.customerBuyingHabits.findMany({
      where: and(
        eq(customerBuyingHabits.storeId, storeId),
        eq(customerBuyingHabits.budgetTier, tier)
      ),
      with: {
        customer: true,
      },
      orderBy: [desc(customerBuyingHabits.totalSpent)],
    });
  }

  // Recalculate all customer habits for a store
  async recalculateAllHabits(storeId: string) {
    const storeCustomers = await db.query.customers.findMany({
      where: eq(customers.storeId, storeId),
    });

    let processed = 0;
    for (const customer of storeCustomers) {
      await this.calculateCustomerHabits(customer.id, storeId);
      processed++;
    }

    // Then calculate RFM scores across all customers
    await this.calculateRFMScores(storeId);

    logger.info(`Recalculated buying habits for ${processed} customers in store ${storeId}`);
    return processed;
  }

  // Alias for scheduled job
  async recalculateAllCustomers(storeId: string) {
    return this.recalculateAllHabits(storeId);
  }

  // Update habits after a new purchase
  async updateAfterPurchase(customerId: string, storeId: string) {
    // Recalculate individual customer's habits
    await this.calculateCustomerHabits(customerId, storeId);

    // Note: RFM scores are calculated weekly as they require comparison across all customers
    // Individual purchase doesn't need to recalculate all customers
  }

  // Get store analytics summary
  async getStoreAnalytics(storeId: string) {
    const [stats] = await db
      .select({
        totalCustomers: count(customerBuyingHabits.id),
        avgLifetimeValue: avg(customerBuyingHabits.lifetimeValue),
        avgPurchaseFrequency: avg(customerBuyingHabits.averageDaysBetweenPurchases),
        avgChurnRisk: avg(customerBuyingHabits.churnRiskScore),
        totalLifetimeValue: sum(customerBuyingHabits.lifetimeValue),
        championsCount: sql<number>`count(*) filter (where ${customerBuyingHabits.rfmSegment} = 'champions')::int`,
        atRiskCount: sql<number>`count(*) filter (where ${customerBuyingHabits.rfmSegment} = 'at_risk')::int`,
        lostCount: sql<number>`count(*) filter (where ${customerBuyingHabits.rfmSegment} = 'lost')::int`,
      })
      .from(customerBuyingHabits)
      .where(eq(customerBuyingHabits.storeId, storeId));

    return stats;
  }
}

export const buyingHabitsService = new BuyingHabitsService();
