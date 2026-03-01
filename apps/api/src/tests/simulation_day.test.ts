import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { db } from '../config/database';
import { resetDb } from './helpers/reset-db';
import { TestFactory } from './helpers/factories';
import { seedRoles } from '../scripts/seed-roles';
import * as schema from '../db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { inventoryService } from '../modules/inventory/inventory.service';
import { salesService } from '../modules/sales/sales.service';
import { authService } from '../modules/auth/auth.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * ERP SIMULATION: A DAY IN THE LIFE
 * 
 * This test file simulates a full day of operations across 2 shops with 12 employees.
 * It serves as a comprehensive integration test and a way to identify gaps.
 */

describe('ERP Simulation: Day in the Life', () => {
    // Context for the simulation
    let shop1: typeof schema.stores.$inferSelect;
    let shop2: typeof schema.stores.$inferSelect;
    let superadminToken: string;
    let superadminId: string;

    // Employees Shop 1
    let s1_manager: any;
    let s1_sales1: any;
    let s1_sales2: any;
    let s1_cashier: any;
    let s1_inventory: any;
    let s1_artisan: any;

    // Employees Shop 2
    let s2_manager: any;
    let s2_sales1: any;
    let s2_sales2: any;
    let s2_cashier: any;
    let s2_inventory: any;
    let s2_artisan: any;

    beforeAll(async () => {
        try {
            console.log('[Test Setup] Resetting Database...');
            await resetDb();

            console.log('[Test Setup] Seeding Roles...');
            await seedRoles();

            // Manual check/seed fallback
            const check = await db.query.roles.findFirst({ where: eq(schema.roles.name, 'shop_manager') });
            if (!check) {
                console.warn('[Test Setup] shop_manager missing after seed. Manually inserting basic roles...');
                await db.insert(schema.roles).values([
                    { name: 'superadmin', description: 'Super Admin' },
                    { name: 'shop_manager', description: 'Shop Manager' },
                    { name: 'sales_agent', description: 'Sales Agent' },
                    { name: 'accountant', description: 'Accountant' },
                    { name: 'stock_controller', description: 'Stock Controller' }
                ]);
            }

            const rolesCount = await db.select({ count: sql<number>`count(*)` }).from(schema.roles);
            console.log(`[Test Setup] Roles count after seed: ${rolesCount[0].count}`);

            const rolesList = await db.query.roles.findMany();
            console.log('[Test Setup] Roles available:', rolesList.map(r => r.name).join(', '));
        } catch (error) {
            console.error('[Test Setup] Critical Error:', error);
            throw error;
        }
    });

    afterAll(async () => {
        // cleanup if needed
    });

    // ============================================================================
    // FULL DAY SIMULATION
    // ============================================================================

    it('Executes Full Day Scenario', async () => {
        // --- 0. PRE-SETUP ---
        // Since global beforeEach resets DB, we must seed roles here
        console.log('[Test] Seeding Roles locally...');
        await seedRoles();

        // Manual fallback just in case
        const check = await db.query.roles.findFirst({ where: eq(schema.roles.name, 'shop_manager') });
        if (!check) {
            console.warn('[Test Setup] shop_manager missing after seed. Manually inserting basic roles...');
            await db.insert(schema.roles).values([
                { name: 'superadmin', description: 'Super Admin' },
                { name: 'shop_manager', description: 'Shop Manager' },
                { name: 'sales_agent', description: 'Sales Agent' },
                { name: 'accountant', description: 'Accountant' },
                { name: 'stock_controller', description: 'Stock Controller' }
            ]);
        }

        const rolesCount = await db.select({ count: sql<number>`count(*)` }).from(schema.roles);
        console.log(`[Test Setup] Roles count after seed: ${rolesCount[0].count}`);

        const rolesList = await db.query.roles.findMany();
        console.log('[Test Setup] Roles available:', rolesList.map(r => r.name).join(', '));

        // --- 1. SETUP INFRASTRUCTURE ---
        console.log('\n--- SETUP PHASE ---');

        // 1. Create Shops
        shop1 = await TestFactory.createStore({
            name: 'Mari Jewellers - Main',
            code: 'MJ-MAIN',
            address: '123 Gold Street, Main Market'
        });
        console.log(`Created Shop 1: ${shop1.name}`);

        shop2 = await TestFactory.createStore({
            name: 'Mari Jewellers - City',
            code: 'MJ-CITY',
            address: '456 Silver Road, City Mall'
        });
        console.log(`Created Shop 2: ${shop2.name}`);

        // 2. Create Superadmin
        superadminId = uuidv4();
        const superadmin = await TestFactory.createUser({
            email: 'admin@marijewellers.com',
            fullName: 'Super Admin',
            id: superadminId
        });
        // Assign superadmin role (assuming it acts global or per store - usually global but for ERP needs per store often)
        const superadminRole = await db.query.roles.findFirst({ where: eq(schema.roles.name, 'superadmin') });
        if (superadminRole) {
            await TestFactory.assignRole(superadmin.id, superadminRole.id, shop1.id);
            await TestFactory.assignRole(superadmin.id, superadminRole.id, shop2.id);
        }
        superadminToken = TestFactory.generateToken(superadmin);


        // 3. Hire Employees for Shop 1
        console.log('Hiring employees for Shop 1...');
        s1_manager = await hireEmployee(shop1.id, 'Manager One', 'shop_manager');
        s1_sales1 = await hireEmployee(shop1.id, 'Sales One A', 'sales_agent');
        s1_sales2 = await hireEmployee(shop1.id, 'Sales One B', 'sales_agent');
        s1_cashier = await hireEmployee(shop1.id, 'Cashier One', 'accountant'); // Mapping cashier to accountant if cashier role missing
        s1_inventory = await hireEmployee(shop1.id, 'Stock One', 'stock_controller');
        s1_artisan = await hireEmployee(shop1.id, 'Artisan One', 'sales_agent'); // Helper/Artisan fallback

        // 4. Hire Employees for Shop 2
        console.log('Hiring employees for Shop 2...');
        s2_manager = await hireEmployee(shop2.id, 'Manager Two', 'shop_manager');
        s2_sales1 = await hireEmployee(shop2.id, 'Sales Two A', 'sales_agent');
        s2_sales2 = await hireEmployee(shop2.id, 'Sales Two B', 'sales_agent');
        s2_cashier = await hireEmployee(shop2.id, 'Cashier Two', 'accountant');
        s2_inventory = await hireEmployee(shop2.id, 'Stock Two', 'stock_controller');
        s2_artisan = await hireEmployee(shop2.id, 'Artisan Two', 'sales_agent');

        expect(shop1).toBeDefined();
        expect(shop2).toBeDefined();
        expect(s1_manager.user).toBeDefined();

        // --- 2. MORNING OPERATIONS ---
        console.log('\n--- MORNING PHASE ---');

        // 1. Set Gold Rate (Superadmin)
        const rateInput = {
            goldType: 'gold',
            purity: '22K',
            ratePerGram: 6500
        };
        await salesService.updateGoldRate(rateInput, superadminId);
        console.log(`Set Gold Rate: ${rateInput.ratePerGram}/g`);

        const rate = await salesService.getCurrentGoldRate('gold', '22K');
        expect(parseFloat(rate.ratePerGram)).toBe(6500);

        // 2. Receive Stock in Shop 1 (Inventory Manager)
        // Creating a batch of Gold Rings
        const batchInput = {
            supplierId: undefined, // Self purchase or generic
            purchaseDate: new Date().toISOString(), // Needs string per type error
            expectedTotalItems: 10,
            expectedTotalWeight: 100, // 100g total
            purchaseType: 'monetary' as const,
            totalCost: 600000,
            goldRatePerGram: 6000,
            initialPaymentAmount: 0,
            notes: 'Morning Stock Arrival'
        };

        // Use s1_inventory user ID
        // Fix TS error: createBatch expects specific input type
        // We cast as any to bypass strict check if needed or match exact type
        const batch = await inventoryService.createBatch(batchInput as any, shop1.id, s1_inventory.user.id);
        console.log(`Created Batch ${batch.batchNumber} in Shop 1`);

        // Add 2 items to the batch
        await inventoryService.addItemToBatch({
            batchId: batch.id,
            name: 'Gold Ring Design A',
            itemType: 'finished_goods',
            metalType: 'gold',
            purity: '22K',
            grossWeight: 10,
            netWeight: 10,
            stoneWeight: 0,
            isHallmarked: true,
            categoryId: undefined,
            makingCharges: 500,
            wastagePercentage: 10,
            location: 'Counter 1'
        }, s1_inventory.user.id);

        await inventoryService.addItemToBatch({
            batchId: batch.id,
            name: 'Gold Chain Design B',
            itemType: 'finished_goods',
            metalType: 'gold',
            purity: '22K',
            grossWeight: 15,
            netWeight: 15,
            stoneWeight: 0,
            isHallmarked: false,
            categoryId: undefined,
            location: 'Counter 2'
        }, s1_inventory.user.id);

        console.log('Added 2 items to inventory in Shop 1');

        // --- 3. MID-DAY OPERATIONS ---
        console.log('\n--- MID-DAY PHASE ---');

        // 1. Walk-in Customer Sale (Sales Exec -> Cashier)
        // Verify we can list items
        const items = await db.query.inventoryItems.findMany({ where: eq(schema.inventoryItems.storeId, shop1.id) });
        expect(items.length).toBeGreaterThan(0);
        const itemToSell = items[0];

        // Create Invoice
        const invoiceInput = {
            customerId: undefined, // Guest
            items: [{
                inventoryItemId: itemToSell.id,
                quantity: 1,
                unitPrice: 75000, // Rough calculation
                makingCharges: 1000,
                wastageCharges: 500,
                discount: 0,
                taxRate: 3,
                itemDescription: itemToSell.name
            }],
            discountAmount: 0,
            taxAmount: 2250
        };

        const invoice = await salesService.createInvoice(invoiceInput, shop1.id, s1_sales1.user.id);
        console.log(`Created Invoice ${invoice.invoiceNumber} for ${itemToSell.name}`);
        expect(invoice).toBeDefined();

        // 2. Payment (Cashier)
        await salesService.addPayment(invoice.id, {
            paymentMethod: 'cash',
            amount: parseFloat(invoice.finalAmount),
            notes: 'Paid in full'
        }, s1_cashier.user.id);

        // Verify Item is SOLD
        const soldItem = await db.query.inventoryItems.findFirst({ where: eq(schema.inventoryItems.id, itemToSell.id) });
        expect(soldItem?.status).toBe('sold');
        console.log(`Item ${soldItem?.sku} status is now: ${soldItem?.status}`);

        const debugItems = await db.query.inventoryItems.findMany({ where: eq(schema.inventoryItems.storeId, shop1.id) });
        console.log('DEBUG: All Items in Shop 1:', debugItems.map(i => `${i.name}: ${i.status}`));

        // Verify Unsold Item is still IN STOCK
        const unsoldItems = await db.query.inventoryItems.findMany({
            where: and(
                eq(schema.inventoryItems.storeId, shop1.id),
                eq(schema.inventoryItems.status, 'available')
            )
        });
        expect(unsoldItems.length).toBeGreaterThan(0);
        console.log(`Remaining items in stock: ${unsoldItems.length}`);

        // --- 4. CLOSING OPERATIONS ---
        console.log('\n--- CLOSING PHASE ---');

        // 1. Daily Sales Report (Manager)
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));

        const stats = await salesService.getSalesStats(shop1.id, startOfDay, endOfDay);
        console.log('Shop 1 Daily Stats:', stats);

        // Expect strings because of Postgres driver behavior with sum/count
        expect(parseInt(stats.totalInvoices.toString())).toBe(1);
    });

});

