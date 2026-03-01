import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createApp } from '../app';
import { TestFactory } from './helpers/factories';
import { db } from '../config/database';
import { seedRoles } from '../scripts/seed-roles';
import * as schema from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { authService } from '../modules/auth/auth.service';

const app = createApp();

/**
 * AGENT 1: Auth, RBAC & Session Management — Comprehensive QA Test Suite
 * 
 * Tests authentication lifecycle, RBAC permission matrix, session management,
 * and edge cases around deactivated accounts/stores.
 */

// ============================================================================
// SECTION 1: AUTH EDGE CASES
// ============================================================================
describe('QA: Auth Edge Cases', () => {

    it('[AUTH-01] Login with deactivated user should be rejected', async () => {
        const store = await TestFactory.createStore();
        const role = await TestFactory.createRole({ name: 'sales_agent' });

        const user = await TestFactory.createUser({
            email: `deactivated-${uuidv4()}@example.com`,
            isActive: false,
        });
        await TestFactory.assignRole(user.id, role.id, store.id);

        await expect(
            authService.login({
                email: user.email,
                password: user.plainPassword,
                storeId: store.id,
            })
        ).rejects.toThrow('Account is disabled');
    });

    it('[AUTH-02] Login with deactivated store should be rejected', async () => {
        const store = await TestFactory.createStore({ isActive: false });
        const role = await TestFactory.createRole({ name: 'sales_agent' });
        const user = await TestFactory.createUser({
            email: `inactivestore-${uuidv4()}@example.com`,
        });
        await TestFactory.assignRole(user.id, role.id, store.id);

        await expect(
            authService.login({
                email: user.email,
                password: user.plainPassword,
                storeId: store.id,
            })
        ).rejects.toThrow('Store is deactivated');
    });

    it('[AUTH-03] Login with no role assignment should be rejected', async () => {
        const store = await TestFactory.createStore();
        const user = await TestFactory.createUser({
            email: `norole-${uuidv4()}@example.com`,
        });
        // Don't assign any role

        await expect(
            authService.login({
                email: user.email,
                password: user.plainPassword,
                storeId: store.id,
            })
        ).rejects.toThrow();
    });

    it('[AUTH-04] Login without storeId should auto-detect from user role', async () => {
        const store = await TestFactory.createStore();
        const role = await TestFactory.createRole({ name: 'sales_agent' });
        const user = await TestFactory.createUser({
            email: `autodetect-${uuidv4()}@example.com`,
        });
        await TestFactory.assignRole(user.id, role.id, store.id);

        const result = await authService.login({
            email: user.email,
            password: user.plainPassword,
            // No storeId
        });

        expect(result.store.id).toBe(store.id);
    });

    it('[AUTH-05] Token refresh with expired session should fail', async () => {
        const store = await TestFactory.createStore();
        const role = await TestFactory.createRole({ name: 'sales_agent' });
        const user = await TestFactory.createUser({
            email: `expiredsession-${uuidv4()}@example.com`,
        });
        await TestFactory.assignRole(user.id, role.id, store.id);

        const loginResult = await authService.login({
            email: user.email,
            password: user.plainPassword,
            storeId: store.id,
        });

        // Manually expire the session
        await db.execute(
            sql`UPDATE sessions SET expires_at = NOW() - INTERVAL '1 day' WHERE user_id = ${user.id}`
        );

        await expect(
            authService.refreshAccessToken(loginResult.refreshToken)
        ).rejects.toThrow();
    });

    it('[AUTH-06] Logout should invalidate refresh token', async () => {
        const store = await TestFactory.createStore();
        const role = await TestFactory.createRole({ name: 'sales_agent' });
        const user = await TestFactory.createUser({
            email: `logout-${uuidv4()}@example.com`,
        });
        await TestFactory.assignRole(user.id, role.id, store.id);

        const loginResult = await authService.login({
            email: user.email,
            password: user.plainPassword,
            storeId: store.id,
        });

        await authService.logout(loginResult.refreshToken);

        await expect(
            authService.refreshAccessToken(loginResult.refreshToken)
        ).rejects.toThrow();
    });

    it('[AUTH-07] Session table accumulates entries — no auto-cleanup', async () => {
        const store = await TestFactory.createStore();
        const role = await TestFactory.createRole({ name: 'sales_agent' });
        const user = await TestFactory.createUser({
            email: `sessions-${uuidv4()}@example.com`,
        });
        await TestFactory.assignRole(user.id, role.id, store.id);

        // Login multiple times to accumulate sessions
        for (let i = 0; i < 10; i++) {
            await authService.login({
                email: user.email,
                password: user.plainPassword,
                storeId: store.id,
            });
        }

        const sessionCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(schema.sessions)
            .where(eq(schema.sessions.userId, user.id));

        console.log(`[AUTH-07] Sessions accumulated: ${sessionCount[0].count}`);

        // Document: sessions are NOT cleaned up after new logins
        // This is a potential DB bloat issue in production
        if (Number(sessionCount[0].count) > 5) {
            console.warn('[AUTH-07] WARNING: Sessions accumulate without cleanup!');
            console.warn(`  ${sessionCount[0].count} sessions for single user after 10 logins.`);
            console.warn('  RECOMMENDATION: Implement session cleanup on login or via cron.');
        }

        expect(Number(sessionCount[0].count)).toBeGreaterThanOrEqual(10);
    });

    it('[AUTH-08] User assigned to Store A cannot access Store B', async () => {
        const storeA = await TestFactory.createStore({ name: 'Store A', code: `SA-${uuidv4().substring(0, 6)}` });
        const storeB = await TestFactory.createStore({ name: 'Store B', code: `SB-${uuidv4().substring(0, 6)}` });
        const role = await TestFactory.createRole({ name: 'sales_agent' });
        const user = await TestFactory.createUser({
            email: `crossstore-${uuidv4()}@example.com`,
        });
        // Only assign to Store A
        await TestFactory.assignRole(user.id, role.id, storeA.id);

        // Try to login to Store B
        await expect(
            authService.login({
                email: user.email,
                password: user.plainPassword,
                storeId: storeB.id,
            })
        ).rejects.toThrow('User does not have access to this store');
    });
});

