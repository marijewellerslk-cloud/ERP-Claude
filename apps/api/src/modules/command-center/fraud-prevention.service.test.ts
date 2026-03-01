import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFraudRiskScore, getAnomalyAlerts } from './fraud-prevention.service.js';

// Hoist the mockDb object
const { mockDb } = vi.hoisted(() => {
    const mock: any = {
        select: vi.fn(),
        from: vi.fn(),
        where: vi.fn(),
        innerJoin: vi.fn(),
        groupBy: vi.fn(),
        having: vi.fn(),
        limit: vi.fn(),
    };
    // Make methods chainable by default
    mock.select.mockReturnThis();
    mock.from.mockReturnThis();
    mock.innerJoin.mockReturnThis();
    return { mockDb: mock };
});

vi.mock('../../config/database.js', () => ({
    db: mockDb,
}));

vi.mock('../../db/schema.js', () => ({
    stores: { id: 'stores.id', name: 'stores.name', code: 'stores.code' },
    invoices: {
        id: 'invoices.id',
        storeId: 'invoices.storeId',
        status: 'invoices.status',
        invoiceDate: 'invoices.invoiceDate',
        createdAt: 'invoices.createdAt',
        discountAmount: 'invoices.discountAmount',
        totalAmount: 'invoices.totalAmount',
        customerId: 'invoices.customerId',
        invoiceNumber: 'invoices.invoiceNumber',
    },
    invoiceItems: {
        invoiceId: 'invoiceItems.invoiceId',
        unitCost: 'invoiceItems.unitCost',
        lineTotal: 'invoiceItems.lineTotal',
    },
    salesReturns: {
        storeId: 'salesReturns.storeId',
        createdBy: 'salesReturns.createdBy',
        createdAt: 'salesReturns.createdAt',
    },
    expenses: { storeId: 'expenses.storeId', expenseDate: 'expenses.expenseDate' },
    goldLoans: { id: 'goldLoans.id', storeId: 'goldLoans.storeId', status: 'goldLoans.status' },
    pledgedGold: { loanId: 'pledgedGold.loanId' },
    payroll: { storeId: 'payroll.storeId' },
    accounts: { storeId: 'accounts.storeId' },
    bankAccounts: { storeId: 'bankAccounts.storeId' },
    auditLogs: { storeId: 'auditLogs.storeId', createdAt: 'auditLogs.createdAt', action: 'auditLogs.action' },
    loginHistory: { status: 'loginHistory.status', createdAt: 'loginHistory.createdAt' },
    users: { id: 'users.id' },
}));

describe('Fraud Prevention Service', () => {
    const storeId = 'store-123';

    beforeEach(() => {
        vi.clearAllMocks();
        // Default chain behavior
        mockDb.select.mockReturnThis();
        mockDb.from.mockReturnThis();
        mockDb.innerJoin.mockReturnThis();
        mockDb.groupBy.mockReturnThis();
        mockDb.having.mockReturnThis();
        mockDb.where.mockReturnThis();
        mockDb.limit.mockReturnThis();
    });

    describe('getFraudRiskScore', () => {
        it('should calculate risk score based on triggered signals', async () => {
            // Sequence in getFraudRiskScore (all end at where)
            mockDb.where
                .mockResolvedValueOnce([{ name: 'Test Store', code: 'TEST-001' }]) // 1
                .mockResolvedValueOnce([{ count: 4 }])   // 2. High Discounts
                .mockResolvedValueOnce([{ count: 0 }])   // 3. Below Cost
                .mockResolvedValueOnce([{ count: 6 }])   // 4. Off Hours
                .mockResolvedValueOnce([{ count: 100 }]) // 5. Total Sales
                .mockResolvedValueOnce([{ count: 5 }])   // 6. Returns
                .mockResolvedValueOnce([{ count: 50 }]); // 7. Audit

            const validation = await getFraudRiskScore([storeId]);

            expect(validation).toHaveLength(1);
            const score = validation[0];
            expect(score.riskScore).toBe(35);
            expect(score.riskLevel).toBe('medium');
        });
    });

    describe('getAnomalyAlerts', () => {
        it('should detect high discount invoices', async () => {
            // Sequence in getAnomalyAlerts (mixed)
            mockDb.where
                .mockResolvedValueOnce([{ name: 'Test Store' }]) // 1. Resolves (end)
                .mockReturnValueOnce(mockDb) // 2. Returns DB for chaining limit()
                .mockReturnValueOnce(mockDb) // 3. Returns DB for chaining groupBy()
                .mockReturnValueOnce(mockDb) // 4. Returns DB for chaining groupBy()
                .mockResolvedValueOnce([])   // 5. Resolves (end - Off Hours)
                .mockReturnValueOnce(mockDb) // 6. Returns DB for chaining groupBy/having
                .mockResolvedValueOnce([])   // 7. Resolves (end - Below Cost)
                .mockResolvedValueOnce([]);  // 8. Resolves (end - Failed Logins)

            // Setup terminators for chained calls

            // 2. High Discount -> limit
            mockDb.limit.mockResolvedValueOnce([
                {
                    invoiceId: 'inv-1',
                    invoiceNumber: 'INV-001',
                    totalAmount: '100',
                    discountAmount: '50', // 33% (>30%)
                    createdAt: new Date(),
                }
            ]);

            // 3. Return Rates -> groupBy
            mockDb.groupBy.mockResolvedValueOnce([]);

            // 4. Sales Counts -> groupBy
            mockDb.groupBy.mockResolvedValueOnce([]);

            // 6. Rapid Repeats -> having
            // Note: rapid repeats invokes groupBy then having.
            // groupBy needs to return mockDb for having to work.
            // But wait, for call #3 and #4, groupBy returns DATA.
            // For call #6, groupBy returns THIS.
            // So we need to sequence groupBy as well.

            // groupBy sequence:
            // Call 1 (Return Rates): Return Data
            // Call 2 (Sales Counts): Return Data
            // Call 3 (Rapid Repeats): Return THIS

            const groupByMock = vi.fn();
            mockDb.groupBy = groupByMock;

            groupByMock
                .mockResolvedValueOnce([]) // 1
                .mockResolvedValueOnce([]) // 2
                .mockReturnValueOnce(mockDb); // 3

            // having sequence (Rapid Repeats)
            mockDb.having.mockResolvedValueOnce([]);

            const alerts = await getAnomalyAlerts([storeId]);
            const discountAlert = alerts.find(a => a.type === 'high_discount');
            expect(discountAlert).toBeDefined();
            expect(discountAlert?.message).toContain('33% discount applied');
        });
    });
});