// --- HELPER FUNCTIONS ---

async function hireEmployee(storeId: string, name: string, roleName: string) {
    const email = `${name.replace(/\s/g, '.').toLowerCase()}@mari.com`;
    // Create user
    const user = await TestFactory.createUser({
        email,
        fullName: name,
        passwordHash: 'password123'
    });

    // Find role
    const role = await db.query.roles.findFirst({ where: eq(schema.roles.name, roleName) });

    if (!role) {
        // Fallback or error - simplistic handling for test
        const allRoles = await db.query.roles.findMany();
        console.warn(`[HireEmployee] Role '${roleName}' not found.`);
        console.warn(`[HireEmployee] Available roles: ${allRoles.map(r => r.name).join(', ')}`);

        if (allRoles.length === 0) {
            throw new Error('[HireEmployee] Critical: No roles found in database. Seeding failed?');
        }

        // Default to sales_agent if specific role missing in seed
        const fallback = allRoles.find(r => r.name === 'sales_agent') || allRoles[0];
        console.warn(`[HireEmployee] Fallback to role: ${fallback.name}`);
        await TestFactory.assignRole(user.id, fallback.id, storeId);
    } else {
        await TestFactory.assignRole(user.id, role.id, storeId);
    }

    // Create employee record
    const [employee] = await db.insert(schema.employees).values({
        storeId,
        userId: user.id,
        employeeCode: `EMP-${Math.floor(Math.random() * 10000)}`,
        fullName: name,
        email,
        dateOfJoining: new Date(),
        department: 'Sales',
        position: roleName,
        salary: '25000',
        status: 'active'
    }).returning();

    return { user, employee };
}
