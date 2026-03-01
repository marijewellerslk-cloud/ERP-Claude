import { db } from '../config/database.js';
import {
  goldLoans,
  pledgedGold,
  loanPayments,
  loanReleases,
  loanInterestRates,
  loanLtvHistory,
  loanRenewals,
  marginCalls,
  loanAuctions,
  loanDocuments,
  customers,
  goldRates,
  stores,
} from '../db/schema.js';
import { eq, and, sql, desc, asc, gte, lte, isNull, not, or } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { metalAccountingService } from './metal-accounting.service.js';

// ============================================================================
// TYPES
// ============================================================================

export interface LTVCalculation {
  loanId: string;
  goldRateUsed: number;
  totalGoldValue: number;
  outstandingAmount: number;
  currentLtv: number;
  maxAllowedLtv: number;
  ltvStatus: 'safe' | 'warning' | 'breach';
}

export interface InterestAccrual {
  principal: number;
  annualRate: number;
  daysElapsed: number;
  dailyInterest: number;
  totalAccrued: number;
  penaltyAmount: number;
}

export interface LoanSummaryStats {
  totalLoans: number;
  activeLoans: number;
  totalDisbursed: number;
  totalOutstanding: number;
  totalPledgedGoldWeight: number;
  totalPledgedGoldValue: number;
  overdueLoans: number;
  marginCallLoans: number;
  averageLtv: number;
  ltvBreachCount: number;
}

// Default LTV limits for Sri Lankan regulations (configurable)
const DEFAULT_LTV_LIMITS = [
  { maxAmount: 250000, maxLtv: 85 },
  { maxAmount: 500000, maxLtv: 80 },
  { maxAmount: Infinity, maxLtv: 75 },
];

// ============================================================================
// GOLD PAWNING SERVICE
// ============================================================================

export class GoldPawningService {
  // ============================================================================
  // INTEREST RATE CONFIGURATION
  // ============================================================================

  async getInterestRates(storeId: string) {
    return db
      .select()
      .from(loanInterestRates)
      .where(
        and(
          eq(loanInterestRates.storeId, storeId),
          eq(loanInterestRates.isActive, true)
        )
      )
      .orderBy(asc(loanInterestRates.minAmount));
  }

  async createInterestRate(
    storeId: string,
    data: {
      rateName: string;
      minAmount: number;
      maxAmount?: number;
      annualRate: number;
      penaltyRate?: number;
      maxLtv: number;
      maxTenureMonths?: number;
      effectiveFrom: Date;
    },
    userId: string
  ) {
    const monthlyRate = data.annualRate / 12;
    const dailyRate = data.annualRate / 365;

    const [rate] = await db
      .insert(loanInterestRates)
      .values({
        storeId,
        rateName: data.rateName,
        minAmount: data.minAmount.toString(),
        maxAmount: data.maxAmount?.toString(),
        annualRate: data.annualRate.toString(),
        monthlyRate: monthlyRate.toFixed(4),
        dailyRate: dailyRate.toFixed(6),
        penaltyRate: (data.penaltyRate || 2).toString(),
        maxLtv: data.maxLtv.toString(),
        maxTenureMonths: data.maxTenureMonths || 12,
        effectiveFrom: data.effectiveFrom,
        createdBy: userId,
      })
      .returning();

    return rate;
  }

  async updateInterestRate(
    rateId: string,
    data: Partial<{
      rateName: string;
      annualRate: number;
      penaltyRate: number;
      maxLtv: number;
      maxTenureMonths: number;
      isActive: boolean;
    }>
  ) {
    const updateData: Record<string, any> = { updatedAt: new Date() };

    if (data.rateName !== undefined) updateData.rateName = data.rateName;
    if (data.annualRate !== undefined) {
      updateData.annualRate = data.annualRate.toString();
      updateData.monthlyRate = (data.annualRate / 12).toFixed(4);
      updateData.dailyRate = (data.annualRate / 365).toFixed(6);
    }
    if (data.penaltyRate !== undefined) updateData.penaltyRate = data.penaltyRate.toString();
    if (data.maxLtv !== undefined) updateData.maxLtv = data.maxLtv.toString();
    if (data.maxTenureMonths !== undefined) updateData.maxTenureMonths = data.maxTenureMonths;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const [rate] = await db
      .update(loanInterestRates)
      .set(updateData)
      .where(eq(loanInterestRates.id, rateId))
      .returning();

    return rate;
  }

