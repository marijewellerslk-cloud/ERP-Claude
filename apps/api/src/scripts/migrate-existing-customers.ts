/**
 * Migrate existing customers to CRM system
 * - Initialize buying habits records
 * - Calculate initial RFM scores
 * - Set default communication preferences
 *
 * Run with: npx tsx src/scripts/migrate-existing-customers.ts
 */

import { db } from '../config/database.js';
import { customers, customerBuyingHabits, invoices, stores } from '../db/schema.js';
import { eq, and, isNull, count } from 'drizzle-orm';
import { buyingHabitsService } from '../services/buying-habits.service.js';

async function migrateExistingCustomers() {
  console.log('Starting customer CRM migration...\n');

  try {
    // Get all active stores
    const activeStores = await db.query.stores.findMany({
      where: eq(stores.isActive, true),
    });

    if (activeStores.length === 0) {
      console.log('No active stores found.');
      process.exit(1);
    }

    console.log(`Found ${activeStores.length} active store(s)\n`);

    let totalMigrated = 0;
    let totalSkipped = 0;

    for (const store of activeStores) {
      console.log(`\nProcessing store: ${store.name} (${store.id})`);

      // Get all customers for this store
      const storeCustomers = await db.query.customers.findMany({
        where: eq(customers.storeId, store.id),
      });

      console.log(`  Found ${storeCustomers.length} customers`);

      for (const customer of storeCustomers) {
        // Check if buying habits record already exists
        const existingHabits = await db.query.customerBuyingHabits.findFirst({
          where: eq(customerBuyingHabits.customerId, customer.id),
        });

        if (existingHabits) {
          totalSkipped++;
          continue;
        }

        // Calculate and create buying habits
        try {
          await buyingHabitsService.calculateCustomerHabits(customer.id, store.id);
          totalMigrated++;

          if (totalMigrated % 10 === 0) {
            console.log(`  Processed ${totalMigrated} customers...`);
          }
        } catch (error) {
          console.error(`  Error processing customer ${customer.id}:`, error);
        }
      }

      // Calculate RFM scores for all customers in this store
      console.log(`  Calculating RFM scores for store...`);
      await buyingHabitsService.calculateRFMScores(store.id);

      // Update customers with default communication preferences if not set
      const customersWithoutPrefs = await db
        .update(customers)
        .set({
          whatsappOptIn: false,
          emailOptIn: true,
          communicationPreferences: { promotions: true, reminders: true, updates: true },
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(customers.storeId, store.id),
            isNull(customers.communicationPreferences)
          )
        )
        .returning({ id: customers.id });

      console.log(`  Updated ${customersWithoutPrefs.length} customers with default preferences`);
    }

    console.log('\n========================================');
    console.log('Migration Summary:');
    console.log(`  - Customers migrated: ${totalMigrated}`);
    console.log(`  - Customers skipped (already migrated): ${totalSkipped}`);
    console.log('========================================\n');

    console.log('Customer CRM migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }

  process.exit(0);
}

migrateExistingCustomers();
