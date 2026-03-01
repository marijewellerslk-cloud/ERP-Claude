import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore, updateStore, deleteStore, getAllStores, getStoreById, getStoreHierarchy } from './stores.service.js';
import { db } from '../../config/database.js';

// Mock dependencies
vi.mock('../../config/database.js', () => ({
    db: {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(), orderBy: vi.fn() })) })),
        insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn() })) })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        query: {
            roles: { findFirst: vi.fn() },
            users: { findFirst: vi.fn() },
            userRoles: { findFirst: vi.fn() },
        },
    },
}));

vi.mock('../../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe('StoresService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createStore', () => {
        it('should create a store with valid data', async () => {
            const input = {
                name: 'Main Store',
                code: 'MAIN',
                address: '123 Main St',
                phone: '+1234567890',
                email: 'main@example.com',
            };

            const mockStore = {
                id: 'store-123',
                ...input,
            };

            // Mock code uniqueness check
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([]) // No existing store
                })
            } as any);

            // Mock insert
            vi.mocked(db.insert).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockStore])
                })
            } as any);

            const result = await createStore(input);

            expect(result).toEqual(mockStore);
            expect(db.insert).toHaveBeenCalled();
        });

        it('should throw error if store code already exists', async () => {
            const input = {
                name: 'Branch Store',
                code: 'MAIN', // Duplicate
                address: '456 Branch St',
            };

            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ id: 'existing-store', code: 'MAIN' }])
                })
            } as any);

            await expect(createStore(input)).rejects.toThrow('A store with this code already exists');
        });

        it('should assign manager when managerId is provided', async () => {
            const input = {
                name: 'Branch Store',
                code: 'BRANCH',
                managerId: 'user-123',
            };

            const mockStore = {
                id: 'store-123',
                ...input,
            };

            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([])
                })
            } as any);

            vi.mocked(db.query.users.findFirst).mockResolvedValue({ id: 'user-123' } as any);
            vi.mocked(db.query.roles.findFirst).mockResolvedValue({ id: 'role-123', name: 'store_manager' } as any);

            vi.mocked(db.insert).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockStore])
                })
            } as any);

            vi.mocked(db.delete).mockReturnValue({
                where: vi.fn().mockResolvedValue({})
            } as any);

            await createStore(input);

            // Expect 2 inserts: store + userRole
            expect(db.insert).toHaveBeenCalledTimes(2);
        });
    });

    describe('updateStore', () => {
        it('should update store successfully', async () => {
            const updates = {
                name: 'Updated Store Name',
                address: 'New Address',
            };

            const mockExisting = {
                id: 'store-123',
                code: 'MAIN',
                name: 'Old Name',
            };

            const mockUpdated = {
                ...mockExisting,
                ...updates,
            };

            // Mock getStoreById
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([mockExisting])
                })
            } as any);

            vi.mocked(db.query.roles.findFirst).mockResolvedValue({ id: 'role-123', name: 'store_manager' } as any);
            vi.mocked(db.query.userRoles.findFirst).mockResolvedValue(null as any);

            vi.mocked(db.update).mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([mockUpdated])
                    })
                })
            } as any);

            const result = await updateStore('store-123', updates);

            expect(result).toEqual(mockUpdated);
        });

        it('should throw error if store not found', async () => {
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([])
                })
            } as any);

            await expect(updateStore('non-existent', { name: 'Test' }))
                .rejects.toThrow('Store not found');
        });
    });

    describe('deleteStore', () => {
        it('should soft delete store by setting isActive to false', async () => {
            const mockStore = {
                id: 'store-123',
                name: 'Store to Delete',
                isActive: true,
            };

            // Mock getStoreById
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValueOnce([mockStore]) // For getStoreById
                        .mockResolvedValueOnce([]) // For child stores check
                })
            } as any);

            vi.mocked(db.query.roles.findFirst).mockResolvedValue({ id: 'role-123' } as any);
            vi.mocked(db.query.userRoles.findFirst).mockResolvedValue(null as any);

            vi.mocked(db.update).mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([{ ...mockStore, isActive: false }])
                    })
                })
            } as any);

            const result = await deleteStore('store-123');

            expect(result.isActive).toBe(false);
            expect(db.update).toHaveBeenCalled();
        });

        it('should throw error if store has child stores', async () => {
            const mockStore = {
                id: 'store-123',
                name: 'Parent Store',
            };

            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValueOnce([mockStore]) // For getStoreById
                        .mockResolvedValueOnce([{ id: 'child-store' }]) // For child stores check
                })
            } as any);

            vi.mocked(db.query.roles.findFirst).mockResolvedValue({ id: 'role-123' } as any);
            vi.mocked(db.query.userRoles.findFirst).mockResolvedValue(null as any);

            await expect(deleteStore('store-123'))
                .rejects.toThrow('Cannot delete store with child stores');
        });
    });

    describe('getStoreHierarchy', () => {
        it('should build hierarchical tree structure', async () => {
            const mockStores = [
                { id: 'store-1', name: 'HQ', parentStoreId: null },
                { id: 'store-2', name: 'Branch A', parentStoreId: 'store-1' },
                { id: 'store-3', name: 'Branch B', parentStoreId: 'store-1' },
            ];

            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockResolvedValue(mockStores)
                })
            } as any);

            const result = await getStoreHierarchy();

            expect(result).toHaveLength(1); // One root store
            expect(result[0].id).toBe('store-1');
            expect(result[0].children).toHaveLength(2); // Two child stores
        });
    });
});
