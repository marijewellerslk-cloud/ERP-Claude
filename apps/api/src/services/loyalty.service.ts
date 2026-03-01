import { db } from '../config/database.js';
import {
  loyaltyRewardsCatalog,
  loyaltyRewardRedemptions,
  loyaltyTransactions,
  customers,
  invoices,
} from '../db/schema.js';
import { eq, and, desc, sql, gte, lte, lt, count, sum } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { whatsappService } from './whatsapp.service.js';

// Loyalty tier definitions
const LOYALTY_TIERS = {
  bronze: {
    name: 'Bronze',
    minPoints: 0,
    pointsMultiplier: 1.0,
    benefits: ['Basic earning: 1 point per ₹100'],
  },
  silver: {
    name: 'Silver',
    minPoints: 500,
    pointsMultiplier: 1.25,
    benefits: ['1.25x point earning', 'Birthday bonus: 50 points', 'Access to Silver rewards'],
  },
  gold: {
    name: 'Gold',
    minPoints: 2000,
    pointsMultiplier: 1.5,
    benefits: ['1.5x point earning', 'Birthday bonus: 100 points', 'Free cleaning service', 'Priority support'],
  },
  platinum: {
    name: 'Platinum',
    minPoints: 5000,
    pointsMultiplier: 2.0,
    benefits: [
      '2x point earning',
      'Birthday bonus: 200 points',
      'Free cleaning & repolishing',
      'Exclusive preview access',
      'Personal stylist consultation',
    ],
  },
};

// Occasion multipliers
const OCCASION_MULTIPLIERS: Record<string, number> = {
  wedding: 1.5,
  anniversary: 1.25,
  birthday: 1.25,
  festival: 1.25,
  self: 1.0,
  gift: 1.0,
  other: 1.0,
};

interface CreateRewardParams {
  storeId: string;
  name: string;
  description?: string;
  rewardType: 'free_service' | 'discount_percentage' | 'discount_fixed' | 'free_product' | 'cashback';
  pointsCost: number;
  discountPercentage?: number;
  discountAmount?: number;
  maxDiscountAmount?: number;
  serviceType?: string;
  applicableCategories?: string[];
  applicableProducts?: string[];
  minTier?: string;
  minPurchaseAmount?: number;
  validityDays?: number;
  maxRedemptionsPerCustomer?: number;
  totalAvailable?: number;
  displayOrder?: number;
  imageUrl?: string;
  isFeatured?: boolean;
  createdBy: string;
}

class LoyaltyService {
  // Calculate points to award for a purchase
  calculatePoints(
    purchaseAmount: number,
    customerTier: string,
    occasion?: string
  ): { basePoints: number; tierBonus: number; occasionBonus: number; totalPoints: number } {
    // Base calculation: 1 point per ₹100
    const basePoints = Math.floor(purchaseAmount / 100);

    // Tier multiplier
    const tier = LOYALTY_TIERS[customerTier as keyof typeof LOYALTY_TIERS] || LOYALTY_TIERS.bronze;
    const tierBonus = Math.floor(basePoints * (tier.pointsMultiplier - 1));

    // Occasion multiplier
    const occasionMultiplier = occasion ? (OCCASION_MULTIPLIERS[occasion] || 1.0) : 1.0;
    const occasionBonus = Math.floor(basePoints * (occasionMultiplier - 1));

    const totalPoints = basePoints + tierBonus + occasionBonus;

    return {
      basePoints,
      tierBonus,
      occasionBonus,
      totalPoints,
    };
  }

  // Award points for a purchase (combines calculation and awarding)
  async awardPurchasePoints(
    customerId: string,
    storeId: string,
    purchaseAmount: number,
    occasion?: string,
    invoiceId?: string,
    processedBy?: string
  ): Promise<{
    pointsAwarded: number;
    newBalance: number;
    tierUpgrade?: { previousTier: string; newTier: string };
  }> {
    // Get customer to check their tier
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, customerId),
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Calculate points based on purchase amount, tier, and occasion
    const { totalPoints } = this.calculatePoints(
      purchaseAmount,
      customer.tier || 'bronze',
      occasion
    );

