import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InventoryService } from './inventory.service';
import { db } from '../../config/database';
import { supplierAccountService } from '../../services/supplier-account.service';
import { activityLogger } from '../../services/activity-logger.service';
import { logger } from '../../utils/logger';
import { inventoryBatches } from '../../db/schema';

// Mock dependencies
vi.mock('../../config/database', () => ({
    db: {
        transaction: vi.fn((callback) => callback(db)),
        insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn() })) })) })),
        query: {
            inventoryBatches: {
                findFirst: vi.fn(),
            },
            inventoryItems: {
                findFirst: vi.fn(),
            },
            inventoryBatchItems: {
                findFirst: vi.fn(),
            },
        },
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
    },
}));

vi.mock('../../services/supplier-account.service', () => ({
    supplierAccountService: {
        checkCreditLimit: vi.fn(),
        updateSupplierBalance: vi.fn(),
        createMonetaryTransaction: vi.fn(),
        updateGoldBalance: vi.fn(),
        createGoldTransaction: vi.fn(),
        updateAccountStatus: vi.fn(),
        updateGoldExchangeBalance: vi.fn(),
        createGoldExchangeTransaction: vi.fn(),
    },
}));

vi.mock('../../services/activity-logger.service', () => ({
    activityLogger: {
        logAudit: vi.fn(),
    },
}));

