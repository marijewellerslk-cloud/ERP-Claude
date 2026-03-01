import { db } from '../../config/database.js';
import {
  goldLoans,
  pledgedGold,
  loanPayments,
  loanReleases,
  customers,
} from '../../db/schema.js';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import type {
  CreateLoanInput,
  ApproveLoanInput,
  AddLoanPaymentInput,
  ReleaseLoanInput,
} from './loans.validation.js';

export class LoansService {
  // ============================================================================
  // LOAN MANAGEMENT
  // ============================================================================

  async generateLoanNumber(storeId: string): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');

    const prefix = `LOAN-${year}${month}-`;

    const lastLoan = await db
      .select()
      .from(goldLoans)
      .where(
        and(
          eq(goldLoans.storeId, storeId),
          sql`${goldLoans.loanNumber} LIKE ${prefix + '%'}`
        )
      )
      .orderBy(desc(goldLoans.createdAt))
      .limit(1);

    let sequence = 1;
    if (lastLoan.length > 0) {
      const lastNumber = lastLoan[0].loanNumber.split('-').pop();
      sequence = parseInt(lastNumber || '0', 10) + 1;
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }

  calculateEMI(principal: number, annualRate: number, tenureMonths: number): number {
    // Handle zero interest rate — simple division, no compounding
    if (annualRate === 0) {
      return Math.round((principal / tenureMonths) * 100) / 100;
    }
    const monthlyRate = annualRate / 100 / 12;
    const emi =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
      (Math.pow(1 + monthlyRate, tenureMonths) - 1);
    return Math.round(emi * 100) / 100;
  }

  async createLoan(input: CreateLoanInput, storeId: string, userId: string) {
    return await db.transaction(async (tx) => {
      const loanNumber = await this.generateLoanNumber(storeId);

      // Calculate maturity date
      const maturityDate = new Date();
      maturityDate.setMonth(maturityDate.getMonth() + input.tenure);

      // Calculate EMI if not provided
      const monthlyEmi =
        input.monthlyEmi ||
        this.calculateEMI(input.loanAmount, input.interestRate, input.tenure);

      // Create loan
      const [loan] = await tx
        .insert(goldLoans)
        .values({
          storeId,
          loanNumber,
          customerId: input.customerId,
          loanAmount: input.loanAmount.toString(),
          interestRate: input.interestRate.toString(),
          tenure: input.tenure,
          monthlyEmi: monthlyEmi.toString(),
          maturityDate,
          createdBy: userId,
        })
        .returning();

      // Add pledged gold items
      for (const item of input.pledgedGoldItems) {
        await tx.insert(pledgedGold).values({
          loanId: loan.id,
          itemDescription: item.itemDescription,
          grossWeight: item.grossWeight.toString(),
          netWeight: item.netWeight.toString(),
          purity: item.purity,
          goldValue: item.goldValue.toString(),
          appraisalValue: item.appraisalValue.toString(),
          photos: item.photos ? JSON.stringify(item.photos) : null,
        });
      }

      return loan;
    });
  }