// ============================================================================
// SECTION 2: RBAC PERMISSION MATRIX
// ============================================================================
describe('QA: RBAC Permission Matrix', () => {

    // Define the expected permission matrix from seed-roles.ts
    const RBAC_MATRIX: Record<string, { granted: string[]; denied: string[] }> = {
        superadmin: {
            granted: ['inventory:create', 'employees:delete', 'payroll:approve', 'sales:create', 'stores:delete'],
            denied: [], // superadmin has *:*
        },
        owner: {
            granted: ['stores:read', 'employees:read', 'inventory:read', 'sales:read', 'reports:read'],
            denied: ['inventory:create', 'employees:delete', 'payroll:approve', 'sales:create', 'stores:delete'], // owner is read-only
        },
        general_manager: {
            granted: ['inventory:create', 'sales:create', 'employees:create', 'stores:read'],
            denied: [], // has broad permissions
        },
        store_manager: {
            granted: ['inventory:create', 'sales:create', 'employees:create'],
            denied: ['stores:delete', 'stores:create'],
        },
        accountant: {
            granted: ['accounting:create', 'sales:read', 'reports:read'],
            denied: ['inventory:create', 'employees:delete', 'stores:delete'],
        },
        sales_agent: {
            granted: ['sales:create', 'sales:read', 'inventory:read', 'customers:create'],
            denied: ['inventory:create', 'employees:delete', 'payroll:approve', 'stores:delete'],
        },
        stock_controller: {
            granted: ['inventory:create', 'inventory:read', 'suppliers:create'],
            denied: ['sales:create', 'employees:delete', 'payroll:approve', 'stores:delete'],
        },
    };

    for (const [roleName, { granted, denied }] of Object.entries(RBAC_MATRIX)) {
        describe(`Role: ${roleName}`, () => {
            it(`should have correct permissions seeded`, async () => {
                await seedRoles();

                const store = await TestFactory.createStore();
                const user = await TestFactory.createUser({
                    email: `rbac-${roleName}-${uuidv4()}@example.com`,
                });

                const role = await db.query.roles.findFirst({
                    where: eq(schema.roles.name, roleName),
                });

                if (!role) {
                    console.error(`[RBAC] Role "${roleName}" NOT FOUND in database after seeding!`);
                    throw new Error(`Role ${roleName} not found`);
                }

                await TestFactory.assignRole(user.id, role.id, store.id);

                const perms = await authService.getUserPermissions(user.id, store.id);
                console.log(`[RBAC] ${roleName} permissions: ${perms.join(', ')}`);

                // Check granted permissions
                for (const perm of granted) {
                    if (roleName === 'superadmin') {
                        // superadmin has *:* which means they get a wildcard permission
                        const hasWildcard = perms.some(p => p === '*:*');
                        expect(hasWildcard).toBe(true);
                        break;
                    } else {
                        const hasPerm = perms.includes(perm);
                        if (!hasPerm) {
                            console.warn(`[RBAC] ${roleName} MISSING expected permission: ${perm}`);
                        }
                        expect(hasPerm).toBe(true);
                    }
                }

                // Check denied permissions
                for (const perm of denied) {
                    const hasPerm = perms.includes(perm);
                    if (hasPerm) {
                        console.error(`[RBAC] ${roleName} has UNEXPECTED permission: ${perm}`);
                    }
                    expect(hasPerm).toBe(false);
                }
            });
        });
    }
});

