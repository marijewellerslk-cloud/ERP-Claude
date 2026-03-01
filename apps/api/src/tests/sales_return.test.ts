import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../config/database';
import {
    stores,
    users,
    inventoryItems,
    stockLevels,
    invoices,
    invoiceItems,
    salesReturns,
    salesReturnItems,
    stockMovements
} from '../db/schema';
import { salesService } from '../modules/sales/sales.service';
import { eq, and } from 'drizzle-orm';
import { resetDb } from './helpers/reset-db';

describe('Sales Return Integration', () => {
    let shop1: any;
    let manager1: any;
    let itemSold: any;
    let invoice: any;
    let invoiceItem: any;

    beforeEach(async () => {
        await resetDb();

        // 1. Setup Shop
        [shop1] = await db.insert(stores).values({
            name: 'Shop 1',
            code: 'S1',
            isActive: true
        }).returning();

        // 2. Setup User
        [manager1] = await db.insert(users).values({
            email: 'manager1@test.com',
            passwordHash: 'hash',
            fullName: 'Manager 1',
        }).returning();

        // 3. Setup Item (Sold)
        [itemSold] = await db.insert(inventoryItems).values({
            storeId: shop1.id,
            sku: 'SOLD-ITEM-001',
            name: 'Sold Item',
            itemType: 'finished_goods',
            grossWeight: '10.00',
            netWeight: '10.00',
            status: 'sold'
        }).returning();

        // 4. Create Invoice
        [invoice] = await db.insert(invoices).values({
            invoiceNumber: 'INV-001',
            storeId: shop1.id,
            totalAmount: '1000.00',
            finalAmount: '1000.00',
            paymentStatus: 'paid',
            createdBy: manager1.id
        }).returning();

        [invoiceItem] = await db.insert(invoiceItems).values({
            invoiceId: invoice.id,
            inventoryItemId: itemSold.id,
            itemDescription: 'Sold Item',
            quantity: 1,
            unitPrice: '1000.00',
            lineTotal: '1000.00'
        }).returning();
    });

    it('should successfully request and approve a sales return', async () => {
        // Step 1: Request Return
        const returnInput = {
            invoiceId: invoice.id,
            items: [{
                inventoryItemId: itemSold.id,
                invoiceItemId: invoiceItem.id,
                quantity: 1,
                refundAmount: 1000,
                condition: 'good' as const
            }],
            reason: 'Defective',
            refundMethod: 'cash' as const
        };

        const returnRecord = await salesService.createReturn(returnInput, manager1.id, shop1.id);

        expect(returnRecord).toBeDefined();
        expect(returnRecord.status).toBe('requested');
        expect(Number(returnRecord.totalRefundAmount)).toBe(1000);

        // Verify Return Items
        const returnItemsList = await db.query.salesReturnItems.findMany({
            where: eq(salesReturnItems.returnId, returnRecord.id)
        });
        expect(returnItemsList).toHaveLength(1);
        expect(returnItemsList[0].inventoryItemId).toBe(itemSold.id);


        // Step 2: Approve Return
        const processInput = {
            returnId: returnRecord.id,
            action: 'approve' as const
        };

        const processResult = await salesService.processReturn(processInput, manager1.id, shop1.id);
        expect(processResult.message).toContain('processed successfully');

        // Verify Return Status
        const updatedReturn = await db.query.salesReturns.findFirst({
            where: eq(salesReturns.id, returnRecord.id)
        });
        expect(updatedReturn?.status).toBe('completed');

        // Verify Inventory Status (Should be 'returned')
        const returnedItem = await db.query.inventoryItems.findFirst({
            where: eq(inventoryItems.id, itemSold.id)
        });
        expect(returnedItem?.status).toBe('returned');

        // Verify Stock Movement
        const movement = await db.query.stockMovements.findFirst({
            where: and(
                eq(stockMovements.referenceId, returnRecord.id),
                eq(stockMovements.referenceType, 'sales_return')
            )
        });
        expect(movement).toBeDefined();
        expect(movement?.movementType).toBe('return');

        // Verify Stock Level (Should be 1 in Vault)
        const stock = await db.query.stockLevels.findFirst({
            where: and(
                eq(stockLevels.inventoryItemId, itemSold.id),
                eq(stockLevels.storeId, shop1.id)
            )
        });
        expect(Number(stock?.quantity)).toBe(1);
    });
});