  /**
   * Find the applicable interest rate based on loan amount and store
   */
  async getApplicableRate(storeId: string, loanAmount: number) {
    const rates = await db
      .select()
      .from(loanInterestRates)
      .where(
        and(
          eq(loanInterestRates.storeId, storeId),
          eq(loanInterestRates.isActive, true),
          lte(loanInterestRates.minAmount, loanAmount.toString()),
          or(
            isNull(loanInterestRates.maxAmount),
            gte(loanInterestRates.maxAmount, loanAmount.toString())
          ),
          lte(loanInterestRates.effectiveFrom, new Date()),
          or(
            isNull(loanInterestRates.effectiveTo),
            gte(loanInterestRates.effectiveTo, new Date())
          )
        )
      )
      .orderBy(desc(loanInterestRates.effectiveFrom))
      .limit(1);

    return rates[0] || null;
  }

  // ============================================================================
  // LTV (LOAN-TO-VALUE) MANAGEMENT
  // ============================================================================

  /**
   * Get maximum LTV for a given loan amount based on Sri Lankan regulations
   */
  getMaxLtv(loanAmount: number): number {
    for (const limit of DEFAULT_LTV_LIMITS) {
      if (loanAmount <= limit.maxAmount) {
        return limit.maxLtv;
      }
    }
    return 75; // Default to most conservative
  }

  /**
   * Calculate LTV for a loan based on current gold rate
   */
  async calculateLTV(loanId: string): Promise<LTVCalculation> {
    // Get loan details
    const [loan] = await db
      .select()
      .from(goldLoans)
      .where(eq(goldLoans.id, loanId))
      .limit(1);

    if (!loan) throw new Error('Loan not found');

    // Get pledged items
    const pledgedItems = await db
      .select()
      .from(pledgedGold)
      .where(eq(pledgedGold.loanId, loanId));

    // Get current gold rate
    const goldRate = await metalAccountingService.getLatestGoldRate(loan.storeId);

    // Calculate total gold value at current market rate
    let totalGoldValue = 0;
    for (const item of pledgedItems) {
      const netWeight = parseFloat(item.netWeight);
      const purityPct = metalAccountingService.getPurityPercentage(item.purity);
      // Value = net weight * purity factor * current rate
      const itemValue = netWeight * (purityPct / 100) * goldRate;
      totalGoldValue += itemValue;
    }

    // Calculate outstanding amount
    const outstanding = loan.outstandingBalance
      ? parseFloat(loan.outstandingBalance)
      : parseFloat(loan.loanAmount);

    // Calculate LTV
    const currentLtv = totalGoldValue > 0 ? (outstanding / totalGoldValue) * 100 : 100;

    // Determine max allowed LTV
    const loanAmount = parseFloat(loan.loanAmount);
    let maxAllowedLtv = this.getMaxLtv(loanAmount);

    // Check if store has a configured rate with lower LTV
    if (loan.interestRateConfigId) {
      const [rateConfig] = await db
        .select()
        .from(loanInterestRates)
        .where(eq(loanInterestRates.id, loan.interestRateConfigId))
        .limit(1);

      if (rateConfig) {
        maxAllowedLtv = Math.min(maxAllowedLtv, parseFloat(rateConfig.maxLtv));
      }
    }

    // Determine status
    let ltvStatus: 'safe' | 'warning' | 'breach' = 'safe';
    if (currentLtv >= maxAllowedLtv) {
      ltvStatus = 'breach';
    } else if (currentLtv >= maxAllowedLtv * 0.9) {
      ltvStatus = 'warning';
    }

    return {
      loanId,
      goldRateUsed: goldRate,
      totalGoldValue: Math.round(totalGoldValue * 100) / 100,
      outstandingAmount: Math.round(outstanding * 100) / 100,
      currentLtv: Math.round(currentLtv * 100) / 100,
      maxAllowedLtv,
      ltvStatus,
    };
  }

