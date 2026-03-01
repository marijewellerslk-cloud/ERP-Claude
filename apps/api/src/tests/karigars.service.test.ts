import { describe, it, expect, beforeEach } from 'vitest';
import { karigarsService } from '../modules/karigars/karigars.service';
import { TestFactory } from './helpers/factories';
import { resetDb } from './helpers/reset-db';
import { db } from '../config/database';
import { eq } from 'drizzle-orm';
import { karigars, karigarTransactions } from '../db/schema';

describe('KarigarsService', () => {
    let store: any;
    let user: any;

    beforeEach(async () => {
        await resetDb();
        store = await TestFactory.createStore();
        user = await TestFactory.createUser();
    });

    describe('createKarigar', () => {
        it('should create a new karigar', async () => {
            const input = {
                storeId: store.id,
                name: 'Ramesh GoldSmith',
                phone: '9876543210',
                skillLevel: 'senior' as const,
                rateType: 'per_gram' as const,
                baseLabourRate: 50,
                wastageAllowance: 2.5
            };

            const karigar = await karigarsService.createKarigar(input);
            expect(karigar).toBeDefined();
            expect(karigar.name).toBe(input.name);
            expect(karigar.karigarCode).toContain(store.code);
            expect(karigar.status).toBe('active');
        });
    });

    describe('recordTransaction', () => {
        let karigar: any;

        beforeEach(async () => {
            const input = {
                storeId: store.id,
                name: 'Suresh SilverSmith',
                skillLevel: 'standard' as const,
                rateType: 'per_gram' as const
            };
            karigar = await karigarsService.createKarigar(input);
        });

        it('should record metal issue and update balances', async () => {
            const transaction = await karigarsService.recordTransaction({
                karigarId: karigar.id,
                storeId: store.id,
                transactionType: 'metal_issue',
                goldAmount: 100,
                goldPurity: 91.67,
                description: 'Issue 100g 22k',
                createdBy: user.id
            });

            expect(transaction).toBeDefined();
            expect(transaction.transactionType).toBe('metal_issue');

            const updatedKarigar = await db.query.karigars.findFirst({
                where: eq(karigars.id, karigar.id)
            });

            expect(Number(updatedKarigar?.goldBalance)).toBe(100);
            // Fine gold: (100 * 91.67) / 99.9 = 91.7617...
            expect(Number(updatedKarigar?.fineGoldBalance)).toBeCloseTo(91.7618, 2);
        });

        it('should record metal return and reduce balances', async () => {
            // First issue
            await karigarsService.recordTransaction({
                karigarId: karigar.id,
                storeId: store.id,
                transactionType: 'metal_issue',
                goldAmount: 100,
                goldPurity: 91.67,
                description: 'Issue',
                createdBy: user.id
            });

            // Then return
            await karigarsService.recordTransaction({
                karigarId: karigar.id,
                storeId: store.id,
                transactionType: 'metal_return',
                goldAmount: 50,
                goldPurity: 91.67,
                description: 'Return',
                createdBy: user.id
            });

            const updatedKarigar = await db.query.karigars.findFirst({
                where: eq(karigars.id, karigar.id)
            });

            expect(Number(updatedKarigar?.goldBalance)).toBe(50);
            // Remaining 50g * 91.67 / 99.9
            expect(Number(updatedKarigar?.fineGoldBalance)).toBeCloseTo(45.8809, 2);
        });

        it('should record labour credit (earnings)', async () => {
            await karigarsService.recordTransaction({
                karigarId: karigar.id,
                storeId: store.id,
                transactionType: 'labour_credit',
                cashAmount: 5000,
                description: 'Labour charges for job',
                createdBy: user.id
            });

            const updatedKarigar = await db.query.karigars.findFirst({
                where: eq(karigars.id, karigar.id)
            });

            // Pending labour increases
            expect(Number(updatedKarigar?.pendingLabour)).toBe(5000);
            expect(Number(updatedKarigar?.advanceBalance)).toBe(0);
        });

        it('should record payment to karigar', async () => {
            // First have some labour credit
            await karigarsService.recordTransaction({
                karigarId: karigar.id,
                storeId: store.id,
                transactionType: 'labour_credit',
                cashAmount: 5000,
                description: 'Labour charges',
                createdBy: user.id
            });

            // Pay partial amount
            await karigarsService.makePayment(karigar.id, store.id, 2000, 'cash', undefined, user.id);

            const updatedKarigar = await db.query.karigars.findFirst({
                where: eq(karigars.id, karigar.id)
            });

            expect(Number(updatedKarigar?.pendingLabour)).toBe(3000);
        });

        it('should handle advance payments correctly', async () => {
            // Pay advance (more than pending labour which is 0)
            await karigarsService.recordAdvance(karigar.id, store.id, 2000, 'cash', undefined, user.id);

            const updatedKarigar = await db.query.karigars.findFirst({
                where: eq(karigars.id, karigar.id)
            });

            expect(Number(updatedKarigar?.pendingLabour)).toBe(0);
            expect(Number(updatedKarigar?.advanceBalance)).toBe(2000);

            // Now earn some labour
            await karigarsService.recordTransaction({
                karigarId: karigar.id,
                storeId: store.id,
                transactionType: 'labour_credit',
                cashAmount: 3000, // Earn 3000, verify it offsets advance 2000 -> Pending 1000
                description: 'Labour',
                createdBy: user.id
            });

            const finalKarigar = await db.query.karigars.findFirst({
                where: eq(karigars.id, karigar.id)
            });

            expect(Number(finalKarigar?.advanceBalance)).toBe(0);
            expect(Number(finalKarigar?.pendingLabour)).toBe(1000);
        });
    });

    describe('getKarigarLedger', () => {
        it('should retrieve ledger entries', async () => {
            // Create karigar and transactions...
            const input = { storeId: store.id, name: 'Ledger Karigar' };
            const karigar = await karigarsService.createKarigar(input);

            await karigarsService.recordTransaction({
                karigarId: karigar.id,
                storeId: store.id,
                transactionType: 'metal_issue',
                goldAmount: 10,
                description: 'T1',
                createdBy: user.id
            });

            const ledger = await karigarsService.getKarigarLedger(karigar.id, {});
            expect(ledger.transactions).toHaveLength(1);
            expect(ledger.total).toBe(1);
            expect(ledger.summary.currentGoldBalance).toBe(10);
        });
    });
});
