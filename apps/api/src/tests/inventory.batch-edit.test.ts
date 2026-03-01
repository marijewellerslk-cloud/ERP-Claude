
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { TestFactory } from './helpers/factories';
import { resetDb } from './helpers/reset-db';
import { db } from '../config/database';
import * as schema from '../db/schema';
import { generateAccessToken } from '../utils/jwt';

describe('Inventory Batch Editing', () => {
    let app: any;
    let authToken: string;
    let storeId: string;
    let supplierId: string;

    beforeAll(() => {
        app = createApp();
    });

    // Setup runs before EACH test because of global setup.ts resetting DB
    beforeEach(async () => {
        // Setup User and Auth
        const store = await TestFactory.createStore();
        storeId = store.id;
        // Use store_manager role to pass StoreAccessService check
        const role = await TestFactory.createRole({ name: 'store_manager', description: 'Store Manager' });
        const user = await TestFactory.createUser();

        // Enable inventory manipulation
        await TestFactory.assignRole(user.id, role.id, store.id, { canManipulateInventory: true });

        // Create Permissions
        const [permCreate] = await db.insert(schema.permissions).values({
            resource: 'inventory',
            action: 'create',
            description: 'Create Inventory'
        }).returning();

        const [permUpdate] = await db.insert(schema.permissions).values({
            resource: 'inventory',
            action: 'update',
            description: 'Update Inventory'
        }).returning();



        // Assign Permissions to Role
        await db.insert(schema.rolePermissions).values([
            { roleId: role.id, permissionId: permCreate.id },
            { roleId: role.id, permissionId: permUpdate.id }
        ]);

        // Generate valid JWT directly using utils/jwt
        authToken = generateAccessToken({
            userId: user.id,
            storeId: store.id,
            email: user.email,
            role: role.name,
            permissions: ['inventory:create', 'inventory:update']
        });

        // Create a supplier
        const supplier = await TestFactory.createSupplier(storeId);
        supplierId = supplier.id;
    });

    afterAll(async () => {
        // Optional: cleanup
        await resetDb();
    });

    const createBatch = async () => {
        const res = await request(app)
            .post('/api/v1/inventory/batches')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                storeId,
                supplierId,
                purchaseDate: new Date().toISOString(),
                expectedTotalItems: 10,
                expectedTotalWeight: 100,
                notes: 'Initial notes',
                purchaseType: 'monetary',
                totalCost: 50000,
                goldRatePerGram: 500,
            });
        if (res.status !== 201) {
            // This will fail the test and print the error body
            expect(res.status, JSON.stringify(res.body)).toBe(201);
        }
        return res.body.data;
    };

    it('should create a batch', async () => {
        const batch = await createBatch();
        expect(batch).toBeDefined();
        expect(Number(batch.expectedTotalWeight)).toBe(100);
    });

    it('should update batch details', async () => {
        const batch = await createBatch();
        const batchId = batch.id;

        const res = await request(app)
            .put(`/api/v1/inventory/batches/${batchId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                expectedTotalWeight: 150.5, // Corrected weight
                expectedTotalItems: 12,
                notes: 'Updated notes',
            });

        if (res.status !== 200) {
            console.error('Update Batch Failed:', res.body);
        }

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Number(res.body.data.expectedTotalWeight)).toBe(150.5);
        expect(res.body.data.expectedTotalItems).toBe(12);
        expect(res.body.data.notes).toBe('Updated notes');
    });

    it('should not allow updating a non-existent batch', async () => {
        const res = await request(app)
            .put('/api/v1/inventory/batches/00000000-0000-0000-0000-000000000000')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                expectedTotalWeight: 200,
            });

        expect(res.status).toBe(400); // Controller handles "Batch not found" as error 400
    });
});
