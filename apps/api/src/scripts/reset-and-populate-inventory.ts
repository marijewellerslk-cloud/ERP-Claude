/**
 * Script to reset inventory data and populate with sample data
 *
 * Usage: npm run script:reset-inventory
 *
 * WARNING: This will DELETE ALL inventory data including:
 * - Inventory items
 * - Inventory batches and batch items
 * - Stock levels
 * - Stock movements
 * - Stones
 * - Purchase payments
 * - Categories (optional - will preserve if they exist)
 */

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

// Sample data templates
interface CategoryTemplate {
  name: string;
  requiresLength?: boolean;
  requiresWidth?: boolean;
  requiresHeight?: boolean;
  requiresInternalSize?: boolean;
  requiresRingSize?: boolean;
}

const CATEGORIES: CategoryTemplate[] = [
  { name: 'Rings', requiresRingSize: true, requiresInternalSize: true },
  { name: 'Necklaces', requiresLength: true },
  { name: 'Bangles', requiresInternalSize: true },
  { name: 'Earrings' },
  { name: 'Bracelets', requiresLength: true },
  { name: 'Chains', requiresLength: true },
  { name: 'Pendants', requiresLength: true, requiresWidth: true },
  { name: 'Anklets', requiresLength: true },
];

const METAL_TYPES = ['gold', 'silver', 'platinum'];
const GOLD_PURITIES = ['22K', '18K', '14K'];
const SILVER_PURITIES = ['925', '999'];

const ITEM_DESCRIPTIONS = {
  Rings: ['Plain Band', 'Designer Ring', 'Engagement Ring', 'Wedding Band', 'Statement Ring'],
  Necklaces: ['Chain Necklace', 'Designer Necklace', 'Temple Necklace', 'Pearl Necklace'],
  Bangles: ['Plain Bangle', 'Designer Bangle', 'Temple Bangle', 'Kada'],
  Earrings: ['Stud Earrings', 'Jhumka', 'Hoops', 'Drop Earrings'],
  Bracelets: ['Chain Bracelet', 'Designer Bracelet', 'Tennis Bracelet'],
  Chains: ['Box Chain', 'Rope Chain', 'Cable Chain', 'Singapore Chain'],
  Pendants: ['Heart Pendant', 'Religious Pendant', 'Designer Pendant'],
  Anklets: ['Plain Anklet', 'Designer Anklet', 'Beaded Anklet'],
};

// Weight ranges for different categories (in grams)
const WEIGHT_RANGES = {
  Rings: { min: 2, max: 8 },
  Necklaces: { min: 8, max: 40 },
  Bangles: { min: 20, max: 50 },
  Earrings: { min: 1.5, max: 6 },
  Bracelets: { min: 5, max: 15 },
  Chains: { min: 3, max: 20 },
  Pendants: { min: 1, max: 8 },
  Anklets: { min: 8, max: 25 },
};

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function resetInventoryData() {
  // CRITICAL SAFETY CHECK
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL SAFETY: Cannot reset inventory in production environment');
  }

  console.log('🗑️  Deleting all inventory data...');

  // Delete in correct order due to foreign key constraints
  await db.delete(purchasePayments);
  console.log('   ✓ Purchase payments deleted');

  await db.delete(stones);
  console.log('   ✓ Stones deleted');

  await db.delete(stockMovements);
  console.log('   ✓ Stock movements deleted');

  await db.delete(stockLevels);
  console.log('   ✓ Stock levels deleted');

  await db.delete(inventoryBatchItems);
  console.log('   ✓ Inventory batch items deleted');

  await db.delete(inventoryItems);
  console.log('   ✓ Inventory items deleted');

  await db.delete(inventoryBatches);
  console.log('   ✓ Inventory batches deleted');

  // Don't delete categories, we'll reuse or create them
  console.log('✅ All inventory data deleted\n');
}

async function ensureCategories() {
  console.log('📦 Ensuring categories exist...');

  const existingCategories = await db.select().from(inventoryCategories);
  const categoryMap: Record<string, string> = {};

  for (const category of CATEGORIES) {
    const existing = existingCategories.find((c: any) => c.name === category.name);

    if (existing) {
      categoryMap[category.name] = existing.id;
      console.log(`   ✓ Category "${category.name}" already exists`);
    } else {
      const [newCategory] = await db
        .insert(inventoryCategories)
        .values({
          name: category.name,
          requiresLength: category.requiresLength ?? false,
          requiresWidth: category.requiresWidth ?? false,
          requiresHeight: category.requiresHeight ?? false,
          requiresInternalSize: category.requiresInternalSize ?? false,
          requiresRingSize: category.requiresRingSize ?? false,
        })
        .returning();

      categoryMap[category.name] = newCategory.id;
      console.log(`   ✓ Created category "${category.name}"`);
    }
  }

  console.log('✅ Categories ready\n');
  return categoryMap;
}

