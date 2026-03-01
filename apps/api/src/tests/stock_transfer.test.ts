import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../config/database';
import {
    stores,
    users,
    roles,
    userRoles,
    inventoryItems,
    inventoryTransfers,
    stockLevels
} from '../db/schema';
import { v4 as uuidv4 } from 'uuid';
import { inventoryService } from '../modules/inventory/inventory.service';
import { eq, and } from 'drizzle-orm';
import { resetDb } from './helpers/reset-db';

describe('Inventory Transfer Integration', () => {
    let shop1: any;
    let shop2: any;
    let manager1: any;
    let manager2: any;
    let itemToTransfer: any;

    beforeEach(async () => {
        await resetDb();

        // 1. Setup Shops
        [shop1] = await db.insert(stores).values({
            name: 'Shop 1',
            code: 'S1',
            isActive: true
        }).returning();

        [shop2] = await db.insert(stores).values({
            name: 'Shop 2',
            code: 'S2',
            isActive: true
        }).returning();

        // 2. Setup Users (Managers)
        [manager1] = await db.insert(users).values({
            email: 'manager1@test.com',
            passwordHash: 'hash',
            fullName: 'Manager 1',
        }).returning();

        [manager2] = await db.insert(users).values({
            email: 'manager2@test.com',
            passwordHash: 'hash',
            fullName: 'Manager 2',
        }).returning();

        // 3. Setup Item in Shop 1
        [itemToTransfer] = await db.insert(inventoryItems).values({
            storeId: shop1.id,
            sku: 'TRANS-ITEM-001',
            name: 'Transfer Item',
            itemType: 'finished_goods',
            grossWeight: '10.00',
            netWeight: '10.00',
            status: 'available'
        }).returning();

        // 4. Initial Stock Level
        await db.insert(stockLevels).values({
            storeId: shop1.id,
            inventoryItemId: itemToTransfer.id,
            quantity: 1,
            location: 'Vault'
        });
    });

    it('should successfully transfer an item from Shop 1 to Shop 2', async () => {
        // Step 1: Create Transfer (Shop 1 -> Shop 2)
        const transferInput = {
            destinationStoreId: shop2.id,
            items: [{
                inventoryItemId: itemToTransfer.id,
                quantity: 1
            }],
            notes: 'Test Transfer'
        };

        console.log('DEBUG: Shop 1 ID:', shop1.id);
        console.log('DEBUG: Shop 2 ID:', shop2.id);
        const storeCheck = await db.query.stores.findFirst({ where: eq(stores.id, shop1.id) });
        console.log('DEBUG: Store Check:', storeCheck);

        const transfer = await inventoryService.createTransfer(transferInput, shop1.id, manager1.id);

        expect(transfer).toBeDefined();
        expect(transfer.status).toBe('in_transit');
        expect(transfer.sourceStoreId).toBe(shop1.id);
        expect(transfer.destinationStoreId).toBe(shop2.id);

        // Verify Item is In Transit and locked in Shop 1
        const itemInTransit = await db.query.inventoryItems.findFirst({
            where: eq(inventoryItems.id, itemToTransfer.id)
        });
        expect(itemInTransit?.status).toBe('in_transit');
        expect(itemInTransit?.storeId).toBe(shop1.id); // Still belongs to Shop 1 until received

        // Verify Stock Level in Shop 1 (Should be 0)
        const stock1 = await db.query.stockLevels.findFirst({
            where: and(
                eq(stockLevels.storeId, shop1.id),
                eq(stockLevels.inventoryItemId, itemToTransfer.id)
            )
        });
        expect(Number(stock1?.quantity)).toBe(0);

        // Verify "Get Transfers" (Outbound for Shop 1)
        const outboundTransfers = await inventoryService.getTransfers(shop1.id, { type: 'outbound' });
        expect(outboundTransfers).toHaveLength(1);
        expect(outboundTransfers[0].id).toBe(transfer.id);

        // Verify "Get Transfer By ID"
        const transferDetails = await inventoryService.getTransferById(transfer.id, shop1.id);
        expect(transferDetails).toBeDefined();
        expect(transferDetails?.items[0].inventoryItemId).toBe(itemToTransfer.id);

        // Verify Global Search returns nothing (item is in_transit, not available)
        const searchMidTransit = await inventoryService.searchGlobalInventory(itemToTransfer.sku);
        expect(searchMidTransit).toHaveLength(0);


        // Step 2: Receive Transfer (at Shop 2)
        const receiveInput = {
            transferId: transfer.id,
            notes: 'Received in good condition'
        };

        const result = await inventoryService.receiveTransfer(receiveInput, shop2.id, manager2.id);

        expect(result.success).toBe(true);

        // Verify Transfer Completed
        const completedTransfer = await db.query.inventoryTransfers.findFirst({
            where: eq(inventoryTransfers.id, transfer.id)
        });
        expect(completedTransfer?.status).toBe('completed');
        expect(completedTransfer?.receivedBy).toBe(manager2.id);

        // Verify Item Moved to Shop 2 and is Available
        const itemReceived = await db.query.inventoryItems.findFirst({
            where: eq(inventoryItems.id, itemToTransfer.id)
        });
        expect(itemReceived?.status).toBe('available');
        expect(itemReceived?.storeId).toBe(shop2.id);

        // Verify Stock Level in Shop 2 (Should be 1)
        const stock2 = await db.query.stockLevels.findFirst({
            where: and(
                eq(stockLevels.storeId, shop2.id),
                eq(stockLevels.inventoryItemId, itemToTransfer.id)
            )
        });
        expect(Number(stock2?.quantity)).toBe(1);

        // Step 3: Verify Read APIs After Receive

        // Verify "Get Transfers" (Inbound for Shop 2)
        const inboundTransfers = await inventoryService.getTransfers(shop2.id, { type: 'inbound' });
        expect(inboundTransfers).toHaveLength(1);
        expect(inboundTransfers[0].id).toBe(transfer.id);
        expect(inboundTransfers[0].status).toBe('completed');

        // Verify "Get Transfer By ID" from destination store
        const transferFromDest = await inventoryService.getTransferById(transfer.id, shop2.id);
        expect(transferFromDest).toBeDefined();
        expect(transferFromDest?.items[0].status).toBe('received');

        // Verify Global Search now finds item available at Shop 2
        const searchResults = await inventoryService.searchGlobalInventory(itemToTransfer.sku);
        expect(searchResults).toHaveLength(1);
        expect(searchResults[0].storeName).toBe('Shop 2');
    });

    it('should fail to transfer if item is not available', async () => {
        // Set item to 'sold' to make it unavailable
        await db.update(inventoryItems)
            .set({ status: 'sold' })
            .where(eq(inventoryItems.id, itemToTransfer.id));

        const transferInput = {
            destinationStoreId: shop2.id,
            items: [{
                inventoryItemId: itemToTransfer.id,
                quantity: 1
            }]
        };

        await expect(
            inventoryService.createTransfer(transferInput, shop1.id, manager1.id)
        ).rejects.toThrow();
    });
});
