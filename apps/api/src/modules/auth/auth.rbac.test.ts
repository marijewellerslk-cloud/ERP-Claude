
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createApp } from '../../app';
import { TestFactory } from '../../tests/helpers/factories';
import { db } from '../../config/database';
import { permissions, rolePermissions, roles, userRoles } from '../../db/schema';
import { eq } from 'drizzle-orm';

const app = createApp();

describe('RBAC Integration', () => {
    let store: any;
    let viewerRole: any;
    let adminRole: any;
    let viewerUser: any;
    let adminUser: any;
    let viewerToken: string;
    let adminToken: string;

    beforeEach(async () => {
        store = await TestFactory.createStore();

        // 1. Create Permissions
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

        // 2. Create Roles
        viewerRole = await TestFactory.createRole({ name: `viewer_${uuidv4()}` });
        // Use 'store_manager' role name to satisfy strict middleware check, but ensure it's unique if possible or handle conflict?
        // Actually, the middleware checks if (userRole === 'store_manager'). 
        // If I create a role named 'store_manager', it matches.
        // But 'store_manager' might already exist from seed. 
        // TestFactory handles duplicates.
        adminRole = await TestFactory.createRole({ name: 'store_manager' });

        // 3. Assign Permissions to Roles
        // Viewer gets ONLY read
        await db.insert(rolePermissions).values({
            roleId: viewerRole.id,
            permissionId: readPerm.id
        });

        // Admin (Store Manager) gets BOTH read and create
        // Note: If role already existed and had permissions, this might duplicate or fail if unique constraint?
        // role_permissions has unique(roleId, permissionId).
        // Let's try insert on conflict do nothing
        await db.insert(rolePermissions).values({
            roleId: adminRole.id,
            permissionId: readPerm.id
        }).onConflictDoNothing();

        await db.insert(rolePermissions).values({
            roleId: adminRole.id,
            permissionId: createPerm.id
        }).onConflictDoNothing();

        // 4. Create Users and Assign Roles
        viewerUser = await TestFactory.createUser({ email: `viewer-${uuidv4()}@example.com` });
        await TestFactory.assignRole(viewerUser.id, viewerRole.id, store.id);

        adminUser = await TestFactory.createUser({ email: `admin-${uuidv4()}@example.com` });
        // Assign role returns the userRole record.
        // VITAL: Set canManipulateInventory to true for this user via overrides
        await TestFactory.assignRole(adminUser.id, adminRole.id, store.id, { canManipulateInventory: true });

        // 5. Login to get tokens
        const viewerLogin = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: viewerUser.email,
                password: 'password123',
                storeId: store.id
            });
        viewerToken = viewerLogin.body.data.accessToken;

        const adminLogin = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: adminUser.email,
                password: 'password123',
                storeId: store.id
            });
        adminToken = adminLogin.body.data.accessToken;
    });

    it('should allow access to protected route with correct permission', async () => {
        // Viewer has inventory:read, so accessing GET /inventory/items should succeed
        // We'll mock the service response effectively by expecting a 200 (or empty list) 
        // We rely on the fact that if RBAC fails it returns 403, and if it passes it hits controller.
        // Even if controller fails unrelated logic, status won't be 403.

        const response = await request(app)
            .get('/api/v1/inventory/items')
            .set('Authorization', `Bearer ${viewerToken}`);

        // 403 is the only status we strictly want to avoid finding. 
        // 200 is success. 
        expect(response.status).not.toBe(403);
    });

    it('should deny access to protected route without permission', async () => {
        // Viewer DOES NOT have inventory:create. 
        // POST /inventory/batches requires inventory:create

        const response = await request(app)
            .post('/api/v1/inventory/batches')
            .set('Authorization', `Bearer ${viewerToken}`)
            .send({
                // Payload doesn't matter much as RBAC hits first, 
                // but let's provide minimal valid shape to be safe
                batchNumber: 'BATCH-001',
                purchaseDate: new Date(),
                expectedTotalItems: 10,
                expectedTotalWeight: 100
            });

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow access to higher privilege route for admin', async () => {
        // Admin has inventory:create

        // We might get validation error (400) or success (201), but NOT 403.
        const response = await request(app)
            .post('/api/v1/inventory/batches')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                // Minimal payload to pass validation if possible, or just checking NOT 403
                // If the body is invalid, it returns 400, which proves RBAC passed.
            });

        expect(response.status).not.toBe(403);
    });
});