async function ensureSupplier(storeId: string): Promise<string> {
  console.log('🏢 Ensuring supplier exists...');

  // Check if a supplier exists for this store
  const existingSuppliers = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.storeId, storeId))
    .limit(1);

  if (existingSuppliers.length > 0) {
    console.log(`   ✓ Using existing supplier: ${existingSuppliers[0].businessName}\n`);
    return existingSuppliers[0].id;
  }

  // Create a sample supplier
  const [supplier] = await db
    .insert(suppliers)
    .values({
      storeId,
      supplierCode: 'SUP-001',
      businessName: 'Golden Crafts Jewellers',
      contactPersonName: 'Rajesh Kumar',
      email: 'rajesh@goldencrafts.com',
      phone: '+94771234567',
      whatsapp: '+94771234567',
      address: '123, Gem Street, Colombo',
      city: 'Colombo',
      state: 'Western Province',
      pincode: '00100',
      gstNumber: 'GST29ABCDE1234F1Z5',
      supplierType: 'wholesaler',
      specialization: ['Gold', 'Silver', 'Diamond'],
      defaultCreditDays: 30,
      creditLimit: '1000000',
      rating: 5,
      isActive: true,
    })
    .returning();

  console.log(`   ✓ Created supplier: ${supplier.businessName}\n`);
  return supplier.id;
}

async function createSampleBatch(
  storeId: string,
  supplierId: string,
  userId: string,
  batchNumber: number
) {
  console.log(`📦 Creating batch ${batchNumber}...`);

  const expectedItems = randomInt(15, 30);
  const expectedWeight = expectedItems * randomInRange(5, 15);
  const goldRate = randomInRange(6500, 7500); // Rs per gram

  const purchaseDate = new Date();
  purchaseDate.setDate(purchaseDate.getDate() - randomInt(1, 60)); // Random date within last 60 days

  const [batch] = await db
    .insert(inventoryBatches)
    .values({
      batchNumber: `BATCH-${String(batchNumber).padStart(4, '0')}`,
      storeId,
      supplierId,
      purchaseDate,
      expectedTotalItems: expectedItems,
      actualTotalItems: expectedItems, // We'll match expected
      expectedTotalWeight: expectedWeight.toFixed(3),
      actualTotalWeight: expectedWeight.toFixed(3),
      totalCost: (expectedWeight * goldRate).toFixed(2),
      goldRatePerGram: goldRate.toFixed(2),
      totalPaid: (expectedWeight * goldRate * 0.5).toFixed(2), // 50% paid
      outstandingBalance: (expectedWeight * goldRate * 0.5).toFixed(2),
      paymentStatus: 'partial',
      status: 'completed',
      notes: 'Sample batch data',
      createdBy: userId,
      completedAt: new Date(),
    })
    .returning();

  console.log(`   ✓ Batch created: ${batch.batchNumber}`);
  return batch;
}