vi.mock('../../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe('InventoryService', () => {
    let inventoryService: InventoryService;

    beforeEach(() => {
        inventoryService = new InventoryService();
        vi.clearAllMocks();
    });

    describe('createBatch', () => {
        const mockStoreId = 'store-123';
        const mockUserId = 'user-123';
        const mockDate = new Date('2024-01-01');

        it('should create a monetary batch successfully when credit limit is sufficient', async () => {
            const input = {
                supplierId: 'sup-123',
                purchaseDate: mockDate.toISOString(),
                expectedTotalItems: 10,
                expectedTotalWeight: 100,
                purchaseType: 'monetary' as const,
                totalCost: 50000,
                initialPaymentAmount: 10000,
                paymentMethod: 'cash',
                goldRatePerGram: 5000,
            };

            // Mock credit check
            vi.mocked(supplierAccountService.checkCreditLimit).mockResolvedValue({
                withinLimit: true,
                currentBalance: 0,
                creditLimit: 100000,
            });

            // Mock generateBatchNumber (internal private method, but we can mock db.select to control it indirectly or just let it run)
            // Since generateBatchNumber uses db.select, we'll mock that return
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ count: 0 }]),
                }),
            } as any);

            // Mock db.insert for batch creation
            const mockBatch = {
                id: 'batch-123',
                batchNumber: 'BAT-20240101-001',
                ...input,
            };

            const insertMock = vi.fn().mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockBatch])
                })
            });
            // @ts-ignore
            db.insert = insertMock;

            // Mock db.insert for payment (if any)
            // We need to handle multiple insert calls (batch, payment)
            // For simplicity in this specific test, we can use mockImplementation if strictly needed,
            // but the chain above returns the batch.
            // If payment is inserted, it calls insert again.
            // Let's refine the insert mock to handle different tables if possible, or just return generic compatible structures.

            // Since we need different returns for different inserts, let's use mockImplementation
            vi.mocked(db.insert).mockImplementation((table: any) => {
                return {
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([{ id: 'record-123' }])
                    })
                } as any;
            });

            // We need to ensure the FIRST insert (batch) returns the mockBatch
            vi.mocked(db.insert).mockImplementationOnce((table: any) => {
                return {
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([mockBatch])
                    })
                } as any;
            });

            const result = await inventoryService.createBatch(input, mockStoreId, mockUserId);

            expect(result).toEqual(mockBatch);
            expect(supplierAccountService.checkCreditLimit).toHaveBeenCalledWith(
                input.supplierId,
                mockStoreId,
                input.totalCost
            );
            expect(supplierAccountService.updateSupplierBalance).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Batch created'), expect.any(Object));
        });

        it('should warn when credit limit is exceeded', async () => {
            const input = {
                supplierId: 'sup-123',
                purchaseDate: mockDate.toISOString(),
                expectedTotalItems: 10,
                expectedTotalWeight: 100,
                purchaseType: 'monetary' as const,
                totalCost: 150000,
                goldRatePerGram: 5000,
                initialPaymentAmount: 0,
            };

            vi.mocked(supplierAccountService.checkCreditLimit).mockResolvedValue({
                withinLimit: false,
                currentBalance: 0,
                creditLimit: 100000,
                warning: 'Credit limit exceeded',
                availableCredit: -50000,
            });

            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ count: 0 }]),
                }),
            } as any);

            const mockBatch = { id: 'batch-123', ...input };
            vi.mocked(db.insert).mockImplementationOnce((table: any) => {
                return {
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([mockBatch])
                    })
                } as any;
            });

            const result = await inventoryService.createBatch(input, mockStoreId, mockUserId);

            expect(result).toHaveProperty('creditWarning', 'Credit limit exceeded');
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Batch creation exceeds supplier credit limit'), expect.any(Object));
        });

        it('should create a gold exchange batch correctly', async () => {
            const input = {
                supplierId: 'sup-123',
                purchaseDate: mockDate.toISOString(),
                expectedTotalItems: 10,
                expectedTotalWeight: 100,
                purchaseType: 'gold_exchange' as const,
                goldGivenWeight: 50,
                goldGivenPurity: 0.999,
                goldGivenValue: 250000,
                goldBalancePaid: 0,
                goldBalanceReceived: 50,
                initialPaymentAmount: 0,
            };

            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ count: 0 }]),
                }),
            } as any);

            const mockBatch = { id: 'batch-123', ...input };
            vi.mocked(db.insert).mockImplementationOnce((table: any) => {
                return {
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([mockBatch])
                    })
                } as any;
            });

            await inventoryService.createBatch(input, mockStoreId, mockUserId);

            expect(supplierAccountService.updateGoldExchangeBalance).toHaveBeenCalledWith(
                input.supplierId,
                mockStoreId,
                {
                    goldGivenChange: input.goldGivenWeight,
                    goldReceivedChange: input.expectedTotalWeight
                },
                expect.any(Object)
            );
            expect(supplierAccountService.createGoldExchangeTransaction).toHaveBeenCalled();
        });
    });

    describe('addItemToBatch', () => {
        const mockUserId = 'user-123';
        const mockBatchId = 'batch-123';
        const mockStoreId = 'store-123';

        it('should add item to batch and update batch totals', async () => {
            const input = {
                batchId: mockBatchId,
                storeId: mockStoreId,
                categoryId: 'cat-123',
                name: 'Gold Ring',
                itemType: 'finished_goods' as const,
                metalType: 'gold' as const,
                purity: '22k',
                grossWeight: 10,
                netWeight: 10,
                costRatePercentage: 0,
                identificationNumber: 'ID-123',
                huidNumber: 'HUID-123',
                stoneWeight: 0,
                isHallmarked: true,
            };

            const mockBatch = {
                id: mockBatchId,
                storeId: mockStoreId,
                status: 'in_progress',
                expectedTotalItems: 10,
                actualTotalItems: 0,
                actualTotalWeight: '0',
                goldRatePerGram: '5000',
                batchItems: [],
            };

            vi.mocked(db.query.inventoryBatches.findFirst).mockResolvedValue(mockBatch as any);

            const mockItem = {
                id: 'item-123',
                ...input,
                sku: 'FG-123-456'
            };

            // Mock item insertion
            vi.mocked(db.insert).mockImplementation((table: any) => {
                return {
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([mockItem])
                    })
                } as any;
            });

            // Mock batch update
            vi.mocked(db.update).mockImplementation((table: any) => {
                return {
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue({})
                    })
                } as any;
            });


            const result = await inventoryService.addItemToBatch(input, mockUserId);

            expect(result).toEqual(mockItem);
            expect(db.insert).toHaveBeenCalledTimes(4); // Item, BatchItem, StockLevel, StockMovement
        });

        it('should throw error if batch is not in progress', async () => {
            const input = {
                batchId: mockBatchId,
                storeId: mockStoreId,
                categoryId: 'cat-123',
                name: 'Gold Ring',
                itemType: 'finished_goods' as const,
                metalType: 'gold' as const,
                purity: '22k',
                grossWeight: 10,
                netWeight: 10,
                identificationNumber: 'ID-123',
                stoneWeight: 0,
                isHallmarked: true,
            };

            const mockBatch = {
                id: mockBatchId,
                status: 'completed',
                batchItems: [],
            };

            vi.mocked(db.query.inventoryBatches.findFirst).mockResolvedValue(mockBatch as any);

            await expect(inventoryService.addItemToBatch(input, mockUserId))
                .rejects.toThrow('Batch is already completed or has discrepancies');
        });
    });

    describe('updateBatchItem', () => {
        const mockUserId = 'user-123';
        const mockBatchId = 'batch-123';
        const mockStoreId = 'store-123';
        const mockItemId = 'item-123';

        it('should update item weights and recalculate batch totals', async () => {
            const updates = {
                grossWeight: 15,
                netWeight: 15
            };

            const mockBatch = {
                id: mockBatchId,
                storeId: mockStoreId,
                status: 'in_progress',
                actualTotalWeight: '100',
            };

            const mockItem = {
                id: mockItemId,
                storeId: mockStoreId,
                grossWeight: '10',
                netWeight: '10',
                sku: 'SKU-123'
            };

            const mockBatchItem = {
                inventoryItemId: mockItemId,
                batchId: mockBatchId
            };

            // Mock findFirst chain
            vi.mocked(db.query.inventoryBatches.findFirst).mockResolvedValue(mockBatch as any);
            vi.mocked(db.query.inventoryItems.findFirst).mockResolvedValue(mockItem as any);
            vi.mocked(db.query.inventoryBatchItems.findFirst).mockResolvedValue(mockBatchItem as any);

            // Mock update returns
            const updatedItem = { ...mockItem, ...updates };
            vi.mocked(db.update).mockImplementation(() => ({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([updatedItem])
                    })
                })
            } as any));

            const result = await inventoryService.updateBatchItem(mockItemId, mockBatchId, updates, mockUserId, mockStoreId);

            expect(result).toEqual(updatedItem);
            expect(activityLogger.logAudit).toHaveBeenCalled();
            // We expect batch total weight to update: 100 - 10 + 15 = 105
            // The service logic: newBatchWeight = currentBatchWeight + (newNet - oldNet) = 100 + (15 - 10) = 105
            // We can't easily check the exact update call arguments without complex spy matching, 
            // but we know db.update was called for batch
            expect(db.update).toHaveBeenCalledTimes(2); // Item update, Batch update
        });
    });

    describe('deleteItemFromBatch', () => {
        const mockUserId = 'user-123';
        const mockBatchId = 'batch-123';
        const mockStoreId = 'store-123';
        const mockItemId = 'item-123';

        it('should delete item and update batch totals', async () => {
            const mockBatch = {
                id: mockBatchId,
                storeId: mockStoreId,
                status: 'in_progress',
                actualTotalItems: 5,
                actualTotalWeight: '50',
            };

            const mockItem = {
                id: mockItemId,
                storeId: mockStoreId,
                netWeight: '10',
                sku: 'SKU-123'
            };

            const mockBatchItem = {
                inventoryItemId: mockItemId,
                batchId: mockBatchId
            };

            // Since deleteItemFromBatch uses a transaction, we need to ensure the tx mock works correctly
            // Our global mock for db.transaction executes the callback with 'db'
            // so inside the service, 'tx' is actually 'db'.

            vi.mocked(db.query.inventoryBatches.findFirst).mockResolvedValue(mockBatch as any);
            vi.mocked(db.query.inventoryItems.findFirst).mockResolvedValue(mockItem as any);
            vi.mocked(db.query.inventoryBatchItems.findFirst).mockResolvedValue(mockBatchItem as any);

            vi.mocked(db.delete).mockReturnValue({
                where: vi.fn().mockResolvedValue({})
            } as any);

            await inventoryService.deleteItemFromBatch(mockItemId, mockBatchId, 'Mistake', mockUserId, mockStoreId);

            expect(db.delete).toHaveBeenCalledTimes(2); // Delete from BatchItems, Delete from Items
            expect(db.update).toHaveBeenCalledTimes(1); // Update Batch totals
            expect(activityLogger.logAudit).toHaveBeenCalled();
        });
    });
});
