import { beforeAll, afterAll, beforeEach, vi } from 'vitest';
import dotenv from 'dotenv';
import { resetDb } from './helpers/reset-db';

// Load environment variables from .env.test if it exists, otherwise .env
dotenv.config({ path: '.env.test' });

// Mock console.log/error to keep test output clean, if desired
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'error').mockImplementation(() => {});

beforeAll(async () => {
    // Global setup checks
    process.env.BCRYPT_SALT_ROUNDS = '10';
    if (!process.env.DATABASE_URL) {
        console.warn('WARNING: DATABASE_URL is not defined. Database tests may fail.');
    }
});

beforeEach(async () => {
    await resetDb();
});

afterAll(async () => {
    // Global teardown
    vi.restoreAllMocks();
});
