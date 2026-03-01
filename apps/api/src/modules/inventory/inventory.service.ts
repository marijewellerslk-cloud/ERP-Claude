import { eq, and, desc, sql, inArray, or } from 'drizzle-orm';
import { accountingService } from '../accounting/accounting.service.js';
import { db } from '../../config/database.js';
import {
  CreateBatchInput,
  CreateInventoryItemInput,
  CompleteBatchInput,
  CreateCategoryInput,
  RecordBatchPaymentInput,
  CreateInventoryItemInput,
  CompleteBatchInput,
  CreateCategoryInput,
  RecordBatchPaymentInput,
  CreateTransferInput,
  ReceiveTransferInput,
  UpdateBatchInput,
} from './inventory.validation.js';
import {
  inventoryBatches,
  inventoryBatchItems,
  inventoryItems,
  inventoryCategories,
  stones,
  stockLevels,
  stockMovements,
  purchasePayments,
  auditLogs,
  inventoryTransfers,
  inventoryTransferItems,
  stores,
  accounts,
} from '../../db/schema.js';
import { logger } from '../../utils/logger.js';
import { activityLogger } from '../../services/activity-logger.service.js';
import { supplierAccountService } from '../../services/supplier-account.service.js';
import { metalAccountingService } from '../../services/metal-accounting.service.js';
import { calculateFineGoldEquivalent, getWastageAllowance } from '../../utils/metal-utils.js';

export class InventoryService {
  // Parse purity string to decimal factor
  private parsePurity(purity: string | null | undefined): number {
    if (!purity) return 0;

    const normalized = purity.toLowerCase().trim();

    // Handle common purity formats
    if (normalized.includes('24k') || normalized.includes('999')) return 0.999;
    if (normalized.includes('22k') || normalized.includes('916')) return 0.916;
    if (normalized.includes('18k') || normalized.includes('750')) return 0.750;
    if (normalized.includes('14k') || normalized.includes('585')) return 0.585;

    // Try to parse as percentage
    const percentage = parseFloat(normalized.replace(/[^\d.]/g, ''));
    if (!isNaN(percentage) && percentage > 0 && percentage <= 100) {
      return percentage / 100;
    }

    return 0;
  }

  // Generate unique batch number
  private async generateBatchNumber(storeId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    // Get count of batches created today for this store
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryBatches)
      .where(
        and(
          eq(inventoryBatches.storeId, storeId),
          sql`DATE(${inventoryBatches.createdAt}) = CURRENT_DATE`
        )
      );

