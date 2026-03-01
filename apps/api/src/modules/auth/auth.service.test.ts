import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authService } from './auth.service';
import { db } from '../../config/database';
import { resetDb } from '../../tests/helpers/reset-db';
import { TestFactory } from '../../tests/helpers/factories';
import { users, sessions } from '../../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

describe('AuthService', () => {
    /* beforeEach removed as setup.ts handles it */

    describe('register', () => {
        it('should successfully register a new user', async () => {
            const store = await TestFactory.createStore();
            const role = await TestFactory.createRole();

            const input = {
                email: 'newuser@example.com',
                password: 'password123',
                fullName: 'New User',
                storeId: store.id,
                roleId: role.id,
            };

            const result = await authService.register(input);

            expect(result).toBeDefined();
            expect(result.accessToken).toBeDefined();
            expect(result.refreshToken).toBeDefined();
            expect(result.user.email).toBe(input.email);
            expect(result.store.id).toBe(store.id);

            // Verify db
            const userInDb = await db.query.users.findFirst({
                where: eq(users.email, input.email),
            });
            expect(userInDb).toBeDefined();
        });

        it('should fail if email already exists', async () => {
            const store = await TestFactory.createStore();
            const role = await TestFactory.createRole();
            await TestFactory.createUser({ email: 'existing@example.com' });

            const input = {
                email: 'existing@example.com',
                password: 'password123',
                fullName: 'Another User',
                storeId: store.id,
                roleId: role.id,
            };

            await expect(authService.register(input)).rejects.toThrow('User with this email already exists');
        });
    });

    describe('login', () => {
        it('should successfully login with valid credentials', async () => {
            const store = await TestFactory.createStore();
            const role = await TestFactory.createRole();
            // Factory helper hashes the passwordHash argument. 
            // So if we pass 'password123', it gets hashed and stored.
            // authService.login verifies input 'password123' against that hash.
            const user = await TestFactory.createUser({
                email: 'login@example.com',
                passwordHash: 'password123'
            });

            // Assign role
            await TestFactory.assignRole(user.id, role.id, store.id);

            const result = await authService.login({
                email: 'login@example.com',
                password: user.plainPassword, // Use the plain password returned by factory
                storeId: store.id,
            });

            expect(result.accessToken).toBeDefined();
            expect(result.user.email).toBe('login@example.com');
        });

        it('should fail with invalid password', async () => {
            const store = await TestFactory.createStore();
            const role = await TestFactory.createRole();
            const user = await TestFactory.createUser({
                email: 'login@example.com',
                passwordHash: 'password123'
            });
            await TestFactory.assignRole(user.id, role.id, store.id);

            await expect(authService.login({
                email: 'login@example.com',
                password: 'wrongpassword',
                storeId: store.id,
            })).rejects.toThrow('Invalid credentials');
        });
    });

    describe('refreshAccessToken', () => {
        it('should generate new access token', async () => {
            const store = await TestFactory.createStore();
            const role = await TestFactory.createRole();
            const user = await TestFactory.createUser({ passwordHash: 'password123' });
            await TestFactory.assignRole(user.id, role.id, store.id);

            // Login first to get refresh token
            const loginResult = await authService.login({
                email: user.email,
                password: user.plainPassword,
                storeId: store.id
            });

            // Add small delay to ensure iat changes
            await new Promise(r => setTimeout(r, 1100));

            const newTokens = await authService.refreshAccessToken(loginResult.refreshToken);
            expect(newTokens.accessToken).toBeDefined();
            expect(newTokens.accessToken).not.toBe(loginResult.accessToken);
        });
    });

    describe('getUsers', () => {
        it('should return all users', async () => {
            // resetDb handled by setup.ts
            const user1 = await TestFactory.createUser({ email: 'user1@example.com', fullName: 'User One' });
            const user2 = await TestFactory.createUser({ email: 'user2@example.com', fullName: 'User Two' });

            const result = await authService.getUsers();

            expect(result.length).toBeGreaterThanOrEqual(2);
            expect(result).toEqual(expect.arrayContaining([
                expect.objectContaining({ id: user1.id, email: user1.email, fullName: user1.fullName }),
                expect.objectContaining({ id: user2.id, email: user2.email, fullName: user2.fullName }),
            ]));
        });
    });
});
