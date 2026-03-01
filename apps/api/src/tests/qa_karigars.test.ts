import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { TestFactory } from './helpers/factories';
import { db } from '../config/database';
import { seedRoles } from '../scripts/seed-roles';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { karigarsService } from '../modules/karigars/karigars.service';

/**
 * AGENT 6: Karigars (Goldsmiths) — QA Test Suite
 *
 * Tests karigar management, transaction recording,
 * ledger retrieval, and store summary.
 */

describe('QA: Karigars Module', () => {
    let store: typeof schema.stores.$inferSelect;
    let userId: string;

    async function setupKarigarEnvironment() {
        await seedRoles();
        store = await TestFactory.createStore();
        const role = await db.query.roles.findFirst({ where: eq(schema.roles.name, 'store_manager') });
        const user = await TestFactory.createUser({ email: `kgr-mgr-${uuidv4()}@example.com` });
        await TestFactory.assignRole(user.id, role!.id, store.id);
        userId = user.id;
    }

    // ========================================================================
    // SECTION 1: KARIGAR LIFECYCLE
    // ========================================================================
    describe('Karigar Lifecycle', () => {
        it('[KGR-01] Create and retrieve karigar', async () => {
            await setupKarigarEnvironment();

            const karigar = await karigarsService.createKarigar({
                storeId: store.id,
                name: `QA Karigar ${uuidv4().substring(0, 6)}`,
                phone: `077${uuidv4().substring(0, 7)}`,
                specialization: 'ring_making',
                skillLevel: 'senior',
                baseLabourRate: 500,
                rateType: 'per_gram',
            });

            expect(karigar).toBeDefined();
            expect(karigar.id).toBeDefined();
            console.log(`[KGR-01] Karigar created: ${karigar.karigarCode}`);

            const retrieved = await karigarsService.getKarigarById(karigar.id);
            expect(retrieved).toBeDefined();
        });

        it('[KGR-02] List karigars with filters', async () => {
            await setupKarigarEnvironment();

            await karigarsService.createKarigar({
                storeId: store.id,
                name: `Master Karigar ${uuidv4().substring(0, 6)}`,
                specialization: 'chain_making',
                skillLevel: 'master',
                baseLabourRate: 800,
                rateType: 'per_gram',
            });

            const result = await karigarsService.listKarigars({
                storeId: store.id,
            });
            expect(result.karigars.length).toBeGreaterThan(0);
            console.log(`[KGR-02] Karigars listed: ${result.total}`);
        });

        it('[KGR-03] Update karigar', async () => {
            await setupKarigarEnvironment();

            const karigar = await karigarsService.createKarigar({
                storeId: store.id,
                name: `Update Karigar ${uuidv4().substring(0, 6)}`,
                specialization: 'ring_making',
                skillLevel: 'junior',
                baseLabourRate: 300,
                rateType: 'per_piece',
            });

            const updated = await karigarsService.updateKarigar(karigar.id, {
                skillLevel: 'standard',
                baseLabourRate: 450,
            });

            expect(updated).toBeDefined();
            console.log(`[KGR-03] Karigar updated`);
        });
    });

    // ========================================================================
    // SECTION 2: TRANSACTIONS
    // ========================================================================
    describe('Transactions', () => {
        it('[KGR-04] Record gold issue transaction', async () => {
            await setupKarigarEnvironment();

            const karigar = await karigarsService.createKarigar({
                storeId: store.id,
                name: `Txn Karigar ${uuidv4().substring(0, 6)}`,
                specialization: 'ring_making',
                skillLevel: 'senior',
            });

            const txn = await karigarsService.recordTransaction({
                karigarId: karigar.id,
                storeId: store.id,
                transactionType: 'gold_issue',
                goldAmount: 10,
                goldPurity: 22,
                description: 'QA gold issue test',
                createdBy: userId,
            });

            expect(txn).toBeDefined();
            console.log(`[KGR-04] Gold issue recorded`);
        });

        it('[KGR-05] Record gold return transaction', async () => {
            await setupKarigarEnvironment();

            const karigar = await karigarsService.createKarigar({
                storeId: store.id,
                name: `Return Karigar ${uuidv4().substring(0, 6)}`,
                specialization: 'chain_making',
                skillLevel: 'standard',
            });

            // Issue gold first
            await karigarsService.recordTransaction({
                karigarId: karigar.id,
                storeId: store.id,
                transactionType: 'gold_issue',
                goldAmount: 15,
                goldPurity: 22,
                description: 'Gold issued for job',
                createdBy: userId,
            });

            // Return gold
            const returnTxn = await karigarsService.recordTransaction({
                karigarId: karigar.id,
                storeId: store.id,
                transactionType: 'gold_return',
                goldAmount: 14.5,
                goldPurity: 22,
                description: 'Gold returned from job',
                createdBy: userId,
            });

            expect(returnTxn).toBeDefined();
            console.log(`[KGR-05] Gold return recorded`);
        });

        it('[KGR-06] Get karigar ledger', async () => {
            await setupKarigarEnvironment();

            const karigar = await karigarsService.createKarigar({
                storeId: store.id,
                name: `Ledger Karigar ${uuidv4().substring(0, 6)}`,
                specialization: 'ring_making',
                skillLevel: 'senior',
            });

            // Add some transactions
            await karigarsService.recordTransaction({
                karigarId: karigar.id,
                storeId: store.id,
                transactionType: 'gold_issue',
                goldAmount: 10,
                goldPurity: 22,
                description: 'Test issue',
                createdBy: userId,
            });

            const ledger = await karigarsService.getKarigarLedger(karigar.id, {});
            expect(ledger.transactions.length).toBeGreaterThan(0);
            console.log(`[KGR-06] Ledger transactions: ${ledger.total}`);
        });
    });

    // ========================================================================
    // SECTION 3: STORE SUMMARY
    // ========================================================================
    describe('Store Summary', () => {
        it('[KGR-07] Get karigar store summary', async () => {
            await setupKarigarEnvironment();

            await karigarsService.createKarigar({
                storeId: store.id,
                name: `Summary Karigar ${uuidv4().substring(0, 6)}`,
                specialization: 'ring_making',
                skillLevel: 'senior',
            });

            const summary = await karigarsService.getStoreSummary(store.id);
            expect(summary).toBeDefined();
            console.log(`[KGR-07] Store summary:`, summary);
        });
    });
});
