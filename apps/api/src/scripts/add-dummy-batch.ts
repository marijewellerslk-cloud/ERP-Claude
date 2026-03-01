import { db, connection } from '../config/database.js';
import {
  inventoryItems,
  inventoryBatches,
  inventoryBatchItems,
  stockLevels,
  stockMovements,
  stones,
  purchasePayments,
  inventoryCategories,
  suppliers,
  stores,
  users,
} from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

// Configuration
const BATCH_COUNT = 1;
const ITEMS_PER_BATCH_MIN = 5;
const ITEMS_PER_BATCH_MAX = 10;
const FORCE_DISCREPANCY = true; // Set to true to force a weight discrepancy

const ITEM_DESCRIPTIONS = {
  Rings: ['Plain Band', 'Designer Ring', 'Engagement Ring', 'Wedding Band'],
  Necklaces: ['Chain Necklace', 'Designer Necklace', 'Temple Necklace'],
  Bangles: ['Plain Bangle', 'Designer Bangle', 'Temple Bangle'],
  Earrings: ['Stud Earrings', 'Jhumka', 'Hoops'],
};

const METAL_TYPES = ['gold', 'silver'];
const GOLD_PURITIES = ['22K', '18K'];
const SILVER_PURITIES = ['925'];

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function getStoreAndUser() {
  const [store] = await db.select().from(stores).limit(1);
  if (!store) throw new Error('No store found.');
  
  const [user] = await db.select().from(users).limit(1);
  if (!user) throw new Error('No user found.');
  
  return { store, user };
}

async function getSupplier(storeId: string) {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.storeId, storeId)).limit(1);
    if (supplier) return supplier;
    
    // Create one if not exists
    const [newSupplier] = await db.insert(suppliers).values({
        storeId,
        supplierCode: 'SUP-TEST',
        businessName: 'Test Supplier',
        contactPersonName: 'Tester',
        email: 'test@example.com',
        phone: '0000000000',
        address: 'Test Address',
        city: 'Test City',
        supplierType: 'wholesaler',
        isActive: true,
    }).returning();
    return newSupplier;
}

async function getCategoryMap() {
    const categories = await db.select().from(inventoryCategories);
    const map: Record<string, string> = {};
    categories.forEach(c => map[c.name] = c.id);
    return map;
}

async function createBatchAndItems() {
  console.log('🏁 Starting Dummy Data Creation...');
  
  const { store, user } = await getStoreAndUser();
  const supplier = await getSupplier(store.id);
  const categoryMap = await getCategoryMap();
  
  const expectedItems = randomInt(ITEMS_PER_BATCH_MIN, ITEMS_PER_BATCH_MAX);
  // Calculate expected weight roughly
  let calculatedExpectedWeight = 0;
  
  // Create Batch placeholder first
  const batchNumberRaw = Date.now().toString().slice(-6);
  const [batch] = await db.insert(inventoryBatches).values({
      batchNumber: `BAT-DUMMY-${batchNumberRaw}`,
      storeId: store.id,
      supplierId: supplier.id,
      purchaseDate: new Date(),
      expectedTotalItems: expectedItems,
      expectedTotalWeight: '0', // Will update later
      actualTotalItems: 0,
      actualTotalWeight: '0',
      status: 'in_progress',
      createdBy: user.id
  }).returning();
  
  console.log(`📦 Created Batch: ${batch.batchNumber} (ID: ${batch.id})`);
  
  let actualTotalWeight = 0;
  let itemsCreated = 0;
  
  for (let i = 0; i < expectedItems; i++) {
        // ... Logic to create item ...
        const categoryName = randomElement(Object.keys(ITEM_DESCRIPTIONS));
        
        // Skip if category doesn't exist in map (e.g. if DB is empty of categories)
        if (!categoryMap[categoryName]) continue;
        
        const description = randomElement(ITEM_DESCRIPTIONS[categoryName as keyof typeof ITEM_DESCRIPTIONS]);
        const metalType = randomElement(METAL_TYPES);
        const purity = metalType === 'gold' ? randomElement(GOLD_PURITIES) : randomElement(SILVER_PURITIES);
        
        const grossWeight = randomInRange(2, 15);
        const stoneWeight = grossWeight > 5 && Math.random() > 0.7 ? randomInRange(0.1, 1) : 0;
        const netWeight = grossWeight - stoneWeight;
        
        actualTotalWeight += grossWeight;
        calculatedExpectedWeight += grossWeight; // Matches ideally
        
        const sku = `DUMMY-${batchNumberRaw}-${i}`;
        const itemName = `${purity} ${metalType} ${description}`;
        
         const [item] = await db.insert(inventoryItems).values({
            storeId: store.id,
            categoryId: categoryMap[categoryName],
            sku: sku,
            barcode: sku,
            name: itemName,
            description: 'Dummy item',
            itemType: 'finished_goods',
            metalType,
            purity,
            grossWeight: grossWeight.toFixed(3),
            netWeight: netWeight.toFixed(3),
            stoneWeight: stoneWeight.toFixed(3),
            isActive: true,
             costCalculationMethod: 'rate_based',
        }).returning();
        
        await db.insert(inventoryBatchItems).values({
            batchId: batch.id,
            inventoryItemId: item.id,
            sequenceNumber: i + 1,
        });

        // Stock stock_levels
        await db.insert(stockLevels).values({
            inventoryItemId: item.id,
            storeId: store.id,
            quantity: 1,
            location: 'dummy_loc'
        });

        itemsCreated++;
  }
  
  // Introduce Discrepancy if needed
  let finalExpectedWeight = calculatedExpectedWeight;
  if (FORCE_DISCREPANCY) {
      finalExpectedWeight += 5.5; // Add 5.5g to expected to cause mismatch
      console.log('⚠️  Forcing discrepancy: Added 5.5g to expected weight.');
  }

  // Update Batch
  await db.update(inventoryBatches)
    .set({
        expectedTotalWeight: finalExpectedWeight.toFixed(3),
        actualTotalItems: itemsCreated,
        actualTotalWeight: actualTotalWeight.toFixed(3),
        status: FORCE_DISCREPANCY ? 'discrepancy' : 'completed' 
    })
    .where(eq(inventoryBatches.id, batch.id));

  console.log(`✅ Finished. Created ${itemsCreated} items.`);
  console.log(`   Expected Weight: ${finalExpectedWeight.toFixed(3)}`);
  console.log(`   Actual Weight: ${actualTotalWeight.toFixed(3)}`);
  console.log(`   Status: ${FORCE_DISCREPANCY ? 'DISCREPANCY' : 'COMPLETED'}`);
}

async function main() {
    try {
        await createBatchAndItems();
        await connection.end();
        process.exit(0);
    } catch (e) {
        console.error('❌ Error', e);
        await connection.end();
        process.exit(1);
    }
}

main();
