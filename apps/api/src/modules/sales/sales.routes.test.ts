
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createApp } from '../../app';
import { TestFactory } from '../../tests/helpers/factories';
import { db } from '../../config/database';
import { permissions, rolePermissions } from '../../db/schema';
import { eq } from 'drizzle-orm';

const app = createApp();

describe('Sales Routes Integration', () => {
    let store: any;
    let adminRole: any;
    let adminUser: any;
    let adminToken: string;
    let customer: any;
    let supplier: any;
    let inventoryItemId: string;

    beforeEach(async () => {
        store = await TestFactory.createStore();

        // Permissions
        const permsToCreate = [
            { resource: 'sales', action: 'create' },
            { resource: 'sales', action: 'read' },
            { resource: 'inventory', action: 'create' }, // Needed to setup inventory
            { resource: 'inventory', action: 'read' },
            { resource: 'inventory', action: 'update' }
        ];

        const createdPerms = [];
        for (const p of permsToCreate) {
            const [perm] = await db.insert(permissions).values({
                resource: p.resource,
                action: p.action,
                description: `${p.action} ${p.resource}`
            }).returning();
            createdPerms.push(perm);
        }

        // Role & User
        adminRole = await TestFactory.createRole({ name: 'store_manager' });

        for (const perm of createdPerms) {
            await db.insert(rolePermissions).values({ roleId: adminRole.id, permissionId: perm.id }).onConflictDoNothing();
        }

        adminUser = await TestFactory.createUser({ email: `sales-admin-${uuidv4()}@example.com` });
        await TestFactory.assignRole(adminUser.id, adminRole.id, store.id, { canManipulateInventory: true });

        const loginRes = await request(app).post('/api/v1/auth/login').send({
            email: adminUser.email,
            password: 'password123',
            storeId: store.id
        });
        adminToken = loginRes.body.data.accessToken;

        // Customer
        customer = await TestFactory.createCustomer(store.id);

        // Supplier (for inventory setup)
        supplier = await TestFactory.createSupplier(store.id);

        // Setup Inventory Item via API
        // 1. Create Batch
        const batchRes = await request(app)
            .post('/api/v1/inventory/batches')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                supplierId: supplier.id,
                purchaseDate: new Date().toISOString(),
                expectedTotalItems: 10,
                expectedTotalWeight: 50.5,
                purchaseType: 'monetary',
                totalCost: 100000,
                goldRatePerGram: 5000,
                paymentMethod: 'cash'
            });

        const batchId = batchRes.body.data.id;

        // 2. Add Item
        const itemRes = await request(app)
            .post(`/api/v1/inventory/batches/${batchId}/items`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                batchId: batchId,
                name: "Gold Replaceable Ring",
                itemType: "finished_goods",
                metalType: "gold",
                grossWeight: 5.5,
                netWeight: 5.0,
                purity: "22K"
            });

        inventoryItemId = itemRes.body.data.id;

        // 3. Complete batch to make item available? 
        // Some systems require batch completion. 
        // Let's check status. Usually status is 'available' after creation or batch completion.
        // I will assume it is available.
    });

    it('should create an invoice with ad-hoc item', async () => {
        const invoiceData = {
            customerId: customer.id,
            items: [
                {
                    itemDescription: "Custom Repair Job",
                    quantity: 1,
                    unitPrice: 500,
                    makingCharges: 100
                }
            ],
            discountAmount: 0,
            taxAmount: 50
        };

        const response = await request(app)
            .post('/api/v1/sales/invoices')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(invoiceData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.customerId).toBe(customer.id);

        // Verify via GET
        const getRes = await request(app)
            .get(`/api/v1/sales/invoices/${response.body.data.id}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(getRes.status).toBe(200);
        expect(getRes.body.data.customer.firstName).toContain('Test');
    });

    it('should create an invoice with inventory item', async () => {
        const invoiceData = {
            customerId: customer.id,
            items: [
                {
                    inventoryItemId: inventoryItemId,
                    itemDescription: "Gold Ring",
                    quantity: 1,
                    unitPrice: 25000,
                    makingCharges: 2000,
                    goldWeight: 5.0,
                    goldPurity: "22K"
                }
            ]
        };

        const response = await request(app)
            .post('/api/v1/sales/invoices')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(invoiceData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);

        // Verify Item is now Sold
        // We can check via Inventory API
        const itemRes = await request(app)
            .get(`/api/v1/inventory/items/${inventoryItemId}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(itemRes.status).toBe(200);
        expect(itemRes.body.data.status).toBe('sold');
    });
});