  /**
   * Validate LTV before loan creation
   */
  validateLTV(
    loanAmount: number,
    totalGoldValue: number,
    maxLtv?: number
  ): { valid: boolean; ltv: number; maxAllowed: number; message?: string } {
    const maxLtvValue = maxLtv || this.getMaxLtv(loanAmount);
    const ltv = (loanAmount / totalGoldValue) * 100;

    if (ltv > maxLtvValue) {
      return {
        valid: false,
        ltv: Math.round(ltv * 100) / 100,
        maxAllowed: maxLtvValue,
        message: `LTV of ${ltv.toFixed(2)}% exceeds maximum allowed ${maxLtvValue}% for loan amount of Rs ${loanAmount}. Maximum loan amount: Rs ${Math.floor(totalGoldValue * maxLtvValue / 100)}`,
      };
    }

    return {
      valid: true,
      ltv: Math.round(ltv * 100) / 100,
      maxAllowed: maxLtvValue,
    };
  }

  /**
   * Recalculate and persist LTV for a loan (used by scheduler)
   */
  async recalculateLoanLTV(loanId: string): Promise<LTVCalculation> {
    const ltv = await this.calculateLTV(loanId);

    // Save to history
    await db.insert(loanLtvHistory).values({
      loanId,
      goldRateUsed: ltv.goldRateUsed.toString(),
      totalGoldValue: ltv.totalGoldValue.toString(),
      outstandingAmount: ltv.outstandingAmount.toString(),
      currentLtv: ltv.currentLtv.toString(),
      maxAllowedLtv: ltv.maxAllowedLtv.toString(),
      ltvStatus: ltv.ltvStatus,
    });

    // Update loan record
    await db
      .update(goldLoans)
      .set({
        currentLtv: ltv.currentLtv.toString(),
        ltvStatus: ltv.ltvStatus,
        totalGoldValue: ltv.totalGoldValue.toString(),
        updatedAt: new Date(),
      })
      .where(eq(goldLoans.id, loanId));

    return ltv;
  }

  /**
   * Get LTV history for a loan
   */
  async getLtvHistory(loanId: string) {
    return db
      .select()
      .from(loanLtvHistory)
      .where(eq(loanLtvHistory.loanId, loanId))
      .orderBy(desc(loanLtvHistory.calculationDate))
      .limit(90); // Last 90 records
  }

  /**
   * Get all loans with LTV warnings or breaches
   */
  async getLtvAlerts(storeId: string) {
    return db
      .select({
        loan: goldLoans,
        customer: customers,
      })
      .from(goldLoans)
      .innerJoin(customers, eq(goldLoans.customerId, customers.id))
      .where(
        and(
          eq(goldLoans.storeId, storeId),
          eq(goldLoans.status, 'active'),
          or(
            eq(goldLoans.ltvStatus, 'warning'),
            eq(goldLoans.ltvStatus, 'breach')
          )
        )
      )
      .orderBy(desc(goldLoans.currentLtv));
  }

  // ============================================================================
  // INTEREST ACCRUAL
  // ============================================================================

