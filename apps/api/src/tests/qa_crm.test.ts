import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { TestFactory } from './helpers/factories';
import { db } from '../config/database';
import { seedRoles } from '../scripts/seed-roles';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { customersService } from '../modules/customers/customers.service';
import { SuppliersService } from '../modules/suppliers/suppliers.service';

const suppliersService = new SuppliersService();

/**
 * AGENT 7: Customers, Leads & Suppliers CRM — QA Test Suite
 *
 * Tests customer lifecycle, loyalty points, supplier management,
 * and CRM-related functionality.
 */

describe('QA: CRM Module (Customers & Suppliers)', () => {
    let store: typeof schema.stores.$inferSelect;
    let userId: string;

    async function setupCRMEnvironment() {
        await seedRoles();
        store = await TestFactory.createStore();
        const role = await db.query.roles.findFirst({ where: eq(schema.roles.name, 'store_manager') });
        const user = await TestFactory.createUser({ email: `crm-mgr-${uuidv4()}@example.com` });
        await TestFactory.assignRole(user.id, role!.id, store.id);
        userId = user.id;
    }

    // ========================================================================
    // SECTION 1: CUSTOMER LIFECYCLE
    // ========================================================================
    describe('Customer Lifecycle', () => {
        it('[CRM-01] Create and retrieve customer', async () => {
            await setupCRMEnvironment();

            const customer = await customersService.createCustomer({
                firstName: 'Test',
                lastName: 'Customer',
                phone: `077${uuidv4().substring(0, 7)}`,
                email: `test-${uuidv4().substring(0, 6)}@example.com`,
            }, store.id);

            expect(customer).toBeDefined();
            expect(customer.id).toBeDefined();
            expect(customer.customerCode).toBeDefined();
            console.log(`[CRM-01] Customer created: ${customer.customerCode}`);

            const retrieved = await customersService.getCustomer(customer.id);
            expect(retrieved).toBeDefined();
            expect(retrieved.firstName).toBe('Test');
        });

        it('[CRM-02] Update customer details', async () => {
            await setupCRMEnvironment();

            const customer = await customersService.createCustomer({
                firstName: 'Original',
                lastName: 'Name',
                phone: `077${uuidv4().substring(0, 7)}`,
            }, store.id);

            const updated = await customersService.updateCustomer(customer.id, {
                firstName: 'Updated',
                lastName: 'Name',
            });

            expect(updated).toBeDefined();
            console.log(`[CRM-02] Customer updated`);
        });

        it('[CRM-03] List customers with search', async () => {
            await setupCRMEnvironment();

            await customersService.createCustomer({
                firstName: 'Searchable',
                lastName: 'Customer',
                phone: `077${uuidv4().substring(0, 7)}`,
            }, store.id);

            const all = await customersService.listCustomers(store.id);
            expect(all.length).toBeGreaterThan(0);

            const searched = await customersService.listCustomers(store.id, 'Searchable');
            expect(searched.length).toBeGreaterThanOrEqual(1);
            console.log(`[CRM-03] Search results: ${searched.length}`);
        });

        it('[CRM-04] Customer code auto-generation', async () => {
            await setupCRMEnvironment();

            const c1 = await customersService.createCustomer({
                firstName: 'Code',
                lastName: 'Test1',
                phone: `077${uuidv4().substring(0, 7)}`,
            }, store.id);

            const c2 = await customersService.createCustomer({
                firstName: 'Code',
                lastName: 'Test2',
                phone: `077${uuidv4().substring(0, 7)}`,
            }, store.id);

            expect(c1.customerCode).not.toBe(c2.customerCode);
            console.log(`[CRM-04] Customer codes: ${c1.customerCode}, ${c2.customerCode}`);
        });
    });

    // ========================================================================
    // SECTION 2: LOYALTY POINTS
    // ========================================================================
    describe('Loyalty Points', () => {
        it('[CRM-05] Add and retrieve loyalty points', async () => {
            await setupCRMEnvironment();

            const customer = await customersService.createCustomer({
                firstName: 'Loyalty',
                lastName: 'Test',
                phone: `077${uuidv4().substring(0, 7)}`,
            }, store.id);

            await customersService.addLoyaltyPoints(customer.id, {
                points: 100,
                type: 'earned',
                description: 'QA test points',
            }, userId);

            const transactions = await customersService.getLoyaltyTransactions(customer.id);
            expect(transactions.length).toBeGreaterThan(0);
            console.log(`[CRM-05] Loyalty transactions: ${transactions.length}`);
        });

        it('[CRM-06] Earn and redeem loyalty cycle', async () => {
            await setupCRMEnvironment();

            const customer = await customersService.createCustomer({
                firstName: 'LoyaltyCycle',
                lastName: 'Test',
                phone: `077${uuidv4().substring(0, 7)}`,
            }, store.id);

            // Earn points
            await customersService.addLoyaltyPoints(customer.id, {
                points: 500,
                type: 'earned',
                description: 'Purchase reward',
            }, userId);

            // Redeem points
            await customersService.addLoyaltyPoints(customer.id, {
                points: 200,
                type: 'redeemed',
                description: 'Points redeemed',
            }, userId);

            const updatedCustomer = await customersService.getCustomer(customer.id);
            console.log(`[CRM-06] Points balance: ${updatedCustomer.loyaltyPoints}`);
        });
    });

    // ========================================================================
    // SECTION 3: CUSTOMER STATS
    // ========================================================================
    describe('Customer Stats', () => {
        it('[CRM-07] Get customer stats for store', async () => {
            await setupCRMEnvironment();

            await customersService.createCustomer({
                firstName: 'Stats',
                lastName: 'Test',
                phone: `077${uuidv4().substring(0, 7)}`,
            }, store.id);

            const stats = await customersService.getCustomerStats(store.id);
            expect(stats).toBeDefined();
            console.log(`[CRM-07] Customer stats:`, stats);
        });
    });

    // ========================================================================
    // SECTION 4: SUPPLIERS
    // ========================================================================
    describe('Suppliers', () => {
        it('[CRM-08] Create and list suppliers', async () => {
            await setupCRMEnvironment();

            const supplier = await suppliersService.createSupplier({
                businessName: `QA Supplier ${uuidv4().substring(0, 6)}`,
                phone: `077${uuidv4().substring(0, 7)}`,
                supplierType: 'gold_supplier',
                address: '123 QA Street',
            } as any, store.id);

            expect(supplier).toBeDefined();
            console.log(`[CRM-08] Supplier created: ${supplier.id}`);

            const result = await suppliersService.listSuppliers(store.id, {});
            expect(result.data.length).toBeGreaterThan(0);
        });

        it('[CRM-09] Update supplier', async () => {
            await setupCRMEnvironment();

            const supplier = await suppliersService.createSupplier({
                businessName: `Original Supplier ${uuidv4().substring(0, 6)}`,
                phone: `077${uuidv4().substring(0, 7)}`,
                supplierType: 'gold_supplier',
            } as any, store.id);

            const updated = await suppliersService.updateSupplier(supplier.id, store.id, {
                businessName: 'Updated Supplier',
            } as any);

            expect(updated).toBeDefined();
            console.log(`[CRM-09] Supplier updated`);
        });
    });
});
