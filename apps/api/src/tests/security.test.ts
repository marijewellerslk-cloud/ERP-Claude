import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createApp } from '../app';
import { TestFactory } from './helpers/factories';
import { db } from '../config/database';
import { seedRoles } from '../scripts/seed-roles'; // We need roles to be seeded
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { authService } from '../modules/auth/auth.service';

const app = createApp();

describe('Security Module Tests', () => {
    let store: any;
    let privilegedRole: any;
    let nonPrivilegedRole: any;
    let privilegedUser: any;
    let nonPrivilegedUser: any;

    beforeEach(async () => {
        // Ensure roles are seeded
        await seedRoles();

        // Create a store
        store = await TestFactory.createStore();

        // Get roles from DB
        privilegedRole = await db.query.roles.findFirst({
            where: eq(schema.roles.name, 'store_manager')
        });

        nonPrivilegedRole = await db.query.roles.findFirst({
            where: eq(schema.roles.name, 'salesperson')
        });

        // Fallback if seeding didn't work as expected or names differ
        if (!privilegedRole) privilegedRole = await TestFactory.createRole({ name: 'store_manager' });
        if (!nonPrivilegedRole) nonPrivilegedRole = await TestFactory.createRole({ name: 'salesperson' });

        // Create users
        privilegedUser = await TestFactory.createUser({
            email: `manager-${uuidv4()}@example.com`,
            passwordHash: 'password123'
        });
        await TestFactory.assignRole(privilegedUser.id, privilegedRole.id, store.id);

        nonPrivilegedUser = await TestFactory.createUser({
            email: `sales-${uuidv4()}@example.com`,
            passwordHash: 'password123'
        });
        await TestFactory.assignRole(nonPrivilegedUser.id, nonPrivilegedRole.id, store.id);
    });

    afterAll(() => {
        vi.useRealTimers();
    });

    describe('Time-Based Access Control', () => {
        it('should allow non-privileged user login during Allowed Hours (e.g. 10:00 AM)', async () => {
            // Set time to 10:00 AM
            const date = new Date('2024-01-01T10:00:00');
            vi.setSystemTime(date);

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: nonPrivilegedUser.email,
                    password: 'password123',
                    storeId: store.id
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should BLOCK non-privileged user login during Restricted Hours (e.g. 3:00 AM)', async () => {
            // Set time to 3:00 AM
            const date = new Date('2024-01-01T03:00:00');
            vi.setSystemTime(date);

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: nonPrivilegedUser.email,
                    password: nonPrivilegedUser.plainPassword,
                    storeId: store.id
                });

            expect(response.status).toBe(401); // 401 is correct for Auth failures
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('System access is restricted');
        });

        it('should ALLOW privileged user login during Restricted Hours (e.g. 3:00 AM)', async () => {
            // Set time to 3:00 AM
            const date = new Date('2024-01-01T03:00:00');
            vi.setSystemTime(date);

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: privilegedUser.email,
                    password: 'password123',
                    storeId: store.id
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should BLOCK authenticated non-privileged user API access during Restricted Hours', async () => {
            // 1. Login during allowed hours to get token
            const dateAllowed = new Date('2024-01-01T10:00:00');
            vi.setSystemTime(dateAllowed);

            const loginRes = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: nonPrivilegedUser.email,
                    password: 'password123',
                    storeId: store.id
                });
            const token = loginRes.body.data.accessToken;

            // 2. Switch to restricted hours
            const dateRestricted = new Date('2024-01-01T03:00:00');
            vi.setSystemTime(dateRestricted);

            // 3. Try to access a protected route
            const response = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(403);
            expect(response.body.error.code).toBe('ACCESS_RESTRICTED_TIME');
        });

        it('should ALLOW authenticated privileged user API access during Restricted Hours', async () => {
            // 1. Login during allowed hours (or restricted, doesn't matter for them)
            const dateRestricted = new Date('2024-01-01T03:00:00');
            vi.setSystemTime(dateRestricted);

            const loginRes = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: privilegedUser.email,
                    password: 'password123',
                    storeId: store.id
                });
            const token = loginRes.body.data.accessToken;

            // 2. Try to access a protected route
            const response = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
        });
    });

    describe('Rate Limiting', () => {
        // NOTE: rate-limit is memory based. 
        // We need to ensure we don't accidentally hit it with previous tests, 
        // but since we create app inside describe (or setup), 
        // effectively we are using the same instance.
        // Also, rate limit is by IP. Supertest uses 127.0.0.1 or ::1.

        it('should block excessive login attempts', async () => {
            // Reset time to allowed
            vi.setSystemTime(new Date('2024-01-01T12:00:00'));

            // We configured max 10 attempts in 15 mins
            const attempts = [];
            for (let i = 0; i < 12; i++) {
                attempts.push(
                    request(app)
                        .post('/api/v1/auth/login')
                        .send({
                            email: 'bad-actor@example.com', // Wrong email
                            password: 'wrongpassword',
                            storeId: store.id
                        })
                );
            }

            const responses = await Promise.all(attempts);

            // The last few should be 429
            const lastResponse = responses[responses.length - 1];

            if (lastResponse.status !== 429) {
                console.log('Last response status:', lastResponse.status);
                console.log('Last response body:', lastResponse.body);
            }

            expect(lastResponse.status).toBe(429);
            expect(lastResponse.body.error.code).toBe('AUTH_RATE_LIMIT_EXCEEDED');
        });
    });
});
