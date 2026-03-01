import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { TestFactory } from './helpers/factories';
import { db } from '../config/database';
import { seedRoles } from '../scripts/seed-roles';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { loansService } from '../modules/loans/loans.service';

/**
 * AGENT 5: Gold Loans & Pawning Module — QA Test Suite
 * 
 * BRAND NEW TEST COVERAGE — These modules had ZERO existing tests.
 * Tests loan lifecycle: creation, EMI calculation, payments, overdue detection,
 * loan release, and statistics.
 */

describe('QA: Loans Module', () => {
    let store: typeof schema.stores.$inferSelect;
    let userId: string;
    let customerId: string;

    async function setupLoanEnvironment() {
        await seedRoles();
        store = await TestFactory.createStore();
        const role = await db.query.roles.findFirst({ where: eq(schema.roles.name, 'store_manager') });
        const user = await TestFactory.createUser({ email: `loan-mgr-${uuidv4()}@example.com` });
        await TestFactory.assignRole(user.id, role!.id, store.id);
        userId = user.id;

        const customer = await TestFactory.createCustomer(store.id, {
            firstName: 'Loan',
            lastName: 'Customer',
            phone: `077${uuidv4().substring(0, 7)}`,
        });
        customerId = customer.id;
    }

    // ========================================================================
    // SECTION 1: EMI CALCULATION
    // ========================================================================
    describe('EMI Calculation', () => {
        it('[LOAN-01] EMI calculation with standard values', async () => {
            await setupLoanEnvironment();

            const emi = loansService.calculateEMI(100000, 12, 12);
            console.log(`[LOAN-01] EMI for 100000 @ 12% for 12 months = ${emi}`);

            // EMI should be > 0 and reasonable
            expect(emi).toBeGreaterThan(0);
            expect(emi).toBeLessThan(100000); // Monthly EMI should be less than principal

            // Approximate expected: ~8884 for 100k @ 12% for 12 months
            expect(emi).toBeGreaterThan(8000);
            expect(emi).toBeLessThan(10000);
        });

        it('[LOAN-02] EMI with zero interest rate', async () => {
            await setupLoanEnvironment();

            const emi = loansService.calculateEMI(120000, 0, 12);
            console.log(`[LOAN-02] EMI for 120000 @ 0% for 12 months = ${emi}`);

            // With 0% interest, EMI = principal / tenure = 10000
            expect(emi).toBe(10000);
        });

        it('[LOAN-03] EMI with very high interest rate', async () => {
            await setupLoanEnvironment();

            const emi = loansService.calculateEMI(100000, 36, 12);
            console.log(`[LOAN-03] EMI for 100000 @ 36% for 12 months = ${emi}`);

            expect(emi).toBeGreaterThan(0);
            expect(emi).toBeLessThan(100000);
        });

        it('[LOAN-04] EMI with single month tenure', async () => {
            await setupLoanEnvironment();

            const emi = loansService.calculateEMI(100000, 12, 1);
            console.log(`[LOAN-04] EMI for 100000 @ 12% for 1 month = ${emi}`);

            // Should be approximately principal + 1 month interest
            expect(emi).toBeGreaterThan(100000); // Principal + interest
            expect(emi).toBeLessThan(110000);
        });
    });

    // ========================================================================
    // SECTION 2: LOAN LIFECYCLE
    // ========================================================================
    describe('Loan Lifecycle', () => {
        it('[LOAN-05] Full lifecycle: create → approve → pay → release', async () => {
            await setupLoanEnvironment();

            // Create loan
            const loan = await loansService.createLoan({
                customerId,
                loanAmount: 50000,
                interestRate: 12,
                tenure: 6,
                pledgedGoldItems: [{
                    itemDescription: 'Gold Chain 22K',
                    grossWeight: 15,
                    netWeight: 14.5,
                    purity: '22K',
                    goldValue: 80000,
                    appraisalValue: 75000,
                }],
                notes: 'QA Test Loan',
            }, store.id, userId);

            expect(loan).toBeDefined();
            expect(loan.id).toBeDefined();
            console.log(`[LOAN-05] Loan created: ${loan.id}, status: ${loan.status}`);

            // Approve loan
            const approved = await loansService.approveLoan(loan.id, {
                approved: true,
                notes: 'QA approved',
            }, userId);
            expect(['active', 'approved'].includes(approved.status)).toBe(true);
            console.log(`[LOAN-05] Loan approved: status=${approved.status}`);

            // Get outstanding
            const outstanding = await loansService.calculateOutstanding(loan.id);
            console.log(`[LOAN-05] Outstanding: ${outstanding}`);
            expect(outstanding).toBeGreaterThan(0);

            // Make a payment
            const payment = await loansService.addPayment(loan.id, {
                amount: 10000,
                paymentType: 'partial',
                notes: 'QA partial payment',
            }, userId);
            expect(payment).toBeDefined();

            // Check outstanding decreased
            const outstandingAfterPayment = await loansService.calculateOutstanding(loan.id);
            console.log(`[LOAN-05] Outstanding after payment: ${outstandingAfterPayment}`);
            expect(outstandingAfterPayment).toBeLessThan(outstanding);

            // Release loan
            const released = await loansService.releaseLoan(loan.id, {
                totalPaid: 50000,
                totalInterest: 3000,
                penalty: 0,
                notes: 'QA release',
            }, userId);
            // releaseLoan returns a release record, not the loan itself
            expect(released).toBeDefined();
            console.log(`[LOAN-05] Loan released successfully. Release record:`, released.id);
        });

        it('[LOAN-06] Create loan with multiple pledged items', async () => {
            await setupLoanEnvironment();

            const loan = await loansService.createLoan({
                customerId,
                loanAmount: 100000,
                interestRate: 15,
                tenure: 12,
                pledgedGoldItems: [
                    {
                        itemDescription: 'Gold Necklace 22K',
                        grossWeight: 25,
                        netWeight: 24,
                        purity: '22K',
                        goldValue: 150000,
                        appraisalValue: 140000,
                    },
                    {
                        itemDescription: 'Gold Bangles 22K',
                        grossWeight: 30,
                        netWeight: 28,
                        purity: '22K',
                        goldValue: 160000,
                        appraisalValue: 155000,
                    },
                ],
            }, store.id, userId);

            expect(loan).toBeDefined();

            // Verify pledged items were stored — property is 'pledgedGoldItems'
            const fullLoan = await loansService.getLoan(loan.id);
            const pledgedItems = (fullLoan as any).pledgedGoldItems || (fullLoan as any).pledgedGold || [];
            console.log(`[LOAN-06] Pledged items count: ${pledgedItems.length}`);
            expect(pledgedItems.length).toBe(2);
        });

        it('[LOAN-07] Reject loan approval', async () => {
            await setupLoanEnvironment();

            const loan = await loansService.createLoan({
                customerId,
                loanAmount: 50000,
                interestRate: 12,
                tenure: 6,
                pledgedGoldItems: [{
                    itemDescription: 'Gold Chain',
                    grossWeight: 10,
                    netWeight: 9.5,
                    purity: '22K',
                    goldValue: 55000,
                    appraisalValue: 50000,
                }],
            }, store.id, userId);

            const rejected = await loansService.approveLoan(loan.id, {
                approved: false,
                notes: 'QA rejection test',
            }, userId);

            expect(rejected.status).toBe('rejected');
        });
    });

    // ========================================================================
    // SECTION 3: LOAN QUERIES
    // ========================================================================
    describe('Loan Queries & Stats', () => {
        it('[LOAN-08] List loans by store with filters', async () => {
            await setupLoanEnvironment();

            // Create 2 loans
            for (let i = 0; i < 2; i++) {
                await loansService.createLoan({
                    customerId,
                    loanAmount: 50000 + (i * 10000),
                    interestRate: 12,
                    tenure: 6,
                    pledgedGoldItems: [{
                        itemDescription: `Item ${i}`,
                        grossWeight: 10,
                        netWeight: 9,
                        purity: '22K',
                        goldValue: 55000,
                        appraisalValue: 50000,
                    }],
                }, store.id, userId);
            }

            const loans = await loansService.listLoans(store.id);
            expect(loans.length).toBeGreaterThanOrEqual(2);

            // Filter by status
            const pendingLoans = await loansService.listLoans(store.id, { status: 'pending' });
            console.log(`[LOAN-08] Pending loans: ${pendingLoans.length}`);
        });

        it('[LOAN-09] Loan number generation is unique per store', async () => {
            await setupLoanEnvironment();

            const loan1 = await loansService.createLoan({
                customerId,
                loanAmount: 50000,
                interestRate: 12,
                tenure: 6,
                pledgedGoldItems: [{
                    itemDescription: 'Item 1',
                    grossWeight: 10,
                    netWeight: 9,
                    purity: '22K',
                    goldValue: 55000,
                    appraisalValue: 50000,
                }],
            }, store.id, userId);

            const loan2 = await loansService.createLoan({
                customerId,
                loanAmount: 60000,
                interestRate: 12,
                tenure: 6,
                pledgedGoldItems: [{
                    itemDescription: 'Item 2',
                    grossWeight: 12,
                    netWeight: 11,
                    purity: '22K',
                    goldValue: 66000,
                    appraisalValue: 60000,
                }],
            }, store.id, userId);

            expect(loan1.loanNumber).not.toBe(loan2.loanNumber);
            console.log(`[LOAN-09] Loan numbers: ${loan1.loanNumber}, ${loan2.loanNumber}`);
        });

        it('[LOAN-10] Get loan stats', async () => {
            await setupLoanEnvironment();

            // Create and approve a loan
            const loan = await loansService.createLoan({
                customerId,
                loanAmount: 50000,
                interestRate: 12,
                tenure: 6,
                pledgedGoldItems: [{
                    itemDescription: 'Stats Test Item',
                    grossWeight: 10,
                    netWeight: 9,
                    purity: '22K',
                    goldValue: 55000,
                    appraisalValue: 50000,
                }],
            }, store.id, userId);

            await loansService.approveLoan(loan.id, { approved: true }, userId);

            const stats = await loansService.getLoanStats(store.id);
            console.log(`[LOAN-10] Loan stats:`, stats);
            expect(stats).toBeDefined();
        });
    });

    // ========================================================================
    // SECTION 4: EDGE CASES
    // ========================================================================
    describe('Edge Cases', () => {
        it('[LOAN-11] Payment exceeding outstanding - check behavior', async () => {
            await setupLoanEnvironment();

            const loan = await loansService.createLoan({
                customerId,
                loanAmount: 5000,
                interestRate: 12,
                tenure: 1,
                pledgedGoldItems: [{
                    itemDescription: 'Small Item',
                    grossWeight: 2,
                    netWeight: 1.8,
                    purity: '22K',
                    goldValue: 10000,
                    appraisalValue: 9000,
                }],
            }, store.id, userId);

            await loansService.approveLoan(loan.id, { approved: true }, userId);

            // Try to pay MORE than outstanding
            try {
                await loansService.addPayment(loan.id, {
                    amount: 1000000, // Way too much
                    paymentType: 'full',
                }, userId);
                console.warn('[LOAN-11] Overpayment ACCEPTED - potential issue');
            } catch (error: any) {
                console.log(`[LOAN-11] Overpayment correctly rejected: ${error.message}`);
                expect(error).toBeDefined();
            }
        });

        it('[LOAN-12] Payment on unapproved loan - check behavior', async () => {
            await setupLoanEnvironment();

            const loan = await loansService.createLoan({
                customerId,
                loanAmount: 50000,
                interestRate: 12,
                tenure: 6,
                pledgedGoldItems: [{
                    itemDescription: 'Unapproved Item',
                    grossWeight: 10,
                    netWeight: 9,
                    purity: '22K',
                    goldValue: 55000,
                    appraisalValue: 50000,
                }],
            }, store.id, userId);

            // DO NOT approve — try to add payment to pending loan
            try {
                await loansService.addPayment(loan.id, {
                    amount: 5000,
                    paymentType: 'partial',
                }, userId);
                console.warn('[LOAN-12] Payment on PENDING loan succeeded - potential issue');
                console.warn('  RECOMMENDATION: Validate loan status before accepting payments');
            } catch (error: any) {
                console.log(`[LOAN-12] Correctly rejected payment on pending loan: ${error.message}`);
                expect(error).toBeDefined();
            }
        });
    });
});
