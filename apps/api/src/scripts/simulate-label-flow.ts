
import { db } from '../config/database';
import { inventoryBatches, inventoryItems, stores, inventoryBatchItems, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

async function runSimulation() {
    console.log('🚀 Starting Label Flow Simulation...');

    const batchId = uuidv4();
    const itemId = uuidv4();

    try {
        // Get a store ID
        const store = await db.query.stores.findFirst();
        if (!store) {
            throw new Error('No store found to run simulation against');
        }
        const storeId = store.id;

        // Get a user ID for createdBy
        const user = await db.query.users.findFirst();
        if (!user) {
            throw new Error('No user found to run simulation against');
        }
        const userId = user.id;

        // 1. Create a dummy batch
        console.log('📦 Creating Test Batch...');
        await db.insert(inventoryBatches).values({
            id: batchId,
            batchNumber: `SIM-${Date.now()}`,
            status: 'in_progress',
            storeId: storeId,
            createdBy: userId,
            purchaseDate: new Date(),
            expectedTotalItems: 1,
            expectedTotalWeight: '10.000',
        });
        console.log('✅ Batch Created');

        // 2. Add an item with new fields
        console.log('💎 Adding Inventory Item with new Label Fields...');
        await db.insert(inventoryItems).values({
            id: itemId,
            storeId: storeId,
            sku: `SKU-${Date.now()}`,
            name: 'Simulation Gold Ring',
            itemType: 'finished_goods',
            grossWeight: '10.000',
            netWeight: '10.000',
            purity: '22K',
            metalType: 'gold',
            // NEW FIELDS
            countryOfOrigin: 'Sri Lanka',
            // mocking jsonb fields
            dimensions: { ringSize: '7' },
            imageUrls: ['https://example.com/logo.png'],
        });

        // Link item to batch
        await db.insert(inventoryBatchItems).values({
            id: uuidv4(),
            batchId: batchId,
            inventoryItemId: itemId,
            sequenceNumber: 1
        });

        console.log('✅ Item Added and Linked to Batch');

        // 3. Retrieve the item to verify data persistence
        console.log('🔍 Retrieving Item to verify data...');
        const result = await db.select().from(inventoryItems).where(eq(inventoryItems.id, itemId));

        if (result.length > 0) {
            const item = result[0];
            console.log('📄 Item Details:');
            console.log(`   - Name: ${item.name}`);
            console.log(`   - Country of Origin: ${item.countryOfOrigin} ${item.countryOfOrigin === 'Sri Lanka' ? '✅ MATCH' : '❌ MISMATCH'}`);
            console.log(`   - Purity: ${item.purity}`);
            console.log(`   - Image URLs: ${JSON.stringify(item.imageUrls)}`);
        } else {
            console.error('❌ Failed to retrieve item');
        }

        // Cleanup
        console.log('🧹 Cleaning up test data...');
        // Delete batch item first (cascade usually handles this but being explicit)
        // await db.delete(inventoryBatchItems).where(eq(inventoryBatchItems.inventoryItemId, itemId)); 
        // Delete item
        await db.delete(inventoryItems).where(eq(inventoryItems.id, itemId));
        // Delete batch
        await db.delete(inventoryBatches).where(eq(inventoryBatches.id, batchId));
        console.log('✅ Cleanup complete');

    } catch (error) {
        console.error('❌ Simulation Failed:', error);
    } finally {
        process.exit(0);
    }
}

runSimulation();