  async getLoan(loanId: string) {
    const [loan] = await db
      .select()
      .from(goldLoans)
      .where(eq(goldLoans.id, loanId))
      .limit(1);

    if (!loan) {
      throw new Error('Loan not found');
    }

    // Get pledged gold items
    const pledgedItems = await db
      .select()
      .from(pledgedGold)
      .where(eq(pledgedGold.loanId, loanId));

    // Get payments
    const payments = await db
      .select()
      .from(loanPayments)
      .where(eq(loanPayments.loanId, loanId))
      .orderBy(desc(loanPayments.paymentDate));

    // Get customer
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, loan.customerId))
      .limit(1);

    return {
      ...loan,
      pledgedGoldItems: pledgedItems,
      payments,
      customer,
    };
  }

  async listLoans(
    storeId: string,
    filters?: {
      status?: string;
      customerId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const conditions = [eq(goldLoans.storeId, storeId)];

    if (filters?.status) {
      conditions.push(eq(goldLoans.status, filters.status));
    }
    if (filters?.customerId) {
      conditions.push(eq(goldLoans.customerId, filters.customerId));
    }
    if (filters?.startDate) {
      conditions.push(gte(goldLoans.applicationDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(goldLoans.applicationDate, filters.endDate));
    }

    const loans = await db
      .select()
      .from(goldLoans)
      .where(and(...conditions))
      .orderBy(desc(goldLoans.applicationDate));

    return loans;
  }

  async approveLoan(loanId: string, input: ApproveLoanInput, userId: string) {
    const [loan] = await db
      .update(goldLoans)
      .set({
        status: input.approved ? 'approved' : 'rejected',
        approvedBy: userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(goldLoans.id, loanId))
      .returning();

    if (!loan) {
      throw new Error('Loan not found');
    }

    return loan;
  }

  // ============================================================================
  // LOAN PAYMENTS
  // ============================================================================

  async calculateOutstanding(loanId: string): Promise<number> {
    const [loan] = await db
      .select()
      .from(goldLoans)
      .where(eq(goldLoans.id, loanId))
      .limit(1);

    if (!loan) {
      throw new Error('Loan not found');
    }

    const payments = await db
      .select()
      .from(loanPayments)
      .where(eq(loanPayments.loanId, loanId));

    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const principal = parseFloat(loan.loanAmount);

    // Simple interest calculation
    const monthlyRate = parseFloat(loan.interestRate) / 100 / 12;
    const monthsElapsed = Math.floor(
      (new Date().getTime() - new Date(loan.applicationDate).getTime()) /
      (1000 * 60 * 60 * 24 * 30)
    );
    const interest = principal * monthlyRate * monthsElapsed;

    return principal + interest - totalPaid;
  }

  async addPayment(loanId: string, input: AddLoanPaymentInput, userId: string) {
    return await db.transaction(async (tx) => {
      const outstanding = await this.calculateOutstanding(loanId);

      // Calculate principal and interest split
      const [loan] = await tx
        .select()
        .from(goldLoans)
        .where(eq(goldLoans.id, loanId))
        .limit(1);

      if (!loan) {
        throw new Error('Loan not found');
      }

      const principal = parseFloat(loan.loanAmount);
      const monthlyRate = parseFloat(loan.interestRate) / 100 / 12;
      const monthsElapsed = Math.floor(
        (new Date().getTime() - new Date(loan.applicationDate).getTime()) /
        (1000 * 60 * 60 * 24 * 30)
      );

      const totalInterest = principal * monthlyRate * monthsElapsed;

      const existingPayments = await tx
        .select()
        .from(loanPayments)
        .where(eq(loanPayments.loanId, loanId));

      const interestPaid = existingPayments.reduce(
        (sum, p) => sum + parseFloat(p.interestAmount),
        0
      );
      const principalPaid = existingPayments.reduce(
        (sum, p) => sum + parseFloat(p.principalAmount),
        0
      );

      const interestDue = totalInterest - interestPaid;
      let interestAmount = Math.min(input.amount, interestDue);
      let principalAmount = input.amount - interestAmount;

      // Create payment record
      const [payment] = await tx
        .insert(loanPayments)
        .values({
          loanId,
          amount: input.amount.toString(),
          paymentType: input.paymentType,
          principalAmount: principalAmount.toString(),
          interestAmount: interestAmount.toString(),
          outstandingBalance: (outstanding - input.amount).toString(),
          transactionReference: input.transactionReference,
          createdBy: userId,
        })
        .returning();

      // Update loan status if fully paid
      if (outstanding - input.amount <= 0) {
        await tx
          .update(goldLoans)
          .set({ status: 'closed', closedAt: new Date(), updatedAt: new Date() })
          .where(eq(goldLoans.id, loanId));
      } else {
        await tx
          .update(goldLoans)
          .set({ status: 'active', updatedAt: new Date() })
          .where(eq(goldLoans.id, loanId));
      }

      return payment;
    });
  }

  async getOverdueLoans(storeId: string) {
    const today = new Date();

    const overdueLoans = await db
      .select()
      .from(goldLoans)
      .where(
        and(
          eq(goldLoans.storeId, storeId),
          eq(goldLoans.status, 'active'),
          lte(goldLoans.maturityDate, today)
        )
      )
      .orderBy(goldLoans.maturityDate);

    return overdueLoans;
  }

  // ============================================================================
  // LOAN RELEASE
  // ============================================================================

  async releaseLoan(loanId: string, input: ReleaseLoanInput, userId: string) {
    return await db.transaction(async (tx) => {
      const [loan] = await tx
        .select()
        .from(goldLoans)
        .where(eq(goldLoans.id, loanId))
        .limit(1);

      if (!loan) {
        throw new Error('Loan not found');
      }

      if (loan.status === 'closed') {
        throw new Error('Loan is already closed');
      }

      // Create release record
      const [release] = await tx
        .insert(loanReleases)
        .values({
          loanId,
          totalPaid: input.totalPaid.toString(),
          totalInterest: input.totalInterest.toString(),
          penalty: input.penalty.toString(),
          releasedBy: userId,
          notes: input.notes,
        })
        .returning();

      // Update loan status
      await tx
        .update(goldLoans)
        .set({ status: 'closed', closedAt: new Date(), updatedAt: new Date() })
        .where(eq(goldLoans.id, loanId));

      return release;
    });
  }

  // ============================================================================
  // ANALYTICS
  // ============================================================================

  async getLoanStats(storeId: string) {
    const stats = await db
      .select({
        totalLoans: sql<number>`COUNT(*)`,
        activeLoans: sql<number>`COUNT(CASE WHEN ${goldLoans.status} = 'active' THEN 1 END)`,
        closedLoans: sql<number>`COUNT(CASE WHEN ${goldLoans.status} = 'closed' THEN 1 END)`,
        totalDisbursed: sql<number>`COALESCE(SUM(CAST(${goldLoans.loanAmount} AS DECIMAL)), 0)`,
      })
      .from(goldLoans)
      .where(eq(goldLoans.storeId, storeId));

    const overdue = await this.getOverdueLoans(storeId);

    return {
      ...stats[0],
      overdueLoans: overdue.length,
    };
  }
}

export const loansService = new LoansService();
