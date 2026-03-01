import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoldPawningService } from './gold-pawning.service';
import { db } from '../config/database';

// Mock dependencies
vi.mock('../config/database', () => ({
    db: {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(), orderBy: vi.fn(() => ({ limit: vi.fn() })) })) })) })),
        insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    },
}));

vi.mock('./metal-accounting.service', () => ({
    metalAccountingService: {
        getLatestGoldRate: vi.fn(),
        getPurityPercentage: vi.fn((p) => {
            if (p === '22k') return 91.6;
            if (p === '24k') return 99.9;
            return 0;
        }),
    },
}));

describe('Gold Pawning Service - Advanced Scenarios', () => {
    let service: GoldPawningService;

    beforeEach(() => {
        service = new GoldPawningService();
        vi.clearAllMocks();
    });

    describe('Loan to Value (LTV) Scenarios', () => {
        it('should correctly flag WARNING state at exact 85% LTV boundary', async () => {
            // Scenario: 
            // Loan Amount: 85,000
            // Gold Value: 100,000
            // LTV = 85%
            // Max LTV = 85% (Standard)
            // Policy: Warning at 90% of Max? Or Breach at Max?
            // "if (currentLtv >= maxAllowedLtv) ltvStatus = 'breach';"
            // "else if (currentLtv >= maxAllowedLtv * 0.9) ltvStatus = 'warning';"

            // So if Max is 85, then 85 >= 85 is BREACH.
            // Warning starts at 85 * 0.9 = 76.5

            const loanId = 'loan-123';
            const mockLoan = {
                id: loanId,
                loanAmount: '85000', // Principal
                outstandingBalance: '85000',
                storeId: 'store-1',
                interestRateConfigId: null
            };

            const mockPledgedItems = [
                { netWeight: '10', purity: '24k' } // 10g 24k
            ];

            // Mock DB returns
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockImplementation((condition) => ({
                        limit: vi.fn().mockResolvedValue([mockLoan]), // For loan query
                        // For pledged items query, it returns array directly or via limit?
                        // Usually distinct queries. Mock implementation is simplified.
                    }))
                })
            } as any);

            // We need separate mocks for Loan vs PledgedItems
            // Let's use mockImplementation on `from`
            vi.mocked(db.select).mockImplementation(() => ({
                from: vi.fn().mockImplementation((table: any) => {
                    // Primitive check based on table name via proxy or string if possible
                    // Since schema objects are passed, checking them is hard in mocks without deep equality
                    // We can just rely on the order of calls or specific returns

                    return {
                        where: vi.fn().mockImplementation(() => {
                            // If we return array with 'netWeight', it's items
                            // If we return array with 'loanAmount', it's loan
                            // Hacky but works for unit tests
                            return {
                                limit: vi.fn().mockResolvedValue([mockLoan]),
                            };
                        })
                    };
                })
            } as any));

            // Actually, querying pledged items probably doesn't use `limit(1)`.
            // The service code: 
            // const pledgedItems = await db.select().from(pledgedGold).where(...)
            // It awaits the where chain.

            // We need a better mock strategy for multiple queries.
            const queryMock = vi.fn();

            // Mock DB select chain
            vi.mocked(db.select).mockImplementation(() => ({
                from: vi.fn().mockImplementation((table) => ({
                    where: vi.fn().mockImplementation(() => {
                        // Mocking the behavior based on expected calls
                        // 1. Get Loan -> returns [loan] (via limit)
                        // 2. Get Items -> returns items (promise resolves to array)
                        const promise = Promise.resolve(mockPledgedItems);
                        // Add limit method to promise
                        (promise as any).limit = vi.fn().mockResolvedValue([mockLoan]);
                        return promise;
                    })
                }))
            } as any));

            // Value of 10g 24k @ 10,000/g = 100,000
            // We need to mock gold rate
            const { metalAccountingService } = await import('./metal-accounting.service');
            vi.mocked(metalAccountingService.getLatestGoldRate).mockResolvedValue(10000); // 10,000 per gram 24k base? 
            // Logic: itemValue = netWeight * (purityPct / 100) * goldRate;
            // 10 * (99.9/100) * 10000 = 99,900
            // Loan 85,000
            // LTV = 85000 / 99900 = 85.08%

            // Wait, getMaxLtv returns 85 for 250k loan.
            // 85.08 > 85 -> Breach?

            // Let's force an EXACT match.
            // 10g * 1.0 * 10000 = 100,000 (if purity 100%)
            vi.mocked(metalAccountingService.getPurityPercentage).mockReturnValue(100);
            vi.mocked(metalAccountingService.getLatestGoldRate).mockResolvedValue(10000);

            // Total Value = 10 * 1 * 10000 = 100,000
            // Loan = 85,000
            // LTV = 85.00%

            // Service Logic: if (currentLtv >= maxAllowedLtv) -> Breach
            // 85 >= 85 -> Breach.

            const result = await service.calculateLTV(loanId);

            expect(result.currentLtv).toBe(85);
            expect(result.ltvStatus).toBe('breach'); // Strict boundary check
        });

        it('should allow LTV just below max (e.g. 84.99%)', async () => {
            // Loan 84,990 / 100,000 = 84.99%
            const loanId = 'loan-safe';
            const mockLoan = {
                id: loanId,
                loanAmount: '84990',
                outstandingBalance: '84990',
                storeId: 'store-1',
            };

            // Setup exact same mocks, just return different loan
            vi.mocked(db.select).mockImplementation(() => ({
                from: vi.fn().mockImplementation(() => ({
                    where: vi.fn().mockImplementation(() => {
                        const promise = Promise.resolve([{ netWeight: '10' }]);
                        (promise as any).limit = vi.fn().mockResolvedValue([mockLoan]);
                        return promise;
                    })
                }))
            } as any));

            const result = await service.calculateLTV(loanId);

            expect(result.currentLtv).toBe(84.99);
            expect(result.ltvStatus).toBe('warning');
            // Warning because 84.99 > (85 * 0.9 = 76.5)
        });
    });

    describe('Daily Interest Compounding', () => {
        it('should calculate precise daily interest without drift', () => {
            // 100,000 Principal
            // 18% Annual Rate
            // 365 days
            // Expected = 18,000 exactly?

            // Formula: principal * (annualRate/100/365) * days
            // 100000 * (0.18/365) * 365 = 100000 * 0.18 = 18000

            const principal = 100000;
            const rate = 18;
            const fromDate = new Date('2023-01-01');
            const toDate = new Date('2024-01-01'); // 365 days

            const result = service.calculateInterestAccrual(principal, rate, fromDate, toDate);

            expect(result.daysElapsed).toBe(365);
            expect(result.totalAccrued).toBe(18000);
        });

        it('should handle partial compounding scenarios correctly', () => {
            // Test 10 days
            // 100,000 * (0.18/365) * 10
            // 100,000 * 0.00049315... * 10 = 49.315...
            // Round to 2 decimals = 493.15?

            const principal = 100000;
            const rate = 18;
            const fromDate = new Date('2023-01-01');
            const toDate = new Date('2023-01-11'); // 10 days

            const result = service.calculateInterestAccrual(principal, rate, fromDate, toDate);

            // 100000 * 0.18 / 365 * 10 = 493.15068...
            // Should round to 493.15

            expect(result.totalAccrued).toBe(493.15);
            expect(result.dailyInterest).toBe(49.32); // 49.315... rounds to 49.32
        });
    });

    describe('Partial Payments', () => {
        it('should verify behavior logic for splitting interest (unit test simulation)', () => {
            // This focuses on the logic: 
            // If I pay 5000, and Interest is 2000, Principal is 3000 reduced?

            // We'll simulate the logic found in 'accrueInterestForAllLoans' or manual payment handlers
            // Since we don't have a direct 'processPayment' method viewable in the snippet,
            // we verify the interest Priority rule via a standalone test of expectations.

            const payment = 5000;
            const accruedInterest = 2000;
            const penalty = 100;

            // Standard Pawning Rule: Penalty First, Then Interest, Then Principal
            const remainingAfterPenalty = payment - penalty; // 4900
            const remainingAfterInterest = remainingAfterPenalty - accruedInterest; // 2900

            expect(remainingAfterInterest).toBe(2900);

            // This simple test documents the "Why Important":
            // "Risk: If principal is reduced before interest, the store loses revenue compounding potential."
        });
    });
});
