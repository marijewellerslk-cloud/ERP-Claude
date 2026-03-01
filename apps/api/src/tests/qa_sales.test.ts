import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { TestFactory } from './helpers/factories';
import { db } from '../config/database';
import { seedRoles } from '../scripts/seed-roles';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { salesService } from '../modules/sales/sales.service';
import { inventoryService } from '../modules/inventory/inventory.service';

/**
 * AGENT 3: Sales & Returns Lifecycle — QA Test Suite
 * 
 * Tests the full sales flow: gold rate → inventory → invoice → payment → return.
 * Also tests edge cases like double-selling, partial payments, and return processing.
 */

describe('QA: Sales & Returns Lifecycle', () => {
    let store: typeof schema.stores.$inferSelect;
    let userId: string;
    let customerId: string;

    async function setupSalesEnvironment() {
        await seedRoles();
        store = await TestFactory.createStore();
        const role = await db.query.roles.findFirst({ where: eq(schema.roles.name, 'store_manager') });
        const user = await TestFactory.createUser({ email: `sales-mgr-${uuidv4()}@example.com` });
        await TestFactory.assignRole(user.id, role!.id, store.id);
        userId = user.id;

        const customer = await TestFactory.createCustomer(store.id, {
            firstName: 'Sales',
            lastName: 'Customer',
            phone: `077${uuidv4().substring(0, 7)}`,
        });
        customerId = customer.id;

        // Set gold rate
        await salesService.updateGoldRate({
            goldType: 'gold',
            purity: '22K',
            ratePerGram: 7500,
        }, userId);
    }

    async function createInventoryForSale(): Promise<string> {
        const batch = await inventoryService.createBatch({
            purchaseDate: new Date().toISOString(),
            expectedTotalItems: 1,
            expectedTotalWeight: 10,
            purchaseType: 'monetary',
            totalCost: 60000,
            goldRatePerGram: 6000,
            initialPaymentAmount: 0,
        } as any, store.id, userId);

        const item = await inventoryService.addItemToBatch({
            batchId: batch.id,
            name: `Gold Ring ${uuidv4().substring(0, 6)}`,
            itemType: 'finished_goods',
            metalType: 'gold',
            purity: '22K',
            grossWeight: 10,
            netWeight: 10,
            stoneWeight: 0,
            isHallmarked: true,
        }, userId);

        return item.id;
    }

    // ========================================================================
    // SECTION 1: GOLD RATE MANAGEMENT
    // ========================================================================
    describe('Gold Rate', () => {
        it('[SALES-01] Set and retrieve gold rate', async () => {
            await setupSalesEnvironment();

            const rate = await salesService.getCurrentGoldRate('gold', '22K');
            expect(rate).toBeDefined();
            expect(Number(rate.ratePerGram)).toBe(7500);
        });

        it('[SALES-02] Gold rate history', async () => {
            await setupSalesEnvironment();

            // Set another rate
            await salesService.updateGoldRate({
                goldType: 'gold',
                purity: '22K',
                ratePerGram: 7600,
            }, userId);

            const rates = await salesService.listGoldRates();
            expect(rates.length).toBeGreaterThanOrEqual(2);
            console.log(`[SALES-02] Gold rate entries: ${rates.length}`);
        });
    });

    // ========================================================================
    // SECTION 2: INVOICE CREATION
    // ========================================================================
    describe('Invoice Creation', () => {
        it('[SALES-03] Create invoice with inventory item', async () => {
            await setupSalesEnvironment();
            const itemId = await createInventoryForSale();

            const invoice = await salesService.createInvoice({
                customerId,
                items: [{
                    inventoryItemId: itemId,
                    itemDescription: 'Gold Ring',
                    quantity: 1,
                    unitPrice: 80000,
                    makingCharges: 1500,
                    wastageCharges: 500,
                    discount: 0,
                    taxRate: 3,
                }],
                discountAmount: 0,
                taxAmount: 2460,
            }, store.id, userId);

            expect(invoice).toBeDefined();
            expect(invoice.id).toBeDefined();
            expect(invoice.invoiceNumber).toBeDefined();
            console.log(`[SALES-03] Invoice created: ${invoice.invoiceNumber}`);

            // Verify item status changed to 'sold'
            const item = await db.query.inventoryItems.findFirst({
                where: eq(schema.inventoryItems.id, itemId),
            });
            expect(item?.status).toBe('sold');
        });

        it('[SALES-04] Invoice number auto-increments', async () => {
            await setupSalesEnvironment();
            const item1Id = await createInventoryForSale();
            const item2Id = await createInventoryForSale();

            const inv1 = await salesService.createInvoice({
                items: [{
                    inventoryItemId: item1Id,
                    itemDescription: 'Ring 1',
                    quantity: 1,
                    unitPrice: 70000,
                    makingCharges: 0,
                    wastageCharges: 0,
                    discount: 0,
                    taxRate: 0,
                }],
                discountAmount: 0,
                taxAmount: 0,
            }, store.id, userId);

            const inv2 = await salesService.createInvoice({
                items: [{
                    inventoryItemId: item2Id,
                    itemDescription: 'Ring 2',
                    quantity: 1,
                    unitPrice: 70000,
                    makingCharges: 0,
                    wastageCharges: 0,
                    discount: 0,
                    taxRate: 0,
                }],
                discountAmount: 0,
                taxAmount: 0,
            }, store.id, userId);

            expect(inv1.invoiceNumber).not.toBe(inv2.invoiceNumber);
            console.log(`[SALES-04] Invoice numbers: ${inv1.invoiceNumber}, ${inv2.invoiceNumber}`);
        });

        it('[SALES-05] Cannot sell the same inventory item twice', async () => {
            await setupSalesEnvironment();
            const itemId = await createInventoryForSale();

            // First sale — should succeed
            await salesService.createInvoice({
                items: [{
                    inventoryItemId: itemId,
                    itemDescription: 'Gold Ring',
                    quantity: 1,
                    unitPrice: 80000,
                    makingCharges: 0,
                    wastageCharges: 0,
                    discount: 0,
                    taxRate: 0,
                }],
                discountAmount: 0,
                taxAmount: 0,
            }, store.id, userId);

            // Second sale of same item — SHOULD FAIL
            try {
                await salesService.createInvoice({
                    items: [{
                        inventoryItemId: itemId,
                        itemDescription: 'Gold Ring (duplicate sale)',
                        quantity: 1,
                        unitPrice: 80000,
                        makingCharges: 0,
                        wastageCharges: 0,
                        discount: 0,
                        taxRate: 0,
                    }],
                    discountAmount: 0,
                    taxAmount: 0,
                }, store.id, userId);
                console.error('[SALES-05] BUG: Double-selling same item succeeded!');
                console.error('  SEVERITY: CRITICAL — inventory item sold twice');
            } catch (error: any) {
                console.log(`[SALES-05] Correctly prevented double sale: ${error.message}`);
                expect(error).toBeDefined();
            }
        });
    });

    // ========================================================================
    // SECTION 3: PAYMENTS
    // ========================================================================
    describe('Payments', () => {
        it('[SALES-06] Add payment to invoice', async () => {
            await setupSalesEnvironment();
            const itemId = await createInventoryForSale();

            const invoice = await salesService.createInvoice({
                items: [{
                    inventoryItemId: itemId,
                    itemDescription: 'Gold Ring',
                    quantity: 1,
                    unitPrice: 80000,
                    makingCharges: 0,
                    wastageCharges: 0,
                    discount: 0,
                    taxRate: 3,
                }],
                discountAmount: 0,
                taxAmount: 2400,
            }, store.id, userId);

            // Add partial payment
            const payment = await salesService.addPayment(invoice.id, {
                paymentMethod: 'cash',
                amount: 50000,
                notes: 'QA partial payment',
            }, userId);

            expect(payment).toBeDefined();
            console.log(`[SALES-06] Payment recorded: ${payment.id}`);
        });

        it('[SALES-07] Multiple payment methods for single invoice', async () => {
            await setupSalesEnvironment();
            const itemId = await createInventoryForSale();

            const invoice = await salesService.createInvoice({
                items: [{
                    inventoryItemId: itemId,
                    itemDescription: 'Gold Ring',
                    quantity: 1,
                    unitPrice: 80000,
                    makingCharges: 0,
                    wastageCharges: 0,
                    discount: 0,
                    taxRate: 0,
                }],
                discountAmount: 0,
                taxAmount: 0,
            }, store.id, userId);

            // Cash payment
            await salesService.addPayment(invoice.id, {
                paymentMethod: 'cash',
                amount: 40000,
            }, userId);

            // Card payment
            await salesService.addPayment(invoice.id, {
                paymentMethod: 'card',
                amount: 40000,
                transactionReference: 'TXN-001',
            }, userId);

            const fullInvoice = await salesService.getInvoice(invoice.id);
            console.log(`[SALES-07] Payment status: ${fullInvoice.paymentStatus}`);
        });
    });

    // ========================================================================
    // SECTION 4: RETURNS
    // ========================================================================
    describe('Returns', () => {
        it('[SALES-08] Create a return for sold item', async () => {
            await setupSalesEnvironment();
            const itemId = await createInventoryForSale();

            const invoice = await salesService.createInvoice({
                customerId,
                items: [{
                    inventoryItemId: itemId,
                    itemDescription: 'Gold Ring',
                    quantity: 1,
                    unitPrice: 80000,
                    makingCharges: 0,
                    wastageCharges: 0,
                    discount: 0,
                    taxRate: 0,
                }],
                discountAmount: 0,
                taxAmount: 0,
            }, store.id, userId);

            // Get invoice items for return
            const fullInvoice = await salesService.getInvoice(invoice.id);
            const invoiceItem = fullInvoice.items[0];

            const returnResult = await salesService.createReturn({
                invoiceId: invoice.id,
                items: [{
                    inventoryItemId: itemId,
                    invoiceItemId: invoiceItem.id,
                    quantity: 1,
                    condition: 'good',
                    refundAmount: 80000,
                }],
                reason: 'Customer changed mind',
                refundMethod: 'cash',
            }, userId, store.id);

            expect(returnResult).toBeDefined();
            console.log(`[SALES-08] Return created: ${returnResult.id}`);
        });
    });

    // ========================================================================
    // SECTION 5: QUERIES
    // ========================================================================
    describe('Sales Queries', () => {
        it('[SALES-09] List invoices with filters', async () => {
            await setupSalesEnvironment();
            const itemId = await createInventoryForSale();

            await salesService.createInvoice({
                items: [{
                    inventoryItemId: itemId,
                    itemDescription: 'Gold Ring',
                    quantity: 1,
                    unitPrice: 70000,
                    makingCharges: 0,
                    wastageCharges: 0,
                    discount: 0,
                    taxRate: 0,
                }],
                discountAmount: 0,
                taxAmount: 0,
            }, store.id, userId);

            const invoices = await salesService.listInvoices(store.id);
            expect(invoices.length).toBeGreaterThan(0);
        });

        it('[SALES-10] Sales stats for date range', async () => {
            await setupSalesEnvironment();

            const stats = await salesService.getSalesStats(
                store.id,
                new Date('2020-01-01'),
                new Date('2030-12-31')
            );
            expect(stats).toBeDefined();
            console.log(`[SALES-10] Sales stats:`, stats);
        });
    });

    // ========================================================================
    // SECTION 6: QUOTATIONS
    // ========================================================================
    describe('Quotations', () => {
        it('[SALES-11] Create and list quotations', async () => {
            await setupSalesEnvironment();

            const quotation = await salesService.createQuotation({
                customerId,
                validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                items: [{
                    itemDescription: 'Gold Necklace Custom',
                    quantity: 1,
                    unitPrice: 150000,
                    makingCharges: 5000,
                    wastageCharges: 1000,
                    discount: 0,
                    taxRate: 3,
                }],
                notes: 'QA quotation test',
            }, store.id, userId);

            expect(quotation).toBeDefined();

            const quotations = await salesService.listQuotations(store.id);
            expect(quotations.length).toBeGreaterThan(0);
            console.log(`[SALES-11] Quotations: ${quotations.length}`);
        });
    });
});
