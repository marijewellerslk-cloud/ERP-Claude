import { db } from '../config/database.js';
import { customerReferrals, customers } from '../db/schema.js';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { loyaltyService } from './loyalty.service.js';
import { whatsappService } from './whatsapp.service.js';

// Referral reward configuration
const REFERRAL_CONFIG = {
  // Points awarded to referrer when referred customer makes qualifying purchase
  referrerRewardPoints: 100,
  // Welcome bonus for referred customer
  referredWelcomePoints: 50,
  // Minimum purchase amount for qualification (in INR)
  minQualifyingPurchase: 5000,
  // Bonus points for multiple referrals
  tierBonuses: {
    3: 50,   // 50 bonus points after 3 successful referrals
    5: 100,  // 100 bonus points after 5 successful referrals
    10: 250, // 250 bonus points after 10 successful referrals
  },
};

interface CreateReferralParams {
  storeId: string;
  referrerId: string;
  referredId: string;
  referralCode?: string;
  notes?: string;
  recordedBy: string;
}

class ReferralService {
  // Create a new referral record (manual entry by staff)
  async createReferral(params: CreateReferralParams) {
    const { storeId, referrerId, referredId, referralCode, notes, recordedBy } = params;

    // Validate referrer exists
    const referrer = await db.query.customers.findFirst({
      where: eq(customers.id, referrerId),
    });

    if (!referrer) {
      throw new Error('Referrer customer not found');
    }

    // Validate referred customer exists
    const referred = await db.query.customers.findFirst({
      where: eq(customers.id, referredId),
    });

    if (!referred) {
      throw new Error('Referred customer not found');
    }

    // Check if referral already exists
    const existingReferral = await db.query.customerReferrals.findFirst({
      where: and(
        eq(customerReferrals.referrerId, referrerId),
        eq(customerReferrals.referredId, referredId)
      ),
    });

    if (existingReferral) {
      throw new Error('Referral already exists for this customer pair');
    }

    // Check for circular referral
    const reverseReferral = await db.query.customerReferrals.findFirst({
      where: and(
        eq(customerReferrals.referrerId, referredId),
        eq(customerReferrals.referredId, referrerId)
      ),
    });

    if (reverseReferral) {
      throw new Error('Cannot create circular referral');
    }

    // Create referral
    const [referral] = await db.insert(customerReferrals).values({
      storeId,
      referrerId,
      referredId,
      referralCode: referralCode || this.generateReferralCode(referrer.customerCode),
      status: 'pending',
      referredRewardPoints: REFERRAL_CONFIG.referredWelcomePoints,
      notes,
      recordedBy,
    }).returning();

    // Award welcome bonus to referred customer
    await loyaltyService.awardPoints(
      referredId,
      REFERRAL_CONFIG.referredWelcomePoints,
      'welcome',
      'referral',
      referral.id,
      `Welcome bonus from referral by ${referrer.firstName}`,
      recordedBy
    );

    // Update referral with reward timestamp
    await db.update(customerReferrals)
      .set({
        referredRewardedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customerReferrals.id, referral.id));

    logger.info(`Referral created: ${referrer.firstName} referred ${referred.firstName}`);

    return referral;
  }

  // Generate referral code
  private generateReferralCode(customerCode: string): string {
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `REF-${customerCode}-${suffix}`;
  }

  // Qualify a referral when referred customer makes a qualifying purchase
  async qualifyReferral(
    referredCustomerId: string,
    invoiceId: string,
    invoiceAmount: number,
    processedBy?: string
  ) {
    // Find pending referral for this customer
    const referral = await db.query.customerReferrals.findFirst({
      where: and(
        eq(customerReferrals.referredId, referredCustomerId),
        eq(customerReferrals.status, 'pending')
      ),
      with: {
        referrer: true,
        referred: true,
      },
    });

    if (!referral) {
      // No pending referral
      return null;
    }

    // Check if purchase qualifies
    if (invoiceAmount < REFERRAL_CONFIG.minQualifyingPurchase) {
      logger.info(`Referral ${referral.id} not qualified: purchase ₹${invoiceAmount} < minimum ₹${REFERRAL_CONFIG.minQualifyingPurchase}`);
      return null;
    }

    // Update referral status
    await db.update(customerReferrals)
      .set({
        status: 'qualified',
        qualificationDate: new Date(),
        qualifyingInvoiceId: invoiceId,
        qualifyingAmount: invoiceAmount.toString(),
        updatedAt: new Date(),
      })
      .where(eq(customerReferrals.id, referral.id));

    // Award points to referrer
    await this.rewardReferrer(referral.id, processedBy);

    logger.info(`Referral ${referral.id} qualified with purchase of ₹${invoiceAmount}`);

    return referral;
  }

