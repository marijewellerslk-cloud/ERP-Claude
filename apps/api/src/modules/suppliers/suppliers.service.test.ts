import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SuppliersService } from './suppliers.service.js';
import { db } from '../../config/database.js';

// Mock dependencies
vi.mock('../../config/database.js', () => ({
    db: {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(), orderBy: vi.fn() })) })),
        insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn() })) })) })),
        query: {},
    },
}));

vi.mock('../../services/supplier-account.service.js', () => ({
    supplierAccountService: {
        getAccountTransactions: vi.fn(),
        getUnifiedLedger: vi.fn(),
    },
}));

describe('SuppliersService', () => {
    let service: SuppliersService;

    beforeEach(() => {
        service = new SuppliersService();
        vi.clearAllMocks();
    });

    describe('generateSupplierCode', () => {
        it('should generate first code as SUP-00001', async () => {
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            } as any);

            const code = await service.generateSupplierCode('store-123');
            expect(code).toBe('SUP-00001');
        });

        it('should increment code correctly', async () => {
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([{ supplierCode: 'SUP-00005' }])
                        })
                    })
                })
            } as any);

            const code = await service.generateSupplierCode('store-123');
            expect(code).toBe('SUP-00006');
        });
    });

    describe('createSupplier', () => {
        it('should create supplier with generated code', async () => {
            const input = {
                businessName: 'Gold Suppliers Ltd',
                contactPersonName: 'John Smith',
                phone: '+1234567890',
                email: 'john@goldsuppliers.com',
                supplierType: 'wholesaler' as const,
            };

            const mockSupplier = {
                id: 'sup-123',
                supplierCode: 'SUP-00001',
                ...input,
            };

            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            } as any);

            vi.mocked(db.insert).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockSupplier])
                })
            } as any);

            const result = await service.createSupplier(input, 'store-123');

            expect(result).toEqual(mockSupplier);
            expect(result.supplierCode).toBe('SUP-00001');
        });
    });

    describe('updateSupplier', () => {
        it('should update supplier fields', async () => {
            const updates = {
                businessName: 'Updated Name',
                creditLimit: 100000,
            };

            const mockUpdated = {
                id: 'sup-123',
                ...updates,
            };

            vi.mocked(db.update).mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([mockUpdated])
                    })
                })
            } as any);

            const result = await service.updateSupplier('sup-123', 'store-123', updates);

            expect(result).toEqual(mockUpdated);
        });
    });

    describe('deleteSupplier', () => {
        it('should soft delete supplier', async () => {
            const mockSupplier = {
                id: 'sup-123',
                deletedAt: new Date(),
            };

            // Mock batch count check
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ count: 0 }])
                })
            } as any);

            vi.mocked(db.update).mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([mockSupplier])
                    })
                })
            } as any);

            const result = await service.deleteSupplier('sup-123', 'store-123');

            expect(result.deletedAt).toBeDefined();
        });

        it('should throw error if supplier has batches', async () => {
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ count: 5 }])
                })
            } as any);

            await expect(service.deleteSupplier('sup-123', 'store-123'))
                .rejects.toThrow('Cannot delete supplier with existing purchase batches');
        });
    });

    describe('getSupplierStats', () => {
        it('should return supplier statistics', async () => {
            const mockSupplier = {
                id: 'sup-123',
                currentBalance: '50000',
                totalLifetimePurchases: '500000',
                creditLimit: '100000',
                accountStatus: 'active',
            };

            vi.mocked(db.select).mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([mockSupplier])
                })
            } as any);

            vi.mocked(db.select).mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{
                        totalBatches: 10,
                        completedBatches: 8,
                        activeBatches: 2,
                        totalWeight: '500',
                    }])
                })
            } as any);

            const result = await service.getSupplierStats('sup-123', 'store-123');

            expect(result.supplier).toEqual(mockSupplier);
            expect(result.statistics.currentBalance).toBe(50000);
            expect(result.statistics.totalBatches).toBe(10);
        });
    });

    describe('listSuppliers', () => {
        it('should return paginated supplier list', async () => {
            const mockSuppliers = [
                { id: 'sup-1', businessName: 'Supplier 1' },
                { id: 'sup-2', businessName: 'Supplier 2' },
            ];

            vi.mocked(db.select).mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                offset: vi.fn().mockResolvedValue(mockSuppliers)
                            })
                        })
                    })
                })
            } as any);

            vi.mocked(db.select).mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ count: 2 }])
                })
            } as any);

            const result = await service.listSuppliers('store-123', { page: 1, limit: 50 });

            expect(result.data).toEqual(mockSuppliers);
            expect(result.pagination.total).toBe(2);
        });
    });
});