  /**
   * Calculate daily interest for a loan
   */
  calculateInterestAccrual(
    principal: number,
    annualRate: number,
    fromDate: Date,
    toDate: Date = new Date(),
    penaltyRate: number = 0,
    isOverdue: boolean = false
  ): InterestAccrual {
    const daysElapsed = Math.max(0,
      Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    const dailyRate = annualRate / 100 / 365;
    const dailyInterest = principal * dailyRate;
    const totalAccrued = dailyInterest * daysElapsed;

    // Penalty for overdue loans
    const penaltyDailyRate = isOverdue ? (penaltyRate / 100 / 365) : 0;
    const penaltyAmount = principal * penaltyDailyRate * daysElapsed;

    return {
      principal,
      annualRate,
      daysElapsed,
      dailyInterest: Math.round(dailyInterest * 100) / 100,
      totalAccrued: Math.round(totalAccrued * 100) / 100,
      penaltyAmount: Math.round(penaltyAmount * 100) / 100,
    };
  }

  /**
   * Accrue interest for all active loans (called by scheduler)
   */
  async accrueInterestForAllLoans(storeId: string): Promise<{ processed: number; errors: number }> {
    const activeLoans = await db
      .select()
      .from(goldLoans)
      .where(
        and(
          eq(goldLoans.storeId, storeId),
          or(eq(goldLoans.status, 'active'), eq(goldLoans.status, 'margin_call'))
        )
      );

    let processed = 0;
    let errors = 0;

    for (const loan of activeLoans) {
      try {
        const principal = parseFloat(loan.loanAmount);
        const annualRate = parseFloat(loan.interestRate);
        const fromDate = loan.lastInterestCalcDate || loan.disbursementDate || loan.applicationDate;
        const isOverdue = loan.maturityDate ? new Date() > new Date(loan.maturityDate) : false;

        const accrual = this.calculateInterestAccrual(
          principal,
          annualRate,
          new Date(fromDate),
          new Date(),
          2, // Default penalty rate
          isOverdue
        );

        const currentAccrued = parseFloat(loan.accruedInterest || '0');
        const newAccrued = accrual.totalAccrued;
        const outstandingBalance = principal + newAccrued + accrual.penaltyAmount -
          parseFloat(loan.totalInterestPaid || '0') - parseFloat(loan.totalPenaltyPaid || '0');

        await db
          .update(goldLoans)
          .set({
            accruedInterest: newAccrued.toFixed(2),
            outstandingBalance: outstandingBalance.toFixed(2),
            lastInterestCalcDate: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(goldLoans.id, loan.id));

        processed++;
      } catch (err) {
        errors++;
        logger.error('Failed to accrue interest for loan', { error: err, loanId: loan.id });
      }
    }

    logger.info('Interest accrual completed', { storeId, processed, errors });
    return { processed, errors };
  }

  // ============================================================================
  // MARGIN CALLS
  // ============================================================================

  /**
   * Create a margin call for a loan with LTV breach
   */
  async createMarginCall(
    loanId: string,
    ltv: LTVCalculation,
    userId?: string
  ) {
    const [loan] = await db
      .select()
      .from(goldLoans)
      .where(eq(goldLoans.id, loanId))
      .limit(1);

    if (!loan) throw new Error('Loan not found');

    // Calculate payment needed to bring LTV back to safe level (90% of max)
    const targetLtv = ltv.maxAllowedLtv * 0.85;
    const requiredOutstanding = ltv.totalGoldValue * (targetLtv / 100);
    const requiredPayment = Math.max(0, ltv.outstandingAmount - requiredOutstanding);

    // Deadline: 7 days from now
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);

    const [call] = await db
      .insert(marginCalls)
      .values({
        loanId,
        storeId: loan.storeId,
        triggerReason: 'ltv_breach',
        goldRateAtCall: ltv.goldRateUsed.toString(),
        ltvAtCall: ltv.currentLtv.toString(),
        requiredPayment: requiredPayment.toFixed(2),
        deadline,
        createdBy: userId,
      })
      .returning();

    // Update loan status
    await db
      .update(goldLoans)
      .set({
        status: 'margin_call',
        updatedAt: new Date(),
      })
      .where(eq(goldLoans.id, loanId));

    logger.info('Margin call created', {
      loanId,
      currentLtv: ltv.currentLtv,
      requiredPayment,
      deadline,
    });

    return call;
  }

  /**
   * Record compliance with a margin call
   */
  async recordMarginCallCompliance(
    callId: string,
    paymentAmount: number
  ) {
    const [call] = await db
      .select()
      .from(marginCalls)
      .where(eq(marginCalls.id, callId))
      .limit(1);

    if (!call) throw new Error('Margin call not found');

    const totalReceived = parseFloat(call.paymentReceived || '0') + paymentAmount;
    const isComplied = totalReceived >= parseFloat(call.requiredPayment);

    await db
      .update(marginCalls)
      .set({
        paymentReceived: totalReceived.toFixed(2),
        status: isComplied ? 'complied' : 'pending',
        complianceDate: isComplied ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(marginCalls.id, callId));

    // If complied, restore loan status to active
    if (isComplied) {
      await db
        .update(goldLoans)
        .set({
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(goldLoans.id, call.loanId));
    }

    return { complied: isComplied, totalReceived };
  }

  /**
   * Get pending margin calls for a store
   */
  async getPendingMarginCalls(storeId: string) {
    return db
      .select({
        call: marginCalls,
        loan: goldLoans,
        customer: customers,
      })
      .from(marginCalls)
      .innerJoin(goldLoans, eq(marginCalls.loanId, goldLoans.id))
      .innerJoin(customers, eq(goldLoans.customerId, customers.id))
      .where(
        and(
          eq(marginCalls.storeId, storeId),
          eq(marginCalls.status, 'pending')
        )
      )
      .orderBy(asc(marginCalls.deadline));
  }

  /**
   * Check and create margin calls for all active loans (scheduler job)
   */
  async checkMarginCalls(storeId: string): Promise<{ checked: number; callsCreated: number }> {
    const activeLoans = await db
      .select()
      .from(goldLoans)
      .where(
        and(
          eq(goldLoans.storeId, storeId),
          eq(goldLoans.status, 'active')
        )
      );

    let checked = 0;
    let callsCreated = 0;

    for (const loan of activeLoans) {
      try {
        const ltv = await this.recalculateLoanLTV(loan.id);
        checked++;

        if (ltv.ltvStatus === 'breach') {
          // Check if there's already a pending margin call
          const existingCalls = await db
            .select()
            .from(marginCalls)
            .where(
              and(
                eq(marginCalls.loanId, loan.id),
                eq(marginCalls.status, 'pending')
              )
            )
            .limit(1);

          if (existingCalls.length === 0) {
            await this.createMarginCall(loan.id, ltv);
            callsCreated++;
          }
        }
      } catch (err) {
        logger.error('Failed to check margin call for loan', { error: err, loanId: loan.id });
      }
    }

    logger.info('Margin call check completed', { storeId, checked, callsCreated });
    return { checked, callsCreated };
  }

  // ============================================================================
  // LOAN RENEWALS
  // ============================================================================

  /**
   * Renew/extend a loan
   */
  async renewLoan(
    loanId: string,
    data: {
      newLoanAmount: number;
      newInterestRate: number;
      newTenureMonths: number;
      interestPayment: number; // Interest settled at renewal
    },
    storeId: string,
    userId: string
  ) {
    return await db.transaction(async (tx) => {
      // Get original loan
      const [originalLoan] = await tx
        .select()
        .from(goldLoans)
        .where(eq(goldLoans.id, loanId))
        .limit(1);

      if (!originalLoan) throw new Error('Loan not found');
      if (!['active', 'margin_call'].includes(originalLoan.status)) {
        throw new Error('Only active or margin-call loans can be renewed');
      }

      const outstanding = parseFloat(originalLoan.outstandingBalance || originalLoan.loanAmount);

      // Revalue gold
      const pledgedItems = await tx
        .select()
        .from(pledgedGold)
        .where(eq(pledgedGold.loanId, loanId));

      const goldRate = await metalAccountingService.getLatestGoldRate(storeId);
      let newGoldValue = 0;
      for (const item of pledgedItems) {
        const netWeight = parseFloat(item.netWeight);
        const purityPct = metalAccountingService.getPurityPercentage(item.purity);
        newGoldValue += netWeight * (purityPct / 100) * goldRate;
      }

      // Validate LTV for new loan
      const ltvCheck = this.validateLTV(data.newLoanAmount, newGoldValue);
      if (!ltvCheck.valid) {
        throw new Error(ltvCheck.message);
      }

      // Close original loan
      await tx
        .update(goldLoans)
        .set({
          status: 'renewed',
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(goldLoans.id, loanId));

      // Generate new loan number
      const today = new Date();
      const prefix = `LOAN-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}-`;
      const [lastLoan] = await tx
        .select()
        .from(goldLoans)
        .where(sql`${goldLoans.loanNumber} LIKE ${prefix + '%'}`)
        .orderBy(desc(goldLoans.createdAt))
        .limit(1);

      let sequence = 1;
      if (lastLoan) {
        const lastNumber = lastLoan.loanNumber.split('-').pop();
        sequence = parseInt(lastNumber || '0', 10) + 1;
      }
      const newLoanNumber = `${prefix}${String(sequence).padStart(4, '0')}`;

      // Calculate maturity
      const maturityDate = new Date();
      maturityDate.setMonth(maturityDate.getMonth() + data.newTenureMonths);

      // Create new loan
      const [newLoan] = await tx
        .insert(goldLoans)
        .values({
          storeId,
          loanNumber: newLoanNumber,
          customerId: originalLoan.customerId,
          loanAmount: data.newLoanAmount.toString(),
          interestRate: data.newInterestRate.toString(),
          tenure: data.newTenureMonths,
          loanType: originalLoan.loanType || 'bullet',
          maturityDate,
          status: 'active',
          disbursementDate: new Date(),
          originalLtv: ltvCheck.ltv.toString(),
          currentLtv: ltvCheck.ltv.toString(),
          ltvStatus: 'safe',
          totalGoldValue: newGoldValue.toFixed(2),
          outstandingBalance: data.newLoanAmount.toString(),
          renewalCount: (originalLoan.renewalCount || 0) + 1,
          parentLoanId: originalLoan.id,
          kycVerified: originalLoan.kycVerified,
          createdBy: userId,
        })
        .returning();

      // Transfer pledged gold items to new loan
      for (const item of pledgedItems) {
        await tx.insert(pledgedGold).values({
          loanId: newLoan.id,
          itemDescription: item.itemDescription,
          itemType: item.itemType,
          quantity: item.quantity,
          grossWeight: item.grossWeight,
          netWeight: item.netWeight,
          stoneWeight: item.stoneWeight,
          purity: item.purity,
          purityPercentage: item.purityPercentage,
          fineGoldEquivalent: item.fineGoldEquivalent,
          goldRateAtPledge: goldRate.toString(),
          goldValue: item.goldValue,
          appraisalValue: item.appraisalValue,
          currentMarketValue: (parseFloat(item.netWeight) * (metalAccountingService.getPurityPercentage(item.purity) / 100) * goldRate).toFixed(2),
          isHallmarked: item.isHallmarked,
          hallmarkNumber: item.hallmarkNumber,
          huidNumber: item.huidNumber,
          storageLocation: item.storageLocation,
          sealNumber: item.sealNumber,
          photos: item.photos,
        });
      }

      // Record renewal
      await tx.insert(loanRenewals).values({
        originalLoanId: loanId,
        newLoanId: newLoan.id,
        outstandingAtRenewal: outstanding.toFixed(2),
        interestPaidAtRenewal: data.interestPayment.toFixed(2),
        newLoanAmount: data.newLoanAmount.toString(),
        newInterestRate: data.newInterestRate.toString(),
        newTenureMonths: data.newTenureMonths,
        goldRevaluationDone: true,
        newGoldValue: newGoldValue.toFixed(2),
        newLtv: ltvCheck.ltv.toFixed(2),
        processedBy: userId,
      });

      logger.info('Loan renewed', {
        originalLoanId: loanId,
        newLoanId: newLoan.id,
        newAmount: data.newLoanAmount,
        newLtv: ltvCheck.ltv,
      });

      return { newLoan, renewalRecord: { originalLoanId: loanId } };
    });
  }

  /**
   * Get renewal history chain for a loan
   */
  async getRenewalHistory(loanId: string) {
    return db
      .select()
      .from(loanRenewals)
      .where(
        or(
          eq(loanRenewals.originalLoanId, loanId),
          eq(loanRenewals.newLoanId, loanId)
        )
      )
      .orderBy(desc(loanRenewals.renewalDate));
  }

  // ============================================================================
  // AUCTION / FORECLOSURE
  // ============================================================================

  /**
   * Initiate auction for a defaulted loan
   */
  async initiateAuction(loanId: string, userId: string) {
    const [loan] = await db
      .select()
      .from(goldLoans)
      .where(eq(goldLoans.id, loanId))
      .limit(1);

    if (!loan) throw new Error('Loan not found');

    // 7-day release deadline per Sri Lankan regulations
    const releaseDeadline = new Date();
    releaseDeadline.setDate(releaseDeadline.getDate() + 7);

    // Reserve price = outstanding balance
    const outstanding = parseFloat(loan.outstandingBalance || loan.loanAmount);

    const [auction] = await db
      .insert(loanAuctions)
      .values({
        loanId,
        storeId: loan.storeId,
        auctionStatus: 'initiated',
        releaseDeadline,
        reservePrice: outstanding.toFixed(2),
        createdBy: userId,
      })
      .returning();

    // Update loan status
    await db
      .update(goldLoans)
      .set({
        status: 'auction_initiated',
        updatedAt: new Date(),
      })
      .where(eq(goldLoans.id, loanId));

    logger.info('Auction initiated', { loanId, auctionId: auction.id, releaseDeadline });
    return auction;
  }

  /**
   * Complete an auction with sale details
   */
  async completeAuction(
    auctionId: string,
    data: {
      finalSalePrice: number;
      buyerName: string;
      buyerContact: string;
      buyerIdNumber?: string;
    },
    userId: string
  ) {
    const [auction] = await db
      .select()
      .from(loanAuctions)
      .where(eq(loanAuctions.id, auctionId))
      .limit(1);

    if (!auction) throw new Error('Auction not found');

    const [loan] = await db
      .select()
      .from(goldLoans)
      .where(eq(goldLoans.id, auction.loanId))
      .limit(1);

    if (!loan) throw new Error('Loan not found');

    const outstanding = parseFloat(loan.outstandingBalance || loan.loanAmount);
    const surplus = Math.max(0, data.finalSalePrice - outstanding);
    const deficit = Math.max(0, outstanding - data.finalSalePrice);

    await db
      .update(loanAuctions)
      .set({
        auctionStatus: 'completed',
        finalSalePrice: data.finalSalePrice.toFixed(2),
        buyerName: data.buyerName,
        buyerContact: data.buyerContact,
        buyerIdNumber: data.buyerIdNumber,
        amountRecovered: Math.min(data.finalSalePrice, outstanding).toFixed(2),
        surplusAmount: surplus.toFixed(2),
        deficitAmount: deficit.toFixed(2),
        settlementDate: new Date(),
        settledBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(loanAuctions.id, auctionId));

    // Close the loan
    await db
      .update(goldLoans)
      .set({
        status: 'auctioned',
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(goldLoans.id, auction.loanId));

    // Mark pledged items as released
    await db
      .update(pledgedGold)
      .set({
        isReleased: true,
        releasedAt: new Date(),
        releasedTo: `Auction: ${data.buyerName}`,
        updatedAt: new Date(),
      })
      .where(eq(pledgedGold.loanId, auction.loanId));

    return { surplus, deficit, amountRecovered: Math.min(data.finalSalePrice, outstanding) };
  }

  /**
   * Get auctions for a store
   */
  async getAuctions(storeId: string, status?: string) {
    const conditions = [eq(loanAuctions.storeId, storeId)];
    if (status) conditions.push(eq(loanAuctions.auctionStatus, status));

    return db
      .select({
        auction: loanAuctions,
        loan: goldLoans,
        customer: customers,
      })
      .from(loanAuctions)
      .innerJoin(goldLoans, eq(loanAuctions.loanId, goldLoans.id))
      .innerJoin(customers, eq(goldLoans.customerId, customers.id))
      .where(and(...conditions))
      .orderBy(desc(loanAuctions.initiationDate));
  }

  // ============================================================================
  // DASHBOARD STATISTICS
  // ============================================================================

  /**
   * Get comprehensive loan stats for the dashboard
   */
  async getLoanStats(storeId: string): Promise<LoanSummaryStats> {
    // Active loans
    const [activeStats] = await db
      .select({
        count: sql<number>`COUNT(*)`,
        totalDisbursed: sql<number>`COALESCE(SUM(${goldLoans.loanAmount}::numeric), 0)`,
        totalOutstanding: sql<number>`COALESCE(SUM(${goldLoans.outstandingBalance}::numeric), 0)`,
        avgLtv: sql<number>`COALESCE(AVG(${goldLoans.currentLtv}::numeric), 0)`,
      })
      .from(goldLoans)
      .where(
        and(
          eq(goldLoans.storeId, storeId),
          eq(goldLoans.status, 'active')
        )
      );

    // Total loans
    const [totalStats] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(goldLoans)
      .where(eq(goldLoans.storeId, storeId));

    // Overdue loans
    const [overdueStats] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(goldLoans)
      .where(
        and(
          eq(goldLoans.storeId, storeId),
          eq(goldLoans.status, 'active'),
          lte(goldLoans.maturityDate, new Date())
        )
      );

    // Margin call loans
    const [marginCallStats] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(goldLoans)
      .where(
        and(
          eq(goldLoans.storeId, storeId),
          eq(goldLoans.status, 'margin_call')
        )
      );

    // LTV breach count
    const [ltvBreachStats] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(goldLoans)
      .where(
        and(
          eq(goldLoans.storeId, storeId),
          or(eq(goldLoans.status, 'active'), eq(goldLoans.status, 'margin_call')),
          eq(goldLoans.ltvStatus, 'breach')
        )
      );

    // Total pledged gold
    const [goldStats] = await db
      .select({
        totalWeight: sql<number>`COALESCE(SUM(${pledgedGold.netWeight}::numeric), 0)`,
        totalValue: sql<number>`COALESCE(SUM(${pledgedGold.appraisalValue}::numeric), 0)`,
      })
      .from(pledgedGold)
      .innerJoin(goldLoans, eq(pledgedGold.loanId, goldLoans.id))
      .where(
        and(
          eq(goldLoans.storeId, storeId),
          or(eq(goldLoans.status, 'active'), eq(goldLoans.status, 'margin_call')),
          eq(pledgedGold.isReleased, false)
        )
      );

    return {
      totalLoans: parseInt(totalStats?.count?.toString() || '0'),
      activeLoans: parseInt(activeStats?.count?.toString() || '0'),
      totalDisbursed: parseFloat(activeStats?.totalDisbursed?.toString() || '0'),
      totalOutstanding: parseFloat(activeStats?.totalOutstanding?.toString() || '0'),
      totalPledgedGoldWeight: parseFloat(goldStats?.totalWeight?.toString() || '0'),
      totalPledgedGoldValue: parseFloat(goldStats?.totalValue?.toString() || '0'),
      overdueLoans: parseInt(overdueStats?.count?.toString() || '0'),
      marginCallLoans: parseInt(marginCallStats?.count?.toString() || '0'),
      averageLtv: parseFloat(activeStats?.avgLtv?.toString() || '0'),
      ltvBreachCount: parseInt(ltvBreachStats?.count?.toString() || '0'),
    };
  }

  /**
   * Get overdue loans for a store
   */
  async getOverdueLoans(storeId: string) {
    return db
      .select({
        loan: goldLoans,
        customer: customers,
      })
      .from(goldLoans)
      .innerJoin(customers, eq(goldLoans.customerId, customers.id))
      .where(
        and(
          eq(goldLoans.storeId, storeId),
          or(eq(goldLoans.status, 'active'), eq(goldLoans.status, 'margin_call')),
          lte(goldLoans.maturityDate, new Date())
        )
      )
      .orderBy(asc(goldLoans.maturityDate));
  }

  /**
   * Get loans maturing soon (within N days)
   */
  async getMaturingLoans(storeId: string, withinDays: number = 7) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + withinDays);

    return db
      .select({
        loan: goldLoans,
        customer: customers,
      })
      .from(goldLoans)
      .innerJoin(customers, eq(goldLoans.customerId, customers.id))
      .where(
        and(
          eq(goldLoans.storeId, storeId),
          eq(goldLoans.status, 'active'),
          gte(goldLoans.maturityDate, new Date()),
          lte(goldLoans.maturityDate, futureDate)
        )
      )
      .orderBy(asc(goldLoans.maturityDate));
  }
}

// Export singleton
export const goldPawningService = new GoldPawningService();
