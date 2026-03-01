import { db } from '../config/database.js';
import { suppliers, inventoryBatches, purchasePayments, supplierAccountTransactions } from '../db/schema.js';
import { eq, and, sql, desc, isNull } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

/**
 * Migrate existing supplier data to dual-ledger account system
 * This script:
 * 1. Calculates totals from existing batches for each supplier (monetary + gold)
 * 2. Updates supplier denormalized fields (balance, purchases, payments, gold)
 * 3. Creates historical account transactions for both monetary and gold ledgers
 * 4. Sets initial account status based on balance/credit limit
 */
async function migrateSupplierAccounts() {
  logger.info('Starting supplier account migration with dual-ledger support...');

  try {
    // Get all suppliers
    const allSuppliers = await db.query.suppliers.findMany({
      where: isNull(suppliers.deletedAt),
      columns: {
        id: true,
        storeId: true,
        businessName: true,
        supplierCode: true,
        creditLimit: true,
      },
    });

    logger.info(`Found ${allSuppliers.length} suppliers to migrate`);

    for (const supplier of allSuppliers) {
      logger.info(`\nProcessing supplier: ${supplier.businessName} (${supplier.supplierCode})`);

      // Calculate totals from existing batches
      const [batchStats] = await db
        .select({
          totalCost: sql<string>`COALESCE(SUM(${inventoryBatches.totalCost}), 0)`,
          totalPaid: sql<string>`COALESCE(SUM(${inventoryBatches.totalPaid}), 0)`,
          outstandingBalance: sql<string>`COALESCE(SUM(${inventoryBatches.outstandingBalance}), 0)`,
          totalGoldWeight: sql<string>`COALESCE(SUM(COALESCE(${inventoryBatches.actualTotalWeight}, ${inventoryBatches.expectedTotalWeight}, 0)), 0)`,
          batchCount: sql<number>`COUNT(${inventoryBatches.id})`,
          lastPurchaseDate: sql<Date>`MAX(${inventoryBatches.purchaseDate})`,
        })
        .from(inventoryBatches)
        .where(eq(inventoryBatches.supplierId, supplier.id));

      const totalPurchases = parseFloat(batchStats.totalCost || '0');
      const totalPaid = parseFloat(batchStats.totalPaid || '0');
      const currentBalance = parseFloat(batchStats.outstandingBalance || '0');
      const totalGoldReceived = parseFloat(batchStats.totalGoldWeight || '0');
      const batchCount = Number(batchStats.batchCount) || 0;
      const lastPurchaseDate = batchStats.lastPurchaseDate;

      // Get last payment date
      const lastPayment = await db
        .select({ paymentDate: purchasePayments.paymentDate })
        .from(purchasePayments)
        .innerJoin(inventoryBatches, eq(purchasePayments.batchId, inventoryBatches.id))
        .where(eq(inventoryBatches.supplierId, supplier.id))
        .orderBy(desc(purchasePayments.paymentDate))
        .limit(1);

      const lastPaymentDate = lastPayment.length > 0 ? lastPayment[0].paymentDate : null;

      // Determine account status based on business rules
      const creditLimit = parseFloat(supplier.creditLimit || '0');
      let accountStatus: 'active' | 'on_hold' | 'suspended' = 'active';

      if (creditLimit > 0 && currentBalance > creditLimit) {
        accountStatus = 'suspended';
      } else if (creditLimit > 0 && currentBalance >= creditLimit * 0.9) {
        accountStatus = 'on_hold';
      }

      // Update supplier with calculated values
      await db
        .update(suppliers)
        .set({
          currentBalance: currentBalance.toFixed(2),
          totalLifetimePurchases: totalPurchases.toFixed(2),
          totalLifetimePayments: totalPaid.toFixed(2),
          goldBalanceGrams: totalGoldReceived.toFixed(3),
          totalGoldReceived: totalGoldReceived.toFixed(3),
          totalGoldReturned: '0.000',
          lastPurchaseDate: lastPurchaseDate ? new Date(lastPurchaseDate) : null,
          lastPaymentDate: lastPaymentDate ? new Date(lastPaymentDate) : null,
          accountStatus,
          updatedAt: new Date(),
        })
        .where(eq(suppliers.id, supplier.id));

      logger.info(`  Updated supplier totals:`, {
        batchCount,
        totalPurchases: totalPurchases.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        currentBalance: currentBalance.toFixed(2),
        goldReceived: `${totalGoldReceived.toFixed(3)}g`,
        accountStatus,
      });

      // Create historical account transactions
      if (batchCount > 0) {
        // Get all batches with their payments
        const batches = await db.query.inventoryBatches.findMany({
          where: eq(inventoryBatches.supplierId, supplier.id),
          orderBy: [inventoryBatches.purchaseDate],
          with: {
            purchasePayments: {
              orderBy: [purchasePayments.paymentDate],
            },
          },
        });

        let runningMonetaryBalance = 0;
        let runningGoldBalance = 0;
        const transactionsToInsert: any[] = [];

        for (const batch of batches) {
          const batchCost = parseFloat(batch.totalCost || '0');
          const batchWeight = parseFloat(batch.actualTotalWeight || batch.expectedTotalWeight || '0');
          const userId = batch.createdBy;

          // Monetary purchase transaction (debit - increases balance)
          runningMonetaryBalance += batchCost;
          transactionsToInsert.push({
            supplierId: supplier.id,
            storeId: supplier.storeId,
            ledgerType: 'monetary',
            transactionType: 'purchase',
            referenceType: 'batch',
            referenceId: batch.id,
            debit: batchCost.toFixed(2),
            credit: '0',
            balance: runningMonetaryBalance.toFixed(2),
            goldDebit: '0',
            goldCredit: '0',
            goldBalance: '0',
            description: `Historical: Purchase batch ${batch.batchNumber}`,
            transactionDate: batch.purchaseDate,
            createdBy: userId,
          });

          // Gold transaction if weight exists
          if (batchWeight > 0) {
            runningGoldBalance += batchWeight;
            transactionsToInsert.push({
              supplierId: supplier.id,
              storeId: supplier.storeId,
              ledgerType: 'gold',
              transactionType: 'gold_received',
              referenceType: 'batch',
              referenceId: batch.id,
              debit: '0',
              credit: '0',
              balance: '0',
              goldDebit: batchWeight.toFixed(3),
              goldCredit: '0',
              goldBalance: runningGoldBalance.toFixed(3),
              description: `Historical: Gold received from batch ${batch.batchNumber} (${batchWeight.toFixed(3)}g)`,
              transactionDate: batch.purchaseDate,
              createdBy: userId,
            });
          }

          // Payment transactions (credit - decreases balance)
          if (batch.purchasePayments && batch.purchasePayments.length > 0) {
            for (const payment of batch.purchasePayments) {
              const paymentAmount = parseFloat(payment.amount || '0');
              runningMonetaryBalance -= paymentAmount;

              transactionsToInsert.push({
                supplierId: supplier.id,
                storeId: supplier.storeId,
                ledgerType: 'monetary',
                transactionType: 'payment',
                referenceType: 'payment',
                referenceId: payment.id,
                debit: '0',
                credit: paymentAmount.toFixed(2),
                balance: runningMonetaryBalance.toFixed(2),
                goldDebit: '0',
                goldCredit: '0',
                goldBalance: '0',
                paymentMethod: payment.paymentMethod,
                paymentReference: payment.transactionReference,
                description: `Historical: Payment for batch ${batch.batchNumber}`,
                transactionDate: payment.paymentDate,
                createdBy: payment.createdBy,
              });
            }
          }
        }

        // Insert all transactions in bulk
        if (transactionsToInsert.length > 0) {
          await db.insert(supplierAccountTransactions).values(transactionsToInsert);
          logger.info(`  Created ${transactionsToInsert.length} historical transactions (monetary + gold)`);
        }
      }

      logger.info(`  ✓ Completed migration for ${supplier.businessName}`);
    }

    logger.info('\n✅ Supplier account migration completed successfully!');

    // Summary
    const [summary] = await db
      .select({
        totalSuppliers: sql<number>`COUNT(*)`,
        totalBalance: sql<string>`COALESCE(SUM(${suppliers.currentBalance}), 0)`,
        totalPurchases: sql<string>`COALESCE(SUM(${suppliers.totalLifetimePurchases}), 0)`,
        totalPayments: sql<string>`COALESCE(SUM(${suppliers.totalLifetimePayments}), 0)`,
        totalGoldReceived: sql<string>`COALESCE(SUM(${suppliers.totalGoldReceived}), 0)`,
        totalGoldBalance: sql<string>`COALESCE(SUM(${suppliers.goldBalanceGrams}), 0)`,
        activeCount: sql<number>`COUNT(CASE WHEN ${suppliers.accountStatus} = 'active' THEN 1 END)`,
        onHoldCount: sql<number>`COUNT(CASE WHEN ${suppliers.accountStatus} = 'on_hold' THEN 1 END)`,
        suspendedCount: sql<number>`COUNT(CASE WHEN ${suppliers.accountStatus} = 'suspended' THEN 1 END)`,
      })
      .from(suppliers)
      .where(isNull(suppliers.deletedAt));

    logger.info('\n=== Migration Summary ===');
    logger.info(`Total Suppliers: ${Number(summary.totalSuppliers)}`);
    logger.info(`Total Outstanding: Rs ${parseFloat(summary.totalBalance || '0').toLocaleString()}`);
    logger.info(`Total Purchases: Rs ${parseFloat(summary.totalPurchases || '0').toLocaleString()}`);
    logger.info(`Total Payments: Rs ${parseFloat(summary.totalPayments || '0').toLocaleString()}`);
    logger.info(`Total Gold Received: ${parseFloat(summary.totalGoldReceived || '0').toFixed(3)}g`);
    logger.info(`Total Gold Balance: ${parseFloat(summary.totalGoldBalance || '0').toFixed(3)}g`);
    logger.info(`Account Statuses:`);
    logger.info(`  - Active: ${Number(summary.activeCount)}`);
    logger.info(`  - On Hold: ${Number(summary.onHoldCount)}`);
    logger.info(`  - Suspended: ${Number(summary.suspendedCount)}`);
    logger.info('=========================\n');

    process.exit(0);
  } catch (error) {
    logger.error('Error during supplier account migration:', error);
    process.exit(1);
  }
}

// Run migration
migrateSupplierAccounts();