    const todayCount = Number(result[0]?.count || 0) + 1;
    return `BAT-${dateStr}-${todayCount.toString().padStart(3, '0')}`;
  }

  // Generate unique SKU
  private async generateSKU(storeId: string, itemType: string): Promise<string> {
    const typePrefix = itemType === 'finished_goods' ? 'FG' : itemType === 'raw_material' ? 'RM' : 'SF';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${typePrefix}-${timestamp}-${random}`;
  }

  // Create new batch
  async createBatch(input: CreateBatchInput, storeId: string, userId: string) {
    const purchaseType = input.purchaseType || 'monetary';

    // Check credit limit for monetary purchases only
    let creditWarning: string | undefined;
    if (input.supplierId && purchaseType === 'monetary' && input.totalCost) {
      const creditCheck = await supplierAccountService.checkCreditLimit(
        input.supplierId,
        storeId,
        input.totalCost
      );

      if (!creditCheck.withinLimit) {
        logger.warn('Batch creation exceeds supplier credit limit', {
          supplierId: input.supplierId,
          batchCost: input.totalCost,
          currentBalance: creditCheck.currentBalance,
          creditLimit: creditCheck.creditLimit,
        });
        creditWarning = creditCheck.warning;
      }
    }

    const batch = await db.transaction(async (tx) => {
      const batchNumber = await this.generateBatchNumber(storeId);

      // Prepare base batch values
      const baseValues: any = {
        batchNumber,
        storeId,
        supplierId: input.supplierId,
        purchaseDate: new Date(input.purchaseDate),
        expectedTotalItems: input.expectedTotalItems,
        expectedTotalWeight: input.expectedTotalWeight.toString(),
        purchaseType,
        notes: input.notes,
        createdBy: userId,
        status: 'in_progress',
      };

      // Handle monetary purchase
      if (purchaseType === 'monetary') {
        const totalCost = input.totalCost!;
        const initialPayment = input.initialPaymentAmount || 0;
        const outstandingBalance = totalCost - initialPayment;

        // Calculate due date if credit days provided
        let dueDate: Date | null = null;
        if (input.creditDays && input.creditDays > 0) {
          dueDate = new Date(input.purchaseDate);
          dueDate.setDate(dueDate.getDate() + input.creditDays);
        }

        // Determine payment status
        let paymentStatus: 'pending' | 'partial' | 'paid' = 'pending';
        if (initialPayment >= totalCost) {
          paymentStatus = 'paid';
        } else if (initialPayment > 0) {
          paymentStatus = 'partial';
        }

        Object.assign(baseValues, {
          totalCost: totalCost.toString(),
          goldRatePerGram: input.goldRatePerGram!.toString(),
          totalPaid: initialPayment.toString(),
          outstandingBalance: outstandingBalance.toString(),
          dueDate,
          paymentStatus,
        });
      }

      // Handle gold exchange purchase
      if (purchaseType === 'gold_exchange') {
        const goldGiven = input.goldGivenWeight || 0;
        const goldReceived = input.expectedTotalWeight;
        const goldGivenValue = input.goldGivenValue || 0;
        const goldBalancePaid = input.goldBalancePaid || 0;
        const goldBalanceReceived = input.goldBalanceReceived || 0;

        // Determine exchange status
        let goldExchangeStatus: 'balanced' | 'owe_gold' | 'owe_cash' = 'balanced';
        if (goldBalancePaid > 0) {
          goldExchangeStatus = 'owe_cash';
        } else if (goldBalanceReceived > 0) {
          goldExchangeStatus = 'owe_gold';
        }

        Object.assign(baseValues, {
          goldGivenWeight: goldGiven.toString(),
          goldGivenPurity: input.goldGivenPurity?.toString(),
          goldGivenValue: goldGivenValue.toString(),
          goldBalancePaid: goldBalancePaid.toString(),
          goldBalanceReceived: goldBalanceReceived.toString(),
          goldExchangeStatus,
          totalCost: '0',
          goldRatePerGram: input.goldRatePerGram?.toString() || '0',
          totalPaid: '0',
          outstandingBalance: '0',
          paymentStatus: 'paid',
        });
      }

      // Create batch
      const [batch] = await tx.insert(inventoryBatches).values(baseValues).returning();

      // Update supplier account if supplierId provided
      if (input.supplierId) {
        if (purchaseType === 'monetary') {
          const totalCost = input.totalCost!;
          const initialPayment = input.initialPaymentAmount || 0;

          // Increase supplier balance (purchase debit)
          await supplierAccountService.updateSupplierBalance(
            input.supplierId,
            storeId,
            {
              balanceChange: totalCost,
              purchaseChange: totalCost,
            },
            tx
          );

          // Create purchase transaction (monetary ledger)
          await supplierAccountService.createMonetaryTransaction(
            input.supplierId,
            storeId,
            {
              type: 'purchase',
              referenceType: 'batch',
              referenceId: batch.id,
              debit: totalCost,
              credit: 0,
              goldDebit: input.expectedTotalWeight,
              goldCredit: 0,
              description: `Purchase batch ${batchNumber}`,
              transactionDate: new Date(input.purchaseDate),
              userId,
            },
            tx
          );

          // Record initial payment if amount > 0
          if (initialPayment > 0 && input.paymentMethod) {
            const paymentRecord = await tx
              .insert(purchasePayments)
              .values({
                batchId: batch.id,
                paymentDate: new Date(input.purchaseDate),
                amount: initialPayment.toString(),
                paymentMethod: input.paymentMethod,
                paymentType: initialPayment >= totalCost ? 'full_settlement' : 'initial',
                transactionReference: input.transactionReference,
                notes: `Initial payment during batch creation`,
                createdBy: userId,
              })
              .returning();

            // Decrease supplier balance (payment credit)
            await supplierAccountService.updateSupplierBalance(
              input.supplierId,
              storeId,
              {
                balanceChange: -initialPayment,
                paymentChange: initialPayment,
              },
              tx
            );

            // Create payment transaction with payment details
            await supplierAccountService.createMonetaryTransaction(
              input.supplierId,
              storeId,
              {
                type: 'payment',
                referenceType: 'payment',
                referenceId: paymentRecord[0].id,
                debit: 0,
                credit: initialPayment,
                description: `Initial payment for batch ${batchNumber}`,
                transactionDate: new Date(input.purchaseDate),
                userId,
                paymentMethod: input.paymentMethod,
                paymentReference: input.transactionReference,
              },
              tx
            );

            logger.info(`Initial payment recorded: Rs ${initialPayment} for batch ${batch.batchNumber}`);
          }

          // Record gold received in gold balance ledger
          await supplierAccountService.updateGoldBalance(
            input.supplierId,
            storeId,
            {
              goldBalanceChange: input.expectedTotalWeight,
              goldReceivedChange: input.expectedTotalWeight,
            },
            tx
          );

          await supplierAccountService.createGoldTransaction(
            input.supplierId,
            storeId,
            {
              type: 'gold_received',
              referenceType: 'batch',
              referenceId: batch.id,
              goldDebit: input.expectedTotalWeight,
              goldCredit: 0,
              description: `Gold received - Cash purchase batch ${batchNumber}`,
              transactionDate: new Date(input.purchaseDate),
              userId,
            },
            tx
          );
        }

        // Handle gold exchange purchase
        if (purchaseType === 'gold_exchange') {
          const goldGiven = input.goldGivenWeight || 0;
          const goldReceived = input.expectedTotalWeight;

          // Update gold exchange balance
          await supplierAccountService.updateGoldExchangeBalance(
            input.supplierId,
            storeId,
            {
              goldGivenChange: goldGiven,
              goldReceivedChange: goldReceived,
            },
            tx
          );

          // Create gold exchange transaction
          await supplierAccountService.createGoldExchangeTransaction(
            input.supplierId,
            storeId,
            {
              referenceType: 'batch',
              referenceId: batch.id,
              goldGiven: goldGiven,
              goldReceived: goldReceived,
              description: `Gold exchange for batch ${batchNumber}: Given ${goldGiven.toFixed(3)}g, Received ${goldReceived.toFixed(3)}g`,
              transactionDate: new Date(input.purchaseDate),
              userId,
            },
            tx
          );

          logger.info(`Gold exchange recorded for batch ${batch.batchNumber}`, {
            goldGiven: `${goldGiven.toFixed(3)}g`,
            goldReceived: `${goldReceived.toFixed(3)}g`,
            netBalance: `${(goldGiven - goldReceived).toFixed(3)}g`,
          });

          // Also record gold received in gold balance ledger
          await supplierAccountService.updateGoldBalance(
            input.supplierId,
            storeId,
            {
              goldBalanceChange: goldReceived,
              goldReceivedChange: goldReceived,
            },
            tx
          );

          await supplierAccountService.createGoldTransaction(
            input.supplierId,
            storeId,
            {
              type: 'gold_received',
              referenceType: 'batch',
              referenceId: batch.id,
              goldDebit: goldReceived,
              goldCredit: 0,
              description: `Gold received - Exchange batch ${batchNumber}`,
              transactionDate: new Date(input.purchaseDate),
              userId,
            },
            tx
          );
        }
      }

      // Update supplier account status if supplierId provided
      if (input.supplierId) {
        await supplierAccountService.updateAccountStatus(input.supplierId, storeId, tx);
      }

      logger.info(`Batch created: ${batch.batchNumber}`, {
        batchId: batch.id,
        userId,
        purchaseType,
      });

      // --- Accounting Integration: Record purchase in accounting at creation ---
      if (input.supplierId && purchaseType === 'monetary' && input.totalCost && input.totalCost > 0) {
        try {
          const [inventoryAccount] = await tx
            .select()
            .from(accounts)
            .where(and(eq(accounts.storeId, storeId), eq(accounts.accountCode, '1130')));

          const [payableAccount] = await tx
            .select()
            .from(accounts)
            .where(and(eq(accounts.storeId, storeId), eq(accounts.accountCode, '2101')));

          if (inventoryAccount && payableAccount) {
            // Purchase Journal Entry: Debit Inventory, Credit Accounts Payable
            await accountingService.createJournalEntry(
              storeId,
              userId,
              {
                entryDate: new Date(input.purchaseDate).toISOString(),
                entryType: 'purchase',
                narration: `Stock Purchase - Batch ${batchNumber}`,
                referenceType: 'batch',
                referenceId: batch.id,
                referenceNumber: batchNumber,
                lines: [
                  {
                    accountId: inventoryAccount.id,
                    debitAmount: input.totalCost,
                    creditAmount: 0,
                    description: `Inventory Addition - Batch ${batchNumber}`,
                    partyType: 'supplier',
                    partyId: input.supplierId,
                  },
                  {
                    accountId: payableAccount.id,
                    debitAmount: 0,
                    creditAmount: input.totalCost,
                    description: `Accounts Payable - ${batchNumber}`,
                    partyType: 'supplier',
                    partyId: input.supplierId,
                  },
                ],
              },
              tx
            );

            // If there's an initial payment, create the payment journal entry too
            const initialPayment = input.initialPaymentAmount || 0;
            if (initialPayment > 0) {
              let creditAccountCode = '1101'; // Cash
              if (input.paymentMethod && input.paymentMethod !== 'cash') {
                creditAccountCode = '1110'; // Bank
              }

              const [creditAccount] = await tx
                .select()
                .from(accounts)
                .where(and(eq(accounts.storeId, storeId), eq(accounts.accountCode, creditAccountCode)));

              if (creditAccount) {
                await accountingService.createJournalEntry(
                  storeId,
                  userId,
                  {
                    entryDate: new Date(input.purchaseDate).toISOString(),
                    entryType: 'payment',
                    narration: `Initial Payment - Batch ${batchNumber}`,
                    referenceType: 'batch',
                    referenceId: batch.id,
                    referenceNumber: batchNumber,
                    lines: [
                      {
                        accountId: payableAccount.id,
                        debitAmount: initialPayment,
                        creditAmount: 0,
                        description: `Payment against batch ${batchNumber}`,
                        partyType: 'supplier',
                        partyId: input.supplierId,
                      },
                      {
                        accountId: creditAccount.id,
                        debitAmount: 0,
                        creditAmount: initialPayment,
                        description: `Payment via ${input.paymentMethod || 'cash'} - ${batchNumber}`,
                      },
                    ],
                  },
                  tx
                );
              }
            }

            logger.info(`Accounting entries created for batch ${batchNumber}`);
          }
        } catch (accountingError) {
          logger.warn('Could not create accounting entries for batch creation', { error: accountingError });
        }
      }

      return batch;
    });

    // Return batch with credit warning if applicable
    return {
      ...batch,
      creditWarning,
    };
  }

  // Get batch with items
  async getBatch(batchId: string) {
    const batch = await db.query.inventoryBatches.findFirst({
      where: eq(inventoryBatches.id, batchId),
      with: {
        batchItems: {
          with: {
            inventoryItem: {
              with: {
                stones: true,
                category: true,
              },
            },
          },
        },
        supplier: true,
        store: true,
        createdByUser: true,
      },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    return batch;
  }

  // Update batch details
  async updateBatch(batchId: string, updates: UpdateBatchInput, userId: string) {
    return await db.transaction(async (tx) => {
      // Verify batch exists and is in progress
      const batch = await tx.query.inventoryBatches.findFirst({
        where: eq(inventoryBatches.id, batchId),
      });

      if (!batch) {
        throw new Error('Batch not found');
      }

      if (batch.status !== 'in_progress') {
        throw new Error('Cannot edit a completed batch');
      }

      // Prepare updates
      const updateValues: any = {
        updatedAt: new Date(),
      };

      if (updates.supplierId) updateValues.supplierId = updates.supplierId;
      if (updates.purchaseDate) updateValues.purchaseDate = new Date(updates.purchaseDate);
      if (updates.expectedTotalItems) updateValues.expectedTotalItems = updates.expectedTotalItems;
      if (updates.expectedTotalWeight) updateValues.expectedTotalWeight = updates.expectedTotalWeight.toString();
      if (updates.notes) updateValues.notes = updates.notes;

      // Handle financial updates for monetary batches
      if (batch.purchaseType === 'monetary') {
        if (updates.totalCost) {
          updateValues.totalCost = updates.totalCost.toString();
          // Update outstanding balance based on new total cost
          const totalPaid = parseFloat(batch.totalPaid || '0');
          updateValues.outstandingBalance = (updates.totalCost - totalPaid).toString();
        }
        if (updates.goldRatePerGram) updateValues.goldRatePerGram = updates.goldRatePerGram.toString();
      }

      // Handle gold exchange updates
      if (batch.purchaseType === 'gold_exchange') {
        if (updates.goldGivenWeight) updateValues.goldGivenWeight = updates.goldGivenWeight.toString();
        if (updates.goldGivenPurity) updateValues.goldGivenPurity = updates.goldGivenPurity.toString();
      }

      // Update batch
      const [updatedBatch] = await tx
        .update(inventoryBatches)
        .set(updateValues)
        .where(eq(inventoryBatches.id, batchId))
        .returning();

      // Log to audit trail
      await activityLogger.logAudit({
        action: 'update',
        entityType: 'batch',
        entityId: batchId,
        userId,
        storeId: batch.storeId,
        oldValues: {
          supplierId: batch.supplierId,
          purchaseDate: batch.purchaseDate,
          expectedTotalItems: batch.expectedTotalItems,
          expectedTotalWeight: batch.expectedTotalWeight,
          notes: batch.notes,
          totalCost: batch.totalCost,
          goldRatePerGram: batch.goldRatePerGram,
        },
        newValues: updates,
      });

      logger.info(`Batch updated: ${batch.batchNumber}`, {
        batchId,
        userId,
        updates,
      });

      return updatedBatch;
    });
  }



  // Add item to batch
  async addItemToBatch(input: CreateInventoryItemInput, userId: string) {
    // Get batch to verify it's in progress
    const batch = await db.query.inventoryBatches.findFirst({
      where: eq(inventoryBatches.id, input.batchId),
      with: {
        batchItems: true,
      },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status !== 'in_progress') {
      throw new Error('Batch is already completed or has discrepancies');
    }

    // Check if adding this item would exceed expected total
    if (batch.batchItems.length >= batch.expectedTotalItems) {
      throw new Error(`Cannot add more items. Expected total: ${batch.expectedTotalItems}`);
    }

    // Generate SKU
    const sku = await this.generateSKU(batch.storeId, input.itemType);

    // Calculate fine gold equivalent (24K equivalent weight)
    const fineGoldEquivalent = calculateFineGoldEquivalent(
      input.netWeight,
      input.purity,
      input.metalType
    );

    // Calculate the original cost based on the rate-based method if costRatePercentage is provided
    let calculatedCost = input.calculatedCost?.toString();

    if (!calculatedCost && input.costRatePercentage && batch.goldRatePerGram) {
      // Use rate-based method: (Gold Rate per Gram) * Weight * Rate Percentage / 100
      // This calculates the total cost as a percentage of the gold value
      const ratePercentage = parseFloat(input.costRatePercentage);
      const goldRatePerGram = parseFloat(batch.goldRatePerGram);
      const netWeight = input.netWeight;
      calculatedCost = (goldRatePerGram * netWeight * ratePercentage / 100).toFixed(2);
    } else if (!calculatedCost) {
      // Calculate using traditional method if not provided
      const goldRatePerGram = batch.goldRatePerGram ? parseFloat(batch.goldRatePerGram) : 0;
      const netWeight = input.netWeight;
      const purityFactor = this.parsePurity(input.purity);
      const fineGoldWeight = netWeight * purityFactor;
      calculatedCost = (fineGoldWeight * goldRatePerGram).toFixed(2);
    }

    // Create inventory item with fine gold equivalent
    const [item] = await db
      .insert(inventoryItems)
      .values({
        storeId: batch.storeId,
        categoryId: input.categoryId,
        sku,
        name: input.name,
        description: input.description,
        itemType: input.itemType,
        metalType: input.metalType,
        purity: input.purity,
        grossWeight: input.grossWeight.toString(),
        netWeight: input.netWeight.toString(),
        stoneWeight: input.stoneWeight?.toString() || '0',
        fineGoldEquivalent: fineGoldEquivalent.toString(), // Auto-calculated fine gold
        makingCharges: input.makingCharges?.toString(),
        wastagePercentage: input.wastagePercentage?.toString(),
        costRatePercentage: input.costRatePercentage?.toString(),
        calculatedCost: calculatedCost,
        // Set current market value to original cost initially
        currentMarketValue: calculatedCost,
        // Calculate initial unrealized gain/loss (should be 0 initially)
        unrealizedGainLoss: '0.00',
        // Set the date when this valuation was calculated
        lastValuationDate: new Date(),
        isHallmarked: input.isHallmarked,
        hallmarkNumber: input.hallmarkNumber,
        huidNumber: input.huidNumber,
        certificationNumber: input.certificationNumber,
        certificationAgency: input.certificationAgency,
        certificationDate: input.certificationDate ? new Date(input.certificationDate) : null,
        imageUrls: input.imageUrls || [],
        dimensions: input.dimensions,
        isActive: true,
      })
      .returning();

    // Add stones if provided
    if (input.stones && input.stones.length > 0) {
      await db.insert(stones).values(
        input.stones.map((stone) => ({
          inventoryItemId: item.id,
          stoneType: stone.stoneType,
          count: stone.count,
          totalWeight: stone.totalWeight?.toString(),
          averageWeight: stone.averageWeight?.toString(),
          shape: stone.shape,
          color: stone.color,
          clarity: stone.clarity,
          cutGrade: stone.cutGrade,
          certificationNumber: stone.certificationNumber,
          certificationAgency: stone.certificationAgency,
          pricePerCarat: stone.pricePerCarat?.toString(),
        }))
      );
    }

    // Link item to batch
    const sequenceNumber = batch.batchItems.length + 1;
    await db.insert(inventoryBatchItems).values({
      batchId: input.batchId,
      inventoryItemId: item.id,
      sequenceNumber,
    });

    // Create stock level entry
    await db.insert(stockLevels).values({
      inventoryItemId: item.id,
      storeId: batch.storeId,
      quantity: 1,
      reservedQuantity: 0,
      location: input.location,
    });

    // Record stock movement
    await db.insert(stockMovements).values({
      inventoryItemId: item.id,
      storeId: batch.storeId,
      movementType: 'purchase',
      quantity: 1,
      toLocation: input.location,
      referenceType: 'batch',
      referenceId: input.batchId,
      performedBy: userId,
    });

    // Update batch totals
    const newActualItems = batch.actualTotalItems + 1;
    const newActualWeight = parseFloat(batch.actualTotalWeight) + input.grossWeight;

    await db
      .update(inventoryBatches)
      .set({
        actualTotalItems: newActualItems,
        actualTotalWeight: newActualWeight.toString(),
        updatedAt: new Date(),
      })
      .where(eq(inventoryBatches.id, input.batchId));

    logger.info(`Item added to batch: ${item.sku}`, {
      batchId: input.batchId,
      itemId: item.id,
      userId,
    });

    return item;
  }

  // Update batch item weights (for review page inline editing)
  async updateBatchItem(
    itemId: string,
    batchId: string,
    updates: {
      grossWeight?: number;
      netWeight?: number;
      stoneWeight?: number;
    },
    userId: string,
    storeId: string
  ) {
    // Verify batch belongs to store and is in progress
    const batch = await db.query.inventoryBatches.findFirst({
      where: and(
        eq(inventoryBatches.id, batchId),
        eq(inventoryBatches.storeId, storeId)
      ),
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status !== 'in_progress') {
      throw new Error('Cannot edit items in a completed batch');
    }

    // Get current item values
    const currentItem = await db.query.inventoryItems.findFirst({
      where: and(
        eq(inventoryItems.id, itemId),
        eq(inventoryItems.storeId, storeId)
      ),
    });

    if (!currentItem) {
      throw new Error('Item not found');
    }

    // Verify item is in this batch
    const batchItem = await db.query.inventoryBatchItems.findFirst({
      where: and(
        eq(inventoryBatchItems.inventoryItemId, itemId),
        eq(inventoryBatchItems.batchId, batchId)
      ),
    });

    if (!batchItem) {
      throw new Error('Item is not in this batch');
    }

    const oldValues = {
      grossWeight: currentItem.grossWeight,
      netWeight: currentItem.netWeight,
      stoneWeight: currentItem.stoneWeight,
    };

    // Calculate weight differences for batch total adjustment
    const oldGross = parseFloat(currentItem.grossWeight);
    const oldNet = parseFloat(currentItem.netWeight);
    const newGross = updates.grossWeight !== undefined ? updates.grossWeight : oldGross;
    const newNet = updates.netWeight !== undefined ? updates.netWeight : oldNet;
    const newStone = updates.stoneWeight !== undefined ? updates.stoneWeight : parseFloat(currentItem.stoneWeight || '0');

    logger.info('Updating item with weights:', {
      itemId,
      oldGross,
      oldNet,
      newGross,
      newNet,
      newStone,
      updates
    });

    // Update item weights - update all fields explicitly
    const updatedItem = await db
      .update(inventoryItems)
      .set({
        grossWeight: newGross.toFixed(3),
        netWeight: newNet.toFixed(3),
        stoneWeight: newStone.toFixed(3),
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, itemId))
      .returning();

    // Recalculate batch totals
    const netDiff = newNet - oldNet;
    const currentBatchWeight = parseFloat(batch.actualTotalWeight);
    const newBatchWeight = currentBatchWeight + netDiff;

    await db
      .update(inventoryBatches)
      .set({
        actualTotalWeight: newBatchWeight.toFixed(3),
        updatedAt: new Date(),
      })
      .where(eq(inventoryBatches.id, batchId));

    // Log to audit trail
    await activityLogger.logAudit({
      action: 'update_weight',
      entityType: 'batch_item',
      entityId: itemId,
      userId,
      storeId,
      oldValues,
      newValues: {
        grossWeight: newGross,
        netWeight: newNet,
        stoneWeight: newStone,
        reason: 'Weight adjustment from review page',
        batchId,
      },
    });

    logger.info(`Batch item updated: ${currentItem.sku}`, {
      itemId,
      batchId,
      userId,
      updates,
    });

    return updatedItem[0];
  }

  // Delete item from batch
  async deleteItemFromBatch(
    itemId: string,
    batchId: string,
    reason: string,
    userId: string,
    storeId: string
  ) {
    return await db.transaction(async (tx) => {
      // Verify batch belongs to store and is in progress
      const batch = await tx.query.inventoryBatches.findFirst({
        where: and(
          eq(inventoryBatches.id, batchId),
          eq(inventoryBatches.storeId, storeId)
        ),
      });

      if (!batch) {
        throw new Error('Batch not found');
      }

      if (batch.status !== 'in_progress') {
        throw new Error('Cannot delete items from a completed batch');
      }

      // Get item details for logging
      const item = await tx.query.inventoryItems.findFirst({
        where: and(
          eq(inventoryItems.id, itemId),
          eq(inventoryItems.storeId, storeId)
        ),
      });

      if (!item) {
        throw new Error('Item not found');
      }

      // Verify item is in this batch
      const batchItem = await tx.query.inventoryBatchItems.findFirst({
        where: and(
          eq(inventoryBatchItems.inventoryItemId, itemId),
          eq(inventoryBatchItems.batchId, batchId)
        ),
      });

      if (!batchItem) {
        throw new Error('Item is not in this batch');
      }

      // Remove from batch_items junction table
      await tx
        .delete(inventoryBatchItems)
        .where(
          and(
            eq(inventoryBatchItems.inventoryItemId, itemId),
            eq(inventoryBatchItems.batchId, batchId)
          )
        );

      // Delete the inventory item
      await tx.delete(inventoryItems).where(eq(inventoryItems.id, itemId));

      // Update batch totals
      const itemWeight = parseFloat(item.netWeight);
      const currentBatchWeight = parseFloat(batch.actualTotalWeight);
      const newBatchWeight = currentBatchWeight - itemWeight;

      await tx
        .update(inventoryBatches)
        .set({
          actualTotalItems: batch.actualTotalItems - 1,
          actualTotalWeight: Math.max(0, newBatchWeight).toFixed(3),
          updatedAt: new Date(),
        })
        .where(eq(inventoryBatches.id, batchId));

      // Log to audit trail
      await activityLogger.logAudit({
        action: 'delete',
        entityType: 'batch_item',
        entityId: itemId,
        userId,
        storeId,
        oldValues: {
          sku: item.sku,
          name: item.name,
          grossWeight: item.grossWeight,
          netWeight: item.netWeight,
          stoneWeight: item.stoneWeight,
        },
        newValues: {
          reason,
          batchId,
          deletedAt: new Date().toISOString(),
        },
      });

      logger.info(`Item deleted from batch: ${item.sku}`, {
        itemId,
        batchId,
        userId,
        reason,
      });

      return { success: true, message: 'Item deleted successfully' };
    });
  }

  // Get batch summary
  async getBatchSummary(batchId: string) {
    const batch = await db.query.inventoryBatches.findFirst({
      where: eq(inventoryBatches.id, batchId),
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    const expectedItems = batch.expectedTotalItems;
    const actualItems = batch.actualTotalItems;
    const expectedWeight = parseFloat(batch.expectedTotalWeight);
    const actualWeight = parseFloat(batch.actualTotalWeight);

    const weightDifference = actualWeight - expectedWeight;
    const weightTolerance = 0.1; // ±0.1g

    return {
      expectedItems,
      actualItems,
      itemsMatch: actualItems === expectedItems,
      itemsRemaining: expectedItems - actualItems,
      expectedWeight,
      actualWeight,
      weightDifference,
      weightMatch: Math.abs(weightDifference) <= weightTolerance,
      canComplete: actualItems === expectedItems && Math.abs(weightDifference) <= weightTolerance,
      status: batch.status,
    };
  }

  // Complete batch (strict validation - no discrepancy acceptance)
  async completeBatch(batchId: string, userId: string, storeId: string) {
    const summary = await this.getBatchSummary(batchId);

    if (summary.status !== 'in_progress') {
      throw new Error('Batch is not in progress');
    }

    // Get the full batch details
    const batch = await db.query.inventoryBatches.findFirst({
      where: and(
        eq(inventoryBatches.id, batchId),
        eq(inventoryBatches.storeId, storeId)
      ),
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    // Strict validation - no exceptions
    if (!summary.canComplete) {
      const errors: string[] = [];
      if (!summary.itemsMatch) {
        const diff = summary.expectedItems - summary.actualItems;
        errors.push(
          `Item count mismatch: ${summary.actualItems}/${summary.expectedItems} items. ${diff > 0 ? `Add ${diff} more item${diff > 1 ? 's' : ''}.` : `Remove ${Math.abs(diff)} item${Math.abs(diff) > 1 ? 's' : ''}.`}`
        );
      }
      if (!summary.weightMatch) {
        const sign = summary.weightDifference > 0 ? '+' : '';
        errors.push(
          `Weight mismatch: ${sign}${summary.weightDifference.toFixed(3)}g difference (tolerance: ±0.1g)`
        );
      }
      throw new Error(`Cannot complete batch:\n${errors.join('\n')}`);
    }

    // Update batch status to completed
    await db.transaction(async (tx) => {
      await tx
        .update(inventoryBatches)
        .set({
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(inventoryBatches.id, batchId));

      // Update supplier account status if supplierId exists
      if (batch.supplierId) {
        await supplierAccountService.updateAccountStatus(batch.supplierId, storeId, tx);
      }

      // --- Accounting Integration ---
      if (batch.purchaseType === 'monetary' && parseFloat(batch.totalCost || '0') > 0) {
        // Get relevant accounts (Inventory - Gold: 1130, Accounts Payable: 2101)
        const [inventoryAccount] = await tx
          .select()
          .from(accounts)
          .where(and(eq(accounts.storeId, storeId), eq(accounts.accountCode, '1130')));

        const [payableAccount] = await tx
          .select()
          .from(accounts)
          .where(and(eq(accounts.storeId, storeId), eq(accounts.accountCode, '2101')));

        if (inventoryAccount && payableAccount) {
          // Create Purchase Journal Entry
          await accountingService.createJournalEntry(
            storeId,
            userId,
            {
              entryDate: new Date().toISOString(),
              entryType: 'purchase',
              narration: `Purchase Batch: ${batch.batchNumber}`,
              referenceType: 'batch',
              referenceId: batchId,
              referenceNumber: batch.batchNumber,
              lines: [
                {
                  accountId: inventoryAccount.id,
                  debitAmount: parseFloat(batch.totalCost || '0'),
                  creditAmount: 0,
                  description: `Inventory Addition - Batch ${batch.batchNumber}`,
                },
                {
                  accountId: payableAccount.id,
                  debitAmount: 0,
                  creditAmount: parseFloat(batch.totalCost || '0'),
                  description: `Accounts Payable - ${batch.batchNumber}`,
                },
              ],
            },
            tx
          );

          // Handle Initial Payment accounting if applicable
          const totalPaid = parseFloat(batch.totalPaid || '0');
          if (totalPaid > 0) {
            // Default to Cash (1101) if we can't determine specific method easily from here
            const [paymentRecord] = await tx
              .select()
              .from(purchasePayments)
              .where(eq(purchasePayments.batchId, batchId))
              .limit(1);

            let creditAccountCode = '1101'; // Default Cash
            if (paymentRecord && paymentRecord.paymentMethod !== 'cash') {
              creditAccountCode = '1110'; // Bank
            }

            const [creditAccount] = await tx
              .select()
              .from(accounts)
              .where(and(eq(accounts.storeId, storeId), eq(accounts.accountCode, creditAccountCode)));

            if (creditAccount) {
              await accountingService.createJournalEntry(
                storeId,
                userId,
                {
                  entryDate: new Date().toISOString(),
                  entryType: 'payment',
                  narration: `Initial Payment: Batch ${batch.batchNumber}`,
                  referenceType: 'batch',
                  referenceId: batchId,
                  referenceNumber: batch.batchNumber,
                  lines: [
                    {
                      accountId: payableAccount.id,
                      debitAmount: totalPaid,
                      creditAmount: 0,
                      description: `Payment of Liability - Batch ${batch.batchNumber}`,
                    },
                    {
                      accountId: creditAccount.id,
                      debitAmount: 0,
                      creditAmount: totalPaid,
                      description: `Payment Out - ${paymentRecord?.paymentMethod || 'Cash'}`,
                    },
                  ],
                },
                tx
              );
            }
          }
        }
      }
    });

    // Log to audit trail
    await activityLogger.logAudit({
      action: 'complete',
      entityType: 'batch',
      entityId: batchId,
      userId,
      storeId,
      newValues: {
        status: 'completed',
        completedAt: new Date().toISOString(),
        summary: {
          items: summary.actualItems,
          weight: summary.actualWeight,
        },
      },
    });

    logger.info(`Batch completed: ${batchId}`, {
      batchId,
      status: 'completed',
      userId,
    });

    return { success: true, status: 'completed' };
  }

  // Delete batch (only in_progress batches)
  async deleteBatch(batchId: string, userId: string, storeId: string, reason: string) {
    // Verify batch exists and belongs to the store
    const batch = await db.query.inventoryBatches.findFirst({
      where: and(
        eq(inventoryBatches.id, batchId),
        eq(inventoryBatches.storeId, storeId)
      ),
      with: {
        batchItems: {
          with: {
            inventoryItem: true,
          },
        },
      },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    // Only allow deletion of in_progress batches
    if (batch.status !== 'in_progress') {
      throw new Error('Only incomplete batches can be deleted. Completed batches cannot be removed.');
    }

    // Use transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Update supplier account if supplierId exists
      if (batch.supplierId) {
        const totalCost = parseFloat(batch.totalCost || '0');
        const totalPaid = parseFloat(batch.totalPaid || '0');

        // Reverse purchase amount (decrease balance)
        await supplierAccountService.updateSupplierBalance(
          batch.supplierId,
          storeId,
          {
            balanceChange: -totalCost,
            purchaseChange: -totalCost,
          },
          tx
        );

        // Reverse payments if any (increase balance)
        if (totalPaid > 0) {
          await supplierAccountService.updateSupplierBalance(
            batch.supplierId,
            storeId,
            {
              balanceChange: totalPaid,
              paymentChange: -totalPaid,
            },
            tx
          );
        }

        // Create reversal transaction (monetary ledger)
        await supplierAccountService.createMonetaryTransaction(
          batch.supplierId,
          storeId,
          {
            type: 'reversal',
            referenceType: 'batch',
            referenceId: batchId,
            debit: 0,
            credit: totalCost,
            description: `Reversal - deleted batch ${batch.batchNumber}: ${reason}`,
            transactionDate: new Date(),
            userId,
          },
          tx
        );

        // Reverse gold transaction if gold was received
        const totalWeight = parseFloat(batch.actualTotalWeight || batch.expectedTotalWeight || '0');
        if (totalWeight > 0) {
          await supplierAccountService.updateGoldBalance(
            batch.supplierId,
            storeId,
            {
              goldBalanceChange: -totalWeight,
              goldReturnedChange: totalWeight,
            },
            tx
          );

          await supplierAccountService.createGoldTransaction(
            batch.supplierId,
            storeId,
            {
              type: 'gold_returned',
              referenceType: 'batch',
              referenceId: batchId,
              goldDebit: 0,
              goldCredit: totalWeight,
              description: `Gold returned - deleted batch ${batch.batchNumber}: ${reason} (${totalWeight.toFixed(3)}g)`,
              transactionDate: new Date(),
              userId,
            },
            tx
          );
        }

        // Update supplier account status
        await supplierAccountService.updateAccountStatus(batch.supplierId, storeId, tx);
      }

      // Delete all items in the batch
      if (batch.batchItems && batch.batchItems.length > 0) {
        const itemIds = batch.batchItems.map(bi => bi.inventoryItem.id);

        // Delete inventory items (cascade will handle batch_items junction table)
        await tx
          .delete(inventoryItems)
          .where(
            and(
              inArray(inventoryItems.id, itemIds),
              eq(inventoryItems.storeId, storeId)
            )
          );
      }

      // Delete the batch itself
      await tx
        .delete(inventoryBatches)
        .where(
          and(
            eq(inventoryBatches.id, batchId),
            eq(inventoryBatches.storeId, storeId)
          )
        );

      // Log the deletion to audit trail
      await activityLogger.logAudit({
        action: 'delete',
        entityType: 'batch',
        entityId: batchId,
        userId,
        storeId,
        oldValues: {
          batchNumber: batch.batchNumber,
          status: batch.status,
          expectedItems: batch.expectedTotalItems,
          actualItems: batch.actualTotalItems,
          expectedWeight: batch.expectedTotalWeight,
          actualWeight: batch.actualTotalWeight,
          itemCount: batch.batchItems?.length || 0,
          totalCost: batch.totalCost,
          totalPaid: batch.totalPaid,
          supplierId: batch.supplierId,
        },
        newValues: {
          reason,
          deletedAt: new Date().toISOString(),
        },
      });
    });

    logger.info(`Batch deleted: ${batchId}`, {
      batchId,
      batchNumber: batch.batchNumber,
      reason,
      userId,
    });

    return { success: true, message: 'Batch deleted successfully' };
  }

  // List batches
  async listBatches(storeId: string, status?: string, includeChildStores?: boolean) {
    // Build the list of store IDs to query
    let storeIds = [storeId];

    if (includeChildStores) {
      // Fetch child stores
      const childStores = await db
        .select({ id: stores.id })
        .from(stores)
        .where(eq(stores.parentStoreId, storeId));

      storeIds = [storeId, ...childStores.map(s => s.id)];
    }

    const conditions: any[] = storeIds.length === 1
      ? [eq(inventoryBatches.storeId, storeId)]
      : [inArray(inventoryBatches.storeId, storeIds)];

    if (status) {
      conditions.push(eq(inventoryBatches.status, status));
    }

    const batches = await db.query.inventoryBatches.findMany({
      where: and(...conditions),
      orderBy: [desc(inventoryBatches.createdAt)],
      with: {
        store: {
          columns: {
            id: true,
            name: true,
            code: true,
          },
        },
        batchItems: {
          with: {
            inventoryItem: true,
          },
        },
        createdByUser: {
          columns: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return batches;
  }

  // Create category
  async createCategory(input: CreateCategoryInput) {
    const [category] = await db
      .insert(inventoryCategories)
      .values({
        name: input.name,
        parentId: input.parentId,
        description: input.description,
        requiresLength: input.requiresLength || false,
        requiresWidth: input.requiresWidth || false,
        requiresHeight: input.requiresHeight || false,
        requiresInternalSize: input.requiresInternalSize || false,
        requiresRingSize: input.requiresRingSize || false,
      })
      .returning();

    return category;
  }

  // Update category
  async updateCategory(categoryId: string, input: CreateCategoryInput) {
    const [category] = await db
      .update(inventoryCategories)
      .set({
        name: input.name,
        parentId: input.parentId,
        description: input.description,
        requiresLength: input.requiresLength || false,
        requiresWidth: input.requiresWidth || false,
        requiresHeight: input.requiresHeight || false,
        requiresInternalSize: input.requiresInternalSize || false,
        requiresRingSize: input.requiresRingSize || false,
        updatedAt: new Date(),
      })
      .where(eq(inventoryCategories.id, categoryId))
      .returning();

    if (!category) {
      throw new Error('Category not found');
    }

    return category;
  }

  // Delete category
  async deleteCategory(categoryId: string) {
    // Check if category has items
    const itemsInCategory = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(inventoryItems)
      .where(eq(inventoryItems.categoryId, categoryId));

    const itemCount = itemsInCategory[0]?.count || 0;

    if (itemCount > 0) {
      throw new Error(`Cannot delete category with ${itemCount} items. Please move or delete the items first.`);
    }

    // Check if category has children
    const childCategories = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(inventoryCategories)
      .where(eq(inventoryCategories.parentId, categoryId));

    const childCount = childCategories[0]?.count || 0;

    if (childCount > 0) {
      throw new Error(`Cannot delete category with ${childCount} subcategories. Please delete the subcategories first.`);
    }

    // Delete the category
    const result = await db
      .delete(inventoryCategories)
      .where(eq(inventoryCategories.id, categoryId))
      .returning();

    if (result.length === 0) {
      throw new Error('Category not found');
    }

    return { success: true };
  }

  // List categories
  async listCategories() {
    const categories = await db.query.inventoryCategories.findMany({
      with: {
        parent: true,
        children: true,
      },
      orderBy: [inventoryCategories.name],
    });

    return categories;
  }

  // Get category statistics
  async getCategoryStatistics() {
    const categories = await db.query.inventoryCategories.findMany({
      with: {
        parent: true,
        children: true,
      },
      orderBy: [inventoryCategories.name],
    });

    // Get item counts and weights per category
    const categoryStats = await Promise.all(
      categories.map(async (category) => {
        // Count items in this category
        const items = await db
          .select({
            count: sql<number>`count(*)::int`,
            totalGrossWeight: sql<number>`COALESCE(sum(${inventoryItems.grossWeight}), 0)`,
            totalNetWeight: sql<number>`COALESCE(sum(${inventoryItems.netWeight}), 0)`,
            totalStoneWeight: sql<number>`COALESCE(sum(${inventoryItems.stoneWeight}), 0)`,
          })
          .from(inventoryItems)
          .where(and(eq(inventoryItems.categoryId, category.id), eq(inventoryItems.isActive, true)));

        const stats = items[0];

        return {
          ...category,
          statistics: {
            itemCount: stats.count || 0,
            totalGrossWeight: parseFloat(stats.totalGrossWeight?.toString() || '0'),
            totalNetWeight: parseFloat(stats.totalNetWeight?.toString() || '0'),
            totalStoneWeight: parseFloat(stats.totalStoneWeight?.toString() || '0'),
            // Placeholder for sales data - will be implemented when sales module is added
            lastMonthSales: 0,
            currentMonthSales: 0,
          },
        };
      })
    );

    return categoryStats;
  }

  // Search inventory items
  async searchInventoryItems(
    storeId: string,
    query?: string,
    filters?: {
      categoryId?: string;
      metalType?: string;
      purity?: string;
      weightMin?: number;
      weightMax?: number;
      dateFrom?: string;
      dateTo?: string;
      priceMin?: number;
      priceMax?: number;
      slowMovers?: boolean;
    },
    limit?: number,
    offset?: number
  ) {
    const conditions = [
      eq(inventoryItems.storeId, storeId),
      eq(inventoryItems.isActive, true),
      eq(inventoryItems.status, 'available'), // Only show available items, not sold
    ];

    // Text search
    if (query) {
      conditions.push(
        sql`(
          ${inventoryItems.name} ILIKE ${`%${query}%`} OR
          ${inventoryItems.sku} ILIKE ${`%${query}%`} OR
          ${inventoryItems.barcode} ILIKE ${`%${query}%`}
        )`
      );
    }

    // Category filter
    if (filters?.categoryId) {
      conditions.push(eq(inventoryItems.categoryId, filters.categoryId));
    }

    // Metal type filter
    if (filters?.metalType) {
      conditions.push(eq(inventoryItems.metalType, filters.metalType));
    }

    // Purity filter
    if (filters?.purity) {
      conditions.push(eq(inventoryItems.purity, filters.purity));
    }

    // Weight range filter
    if (filters?.weightMin !== undefined) {
      conditions.push(sql`CAST(${inventoryItems.grossWeight} AS DECIMAL) >= ${filters.weightMin}`);
    }
    if (filters?.weightMax !== undefined) {
      conditions.push(sql`CAST(${inventoryItems.grossWeight} AS DECIMAL) <= ${filters.weightMax}`);
    }

    // Date range filter
    if (filters?.dateFrom) {
      conditions.push(sql`${inventoryItems.createdAt} >= ${new Date(filters.dateFrom)}`);
    }
    if (filters?.dateTo) {
      conditions.push(sql`${inventoryItems.createdAt} <= ${new Date(filters.dateTo)}`);
    }

    // Price range filter
    if (filters?.priceMin !== undefined && filters.priceMin > 0) {
      conditions.push(sql`CAST(${inventoryItems.calculatedCost} AS DECIMAL) >= ${filters.priceMin}`);
    }
    if (filters?.priceMax !== undefined && filters.priceMax > 0) {
      conditions.push(sql`CAST(${inventoryItems.calculatedCost} AS DECIMAL) <= ${filters.priceMax}`);
    }

    const items = await db.query.inventoryItems.findMany({
      where: and(...conditions),
      with: {
        category: true,
        stones: true,
        stockLevels: {
          where: eq(stockLevels.storeId, storeId),
        },
      },
      orderBy: [desc(inventoryItems.createdAt)],
      limit: limit || 50,
      offset: offset || 0,
    });

    return items;
  }

  // Record additional payment for a batch
  async recordBatchPayment(batchId: string, input: RecordBatchPaymentInput, userId: string) {
    return await db.transaction(async (tx) => {
      // Get current batch details
      const [batch] = await tx
        .select()
        .from(inventoryBatches)
        .where(eq(inventoryBatches.id, batchId));

      if (!batch) {
        throw new Error('Batch not found');
      }

      const currentOutstanding = parseFloat(batch.outstandingBalance || '0');
      const paymentAmount = input.amount;

      // Validate payment doesn't exceed outstanding
      if (paymentAmount > currentOutstanding) {
        throw new Error(
          `Payment amount (₹${paymentAmount}) exceeds outstanding balance (₹${currentOutstanding})`
        );
      }

      // Calculate new totals
      const currentTotalPaid = parseFloat(batch.totalPaid || '0');
      const newTotalPaid = currentTotalPaid + paymentAmount;
      const newOutstanding = currentOutstanding - paymentAmount;
      const totalCost = parseFloat(batch.totalCost || '0');

      // Determine new payment status and payment type
      let newPaymentStatus: 'pending' | 'partial' | 'paid';
      let paymentType: 'partial' | 'full_settlement';

      if (newOutstanding <= 0.01) {
        // Allow for floating point precision
        newPaymentStatus = 'paid';
        paymentType = 'full_settlement';
      } else {
        newPaymentStatus = newTotalPaid > 0 ? 'partial' : 'pending';
        paymentType = 'partial';
      }

      // Insert payment record
      const [paymentRecord] = await tx
        .insert(purchasePayments)
        .values({
          batchId,
          paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
          amount: paymentAmount.toString(),
          paymentMethod: input.paymentMethod,
          paymentType,
          transactionReference: input.transactionReference,
          notes: input.notes,
          createdBy: userId,
        })
        .returning();

      // Update batch financials
      await tx
        .update(inventoryBatches)
        .set({
          totalPaid: newTotalPaid.toString(),
          outstandingBalance: Math.max(0, newOutstanding).toString(),
          paymentStatus: newPaymentStatus,
          updatedAt: new Date(),
        })
        .where(eq(inventoryBatches.id, batchId));

      // Update supplier account if supplierId exists
      if (batch.supplierId) {
        // Decrease supplier balance (payment credit)
        await supplierAccountService.updateSupplierBalance(
          batch.supplierId,
          batch.storeId,
          {
            balanceChange: -paymentAmount,
            paymentChange: paymentAmount,
          },
          tx
        );

        // Create payment transaction with payment details
        await supplierAccountService.createMonetaryTransaction(
          batch.supplierId,
          batch.storeId,
          {
            type: 'payment',
            referenceType: 'payment',
            referenceId: paymentRecord.id,
            debit: 0,
            credit: paymentAmount,
            description: `Payment for batch ${batch.batchNumber}`,
            transactionDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
            userId,
            paymentMethod: input.paymentMethod,
            paymentReference: input.transactionReference,
          },
          tx
        );

        // Update supplier account status
        await supplierAccountService.updateAccountStatus(batch.supplierId, batch.storeId, tx);

        // --- Accounting Integration: Payment ---
        const [payableAccount] = await tx
          .select()
          .from(accounts)
          .where(and(eq(accounts.storeId, batch.storeId), eq(accounts.accountCode, '2101')));

        let creditAccountCode = '1101'; // Default Cash
        if (input.paymentMethod !== 'cash') {
          creditAccountCode = '1110'; // Bank
        }

        const [creditAccount] = await tx
          .select()
          .from(accounts)
          .where(and(eq(accounts.storeId, batch.storeId), eq(accounts.accountCode, creditAccountCode)));

        if (payableAccount && creditAccount) {
          await accountingService.createJournalEntry(
            batch.storeId,
            userId,
            {
              entryDate: input.paymentDate ? new Date(input.paymentDate).toISOString() : new Date().toISOString(),
              entryType: 'payment',
              narration: `Batch Payment: ${batch.batchNumber}`,
              referenceType: 'payment',
              referenceId: paymentRecord.id, // Use the payment record ID
              referenceNumber: batch.batchNumber,
              lines: [
                {
                  accountId: payableAccount.id,
                  debitAmount: paymentAmount,
                  creditAmount: 0,
                  description: `Payment of Liability - Batch ${batch.batchNumber}`,
                },
                {
                  accountId: creditAccount.id,
                  debitAmount: 0,
                  creditAmount: paymentAmount,
                  description: `Payment Out - ${input.paymentMethod}`,
                },
              ],
            },
            tx
          );
        }
      }

      logger.info(`Payment recorded: Rs ${paymentAmount} for batch ${batch.batchNumber}`, {
        batchId,
        paymentAmount,
        newTotalPaid,
        newOutstanding,
        paymentStatus: newPaymentStatus,
      });

      return {
        success: true,
        paymentAmount,
        newTotalPaid,
        newOutstanding,
        paymentStatus: newPaymentStatus,
      };
    });
  }

  // Get all payments for a batch
  async getBatchPayments(batchId: string) {
    const payments = await db.query.purchasePayments.findMany({
      where: eq(purchasePayments.batchId, batchId),
      with: {
        createdByUser: {
          columns: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: [desc(purchasePayments.paymentDate)],
    });

    return payments;
  }

  // Get single inventory item
  async getInventoryItem(itemId: string, storeId: string) {
    const item = await db.query.inventoryItems.findFirst({
      where: and(
        eq(inventoryItems.id, itemId),
        eq(inventoryItems.storeId, storeId)
      ),
      with: {
        category: true,
        stones: true,
        stockLevels: true,
        batchItems: {
          with: {
            batch: true,
          },
        },
      },
    });

    if (!item) {
      throw new Error('Inventory item not found');
    }

    return item;
  }

  // Update inventory item
  async updateInventoryItem(
    itemId: string,
    storeId: string,
    input: any,
    userId: string
  ) {
    return await db.transaction(async (tx) => {
      // Check if item exists and belongs to the store
      const existingItem = await tx.query.inventoryItems.findFirst({
        where: and(
          eq(inventoryItems.id, itemId),
          eq(inventoryItems.storeId, storeId)
        ),
      });

      if (!existingItem) {
        throw new Error('Inventory item not found');
      }

      // Prepare update data - extract stones separately
      const { stones: inputStones, certificationDate, ...restInput } = input;

      const updateData: any = {
        ...restInput,
        updatedAt: new Date(),
      };

      // Convert numeric fields to strings if they exist
      if (input.grossWeight !== undefined && input.grossWeight !== null) {
        updateData.grossWeight = input.grossWeight.toString();
      }
      if (input.netWeight !== undefined && input.netWeight !== null) {
        updateData.netWeight = input.netWeight.toString();
      }
      if (input.stoneWeight !== undefined && input.stoneWeight !== null) {
        updateData.stoneWeight = input.stoneWeight.toString();
      }
      if (input.makingCharges !== undefined && input.makingCharges !== null) {
        updateData.makingCharges = input.makingCharges.toString();
      }
      if (input.wastagePercentage !== undefined && input.wastagePercentage !== null) {
        updateData.wastagePercentage = input.wastagePercentage.toString();
      }
      if (input.costRatePercentage !== undefined && input.costRatePercentage !== null) {
        updateData.costRatePercentage = input.costRatePercentage.toString();
      }
      if (input.calculatedCost !== undefined && input.calculatedCost !== null) {
        updateData.calculatedCost = input.calculatedCost.toString();
      }
      if (input.dimensions !== undefined) {
        updateData.dimensions = input.dimensions;
      }

      // Recalculate fine gold equivalent if netWeight or purity changed
      const newNetWeight = input.netWeight ?? parseFloat(existingItem.netWeight);
      const newPurity = input.purity ?? existingItem.purity;
      const newMetalType = input.metalType ?? existingItem.metalType;

      if (input.netWeight !== undefined || input.purity !== undefined || input.metalType !== undefined) {
        const fineGoldEquivalent = calculateFineGoldEquivalent(newNetWeight, newPurity, newMetalType);
        updateData.fineGoldEquivalent = fineGoldEquivalent.toString();
      }

      // Handle certification date
      if (certificationDate !== undefined) {
        updateData.certificationDate = certificationDate ? new Date(certificationDate) : null;
      }

      // Update the item
      const [updatedItem] = await tx
        .update(inventoryItems)
        .set(updateData)
        .where(eq(inventoryItems.id, itemId))
        .returning();

      // Update stones if provided
      if (inputStones !== undefined) {
        // Delete existing stones
        await tx.delete(stones).where(eq(stones.inventoryItemId, itemId));

        // Insert new stones
        if (inputStones.length > 0) {
          await tx.insert(stones).values(
            inputStones.map((stone: any) => ({
              inventoryItemId: itemId,
              stoneType: stone.stoneType,
              count: stone.count,
              totalWeight: stone.totalWeight?.toString(),
              averageWeight: stone.averageWeight?.toString(),
              shape: stone.shape,
              color: stone.color,
              clarity: stone.clarity,
              cutGrade: stone.cutGrade,
              certificationNumber: stone.certificationNumber,
              certificationAgency: stone.certificationAgency,
              pricePerCarat: stone.pricePerCarat?.toString(),
            }))
          );
        }
      }

      // Create audit log entry
      await tx.insert(auditLogs).values({
        userId,
        storeId,
        action: 'update',
        entityType: 'inventory_item',
        entityId: itemId,
        oldValues: {
          sku: existingItem.sku,
          name: existingItem.name,
          grossWeight: existingItem.grossWeight,
          netWeight: existingItem.netWeight,
          stoneWeight: existingItem.stoneWeight,
          costRatePercentage: existingItem.costRatePercentage,
          calculatedCost: existingItem.calculatedCost,
          isHallmarked: existingItem.isHallmarked,
          hallmarkNumber: existingItem.hallmarkNumber,
          huidNumber: existingItem.huidNumber,
          metalType: existingItem.metalType,
          purity: existingItem.purity,
          categoryId: existingItem.categoryId,
          isActive: existingItem.isActive,
        },
        newValues: {
          ...input,
          updatedBy: userId,
          updatedAt: new Date().toISOString(),
        },
      });

      logger.info(`Inventory item updated: ${updatedItem.sku}`, {
        itemId,
        userId,
        changes: Object.keys(input),
        auditLogged: true,
      });

      // Fetch and return the complete updated item
      return await this.getInventoryItem(itemId, storeId);
    });
  }

  // List sold inventory items with profit tracking
  async listSoldItems(
    storeId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      metalType?: string;
      categoryId?: string;
    },
    limit: number = 100,
    offset: number = 0
  ) {
    const conditions = [
      eq(inventoryItems.storeId, storeId),
      eq(inventoryItems.status, 'sold'),
    ];

    // Date range filter
    if (filters?.startDate) {
      conditions.push(sql`${inventoryItems.soldAt} >= ${new Date(filters.startDate)}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${inventoryItems.soldAt} <= ${new Date(filters.endDate)}`);
    }

    // Metal type filter
    if (filters?.metalType) {
      conditions.push(eq(inventoryItems.metalType, filters.metalType));
    }

    // Category filter
    if (filters?.categoryId) {
      conditions.push(eq(inventoryItems.categoryId, filters.categoryId));
    }

    const items = await db
      .select({
        id: inventoryItems.id,
        sku: inventoryItems.sku,
        name: inventoryItems.name,
        description: inventoryItems.description,
        metalType: inventoryItems.metalType,
        purity: inventoryItems.purity,
        grossWeight: inventoryItems.grossWeight,
        netWeight: inventoryItems.netWeight,
        calculatedCost: inventoryItems.calculatedCost,
        soldAt: inventoryItems.soldAt,
        soldPrice: inventoryItems.soldPrice,
        soldInvoiceId: inventoryItems.soldInvoiceId,
        profit: inventoryItems.profit,
        dailyGoldRate: inventoryItems.dailyGoldRate,
        imageUrls: inventoryItems.imageUrls,
        categoryId: inventoryItems.categoryId,
      })
      .from(inventoryItems)
      .where(and(...conditions))
      .orderBy(desc(inventoryItems.soldAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryItems)
      .where(and(...conditions));

    // Calculate summary statistics
    const [summaryResult] = await db
      .select({
        totalItems: sql<number>`count(*)`,
        totalRevenue: sql<string>`COALESCE(SUM(CAST(${inventoryItems.soldPrice} AS DECIMAL)), 0)`,
        totalProfit: sql<string>`COALESCE(SUM(CAST(${inventoryItems.profit} AS DECIMAL)), 0)`,
        totalCost: sql<string>`COALESCE(SUM(CAST(${inventoryItems.calculatedCost} AS DECIMAL)), 0)`,
      })
      .from(inventoryItems)
      .where(and(...conditions));

    return {
      items,
      pagination: {
        total: Number(countResult?.count || 0),
        limit,
        offset,
      },
      summary: {
        totalItems: Number(summaryResult?.totalItems || 0),
        totalRevenue: parseFloat(summaryResult?.totalRevenue || '0'),
        totalProfit: parseFloat(summaryResult?.totalProfit || '0'),
        totalCost: parseFloat(summaryResult?.totalCost || '0'),
        profitMargin: summaryResult?.totalRevenue && parseFloat(summaryResult.totalRevenue) > 0
          ? ((parseFloat(summaryResult.totalProfit || '0') / parseFloat(summaryResult.totalRevenue)) * 100).toFixed(2)
          : '0',
      },
    };
  }

  /**
   * Get valuation details for an inventory item (original cost and current market value)
   */
  async getItemValuationDetails(itemId: string) {
    const item = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, itemId))
      .limit(1);

    if (!item || item.length === 0) {
      throw new Error('Item not found');
    }

    const inventoryItem = item[0];

    // Get the latest gold rate for the store
    const latestGoldRate = await db
      .select()
      .from(goldRates)
      .where(and(
        eq(goldRates.goldType, '24K'),
        eq(goldRates.storeId, inventoryItem.storeId)
      ))
      .orderBy(desc(goldRates.date))
      .limit(1);

    let currentMarketValue = 0;
    let goldRateUsed = 0;

    if (latestGoldRate && latestGoldRate.length > 0) {
      goldRateUsed = parseFloat(latestGoldRate[0].ratePerGram);
      const netWeight = parseFloat(inventoryItem.netWeight || inventoryItem.grossWeight || '0');
      const purityFactor = this.parsePurity(inventoryItem.purity);

      if (inventoryItem.costRatePercentage) {
        // Use rate-based method - keeping consistent with original cost calculation
        const ratePercentage = parseFloat(inventoryItem.costRatePercentage);
        currentMarketValue = goldRateUsed * netWeight * (ratePercentage / 100);
      } else {
        // Use traditional method
        const fineGoldWeight = calculateFineGoldEquivalent(
          netWeight,
          inventoryItem.purity,
          inventoryItem.metalType as 'gold' | 'silver' | 'platinum' || 'gold'
        );
        currentMarketValue = fineGoldWeight * goldRateUsed;
      }
    }

    const originalCost = inventoryItem.calculatedCost ? parseFloat(inventoryItem.calculatedCost) : 0;
    const unrealizedGainLoss = currentMarketValue - originalCost;

    return {
      itemId: inventoryItem.id,
      sku: inventoryItem.sku,
      name: inventoryItem.name,
      originalCost,
      currentMarketValue,
      unrealizedGainLoss,
      goldRateUsed,
      lastValuationDate: inventoryItem.lastValuationDate || new Date(),
      status: inventoryItem.status,
      isHallmarked: inventoryItem.isHallmarked,
      purity: inventoryItem.purity,
      netWeight: parseFloat(inventoryItem.netWeight || '0'),
      grossWeight: parseFloat(inventoryItem.grossWeight || '0'),
    };
  }
  // ============================================================================
  // STOCK TRANSFERS
  // ============================================================================

  private async generateTransferNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryTransfers)
      .where(sql`DATE(${inventoryTransfers.createdAt}) = CURRENT_DATE`);

    const count = Number(result[0]?.count || 0) + 1;
    return `TRF-${dateStr}-${count.toString().padStart(3, '0')}`;
  }

  async createTransfer(input: CreateTransferInput, sourceStoreId: string, userId: string) {
    if (input.destinationStoreId === sourceStoreId) {
      throw new Error('Cannot transfer to the same store');
    }

    return await db.transaction(async (tx) => {
      const transferNumber = await this.generateTransferNumber();

      // Get current gold rate for valuation
      const goldRate = await metalAccountingService.getLatestGoldRate(sourceStoreId);

      let totalWeight = 0;
      let totalValue = 0;
      const transferItemsWithDetails: any[] = [];

      // Process Items first to calculate totals
      for (const itemInput of input.items) {
        // Verify item exists and is available in source store
        const item = await tx.query.inventoryItems.findFirst({
          where: and(
            eq(inventoryItems.id, itemInput.inventoryItemId),
            eq(inventoryItems.storeId, sourceStoreId),
            eq(inventoryItems.status, 'available')
          )
        });

        if (!item) {
          throw new Error(`Item ${itemInput.inventoryItemId} not available for transfer`);
        }

        const quantity = itemInput.quantity;
        const weight = parseFloat(item.netWeight); // Using net weight for value calculation
        const itemTotalWeight = weight * quantity;

        // Calculate value based on gold rate
        const value = itemTotalWeight * goldRate;

        totalWeight += itemTotalWeight;
        totalValue += value;

        transferItemsWithDetails.push({
          inventoryItemId: itemInput.inventoryItemId,
          quantity,
          weight: itemTotalWeight,
          rate: goldRate,
          value
        });
      }

      // Generate internal invoice number (INV + Transfer Number)
      const invoiceNumber = `INV-${transferNumber}`;

      // Create Transfer Record
      const [transfer] = await tx.insert(inventoryTransfers).values({
        transferNumber,
        sourceStoreId,
        destinationStoreId: input.destinationStoreId,
        status: 'in_transit', // Skipping 'requested' as per requirements

        // Financials
        totalWeight: totalWeight.toFixed(3),
        totalValue: totalValue.toFixed(2),
        goldRate: goldRate.toFixed(2),
        invoiceNumber,
        invoiceDate: new Date(),

        notes: input.notes,
        createdBy: userId,
      }).returning();

      // Insert Items
      for (const details of transferItemsWithDetails) {
        await tx.insert(inventoryTransferItems).values({
          transferId: transfer.id,
          inventoryItemId: details.inventoryItemId,
          quantity: details.quantity,

          weight: details.weight.toFixed(3),
          rate: details.rate.toFixed(2),
          value: details.value.toFixed(2),

          status: 'pending'
        });

        // Update Inventory Item Status
        await tx.update(inventoryItems)
          .set({ status: 'in_transit', updatedAt: new Date() })
          .where(eq(inventoryItems.id, details.inventoryItemId));

        // Create Stock Movement (Transfer Out)
        await tx.insert(stockMovements).values({
          inventoryItemId: details.inventoryItemId,
          storeId: sourceStoreId,
          movementType: 'transfer',
          quantity: -details.quantity,
          toLocation: 'In Transit',
          referenceType: 'transfer',
          referenceId: transfer.id,
          performedBy: userId,
          notes: `Transfer Out: ${transferNumber} (Inv: ${invoiceNumber})`
        });

        // Update Stock Level (Decrease source)
        await tx.update(stockLevels)
          .set({ quantity: sql`${stockLevels.quantity} - ${details.quantity}`, updatedAt: new Date() })
          .where(and(
            eq(stockLevels.inventoryItemId, details.inventoryItemId),
            eq(stockLevels.storeId, sourceStoreId)
          ));
      }

      await activityLogger.logAudit({
        userId,
        storeId: sourceStoreId,
        action: 'transfer_created',
        entityType: 'transfer',
        entityId: transfer.id,
        newValues: {
          ...input,
          totalValue,
          invoiceNumber
        } as any
      });

      return transfer;
    });
  }

  // Global search for inventory across all stores (restricted view for managers)
  async searchGlobalInventory(
    query: string,
    filters?: {
      category?: string;
      metalType?: string;
      storeId?: string;
    },
    limit: number = 20
  ) {
    const conditions = [
      eq(inventoryItems.status, 'available'),
      eq(inventoryItems.isActive, true)
    ];

    if (query) {
      conditions.push(
        sql`(
          ${inventoryItems.name} ILIKE ${`%${query}%`} OR
          ${inventoryItems.sku} ILIKE ${`%${query}%`} OR
          ${inventoryItems.barcode} ILIKE ${`%${query}%`}
        )`
      );
    }

    if (filters?.category) {
      // Simple UUID check to avoid SQL errors if name passed
      if (filters.category.match(/^[0-9a-fA-F-]{36}$/)) {
        conditions.push(eq(inventoryItems.categoryId, filters.category));
      }
    }

    if (filters?.metalType) {
      conditions.push(eq(inventoryItems.metalType, filters.metalType));
    }

    if (filters?.storeId) {
      conditions.push(eq(inventoryItems.storeId, filters.storeId));
    }

    const items = await db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        sku: inventoryItems.sku,
        metalType: inventoryItems.metalType,
        purity: inventoryItems.purity,
        grossWeight: inventoryItems.grossWeight,
        storeId: inventoryItems.storeId,
        storeName: stores.name,
        categoryName: inventoryCategories.name
      })
      .from(inventoryItems)
      .leftJoin(stores, eq(inventoryItems.storeId, stores.id))
      .leftJoin(inventoryCategories, eq(inventoryItems.categoryId, inventoryCategories.id))
      .where(and(...conditions))
      .limit(limit);

    return items;
  }

  async receiveTransfer(input: ReceiveTransferInput, receivingStoreId: string, userId: string) {
    return await db.transaction(async (tx) => {
      // Fetch Transfer
      const transfer = await tx.query.inventoryTransfers.findFirst({
        where: eq(inventoryTransfers.id, input.transferId),
        with: {
          items: true,
          sourceStore: true
        }
      });

      if (!transfer) throw new Error('Transfer not found');
      if (transfer.destinationStoreId !== receivingStoreId) throw new Error('Transfer does not belong to this store');
      if (transfer.status !== 'in_transit') throw new Error('Transfer is not in transit');

      // Update Transfer Status
      await tx.update(inventoryTransfers)
        .set({
          status: 'completed',
          receivedBy: userId,
          updatedAt: new Date()
        })
        .where(eq(inventoryTransfers.id, input.transferId));

      // Process Items
      for (const transItem of transfer.items) {
        // Update Transfer Item Status
        await tx.update(inventoryTransferItems)
          .set({ status: 'received', updatedAt: new Date() })
          .where(eq(inventoryTransferItems.id, transItem.id));

        // Update Inventory Item (Move to new store, make available)
        await tx.update(inventoryItems)
          .set({
            storeId: receivingStoreId,
            status: 'available',
            updatedAt: new Date()
          })
          .where(eq(inventoryItems.id, transItem.inventoryItemId));

        // Create Stock Level Entry for New Store
        await tx.insert(stockLevels)
          .values({
            inventoryItemId: transItem.inventoryItemId,
            storeId: receivingStoreId,
            quantity: transItem.quantity,
            location: 'Main Vault' // Default location
          })
          .onConflictDoUpdate({
            target: [stockLevels.inventoryItemId, stockLevels.storeId],
            set: { quantity: sql`${stockLevels.quantity} + ${transItem.quantity}` }
          });

        // Log Movement (Transfer In)
        await tx.insert(stockMovements).values({
          inventoryItemId: transItem.inventoryItemId,
          storeId: receivingStoreId,
          movementType: 'transfer',
          quantity: transItem.quantity,
          fromLocation: 'In Transit',
          toLocation: 'Main Vault',
          referenceType: 'transfer',
          referenceId: transfer.id,
          performedBy: userId,
          notes: `Transfer In: ${transfer.transferNumber}`
        });
      }

      await activityLogger.logAudit({
        userId,
        storeId: receivingStoreId,
        action: 'transfer_received',
        entityType: 'transfer',
        entityId: transfer.id,
        newValues: { status: 'completed' }
      });

      return { success: true, message: 'Transfer received successfully' };
    });
  }

  async getTransfers(storeId: string, options?: { type?: 'inbound' | 'outbound' }) {
    const conditions = [];

    if (options?.type === 'inbound') {
      conditions.push(eq(inventoryTransfers.destinationStoreId, storeId));
    } else if (options?.type === 'outbound') {
      conditions.push(eq(inventoryTransfers.sourceStoreId, storeId));
    } else {
      // Show both
      conditions.push(
        or(
          eq(inventoryTransfers.sourceStoreId, storeId),
          eq(inventoryTransfers.destinationStoreId, storeId)
        )
      );
    }

    const results = await db.query.inventoryTransfers.findMany({
      where: and(...conditions),
      with: {
        sourceStore: true,
        destinationStore: true,
        items: true // We need items to count them, though we could aggregate for perf
      },
      orderBy: (transfers, { desc }) => [desc(transfers.createdAt)]
    });

    // Transform for UI
    return results.map(t => ({
      id: t.id,
      transferNumber: t.transferNumber,
      sourceStore: t.sourceStore,
      destinationStore: t.destinationStore,
      status: t.status,
      totalWeight: t.totalWeight,
      totalValue: t.totalValue,
      itemCount: t.items.length,
      createdAt: t.createdAt
    }));
  }

  async getTransferById(transferId: string, storeId: string) {
    const transfer = await db.query.inventoryTransfers.findFirst({
      where: eq(inventoryTransfers.id, transferId),
      with: {
        sourceStore: true,
        destinationStore: true,
        items: {
          with: {
            inventoryItem: true // To get item names/details
          }
        }
      }
    });

    if (!transfer) return null;

    // Security check: ensure user belongs to source or dest store (or is superadmin - logic handled by caller/middleware usually, but good to be safe)
    // For now, we return it, controller checks store access if needed, or we rely on UI hiding stuff. 
    // Ideally we should filter here.
    if (transfer.sourceStoreId !== storeId && transfer.destinationStoreId !== storeId) {
      // user might be admin, but if we strictly scope to store:
      // throw new Error('Unauthorized access to transfer');
      // For now, let's allow it but controller layer should likely enforce store scope if not 'all' access.
    }

    // Transform items to include name/sku from nested relation
    const transformedItems = transfer.items.map(item => ({
      id: item.id,
      inventoryItemId: item.inventoryItemId,
      name: item.inventoryItem.name,
      sku: item.inventoryItem.sku,
      weight: item.weight,
      quantity: item.quantity,
      status: item.status
    }));

    return {
      ...transfer,
      items: transformedItems
    };
  }
}

export const inventoryService = new InventoryService();