async function createSampleItems(
  storeId: string,
  batchId: string,
  categoryMap: Record<string, string>,
  userId: string,
  startingSku: number,
  count: number
) {
  console.log(`   Creating ${count} sample items...`);

  const items = [];
  const categoryNames = Object.keys(ITEM_DESCRIPTIONS);

  for (let i = 0; i < count; i++) {
    const categoryName = randomElement(categoryNames);
    const categoryId = categoryMap[categoryName];
    const description = randomElement(ITEM_DESCRIPTIONS[categoryName as keyof typeof ITEM_DESCRIPTIONS]);

    const metalType = randomElement(METAL_TYPES);
    const purity = metalType === 'gold'
      ? randomElement(GOLD_PURITIES)
      : metalType === 'silver'
        ? randomElement(SILVER_PURITIES)
        : '950';

    const weightRange = WEIGHT_RANGES[categoryName as keyof typeof WEIGHT_RANGES];
    const grossWeight = randomInRange(weightRange.min, weightRange.max);
    const stoneWeight = grossWeight > 5 ? randomInRange(0, grossWeight * 0.15) : 0;
    const netWeight = grossWeight - stoneWeight;

    const wastagePercentage = randomInRange(5, 15);
    const costRatePercentage = randomInRange(8, 20);
    const goldRatePerGram = randomInRange(6500, 7500);
    const calculatedCost = (netWeight * goldRatePerGram * (1 + (costRatePercentage + wastagePercentage) / 100));

    const sku = `ITM-${String(startingSku + i).padStart(6, '0')}`;
    const isHallmarked = grossWeight > 2 && Math.random() > 0.3;

    const itemName = `${purity} ${metalType.charAt(0).toUpperCase() + metalType.slice(1)} ${description}`;

    const [item] = await db
      .insert(inventoryItems)
      .values({
        storeId,
        categoryId,
        sku,
        barcode: sku,
        name: itemName,
        description: `${description} in ${purity} ${metalType}`,
        itemType: 'finished_goods',
        metalType,
        purity,
        grossWeight: grossWeight.toFixed(3),
        netWeight: netWeight.toFixed(3),
        stoneWeight: stoneWeight.toFixed(3),
        wastagePercentage: wastagePercentage.toFixed(2),
        costRatePercentage: costRatePercentage.toFixed(2),
        calculatedCost: calculatedCost.toFixed(2),
        costCalculationMethod: 'rate_based',
        isHallmarked,
        hallmarkNumber: isHallmarked ? `HM${randomInt(100000, 999999)}` : null,
        huidNumber: isHallmarked ? `HUID${randomInt(10000000, 99999999)}` : null,
        imageUrls: [],
        isActive: true,
      })
      .returning();

    // Add to batch
    await db.insert(inventoryBatchItems).values({
      batchId,
      inventoryItemId: item.id,
      sequenceNumber: i + 1,
    });

    // Create stock level
    await db.insert(stockLevels).values({
      inventoryItemId: item.id,
      storeId,
      quantity: 1,
      reservedQuantity: 0,
      reorderLevel: 0,
      location: randomElement(['showcase_1', 'showcase_2', 'vault', 'display_case']),
    });

    // Create stock movement
    await db.insert(stockMovements).values({
      inventoryItemId: item.id,
      storeId,
      movementType: 'purchase',
      quantity: 1,
      toLocation: 'showcase_1',
      referenceType: 'batch',
      referenceId: batchId,
      performedBy: userId,
      notes: 'Initial stock from batch import',
    });

    // Add stones if applicable
    if (stoneWeight > 0 && Math.random() > 0.5) {
      const stoneCount = randomInt(1, 10);
      await db.insert(stones).values({
        inventoryItemId: item.id,
        stoneType: randomElement(['diamond', 'ruby', 'emerald', 'sapphire', 'pearl']),
        count: stoneCount,
        totalWeight: stoneWeight.toFixed(3),
        averageWeight: (stoneWeight / stoneCount).toFixed(3),
        shape: randomElement(['round', 'oval', 'princess', 'emerald']),
        color: randomElement(['D', 'E', 'F', 'G', 'H']),
        clarity: randomElement(['IF', 'VVS1', 'VVS2', 'VS1', 'VS2']),
      });
    }

    items.push(item);
  }

  console.log(`   ✓ Created ${count} items (SKU ${startingSku} to ${startingSku + count - 1})`);
  return items;
}

async function populateSampleData() {
  console.log('🌱 Populating sample data...\n');

  // Get the first store
  const [store] = await db.select().from(stores).limit(1);
  if (!store) {
    throw new Error('No store found. Please create a store first.');
  }
  console.log(`📍 Using store: ${store.name}\n`);

  // Get the first user
  const [user] = await db.select().from(users).limit(1);
  if (!user) {
    throw new Error('No user found. Please create a user first.');
  }
  console.log(`👤 Using user: ${user.fullName}\n`);

  // Ensure categories exist
  const categoryMap = await ensureCategories();

  // Ensure supplier exists
  const supplierId = await ensureSupplier(store.id);

  // Create 5 batches with varying numbers of items
  const batchCount = 5;
  let currentSku = 1;

  for (let batchNum = 1; batchNum <= batchCount; batchNum++) {
    const batch = await createSampleBatch(store.id, supplierId, user.id, batchNum);

    const itemCount = batch.expectedTotalItems;
    await createSampleItems(
      store.id,
      batch.id,
      categoryMap,
      user.id,
      currentSku,
      itemCount
    );

    // Add a payment for the batch
    await db.insert(purchasePayments).values({
      batchId: batch.id,
      paymentDate: batch.purchaseDate,
      amount: batch.totalPaid,
      paymentMethod: 'bank_transfer',
      paymentType: 'partial',
      transactionReference: `TXN${randomInt(100000, 999999)}`,
      notes: 'Initial payment',
      createdBy: user.id,
    });

    currentSku += itemCount;
    console.log('');
  }

  console.log('✅ Sample data population complete!\n');

  // Print summary
  const totalItems = await db.select({ count: sql<number>`count(*)` }).from(inventoryItems);
  const totalBatches = await db.select({ count: sql<number>`count(*)` }).from(inventoryBatches);
  const totalWeight = await db.select({
    sum: sql<string>`sum(cast(gross_weight as decimal))`
  }).from(inventoryItems);

  console.log('📊 Summary:');
  console.log(`   • Total Items: ${totalItems[0].count}`);
  console.log(`   • Total Batches: ${totalBatches[0].count}`);
  console.log(`   • Total Gross Weight: ${parseFloat(totalWeight[0].sum || '0').toFixed(3)}g`);
}

async function main() {
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   INVENTORY RESET & SAMPLE DATA POPULATION SCRIPT        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('⚠️  WARNING: This will delete ALL inventory data!\n');

    // In production, you might want to add a confirmation prompt here
    // For now, we'll just proceed

    await resetInventoryData();
    await populateSampleData();

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    SCRIPT COMPLETED                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    logger.error('Script failed:', error);
    await connection.end();
    process.exit(1);
  }
}

// Run the script
main();
