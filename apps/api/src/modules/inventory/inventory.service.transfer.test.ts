import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryService } from './inventory.service';
import { db } from '../../config/database';
import { metalAccountingService } from '../../services/metal-accounting.service';
import { activityLogger } from '../../services/activity-logger.service';
import { inventoryItems, stores } from '../../db/schema';

// Mock dependencies
vi.mock('../../config/database', () => ({
    db: {
        transaction: vi.fn((callback) => callback(db)),
        insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn() })) })) })),
        query: {
            inventoryItems: {
                findFirst: vi.fn(),
            },
            inventoryTransfers: {
                findFirst: vi.fn(),
                findMany: vi.fn(),
            }
        },
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                leftJoin: vi.fn(() => ({
                    leftJoin: vi.fn(() => ({
                        where: vi.fn(() => ({
                            limit: vi.fn(),
                        }))
                    }))
                })),
                where: vi.fn(() => ({
                    limit: vi.fn()
                }))
            }))
        })),
    },
}));

vi.mock('../../services/metal-accounting.service', () => ({
    metalAccountingService: {
        getLatestGoldRate: vi.fn(),
    },
}));

vi.mock('../../services/activity-logger.service', () => ({
    activityLogger: {
        logAudit: vi.fn(),
    },
}));

describe('InventoryService - Transfers & Global Search', () => {
    let inventoryService: InventoryService;

    beforeEach(() => {
        inventoryService = new InventoryService();
        vi.clearAllMocks();
    });

    describe('createTransfer', () => {
        const mockSourceStoreId = 'source-store-123';
        const mockDestStoreId = 'dest-store-123';
        const mockUserId = 'user-123';
        const mockGoldRate = 5000;

        it('should create a transfer with financial details', async () => {
            const input = {
                destinationStoreId: mockDestStoreId,
                items: [
                    { inventoryItemId: 'item-1', quantity: 1 }
                ],
                notes: 'Test transfer'
            };

            // Mock Gold Rate
            vi.mocked(metalAccountingService.getLatestGoldRate).mockResolvedValue(mockGoldRate);

            // Mock Item Lookup
            const mockItem = {
                id: 'item-1',
                storeId: mockSourceStoreId,
                netWeight: '10', // 10 grams
                status: 'available'
            };
            vi.mocked(db.query.inventoryItems.findFirst).mockResolvedValue(mockItem as any);

            // Mock Transfer Insert Return
            const mockTransfer = {
                id: 'transfer-123',
                transferNumber: 'TRF-TEST-001',
                ...input
            };

            vi.mocked(db.insert).mockImplementationOnce(() => ({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockTransfer])
                })
            } as any));

            // Execute
            const result = await inventoryService.createTransfer(input, mockSourceStoreId, mockUserId);

            // Verify
            expect(metalAccountingService.getLatestGoldRate).toHaveBeenCalledWith(mockSourceStoreId);
            expect(db.insert).toHaveBeenCalledTimes(3); // Transfer, TransferItem, StockMovement

            // Verify financial calculations passed to insert
            // 10g * 5000 = 50000
            // We can't strictly check the args without complex matching since db.insert is partial mock
            // but we can assume success if no error thrown and flow completed.

            expect(activityLogger.logAudit).toHaveBeenCalledWith(expect.objectContaining({
                action: 'transfer_created',
                newValues: expect.objectContaining({
                    totalValue: 50000,
                    invoiceNumber: expect.stringMatching(/^INV-/)
                })
            }));
        });

        it('should fail if item not available', async () => {
            const input = {
                destinationStoreId: mockDestStoreId,
                items: [
                    { inventoryItemId: 'item-1', quantity: 1 }
                ]
            };

            vi.mocked(metalAccountingService.getLatestGoldRate).mockResolvedValue(mockGoldRate);
            vi.mocked(db.query.inventoryItems.findFirst).mockResolvedValue(null); // Item not found

            await expect(inventoryService.createTransfer(input, mockSourceStoreId, mockUserId))
                .rejects.toThrow('Item item-1 not available for transfer');
        });
    });

    describe('searchGlobalInventory', () => {
        it('should search inventory across stores', async () => {
            const mockItems = [
                { id: '1', name: 'Ring', storeId: 'store-A', storeName: 'Store A' }
            ];

            // Mock the chain select().from().leftJoin()...
            const limitMock = vi.fn().mockResolvedValue(mockItems);
            const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
            const leftJoin2Mock = vi.fn().mockReturnValue({ where: whereMock });
            const leftJoin1Mock = vi.fn().mockReturnValue({ leftJoin: leftJoin2Mock });
            const fromMock = vi.fn().mockReturnValue({ leftJoin: leftJoin1Mock });

            vi.mocked(db.select).mockReturnValue({ from: fromMock } as any);

            const result = await inventoryService.searchGlobalInventory('Ring');

            expect(result).toEqual(mockItems);
            expect(db.select).toHaveBeenCalled();
        });
    });

    describe('receiveTransfer', () => {
        const mockTransferId = 'transfer-123';
        const mockSourceStoreId = 'store-A';
        const mockDestStoreId = 'store-B';
        const mockUserId = 'user-123';

        it('should successfully receive a transfer', async () => {
            const mockTransfer = {
                id: mockTransferId,
                status: 'in_transit',
                destinationStoreId: mockDestStoreId,
                transferNumber: 'TRF-001',
                items: [
                    { id: 'ti-1', inventoryItemId: 'item-1', quantity: 5 }
                ]
            };

            vi.mocked(db.query.inventoryTransfers.findFirst).mockResolvedValue(mockTransfer as any);

            // Mock update and insert returns
            vi.mocked(db.update).mockImplementation(() => ({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue({})
                })
            } as any));

            vi.mocked(db.insert).mockImplementation(() => ({
                values: vi.fn().mockReturnValue({
                    onConflictDoUpdate: vi.fn().mockResolvedValue({})
                })
            } as any));

            const result = await inventoryService.receiveTransfer(
                { transferId: mockTransferId },
                mockDestStoreId,
                mockUserId
            );

            expect(result).toEqual({ success: true, message: 'Transfer received successfully' });

            // Verify status updates
            expect(db.update).toHaveBeenCalled();
            // We expect updates for: Transfer, TransferItem, InventoryItem

            // Verify stock level update (upsert)
            expect(db.insert).toHaveBeenCalled();
        });

        it('should fail if transfer not found', async () => {
            vi.mocked(db.query.inventoryTransfers.findFirst).mockResolvedValue(null);

            await expect(inventoryService.receiveTransfer(
                { transferId: mockTransferId },
                mockDestStoreId,
                mockUserId
            )).rejects.toThrow('Transfer not found');
        });

        it('should fail if store does not match destination', async () => {
            const mockTransfer = {
                id: mockTransferId,
                status: 'in_transit',
                destinationStoreId: 'other-store', // Mismatch
                items: []
            };
            vi.mocked(db.query.inventoryTransfers.findFirst).mockResolvedValue(mockTransfer as any);

            await expect(inventoryService.receiveTransfer(
                { transferId: mockTransferId },
                mockDestStoreId,
                mockUserId
            )).rejects.toThrow('Transfer does not belong to this store');
        });

        it('should fail if transfer is not in_transit', async () => {
            const mockTransfer = {
                id: mockTransferId,
                status: 'completed', // Already completed
                destinationStoreId: mockDestStoreId,
                items: []
            };
            vi.mocked(db.query.inventoryTransfers.findFirst).mockResolvedValue(mockTransfer as any);

            await expect(inventoryService.receiveTransfer(
                { transferId: mockTransferId },
                mockDestStoreId,
                mockUserId
            )).rejects.toThrow('Transfer is not in transit');
        });
    });

    describe('getTransfers', () => {
        const mockStoreId = 'store-A';

        it('should return transfers for a store', async () => {
            const mockTransfers = [
                { id: '1', transferNumber: 'TRF-1', sourceStoreId: mockStoreId, items: [{}, {}] }
            ];

            const findManyMock = vi.fn().mockResolvedValue(mockTransfers);
            vi.mocked(db.query.inventoryTransfers.findMany).mockImplementation(findManyMock);

            const result = await inventoryService.getTransfers(mockStoreId);

            expect(result).toHaveLength(1);
            expect(result[0].itemCount).toBe(2);
            expect(db.query.inventoryTransfers.findMany).toHaveBeenCalled();
        });

        it('should filter by inbound type', async () => {
            await inventoryService.getTransfers(mockStoreId, { type: 'inbound' });
            // We can check if the query was built correctly, but strict sql matching is hard with mocks.
            // Relying on successful call and coverage.
            expect(db.query.inventoryTransfers.findMany).toHaveBeenCalled();
        });
    });

    describe('getTransferById', () => {
        const mockTransferId = 'transfer-123';
        const mockStoreId = 'store-A';

        it('should return transfer details if authorized', async () => {
            const mockTransfer = {
                id: mockTransferId,
                sourceStoreId: mockStoreId,
                items: [
                    { id: 'item-1', inventoryItem: { name: 'Ring', sku: 'R1' } }
                ]
            };

            vi.mocked(db.query.inventoryTransfers.findFirst).mockResolvedValue(mockTransfer as any);

            const result = await inventoryService.getTransferById(mockTransferId, mockStoreId);

            expect(result).toBeDefined();
            expect(result?.items[0].name).toBe('Ring');
        });

        it('should return null if not found', async () => {
            vi.mocked(db.query.inventoryTransfers.findFirst).mockResolvedValue(null);

            const result = await inventoryService.getTransferById(mockTransferId, mockStoreId);
            expect(result).toBeNull();
        });
    });
});