  // Award points to referrer
  async rewardReferrer(referralId: string, processedBy?: string) {
    const referral = await db.query.customerReferrals.findFirst({
      where: eq(customerReferrals.id, referralId),
      with: {
        referrer: true,
        referred: true,
      },
    });

    if (!referral || referral.status === 'rewarded') {
      return;
    }

    const referrer = referral.referrer!;
    const referred = referral.referred!;

    // Award base referral points
    await loyaltyService.awardPoints(
      referrer.id,
      REFERRAL_CONFIG.referrerRewardPoints,
      'referral',
      'referral',
      referralId,
      `Referral reward: ${referred.firstName} made qualifying purchase`,
      processedBy
    );

    // Update referral status
    await db.update(customerReferrals)
      .set({
        status: 'rewarded',
        referrerRewardPoints: REFERRAL_CONFIG.referrerRewardPoints,
        referrerRewardedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customerReferrals.id, referralId));

    // Check for tier bonus
    await this.checkAndAwardTierBonus(referrer.id, referral.storeId, processedBy);

    // Send notification to referrer
    if (referrer.whatsappOptIn && whatsappService.isConfigured()) {
      const updatedReferrer = await db.query.customers.findFirst({
        where: eq(customers.id, referrer.id),
      });

      await whatsappService.sendReferralThankYou(
        referral.storeId,
        referrer.id,
        referrer.whatsapp || referrer.phone,
        referrer.firstName,
        referred.firstName,
        REFERRAL_CONFIG.referrerRewardPoints.toString(),
        updatedReferrer?.loyaltyPoints.toString() || '0',
        referralId,
        processedBy
      );
    }

    logger.info(`Awarded ${REFERRAL_CONFIG.referrerRewardPoints} points to referrer ${referrer.id}`);
  }

  // Check and award tier bonus for multiple referrals
  private async checkAndAwardTierBonus(
    referrerId: string,
    storeId: string,
    processedBy?: string
  ) {
    // Count successful referrals
    const [result] = await db
      .select({ count: count() })
      .from(customerReferrals)
      .where(and(
        eq(customerReferrals.referrerId, referrerId),
        eq(customerReferrals.status, 'rewarded')
      ));

    const successfulReferrals = result.count;

    // Check tier bonuses
    for (const [threshold, bonus] of Object.entries(REFERRAL_CONFIG.tierBonuses)) {
      const thresholdNum = parseInt(threshold);
      if (successfulReferrals === thresholdNum) {
        await loyaltyService.awardPoints(
          referrerId,
          bonus,
          'bonus',
          'referral_milestone',
          undefined,
          `Referral milestone: ${thresholdNum} successful referrals`,
          processedBy
        );

        logger.info(`Awarded ${bonus} tier bonus points to referrer ${referrerId} for ${thresholdNum} referrals`);
      }
    }
  }

  // Get referral by ID
  async getReferral(referralId: string) {
    return db.query.customerReferrals.findFirst({
      where: eq(customerReferrals.id, referralId),
      with: {
        referrer: true,
        referred: true,
      },
    });
  }

  // Get referrals made by a customer
  async getReferralsByReferrer(referrerId: string) {
    return db.query.customerReferrals.findMany({
      where: eq(customerReferrals.referrerId, referrerId),
      with: {
        referred: true,
      },
      orderBy: [desc(customerReferrals.createdAt)],
    });
  }

