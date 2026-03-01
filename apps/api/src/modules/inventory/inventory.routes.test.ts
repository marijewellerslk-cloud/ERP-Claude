
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createApp } from '../../app';
import { TestFactory } from '../../tests/helpers/factories';
import { db } from '../../config/database';
import { permissions, rolePermissions } from '../../db/schema';
import { eq } from 'drizzle-orm';

const app = createApp();

describe('Inventory Routes Integration', () => {
    let store: any;
    let adminRole: any;
    let adminUser: any;
    let adminToken: string;
    let supplier: any;

    beforeEach(async () => {
        store = await TestFactory.createStore();

        // Permissions
        const [readPerm] = await db.insert(permissions).values({
            resource: 'inventory',
            action: 'read',
            description: 'Read Inventory'
        }).returning();

        const [createPerm] = await db.insert(permissions).values({
            resource: 'inventory',
            action: 'create',
            description: 'Create Inventory'
        }).returning();

        const [updatePerm] = await db.insert(permissions).values({
            resource: 'inventory',
            action: 'update',
            description: 'Update Inventory'
        }).returning();

        // Role & User
        adminRole = await TestFactory.createRole({ name: 'store_manager' });

        await db.insert(rolePermissions).values({ roleId: adminRole.id, permissionId: readPerm.id }).onConflictDoNothing();
        await db.insert(rolePermissions).values({ roleId: adminRole.id, permissionId: createPerm.id }).onConflictDoNothing();
        await db.insert(rolePermissions).values({ roleId: adminRole.id, permissionId: updatePerm.id }).onConflictDoNothing();

        adminUser = await TestFactory.createUser({ email: `admin-${uuidv4()}@example.com` });
        await TestFactory.assignRole(adminUser.id, adminRole.id, store.id, { canManipulateInventory: true });

        const loginRes = await request(app).post('/api/v1/auth/login').send({
            email: adminUser.email,
            password: 'password123',
            storeId: store.id
        });
        adminToken = loginRes.body.data.accessToken;

        // Supplier
        supplier = await TestFactory.createSupplier(store.id);
    });

    it('should create a new batch', async () => {
        const batchData = {
            supplierId: supplier.id,
            purchaseDate: new Date().toISOString(),
            expectedTotalItems: 10,
            expectedTotalWeight: 50.5,
            purchaseType: 'monetary',
            totalCost: 100000,
            goldRatePerGram: 5000,
            paymentMethod: 'cash',
            initialPaymentAmount: 0
        };

        const response = await request(app)
            .post('/api/v1/inventory/batches')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(batchData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.batchNumber).toBeDefined();
        expect(response.body.data.supplierId).toBe(supplier.id);
    });

    it('should add item to batch', async () => {
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
                goldRatePerGram: 5000
            });

        const batchId = batchRes.body.data.id;

        // 2. Add Item
        const itemData = {
            batchId: batchId, // validation schema requires it in body too? Or matches path?
            // Schema has batchId.
            name: "Gold Ring",
            itemType: "finished_goods",
            metalType: "gold",
            grossWeight: 5.5,
            netWeight: 5.0,
            purity: "22K"
        };

        const itemRes = await request(app)
            .post(`/api/v1/inventory/batches/${batchId}/items`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(itemData);

        expect(itemRes.status).toBe(201);
        expect(itemRes.body.data).toHaveProperty('id');
        expect(itemRes.body.data.name).toBe("Gold Ring");
    });

    it('should search inventory items', async () => {
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
                goldRatePerGram: 5000
            });

        const batchId = batchRes.body.data.id;

        // 2. Add Item
        const itemRes = await request(app)
            .post(`/api/v1/inventory/batches/${batchId}/items`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                batchId: batchId,
                name: "Unique Search Item",
                itemType: "finished_goods",
                metalType: "gold",
                grossWeight: 5.5,
                netWeight: 5.0,
                purity: "22K"
            });

        expect(itemRes.status).toBe(201);

        // 3. Search
        const searchRes = await request(app)
            .get('/api/v1/inventory/items')
            .set('Authorization', `Bearer ${adminToken}`)
            .query({ search: 'Unique' }); // Assuming search param is 'search' or 'q'

        // Check controller implementation for search param name if this fails.
        // inventory.controller.ts -> searchItems

        expect(searchRes.status).toBe(200);
        // The search might return empty if elastic/search logic is complex or async indexing?
        // But usually it's simple ILIKE in these standard controllers.

        expect(searchRes.body.data.length).toBeGreaterThan(0);
        expect(searchRes.body.data[0].name).toContain("Unique");
    });
});
