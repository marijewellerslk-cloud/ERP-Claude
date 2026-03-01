import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createApp } from '../../app';
import { TestFactory } from '../../tests/helpers/factories';

const app = createApp();

describe('Auth Routes Integration', () => {
    describe('POST /api/v1/auth/register', () => {
        it('should register a new user successfully', async () => {
            // Create required dependencies
            const store = await TestFactory.createStore();
            const role = await TestFactory.createRole();

            const userData = {
                email: `integration-${uuidv4()}@example.com`,
                password: 'Password123', // Meets requirement (upper, lower, number)
                fullName: 'Integration User',
                phone: '1234567890',
                storeId: store.id,
                roleId: role.id
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData);

            if (response.status !== 201) {
                console.error('Register failed:', response.body);
            }

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.user.email).toBe(userData.email);
            expect(response.body.data.accessToken).toBeDefined();
            expect(response.headers['set-cookie']).toBeDefined(); // Refresh token cookie
        });

        it('should fail validation with invalid email', async () => {
            const store = await TestFactory.createStore();
            const role = await TestFactory.createRole();

            const userData = {
                email: 'invalid-email',
                password: 'Password123',
                fullName: 'Integration User',
                storeId: store.id,
                roleId: role.id
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('POST /api/v1/auth/login', () => {
        it('should login successfully with valid credentials', async () => {
            const store = await TestFactory.createStore();
            const role = await TestFactory.createRole();

            // Create user
            const user = await TestFactory.createUser({
                email: 'login-route@example.com',
                passwordHash: 'password123'
            });
            await TestFactory.assignRole(user.id, role.id, store.id);

            const loginData = {
                email: 'login-route@example.com',
                password: 'password123',
                storeId: store.id,
            };

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.accessToken).toBeDefined();
            expect(response.body.data.user.email).toBe(user.email);
        });

        it('should fail login with incorrect password', async () => {
            const store = await TestFactory.createStore();
            const role = await TestFactory.createRole();
            const user = await TestFactory.createUser({
                email: 'login-fail@example.com',
                passwordHash: 'password123'
            });
            await TestFactory.assignRole(user.id, role.id, store.id);

            const loginData = {
                email: 'login-fail@example.com',
                password: 'wrongpassword',
                storeId: store.id,
            };

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData);

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('LOGIN_FAILED');
        });
    });

    describe('POST /api/v1/auth/refresh', () => {
        it('should refresh token successfully', async () => {
            const store = await TestFactory.createStore();
            const role = await TestFactory.createRole();

            // Register to get a fresh refresh token via cookie
            const userData = {
                email: 'refresh-route@example.com',
                password: 'Password123',
                fullName: 'Refresh User',
                storeId: store.id,
                roleId: role.id
            };

            const registerResponse = await request(app)
                .post('/api/v1/auth/register')
                .send(userData);

            const cookies = registerResponse.headers['set-cookie'];
            expect(cookies).toBeDefined();

            const refreshResponse = await request(app)
                .post('/api/v1/auth/refresh')
                .set('Cookie', cookies)
                .send();

            expect(refreshResponse.status).toBe(200);
            expect(refreshResponse.body.success).toBe(true);
            expect(refreshResponse.body.data.accessToken).toBeDefined();
        });
    });

    describe('GET /api/v1/auth/me', () => {
        it('should return user details for authenticated request', async () => {
            const store = await TestFactory.createStore();
            const role = await TestFactory.createRole();

            // Register to get access token
            const userData = {
                email: 'me-route@example.com',
                password: 'Password123',
                fullName: 'Me User',
                storeId: store.id,
                roleId: role.id
            };

            const registerResponse = await request(app)
                .post('/api/v1/auth/register')
                .send(userData);

            const accessToken = registerResponse.body.data.accessToken;

            const meResponse = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(meResponse.status).toBe(200);
            expect(meResponse.body.success).toBe(true);
            expect(meResponse.body.data.user.email).toBe(userData.email);
        });

        it('should return 401 for unauthenticated request', async () => {
            const response = await request(app).get('/api/v1/auth/me');
            expect(response.status).toBe(401);
        });
    });
});