  // Get referrals for a store
  async getStoreReferrals(
    storeId: string,
    options: {
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const conditions = [eq(customerReferrals.storeId, storeId)];

    if (options.status) {
      conditions.push(eq(customerReferrals.status, options.status));
    }

    return db.query.customerReferrals.findMany({
      where: and(...conditions),
      with: {
        referrer: true,
        referred: true,
      },
      orderBy: [desc(customerReferrals.createdAt)],
      limit: options.limit || 50,
      offset: options.offset || 0,
    });
  }

  // Get referral statistics for a store
  async getReferralStats(storeId: string) {
    const [stats] = await db
      .select({
        totalReferrals: count(customerReferrals.id),
        pendingReferrals: sql<number>`COUNT(*) FILTER (WHERE ${customerReferrals.status} = 'pending')::int`,
        qualifiedReferrals: sql<number>`COUNT(*) FILTER (WHERE ${customerReferrals.status} = 'qualified')::int`,
        rewardedReferrals: sql<number>`COUNT(*) FILTER (WHERE ${customerReferrals.status} = 'rewarded')::int`,
        cancelledReferrals: sql<number>`COUNT(*) FILTER (WHERE ${customerReferrals.status} = 'cancelled')::int`,
        totalPointsAwarded: sql<number>`COALESCE(SUM(${customerReferrals.referrerRewardPoints}), 0)::int`,
      })
      .from(customerReferrals)
      .where(eq(customerReferrals.storeId, storeId));

    // Get top referrers
    const topReferrers = await db
      .select({
        referrerId: customerReferrals.referrerId,
        count: count(customerReferrals.id),
      })
      .from(customerReferrals)
      .where(and(
        eq(customerReferrals.storeId, storeId),
        eq(customerReferrals.status, 'rewarded')
      ))
      .groupBy(customerReferrals.referrerId)
      .orderBy(desc(count(customerReferrals.id)))
      .limit(10);

    // Get referrer details
    const topReferrerDetails = await Promise.all(
      topReferrers.map(async (r) => {
        const customer = await db.query.customers.findFirst({
          where: eq(customers.id, r.referrerId),
        });
        return {
          ...r,
          referrerName: customer ? `${customer.firstName} ${customer.lastName || ''}`.trim() : 'Unknown',
        };
      })
    );

    return {
      ...stats,
      topReferrers: topReferrerDetails,
      config: REFERRAL_CONFIG,
    };
  }

  // Cancel a referral
  async cancelReferral(referralId: string, reason?: string) {
    const [updated] = await db.update(customerReferrals)
      .set({
        status: 'cancelled',
        notes: reason ? `Cancelled: ${reason}` : undefined,
        updatedAt: new Date(),
      })
      .where(eq(customerReferrals.id, referralId))
      .returning();

    return updated;
  }

  // Get referral leaderboard
  async getReferralLeaderboard(storeId: string, limit = 10) {
    const leaderboard = await db
      .select({
        referrerId: customerReferrals.referrerId,
        successfulReferrals: count(customerReferrals.id),
        totalPointsEarned: sql<number>`COALESCE(SUM(${customerReferrals.referrerRewardPoints}), 0)::int`,
      })
      .from(customerReferrals)
      .where(and(
        eq(customerReferrals.storeId, storeId),
        eq(customerReferrals.status, 'rewarded')
      ))
      .groupBy(customerReferrals.referrerId)
      .orderBy(desc(count(customerReferrals.id)))
      .limit(limit);

    // Enrich with customer details
    const enrichedLeaderboard = await Promise.all(
      leaderboard.map(async (entry, index) => {
        const customer = await db.query.customers.findFirst({
          where: eq(customers.id, entry.referrerId),
        });
        return {
          rank: index + 1,
          customerId: entry.referrerId,
          customerName: customer ? `${customer.firstName} ${customer.lastName || ''}`.trim() : 'Unknown',
          customerTier: customer?.tier || 'bronze',
          successfulReferrals: Number(entry.successfulReferrals),
          totalPointsEarned: entry.totalPointsEarned,
        };
      })
    );

    return enrichedLeaderboard;
  }

  // Get referral configuration
  getConfig() {
    return REFERRAL_CONFIG;
  }
}

export const referralService = new ReferralService();
