import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../config/database';
import { resetDb } from './helpers/reset-db';
import { TestFactory } from './helpers/factories';

describe('Sanity Check', () => {
    beforeEach(async () => {
        await resetDb();
    });

    it('should be able to create a user', async () => {
        const user = await TestFactory.createUser();
        expect(user).toBeDefined();
        expect(user.id).toBeDefined();
        expect(user.email).toContain('@example.com');
    });

    it('should truncate database between tests', async () => {
        const user1 = await TestFactory.createUser();
        expect(user1).toBeDefined();

        // Verify user exists via direct DB query
        const usersBefore = await db.query.users.findMany();
        expect(usersBefore.length).toBe(1);

        // Reset DB manually to simulate next test run clean state (tests run sequentially in a file usually)
        await resetDb();

        const usersAfter = await db.query.users.findMany();
        expect(usersAfter.length).toBe(0);
    });
});
