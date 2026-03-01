import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityLoggerService } from './activity-logger.service';
import { db } from '../config/database';
import { auditLogs } from '../db/schema';

// Mock DB
vi.mock('../config/database', () => ({
    db: {
        insert: vi.fn(() => ({ values: vi.fn() })),
    },
}));

// Mock Logger
vi.mock('../utils/logger', () => ({
    logger: {
        debug: vi.fn(),
        error: vi.fn(),
    },
}));

describe('Audit Trail Immutability & Persistence', () => {
    let service: ActivityLoggerService;

    beforeEach(() => {
        service = new ActivityLoggerService();
        vi.clearAllMocks();
    });

    it('should decouple audit logs from entity lifecycle (Persistence after Soft Delete)', async () => {
        // Scenario: A user deletes a loan. The loan record is marked deleted.
        // The audit log for "Loan Created" and "Loan Deleted" must persist.
        // Risk: If audit logs cascade delete with the entity, we lose history.

        const params = {
            userId: 'user-admin',
            storeId: 'store-1',
            action: 'soft_delete',
            entityType: 'gold_loan',
            entityId: 'loan-123',
            oldValues: { status: 'active' },
            newValues: { status: 'deleted', deletedAt: new Date() }
        };

        await service.logAudit(params);

        // Verify insertion into 'auditLogs' table
        expect(db.insert).toHaveBeenCalledWith(auditLogs);

        // Check contents
        // We can't check the DB state, but we check that the service 
        // writes INDEPENDENTLY of any entity table operation.
        // It does not wrap this in a transaction dependent on the entity by default.
        // (Unless called within one, but the service method itself is standalone)

        const insertMock = vi.mocked(db.insert);
        const valuesMock = insertMock.mock.results[0].value.values;

        expect(valuesMock).toHaveBeenCalledWith(expect.objectContaining({
            action: 'soft_delete',
            entityId: 'loan-123',
            // Crucially, it doesn't require the entity to exist to be inserted here?
            // (In a real DB, Foreign Keys might prevent this if strict, but Audit Logs usually have NO FK or loose FK)
            // We assume the schema design allows loose linking or the entity still exists (soft delete).
        }));
    });

    it('should create distinct logs for corrections rather than overwriting (Immutability)', async () => {
        // Scenario: Manager corrects a gold weight from 10g to 9.5g.
        // We should have TWO logs:
        // 1. Original Entry (10g)
        // 2. Correction Entry (old: 10g, new: 9.5g)
        // We should NOT update the first log.

        // This test calls logAudit for the correction.
        // It verifies we call INSERT, not UPDATE.

        await service.logAudit({
            userId: 'manager-1',
            storeId: 'store-1',
            action: 'correction_weight',
            entityType: 'inventory_item',
            entityId: 'item-123',
            oldValues: { weight: 10 },
            newValues: { weight: 9.5, reason: 'Calibration error' }
        });

        expect(db.insert).toHaveBeenCalledTimes(1);
        // If it called update, this expectation would fail (assuming we didn't mock update)
        // or we can explicitly check that we are inserting a NEW record.

        // Risk: "If correction overwrites the original log, we can't prove who made the mistake vs who fixed it."
    });
});
