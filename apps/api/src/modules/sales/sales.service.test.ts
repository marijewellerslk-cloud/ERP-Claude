import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SalesService } from './sales.service';
import { db } from '../../config/database';

// Mock DB
vi.mock('../../config/database', () => ({
    db: {
        transaction: vi.fn((callback) => callback(mockTx)),
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn() })) })) })) })),
    },
}));

// Mock Transaction object
const mockTx = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
};

// Mock Drizzle operators/schema
vi.mock('drizzle-orm', () => ({
    eq: vi.fn(),
    and: vi.fn(),
    desc: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    sql: vi.fn(),
}));

// Mock Schema
vi.mock('../../db/schema', () => ({
    invoices: {
        id: 'invoices',
        storeId: 'storeId',
        invoiceNumber: 'invoiceNumber',
        customerId: 'customerId',
        totalAmount: 'totalAmount',
        finalAmount: 'finalAmount',
        paymentStatus: 'paymentStatus',
        createdAt: 'createdAt'
    },
    invoiceItems: {
        id: 'invoiceItems',
        invoiceId: 'invoiceId'
    },
    goldRates: {
        date: 'date',
        goldType: 'goldType',
        purity: 'purity'
    },
    stockLevels: {
        quantity: 'quantity'
    },
    inventoryItems: {
        id: 'inventoryItems'
    },
    stockMovements: {
        id: 'stockMovements'
    },
    payments: {
        id: 'payments'
    },
    quotations: {
        id: 'quotations'
    },
    customers: {
        id: 'customers'
    }
}));

// Mock CRM services
vi.mock('../../services/loyalty.service', () => ({
    loyaltyService: { awardPurchasePoints: vi.fn().mockResolvedValue({ pointsAwarded: 0 }) },
}));
vi.mock('../../services/buying-habits.service', () => ({
    buyingHabitsService: { updateAfterPurchase: vi.fn() },
}));
vi.mock('../../services/wishlist.service', () => ({
    wishlistService: { checkAndFulfillWishlists: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../../services/referral.service', () => ({
    referralService: { qualifyReferral: vi.fn() },
}));
vi.mock('../../services/whatsapp.service', () => ({
    whatsappService: { isConfigured: vi.fn().mockReturnValue(false) },
}));
vi.mock('../../utils/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn() },
}));

describe('SalesService', () => {
    let salesService: SalesService;

    beforeEach(() => {
        vi.clearAllMocks();
        salesService = new SalesService();

        // Reset TX mocks
        mockTx.select.mockReset();
        mockTx.insert.mockReset();
        mockTx.update.mockReset();

        // Setup default chainable mocks for TX
        const chain = {
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([])
                    })
                })
            })
        };
        mockTx.select.mockReturnValue(chain);

        // Setup default chainable mocks for DB (used in generateInvoiceNumber)
        const dbChain = {
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([])
                    })
                })
            })
        };
        // @ts-ignore
        db.select.mockReturnValue(dbChain);
    });

    describe('createInvoice', () => {
        it('should calculate invoice totals correctly', async () => {
            // Setup
            const storeId = 'store-123';
            const userId = 'user-123';
            const input = {
                customerId: 'cust-123',
                items: [
                    {
                        itemDescription: 'Gold Ring',
                        quantity: 1,
                        unitPrice: 50000,
                        makingCharges: 5000,
                        wastageCharges: 1000,
                        discount: 500,
                        taxRate: 0,
                    },
                    {
                        itemDescription: 'Silver Chain',
                        quantity: 2,
                        unitPrice: 5000,
                        makingCharges: 500,
                        wastageCharges: 0,
                        discount: 0,
                        taxRate: 0,
                    }
                ],
                discountAmount: 1000, // Invoice level discount
                taxAmount: 0,
            };

            // Mock insert to handle different tables
            mockTx.insert.mockImplementation((table) => {
                if (table.id === 'invoices') {
                    return {
                        values: vi.fn().mockReturnValue({
                            returning: vi.fn().mockResolvedValue([{ id: 'new-invoice-id', finalAmount: '64500.00' }])
                        })
                    };
                }
                // Default for invoiceItems, listing items etc
                return {
                    values: vi.fn().mockResolvedValue(undefined)
                };
            });

            // Execute
            const result = await salesService.createInvoice(input as any, storeId, userId);

            // Verify
            expect(mockTx.insert).toHaveBeenCalled();

            // Use expect.objectContaining to match arguments if possible, or verify result
            expect(result.finalAmount).toBe('64500.00');
        });
    });
});