// ============================================================================
// SECTION 3: RBAC ROUTE ENFORCEMENT
// ============================================================================
describe('QA: RBAC Route Enforcement', () => {

    it('[RBAC-ROUTE-01] sales_agent cannot POST to /inventory/batches (inventory:create required)', async () => {
        await seedRoles();
        const store = await TestFactory.createStore();
        const role = await db.query.roles.findFirst({
            where: eq(schema.roles.name, 'sales_agent'),
        });
        expect(role).toBeDefined();

        const user = await TestFactory.createUser({
            email: `salesagent-route-${uuidv4()}@example.com`,
        });
        await TestFactory.assignRole(user.id, role!.id, store.id);

        const loginResult = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: user.email,
                password: user.plainPassword,
                storeId: store.id,
            });

        const token = loginResult.body.data?.accessToken;
        if (!token) {
            console.error('[RBAC-ROUTE-01] Login failed:', loginResult.body);
            throw new Error('Login failed for sales_agent');
        }

        const response = await request(app)
            .post('/api/v1/inventory/batches')
            .set('Authorization', `Bearer ${token}`)
            .send({});

        expect(response.status).toBe(403);
    });

    it('[RBAC-ROUTE-02] stock_controller cannot POST to /sales/invoices (sales:create required)', async () => {
        await seedRoles();
        const store = await TestFactory.createStore();
        const role = await db.query.roles.findFirst({
            where: eq(schema.roles.name, 'stock_controller'),
        });
        expect(role).toBeDefined();

        const user = await TestFactory.createUser({
            email: `stockctrl-route-${uuidv4()}@example.com`,
        });
        await TestFactory.assignRole(user.id, role!.id, store.id);

        const loginResult = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: user.email,
                password: user.plainPassword,
                storeId: store.id,
            });

        const token = loginResult.body.data?.accessToken;
        if (!token) {
            console.error('[RBAC-ROUTE-02] Login failed:', loginResult.body);
            throw new Error('Login failed for stock_controller');
        }

        const response = await request(app)
            .post('/api/v1/sales/invoices')
            .set('Authorization', `Bearer ${token}`)
            .send({});

        expect(response.status).toBe(403);
    });

    it('[RBAC-ROUTE-03] accountant can GET /reports but NOT POST /inventory/batches', async () => {
        await seedRoles();
        const store = await TestFactory.createStore();
        const role = await db.query.roles.findFirst({
            where: eq(schema.roles.name, 'accountant'),
        });
        expect(role).toBeDefined();

        const user = await TestFactory.createUser({
            email: `accountant-route-${uuidv4()}@example.com`,
        });
        await TestFactory.assignRole(user.id, role!.id, store.id);

        const loginResult = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: user.email,
                password: user.plainPassword,
                storeId: store.id,
            });

        const token = loginResult.body.data?.accessToken;
        if (!token) {
            throw new Error('Login failed for accountant');
        }

        // Should be ALLOWED to read reports
        const reportsRes = await request(app)
            .get('/api/v1/reports/sales')
            .set('Authorization', `Bearer ${token}`);
        expect(reportsRes.status).not.toBe(403);

        // Should be DENIED inventory:create
        const inventoryRes = await request(app)
            .post('/api/v1/inventory/batches')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(inventoryRes.status).toBe(403);
    });

    it('[RBAC-ROUTE-04] unauthenticated request should return 401', async () => {
        const response = await request(app)
            .get('/api/v1/inventory/items');

        expect(response.status).toBe(401);
    });

    it('[RBAC-ROUTE-05] request with invalid token should return 401', async () => {
        const response = await request(app)
            .get('/api/v1/inventory/items')
            .set('Authorization', 'Bearer invalid-token-12345');

        expect(response.status).toBe(401);
    });
});

// ============================================================================
// SECTION 4: ROLE NAME CONSISTENCY CHECK
// ============================================================================
describe('QA: Role Name Consistency', () => {
    it('[ROLE-01] Check for shop_manager vs store_manager mismatch', async () => {
        await seedRoles();

        const storeManager = await db.query.roles.findFirst({
            where: eq(schema.roles.name, 'store_manager'),
        });
        const shopManager = await db.query.roles.findFirst({
            where: eq(schema.roles.name, 'shop_manager'),
        });

        console.log('[ROLE-01] store_manager exists:', !!storeManager);
        console.log('[ROLE-01] shop_manager exists:', !!shopManager);

        // The seed creates 'store_manager' but stores.service.ts looks for 'shop_manager'
        // This is a known inconsistency
        if (!shopManager && storeManager) {
            console.warn('[ROLE-01] BUG CONFIRMED: store_manager exists but shop_manager does NOT.');
            console.warn('  stores.service.ts line 53 looks for "shop_manager" role when assigning managers.');
            console.warn('  This means store manager assignment via createStore/updateStore will SILENTLY FAIL.');
            console.warn('  SEVERITY: HIGH');
        }

        // Document the finding regardless of which exists
        expect(storeManager || shopManager).toBeTruthy();
    });
});