    if (totalPoints <= 0) {
      return {
        pointsAwarded: 0,
        newBalance: customer.loyaltyPoints,
      };
    }

    // Award the points
    const result = await this.awardPoints(
      customerId,
      totalPoints,
      'earned',
      'invoice',
      invoiceId,
      `Purchase of ₹${purchaseAmount.toFixed(2)}${occasion ? ` (${occasion})` : ''}`,
      processedBy
    );

    return {
      pointsAwarded: result.pointsAwarded,
      newBalance: result.newBalance,
      tierUpgrade: result.newTier ? {
        previousTier: result.previousTier || 'bronze',
        newTier: result.newTier,
      } : undefined,
    };
  }

  // Award points to a customer
  async awardPoints(
    customerId: string,
    points: number,
    type: 'earned' | 'bonus' | 'referral' | 'welcome',
    referenceType?: string,
    referenceId?: string,
    notes?: string,
    createdBy?: string
  ) {
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, customerId),
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    const newBalance = customer.loyaltyPoints + points;

    // Create transaction record
    await db.insert(loyaltyTransactions).values({
      customerId,
      points,
      type,
      referenceType,
      referenceId,
      notes,
      createdBy,
    });

    // Update customer points
    await db.update(customers)
      .set({
        loyaltyPoints: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId));

    // Check for tier upgrade
    const newTier = this.calculateTier(newBalance);
    if (newTier !== customer.tier) {
      await this.upgradeTier(customerId, customer.storeId, newTier, createdBy);
    }

    logger.info(`Awarded ${points} points to customer ${customerId}. New balance: ${newBalance}`);

    return {
      pointsAwarded: points,
      newBalance,
      previousTier: customer.tier,
      newTier: newTier !== customer.tier ? newTier : undefined,
    };
  }

  // Deduct points from a customer
  async deductPoints(
    customerId: string,
    points: number,
    referenceType: string,
    referenceId?: string,
    notes?: string,
    createdBy?: string
  ) {
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, customerId),
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    if (customer.loyaltyPoints < points) {
      throw new Error('Insufficient points balance');
    }

    const newBalance = customer.loyaltyPoints - points;

    // Create transaction record (negative points)
    await db.insert(loyaltyTransactions).values({
      customerId,
      points: -points,
      type: 'redeemed',
      referenceType,
      referenceId,
      notes,
      createdBy,
    });

    // Update customer points
    await db.update(customers)
      .set({
        loyaltyPoints: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId));

    logger.info(`Deducted ${points} points from customer ${customerId}. New balance: ${newBalance}`);

    return { pointsDeducted: points, newBalance };
  }

  // Calculate tier based on points
  calculateTier(points: number): string {
    if (points >= LOYALTY_TIERS.platinum.minPoints) return 'platinum';
    if (points >= LOYALTY_TIERS.gold.minPoints) return 'gold';
    if (points >= LOYALTY_TIERS.silver.minPoints) return 'silver';
    return 'bronze';
  }

  // Upgrade customer tier
  private async upgradeTier(
    customerId: string,
    storeId: string,
    newTier: string,
    createdBy?: string
  ) {
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, customerId),
    });

    if (!customer) return;

    const tierInfo = LOYALTY_TIERS[newTier as keyof typeof LOYALTY_TIERS];

    await db.update(customers)
      .set({
        tier: newTier,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId));

    // Send notification if WhatsApp opted in
    if (customer.whatsappOptIn && whatsappService.isConfigured()) {
      await whatsappService.sendLoyaltyMilestone(
        storeId,
        customerId,
        customer.whatsapp || customer.phone,
        tierInfo.name,
        customer.loyaltyPoints.toString(),
        tierInfo.benefits.join('\n- '),
        createdBy
      );
    }

    logger.info(`Customer ${customerId} upgraded to ${newTier} tier`);
  }

  // Get customer's loyalty info
  async getCustomerLoyaltyInfo(customerId: string) {
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, customerId),
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    const tierInfo = LOYALTY_TIERS[(customer.tier || 'bronze') as keyof typeof LOYALTY_TIERS] || LOYALTY_TIERS.bronze;
    const nextTierKey = this.getNextTier(customer.tier || 'bronze');
    const nextTier = nextTierKey ? LOYALTY_TIERS[nextTierKey as keyof typeof LOYALTY_TIERS] : null;

    // Get lifetime points (sum of all earned transactions)
    const lifetimePointsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(CASE WHEN ${loyaltyTransactions.type} = 'earned' THEN ${loyaltyTransactions.points} ELSE 0 END), 0)`,
      })
      .from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.customerId, customerId));

    const lifetimePoints = Number(lifetimePointsResult[0]?.total || 0);

    // Get purchase stats
    const purchaseStats = await db
      .select({
        count: sql<number>`COUNT(*)`,
        total: sql<number>`COALESCE(SUM(CAST(${invoices.finalAmount} AS DECIMAL)), 0)`,
      })
      .from(invoices)
      .where(eq(invoices.customerId, customerId));

    const purchaseCount = Number(purchaseStats[0]?.count || 0);
    const totalSpent = String(purchaseStats[0]?.total || 0);

    // Get recent transactions
    const recentTransactions = await db.query.loyaltyTransactions.findMany({
      where: eq(loyaltyTransactions.customerId, customerId),
      orderBy: [desc(loyaltyTransactions.transactionDate)],
      limit: 10,
    });

    // Format transactions for frontend
    const formattedTransactions = recentTransactions.map((tx) => ({
      id: tx.id,
      points: tx.points,
      type: tx.type,
      description: tx.notes || `${tx.type} - ${tx.referenceType || 'transaction'}`,
      createdAt: tx.createdAt.toISOString(),
    }));

    // Calculate tier progress
    const pointsToNext = nextTier ? nextTier.minPoints - customer.loyaltyPoints : 0;
    const progress = nextTier
      ? Math.min(100, ((customer.loyaltyPoints - tierInfo.minPoints) / (nextTier.minPoints - tierInfo.minPoints)) * 100)
      : 100;

    return {
      tier: customer.tier || 'bronze',
      currentPoints: customer.loyaltyPoints,
      lifetimePoints,
      totalSpent,
      purchaseCount,
      tierProgress: {
        currentTier: customer.tier || 'bronze',
        nextTier: nextTierKey,
        pointsToNext: pointsToNext > 0 ? pointsToNext : 0,
        progress: Math.round(progress),
      },
      recentTransactions: formattedTransactions,
    };
  }

  // Get next tier key
  private getNextTier(currentTier: string): string | null {
    const tiers = ['bronze', 'silver', 'gold', 'platinum'];
    const currentIndex = tiers.indexOf(currentTier);
    return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
  }

  // Create a reward in catalog
  async createReward(params: CreateRewardParams) {
    const [reward] = await db.insert(loyaltyRewardsCatalog).values({
      ...params,
    }).returning();

    logger.info(`Created loyalty reward: ${reward.name}`);
    return reward;
  }

  // Update a reward
  async updateReward(
    rewardId: string,
    params: Partial<Omit<CreateRewardParams, 'storeId' | 'createdBy'>>
  ) {
    const [updated] = await db.update(loyaltyRewardsCatalog)
      .set({
        ...params,
        updatedAt: new Date(),
      })
      .where(eq(loyaltyRewardsCatalog.id, rewardId))
      .returning();

    return updated;
  }

  // Get available rewards for a customer
  async getAvailableRewards(customerId: string, storeId: string) {
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, customerId),
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
    const customerTierIndex = tierOrder.indexOf(customer.tier);

    // Get active rewards
    const rewards = await db.query.loyaltyRewardsCatalog.findMany({
      where: and(
        eq(loyaltyRewardsCatalog.storeId, storeId),
        eq(loyaltyRewardsCatalog.isActive, true)
      ),
      orderBy: [desc(loyaltyRewardsCatalog.isFeatured), loyaltyRewardsCatalog.displayOrder],
    });

    // Filter by tier and check customer eligibility
    const availableRewards = [];
    for (const reward of rewards) {
      const rewardTierIndex = tierOrder.indexOf(reward.minTier || 'bronze');

      // Check tier eligibility
      if (customerTierIndex < rewardTierIndex) {
        continue;
      }

      // Check availability
      if (reward.totalAvailable !== null && reward.totalRedeemed >= reward.totalAvailable) {
        continue;
      }

      // Check max redemptions per customer
      if (reward.maxRedemptionsPerCustomer) {
        const customerRedemptions = await db
          .select({ count: count() })
          .from(loyaltyRewardRedemptions)
          .where(
            and(
              eq(loyaltyRewardRedemptions.customerId, customerId),
              eq(loyaltyRewardRedemptions.rewardId, reward.id)
            )
          );

        if (customerRedemptions[0].count >= reward.maxRedemptionsPerCustomer) {
          continue;
        }
      }

      availableRewards.push({
        ...reward,
        canRedeem: customer.loyaltyPoints >= reward.pointsCost,
        pointsNeeded: Math.max(0, reward.pointsCost - customer.loyaltyPoints),
      });
    }

    return availableRewards;
  }

  // Redeem a reward
  async redeemReward(
    customerId: string,
    rewardId: string,
    storeId: string,
    redeemedBy: string
  ) {
    const reward = await db.query.loyaltyRewardsCatalog.findFirst({
      where: eq(loyaltyRewardsCatalog.id, rewardId),
    });

    if (!reward) {
      throw new Error('Reward not found');
    }

    if (!reward.isActive) {
      throw new Error('This reward is no longer available');
    }

    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, customerId),
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Check points
    if (customer.loyaltyPoints < reward.pointsCost) {
      throw new Error('Insufficient points');
    }

    // Check tier
    const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
    if (tierOrder.indexOf(customer.tier) < tierOrder.indexOf(reward.minTier || 'bronze')) {
      throw new Error('Tier requirement not met');
    }

    // Check availability
    if (reward.totalAvailable !== null && reward.totalRedeemed >= reward.totalAvailable) {
      throw new Error('This reward is out of stock');
    }

    // Generate redemption code
    const redemptionCode = `RWD-${Date.now().toString(36).toUpperCase()}-${uuidv4().substring(0, 4).toUpperCase()}`;

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (reward.validityDays || 90));

    // Create redemption record
    const [redemption] = await db.insert(loyaltyRewardRedemptions).values({
      storeId,
      customerId,
      rewardId,
      pointsSpent: reward.pointsCost,
      redemptionCode,
      status: 'active',
      expiresAt,
      redeemedBy,
    }).returning();

    // Deduct points
    await this.deductPoints(
      customerId,
      reward.pointsCost,
      'redemption',
      redemption.id,
      `Redeemed: ${reward.name}`,
      redeemedBy
    );

    // Update reward redemption count
    await db.update(loyaltyRewardsCatalog)
      .set({
        totalRedeemed: (reward.totalRedeemed || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(loyaltyRewardsCatalog.id, rewardId));

    logger.info(`Customer ${customerId} redeemed reward ${reward.name} (code: ${redemptionCode})`);

    return {
      redemption,
      reward,
      redemptionCode,
      expiresAt,
    };
  }

  // Use a redemption (apply to invoice)
  async useRedemption(
    redemptionCode: string,
    invoiceId: string,
    discountApplied: number,
    usedBy: string
  ) {
    const redemption = await db.query.loyaltyRewardRedemptions.findFirst({
      where: eq(loyaltyRewardRedemptions.redemptionCode, redemptionCode),
      with: {
        reward: true,
      },
    });

    if (!redemption) {
      throw new Error('Redemption code not found');
    }

    if (redemption.status !== 'active') {
      throw new Error(`Redemption is ${redemption.status}`);
    }

    if (new Date() > new Date(redemption.expiresAt)) {
      // Mark as expired
      await db.update(loyaltyRewardRedemptions)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(loyaltyRewardRedemptions.id, redemption.id));
      throw new Error('Redemption has expired');
    }

    // Mark as used
    await db.update(loyaltyRewardRedemptions)
      .set({
        status: 'used',
        usedAt: new Date(),
        usedInInvoiceId: invoiceId,
        discountApplied: discountApplied.toString(),
        usedBy,
        updatedAt: new Date(),
      })
      .where(eq(loyaltyRewardRedemptions.id, redemption.id));

    logger.info(`Redemption ${redemptionCode} used on invoice ${invoiceId}`);

    return { success: true, discountApplied };
  }

  // Get redemption by code
  async getRedemption(redemptionCode: string) {
    return db.query.loyaltyRewardRedemptions.findFirst({
      where: eq(loyaltyRewardRedemptions.redemptionCode, redemptionCode),
      with: {
        reward: true,
        customer: true,
      },
    });
  }

  // Get store's rewards catalog
  async getRewardsCatalog(storeId: string, includeInactive = false) {
    const conditions = [eq(loyaltyRewardsCatalog.storeId, storeId)];
    if (!includeInactive) {
      conditions.push(eq(loyaltyRewardsCatalog.isActive, true));
    }

    return db.query.loyaltyRewardsCatalog.findMany({
      where: and(...conditions),
      orderBy: [desc(loyaltyRewardsCatalog.isFeatured), loyaltyRewardsCatalog.displayOrder],
    });
  }

  // Get loyalty statistics for a store
  async getLoyaltyStats(storeId: string) {
    const [stats] = await db
      .select({
        totalMembers: count(customers.id),
        totalPointsIssued: sql<number>`COALESCE(SUM(CASE WHEN ${loyaltyTransactions.points} > 0 THEN ${loyaltyTransactions.points} ELSE 0 END), 0)::int`,
        totalPointsRedeemed: sql<number>`COALESCE(ABS(SUM(CASE WHEN ${loyaltyTransactions.points} < 0 THEN ${loyaltyTransactions.points} ELSE 0 END)), 0)::int`,
        bronzeMembers: sql<number>`COUNT(*) FILTER (WHERE ${customers.tier} = 'bronze')::int`,
        silverMembers: sql<number>`COUNT(*) FILTER (WHERE ${customers.tier} = 'silver')::int`,
        goldMembers: sql<number>`COUNT(*) FILTER (WHERE ${customers.tier} = 'gold')::int`,
        platinumMembers: sql<number>`COUNT(*) FILTER (WHERE ${customers.tier} = 'platinum')::int`,
      })
      .from(customers)
      .leftJoin(loyaltyTransactions, eq(loyaltyTransactions.customerId, customers.id))
      .where(eq(customers.storeId, storeId));

    // Get redemption stats
    const [redemptionStats] = await db
      .select({
        totalRedemptions: count(loyaltyRewardRedemptions.id),
        activeRedemptions: sql<number>`COUNT(*) FILTER (WHERE ${loyaltyRewardRedemptions.status} = 'active')::int`,
        usedRedemptions: sql<number>`COUNT(*) FILTER (WHERE ${loyaltyRewardRedemptions.status} = 'used')::int`,
        expiredRedemptions: sql<number>`COUNT(*) FILTER (WHERE ${loyaltyRewardRedemptions.status} = 'expired')::int`,
      })
      .from(loyaltyRewardRedemptions)
      .where(eq(loyaltyRewardRedemptions.storeId, storeId));

    return {
      ...stats,
      ...redemptionStats,
      tiers: LOYALTY_TIERS,
    };
  }

  // Expire old redemptions
  async expireOldRedemptions() {
    const now = new Date();

    const expired = await db.update(loyaltyRewardRedemptions)
      .set({ status: 'expired', updatedAt: now })
      .where(and(
        eq(loyaltyRewardRedemptions.status, 'active'),
        lt(loyaltyRewardRedemptions.expiresAt, now)
      ))
      .returning({ id: loyaltyRewardRedemptions.id });

    if (expired.length > 0) {
      logger.info(`Expired ${expired.length} redemptions`);
    }

    return expired.length;
  }

  // Get tier info
  getTierInfo(tier?: string) {
    if (!tier) return LOYALTY_TIERS;
    return LOYALTY_TIERS[tier as keyof typeof LOYALTY_TIERS];
  }
}

export const loyaltyService = new LoyaltyService();
