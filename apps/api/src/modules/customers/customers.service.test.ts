import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomersService } from './customers.service.js';
import { db } from '../../config/database.js';
import { customers, loyaltyTransactions } from '../../db/schema.js';

// Mock the database
vi.mock('../../config/database.js', () => ({
    db: {
        transaction: vi.fn((callback) => callback(db)),
        insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn() })) })) })),
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn() })) })),
        query: {},
    },
}));

describe('CustomersService', () => {
    let service: CustomersService;

    beforeEach(() => {
        service = new CustomersService();
        vi.clearAllMocks();
    });

    describe('generateCustomerCode', () => {
        it('should generate first customer code as CUST-00001', async () => {
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            } as any);

            const code = await service.generateCustomerCode('store-123');
            expect(code).toBe('CUST-00001');
        });

        it('should increment customer code correctly', async () => {
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([{ customerCode: 'CUST-00005' }])
                        })
                    })
                })
            } as any);

            const code = await service.generateCustomerCode('store-123');
            expect(code).toBe('CUST-00006');
        });
    });

    describe('createCustomer', () => {
        it('should create a customer with generated code', async () => {
            const input = {
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                phone: '+1234567890',
            };

            const mockCustomer = {
                id: 'cust-123',
                customerCode: 'CUST-00001',
                ...input,
            };

            // Mock customer code generation
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            } as any);

            // Mock insert
            vi.mocked(db.insert).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockCustomer])
                })
            } as any);

            const result = await service.createCustomer(input, 'store-123');

            expect(result).toEqual(mockCustomer);
            expect(db.insert).toHaveBeenCalled();
        });

        it('should create customer with addresses', async () => {
            const input = {
                firstName: 'Jane',
                lastName: 'Smith',
                email: 'jane@example.com',
                phone: '+1234567890',
                addresses: [
                    {
                        type: 'home' as const,
                        addressLine: '123 Main St',
                        city: 'Colombo',
                        state: 'Western',
                        pincode: '10100',
                        isDefault: true,
                    },
                ],
            };

            const mockCustomer = {
                id: 'cust-123',
                customerCode: 'CUST-00001',
                firstName: input.firstName,
                lastName: input.lastName,
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
                    returning: vi.fn().mockResolvedValue([mockCustomer])
                })
            } as any);

            await service.createCustomer(input, 'store-123');

            // Expect 2 inserts: customer + addresses
            expect(db.insert).toHaveBeenCalledTimes(2);
        });
    });

    describe('addLoyaltyPoints', () => {
        it('should add loyalty points and update customer', async () => {
            const customerId = 'cust-123';
            const input = {
                points: 100,
                type: 'earn' as const,
                notes: 'Purchase reward',
            };

            const mockTransaction = {
                id: 'trans-123',
                customerId,
                points: 100,
            };

            const mockCustomer = {
                id: customerId,
                tier: 'bronze',
                loyaltyPoints: 1500,
            };

            vi.mocked(db.insert).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockTransaction])
                })
            } as any);

            vi.mocked(db.update).mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue({})
                })
            } as any);

            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([mockCustomer])
                    })
                })
            } as any);

            const result = await service.addLoyaltyPoints(customerId, input, 'user-123');

            expect(result).toEqual(mockTransaction);
            expect(db.insert).toHaveBeenCalled();
            expect(db.update).toHaveBeenCalled();
        });

        it('should upgrade tier when points threshold is reached', async () => {
            const customerId = 'cust-123';
            const input = {
                points: 1000,
                type: 'earn' as const,
            };

            const mockCustomer = {
                id: customerId,
                tier: 'bronze',
                loyaltyPoints: 1500, // After adding 1000, total will be 2500 -> silver tier
            };

            vi.mocked(db.insert).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([{ id: 'trans-123' }])
                })
            } as any);

            vi.mocked(db.update).mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue({})
                })
            } as any);

            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([mockCustomer])
                    })
                })
            } as any);

            await service.addLoyaltyPoints(customerId, input, 'user-123');

            // Expect 2 updates: points update + tier upgrade
            expect(db.update).toHaveBeenCalledTimes(2);
        });
    });

    describe('updateCustomer', () => {
        it('should update customer fields', async () => {
            const customerId = 'cust-123';
            const updates = {
                firstName: 'Updated',
                email: 'updated@example.com',
            };

            const mockUpdatedCustomer = {
                id: customerId,
                ...updates,
            };

            vi.mocked(db.update).mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([mockUpdatedCustomer])
                    })
                })
            } as any);

            const result = await service.updateCustomer(customerId, updates);

            expect(result).toEqual(mockUpdatedCustomer);
            expect(db.update).toHaveBeenCalled();
        });

        it('should throw error if customer not found', async () => {
            vi.mocked(db.update).mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([])
                    })
                })
            } as any);

            await expect(service.updateCustomer('non-existent', { firstName: 'Test' }))
                .rejects.toThrow('Customer not found');
        });
    });
});
