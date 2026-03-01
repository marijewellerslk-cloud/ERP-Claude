import { eq, and, sql, desc, or, gt } from 'drizzle-orm';

import { db } from '../config/database.js';
import {
  suppliers,
  supplierAccountTransactions,
  inventoryBatches,
  purchasePayments,
} from '../db/schema.js';
import { activityLogger } from './activity-logger.service.js';
import { logger } from '../utils/logger.js';

interface BalanceUpdate {
  balanceChange: number;
  purchaseChange?: number;
  paymentChange?: number;
}

interface TransactionInput {
  type: 'purchase' | 'payment' | 'adjustment' | 'reversal';
  referenceType: 'batch' | 'payment' | 'manual';
  referenceId?: string;
  debit: number;
  credit: number;
  description: string;
  transactionDate: Date;
  userId: string;
}

interface CreditCheckResult {
  withinLimit: boolean;
  currentBalance: number;
  creditLimit: number;
  availableCredit: number;
  warning?: string;
}

class SupplierAccountService {
  /**
   * Update denormalized balance fields on supplier record
   */
  async updateSupplierBalance(
    supplierId: string,
    storeId: string,
    changes: BalanceUpdate,
    tx?: any
  ): Promise<void> {
    const dbClient = tx || db;

    try {
      // Get current supplier data
      const supplier = await dbClient.query.suppliers.findFirst({
        where: and(eq(suppliers.id, supplierId), eq(suppliers.storeId, storeId)),
        columns: {
          currentBalance: true,
          totalLifetimePurchases: true,
          totalLifetimePayments: true,
        },
      });

      if (!supplier) {
        throw new Error('Supplier not found');
      }

      // Calculate new values
      const currentBalance = parseFloat(supplier.currentBalance || '0');
      const totalPurchases = parseFloat(supplier.totalLifetimePurchases || '0');
      const totalPayments = parseFloat(supplier.totalLifetimePayments || '0');

      const newBalance = currentBalance + changes.balanceChange;
      const newPurchases = totalPurchases + (changes.purchaseChange || 0);
      const newPayments = totalPayments + (changes.paymentChange || 0);

      // Build update object
      const updateData: any = {
        currentBalance: newBalance.toFixed(2),
      };

      if (changes.purchaseChange !== undefined && changes.purchaseChange !== 0) {
        updateData.totalLifetimePurchases = newPurchases.toFixed(2);
        updateData.lastPurchaseDate = new Date();
      }

      if (changes.paymentChange !== undefined && changes.paymentChange !== 0) {
        updateData.totalLifetimePayments = newPayments.toFixed(2);
        updateData.lastPaymentDate = new Date();
      }

      updateData.updatedAt = new Date();

      // Update supplier
      await dbClient
        .update(suppliers)
        .set(updateData)
        .where(and(eq(suppliers.id, supplierId), eq(suppliers.storeId, storeId)));

      logger.info('Supplier balance updated', {
        supplierId,
        storeId,
        oldBalance: currentBalance,
        newBalance,
        balanceChange: changes.balanceChange,
      });
    } catch (error) {
      logger.error('Error updating supplier balance:', error);
      throw error;
    }
  }

  /**
   * Create transaction ledger entry with running balance
   */
  async createAccountTransaction(
    supplierId: string,
    storeId: string,
    transaction: TransactionInput,
    tx?: any
  ): Promise<void> {
    const dbClient = tx || db;

    try {
      // Get current balance from supplier
      const supplier = await dbClient.query.suppliers.findFirst({
        where: and(eq(suppliers.id, supplierId), eq(suppliers.storeId, storeId)),
        columns: { currentBalance: true },
      });

      if (!supplier) {
        throw new Error('Supplier not found');
      }

      const currentBalance = parseFloat(supplier.currentBalance || '0');

      // Create transaction record
      await dbClient.insert(supplierAccountTransactions).values({
        supplierId,
        storeId,
        transactionType: transaction.type,
        referenceType: transaction.referenceType,
        referenceId: transaction.referenceId,
        debit: transaction.debit.toFixed(2),
        credit: transaction.credit.toFixed(2),
        balance: (currentBalance + transaction.debit - transaction.credit).toFixed(2), // Balance after this transaction
        description: transaction.description,
        transactionDate: transaction.transactionDate,
        createdBy: transaction.userId,
      });

      logger.info('Supplier account transaction created', {
        supplierId,
        storeId,
        type: transaction.type,
        debit: transaction.debit,
        credit: transaction.credit,
        balance: currentBalance,
      });
    } catch (error) {
      logger.error('Error creating account transaction:', error);
      throw error;
    }
  }

  /**
   * Update account status based on business rules
   */
  async updateAccountStatus(supplierId: string, storeId: string, tx?: any): Promise<void> {
    const dbClient = tx || db;

    try {
      // Get supplier data
      const supplier = await dbClient.query.suppliers.findFirst({
        where: and(eq(suppliers.id, supplierId), eq(suppliers.storeId, storeId)),
        columns: {
          currentBalance: true,
          creditLimit: true,
          accountStatus: true,
        },
      });

      if (!supplier) {
        throw new Error('Supplier not found');
      }

      const currentBalance = parseFloat(supplier.currentBalance || '0');
      const creditLimit = parseFloat(supplier.creditLimit || '0');
      const utilizationPercentage = creditLimit > 0 ? (currentBalance / creditLimit) * 100 : 0;

      // Calculate overdue status
      const overdueResult = await dbClient.query.inventoryBatches.findFirst({
        where: and(
          eq(inventoryBatches.supplierId, supplierId),
          eq(inventoryBatches.storeId, storeId),
          sql`${inventoryBatches.outstandingBalance} > 0`,
          sql`${inventoryBatches.dueDate} < NOW() - INTERVAL '60 days'`
        ),
      });

      const hasOverdue60Days = !!overdueResult;

      const overdueResult30 = await dbClient.query.inventoryBatches.findFirst({
        where: and(
          eq(inventoryBatches.supplierId, supplierId),
          eq(inventoryBatches.storeId, storeId),
          sql`${inventoryBatches.outstandingBalance} > 0`,
          sql`${inventoryBatches.dueDate} < NOW() - INTERVAL '30 days'`
        ),
      });

      const hasOverdue30Days = !!overdueResult30;

      // Determine new status based on business rules
      let newStatus: 'active' | 'on_hold' | 'suspended' = 'active';

      if (currentBalance > creditLimit || hasOverdue60Days) {
        newStatus = 'suspended';
      } else if (utilizationPercentage >= 90 || hasOverdue30Days) {
        newStatus = 'on_hold';
      }

      // Update status if changed
      if (newStatus !== supplier.accountStatus) {
        await dbClient
          .update(suppliers)
          .set({
            accountStatus: newStatus,
            updatedAt: new Date(),
          })
          .where(and(eq(suppliers.id, supplierId), eq(suppliers.storeId, storeId)));

        logger.info('Supplier account status updated', {
          supplierId,
          storeId,
          oldStatus: supplier.accountStatus,
          newStatus,
          currentBalance,
          creditLimit,
          utilizationPercentage: utilizationPercentage.toFixed(2),
        });
      }
    } catch (error) {
      logger.error('Error updating account status:', error);
      throw error;
    }
  }

  /**
   * Check credit limit and return warning if needed
   */
  async checkCreditLimit(
    supplierId: string,
    storeId: string,
    additionalAmount: number
  ): Promise<CreditCheckResult> {
    try {
      // Get supplier data
      const supplier = await db.query.suppliers.findFirst({
        where: and(eq(suppliers.id, supplierId), eq(suppliers.storeId, storeId)),
        columns: {
          currentBalance: true,
          creditLimit: true,
          businessName: true,
        },
      });

      if (!supplier) {
        throw new Error('Supplier not found');
      }

      const currentBalance = parseFloat(supplier.currentBalance || '0');
      const creditLimit = parseFloat(supplier.creditLimit || '0');
      const newBalance = currentBalance + additionalAmount;
      const availableCredit = creditLimit - currentBalance;
      const withinLimit = newBalance <= creditLimit;

      let warning: string | undefined;
      if (!withinLimit) {
        warning = `This batch will exceed ${supplier.businessName}'s credit limit. Current: ₹${currentBalance.toFixed(
          2
        )}, Limit: ₹${creditLimit.toFixed(2)}, After: ₹${newBalance.toFixed(2)}`;
      }

      return {
        withinLimit,
        currentBalance,
        creditLimit,
        availableCredit,
        warning,
      };
    } catch (error) {
      logger.error('Error checking credit limit:', error);
      throw error;
    }
  }

  /**
   * Recalculate supplier balance from scratch (for integrity checks)
   */
  async recalculateSupplierBalance(supplierId: string, storeId: string): Promise<void> {
    try {
      // Calculate from batches
      const batches = await db.query.inventoryBatches.findMany({
        where: and(
          eq(inventoryBatches.supplierId, supplierId),
          eq(inventoryBatches.storeId, storeId)
        ),
        columns: {
          totalCost: true,
          totalPaid: true,
          outstandingBalance: true,
        },
      });

      let totalPurchases = 0;
      let totalPaid = 0;
      let currentBalance = 0;

      for (const batch of batches) {
        const cost = parseFloat(batch.totalCost || '0');
        const paid = parseFloat(batch.totalPaid || '0');
        const outstanding = parseFloat(batch.outstandingBalance || '0');

        totalPurchases += cost;
        totalPaid += paid;
        currentBalance += outstanding;
      }

      // Update supplier with calculated values
      await db
        .update(suppliers)
        .set({
          currentBalance: currentBalance.toFixed(2),
          totalLifetimePurchases: totalPurchases.toFixed(2),
          totalLifetimePayments: totalPaid.toFixed(2),
          updatedAt: new Date(),
        })
        .where(and(eq(suppliers.id, supplierId), eq(suppliers.storeId, storeId)));

      logger.info('Supplier balance recalculated', {
        supplierId,
        storeId,
        totalPurchases,
        totalPaid,
        currentBalance,
      });
    } catch (error) {
      logger.error('Error recalculating supplier balance:', error);
      throw error;
    }
  }

  /**
   * Get account transactions for a supplier
   */
  async getAccountTransactions(
    supplierId: string,
    storeId: string,
    options?: {
      dateFrom?: Date;
      dateTo?: Date;
      transactionType?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    try {
      const conditions = [
        eq(supplierAccountTransactions.supplierId, supplierId),
        eq(supplierAccountTransactions.storeId, storeId),
      ];

      if (options?.dateFrom) {
        conditions.push(
          sql`${supplierAccountTransactions.transactionDate} >= ${options.dateFrom}`
        );
      }
      if (options?.dateTo) {
        conditions.push(sql`${supplierAccountTransactions.transactionDate} <= ${options.dateTo}`);
      }
      if (options?.transactionType) {
        conditions.push(
          eq(supplierAccountTransactions.transactionType, options.transactionType)
        );
      }

      const transactions = await db.query.supplierAccountTransactions.findMany({
        where: and(...conditions),
        orderBy: [desc(supplierAccountTransactions.transactionDate)],
        limit: options?.limit || 50,
        offset: options?.offset || 0,
        with: {
          createdByUser: {
            columns: {
              id: true,
              fullName: true,
            },
          },
        },
      });

      return transactions;
    } catch (error) {
      logger.error('Error fetching account transactions:', error);
      throw error;
    }
  }

  /**
   * Update gold balance on supplier record
   */
  async updateGoldBalance(
    supplierId: string,
    storeId: string,
    changes: {
      goldBalanceChange: number; // in grams
      goldReceivedChange?: number;
      goldReturnedChange?: number;
    },
    tx?: any
  ): Promise<void> {
    const dbClient = tx || db;

    try {
      const supplier = await dbClient.query.suppliers.findFirst({
        where: and(eq(suppliers.id, supplierId), eq(suppliers.storeId, storeId)),
        columns: {
          goldBalanceGrams: true,
          totalGoldReceived: true,
          totalGoldReturned: true,
        },
      });

      if (!supplier) {
        throw new Error('Supplier not found');
      }

      const currentGoldBalance = parseFloat(supplier.goldBalanceGrams || '0');
      const totalGoldReceived = parseFloat(supplier.totalGoldReceived || '0');
      const totalGoldReturned = parseFloat(supplier.totalGoldReturned || '0');

      const newGoldBalance = currentGoldBalance + changes.goldBalanceChange;
      const newGoldReceived = totalGoldReceived + (changes.goldReceivedChange || 0);
      const newGoldReturned = totalGoldReturned + (changes.goldReturnedChange || 0);

      const updateData: any = {
        goldBalanceGrams: newGoldBalance.toFixed(3),
      };

      if (changes.goldReceivedChange !== undefined && changes.goldReceivedChange !== 0) {
        updateData.totalGoldReceived = newGoldReceived.toFixed(3);
      }

      if (changes.goldReturnedChange !== undefined && changes.goldReturnedChange !== 0) {
        updateData.totalGoldReturned = newGoldReturned.toFixed(3);
      }

      updateData.updatedAt = new Date();

      await dbClient
        .update(suppliers)
        .set(updateData)
        .where(and(eq(suppliers.id, supplierId), eq(suppliers.storeId, storeId)));

      logger.info('Gold balance updated for supplier', {
        supplierId,
        storeId,
        oldBalance: currentGoldBalance,
        newBalance: newGoldBalance,
        goldBalanceChange: changes.goldBalanceChange,
      });
    } catch (error) {
      logger.error('Error updating gold balance:', error);
      throw error;
    }
  }

  /**
   * Create gold transaction entry
   */
  async createGoldTransaction(
    supplierId: string,
    storeId: string,
    transaction: {
      type: 'gold_received' | 'gold_returned';
      referenceType: 'batch' | 'manual' | 'gold_exchange';
      referenceId?: string;
      goldDebit: number; // Gold received from supplier
      goldCredit: number; // Gold returned to supplier
      description: string;
      transactionDate: Date;
      userId: string;
    },
    tx?: any
  ): Promise<void> {
    const dbClient = tx || db;

    try {
      const supplier = await dbClient.query.suppliers.findFirst({
        where: and(eq(suppliers.id, supplierId), eq(suppliers.storeId, storeId)),
        columns: { goldBalanceGrams: true },
      });

      if (!supplier) {
        throw new Error('Supplier not found');
      }

      const currentGoldBalance = parseFloat(supplier.goldBalanceGrams || '0');

      await dbClient.insert(supplierAccountTransactions).values({
        supplierId,
        storeId,
        ledgerType: 'gold',
        transactionType: transaction.type,
        referenceType: transaction.referenceType,
        referenceId: transaction.referenceId,
        debit: '0',
        credit: '0',
        balance: '0', // Not used for gold transactions
        goldDebit: transaction.goldDebit.toFixed(3),
        goldCredit: transaction.goldCredit.toFixed(3),
        goldBalance: (currentGoldBalance + transaction.goldDebit - transaction.goldCredit).toFixed(3),
        description: transaction.description,
        transactionDate: transaction.transactionDate,
        createdBy: transaction.userId,
      });

      logger.info('Gold transaction created', {
        supplierId,
        storeId,
        type: transaction.type,
        goldDebit: transaction.goldDebit,
        goldCredit: transaction.goldCredit,
        goldBalance: currentGoldBalance,
      });
    } catch (error) {
      logger.error('Error creating gold transaction:', error);
      throw error;
    }
  }

  /**
   * Create monetary transaction with payment details
   */
  async createMonetaryTransaction(
    supplierId: string,
    storeId: string,
    transaction: {
      type: 'purchase' | 'payment' | 'adjustment' | 'reversal';
      referenceType: 'batch' | 'payment' | 'manual';
      referenceId?: string;
      debit: number;
      credit: number;
      description: string;
      transactionDate: Date;
      userId: string;
      paymentMethod?: string;
      paymentReference?: string;
      goldDebit?: number;
      goldCredit?: number;
    },
    tx?: any
  ): Promise<void> {
    const dbClient = tx || db;

    try {
      const supplier = await dbClient.query.suppliers.findFirst({
        where: and(eq(suppliers.id, supplierId), eq(suppliers.storeId, storeId)),
        columns: { currentBalance: true },
      });

      if (!supplier) {
        throw new Error('Supplier not found');
      }

      const currentBalance = parseFloat(supplier.currentBalance || '0');

      await dbClient.insert(supplierAccountTransactions).values({
        supplierId,
        storeId,
        ledgerType: 'monetary',
        transactionType: transaction.type,
        referenceType: transaction.referenceType,
        referenceId: transaction.referenceId,
        debit: transaction.debit.toFixed(2),
        credit: transaction.credit.toFixed(2),
        balance: (currentBalance + transaction.debit - transaction.credit).toFixed(2),
        goldDebit: transaction.goldDebit ? transaction.goldDebit.toFixed(3) : '0',
        goldCredit: transaction.goldCredit ? transaction.goldCredit.toFixed(3) : '0',
        goldBalance: '0', // Not used for monetary transactions
        paymentMethod: transaction.paymentMethod,
        paymentReference: transaction.paymentReference,
        description: transaction.description,
        transactionDate: transaction.transactionDate,
        createdBy: transaction.userId,
      });

      logger.info('Monetary transaction created', {
        supplierId,
        storeId,
        type: transaction.type,
        debit: transaction.debit,
        credit: transaction.credit,
        balance: currentBalance,
        paymentMethod: transaction.paymentMethod,
      });
    } catch (error) {
      logger.error('Error creating monetary transaction:', error);
      throw error;
    }
  }

  /**
   * Create gold exchange transaction (for gold-to-gold purchases)
   */
  async createGoldExchangeTransaction(
    supplierId: string,
    storeId: string,
    transaction: {
      referenceType: 'batch' | 'manual';
      referenceId?: string;
      goldGiven: number; // Gold given TO supplier
      goldReceived: number; // Gold received FROM supplier
      description: string;
      transactionDate: Date;
      userId: string;
    },
    tx?: any
  ): Promise<void> {
    const dbClient = tx || db;

    try {
      const supplier = await dbClient.query.suppliers.findFirst({
        where: and(eq(suppliers.id, supplierId), eq(suppliers.storeId, storeId)),
        columns: { goldExchangeBalanceGrams: true },
      });

      if (!supplier) {
        throw new Error('Supplier not found');
      }

      const currentBalance = parseFloat(supplier.goldExchangeBalanceGrams || '0');
      // Balance calculation: positive means they owe us, negative means we owe them
      // When we GIVE gold TO supplier, balance becomes MORE positive (they owe us more)
      // When we RECEIVE gold FROM supplier, balance becomes MORE negative (we owe them less)
      const netChange = transaction.goldGiven - transaction.goldReceived;
      const newBalance = currentBalance + netChange;

      await dbClient.insert(supplierAccountTransactions).values({
        supplierId,
        storeId,
        ledgerType: 'gold_exchange',
        transactionType: transaction.goldGiven > transaction.goldReceived ? 'gold_exchange_given' : 'gold_exchange_received',
        referenceType: transaction.referenceType,
        referenceId: transaction.referenceId,
        debit: '0',
        credit: '0',
        balance: '0',
        goldDebit: transaction.goldGiven.toFixed(3),
        goldCredit: transaction.goldReceived.toFixed(3),
        goldBalance: newBalance.toFixed(3),
        description: transaction.description,
        transactionDate: transaction.transactionDate,
        createdBy: transaction.userId,
      });
    } catch (error) {
      logger.error('Error creating gold exchange transaction:', error);
      throw error;
    }
  }

  /**
   * Update gold exchange balance on supplier
   */
  async updateGoldExchangeBalance(
    supplierId: string,
    storeId: string,
    changes: {
      goldGivenChange: number; // Gold given TO supplier in this transaction
      goldReceivedChange: number; // Gold received FROM supplier in this transaction
    },
    tx?: any
  ): Promise<void> {
    const dbClient = tx || db;

    try {
      const supplier = await dbClient.query.suppliers.findFirst({
        where: and(eq(suppliers.id, supplierId), eq(suppliers.storeId, storeId)),
        columns: {
          goldExchangeBalanceGrams: true,
          totalGoldGivenInExchange: true,
          totalGoldReceivedInExchange: true,
        },
      });

      if (!supplier) {
        throw new Error('Supplier not found');
      }

      const currentBalance = parseFloat(supplier.goldExchangeBalanceGrams || '0');
      const currentGiven = parseFloat(supplier.totalGoldGivenInExchange || '0');
      const currentReceived = parseFloat(supplier.totalGoldReceivedInExchange || '0');

      // Balance calculation: positive means they owe us, negative means we owe them
      const netChange = changes.goldGivenChange - changes.goldReceivedChange;
      const newBalance = currentBalance + netChange;
      const newGiven = currentGiven + changes.goldGivenChange;
      const newReceived = currentReceived + changes.goldReceivedChange;

      await dbClient
        .update(suppliers)
        .set({
          goldExchangeBalanceGrams: newBalance.toFixed(3),
          totalGoldGivenInExchange: newGiven.toFixed(3),
          totalGoldReceivedInExchange: newReceived.toFixed(3),
          updatedAt: new Date(),
        })
        .where(and(eq(suppliers.id, supplierId), eq(suppliers.storeId, storeId)));
    } catch (error) {
      logger.error('Error updating gold exchange balance:', error);
      throw error;
    }
  }

  /**
   * Get unified ledger with both monetary and gold transactions
   */
  async getUnifiedLedger(
    supplierId: string,
    storeId: string,
    options?: {
      ledgerType?: 'monetary' | 'gold' | 'gold_exchange' | 'both';
      dateFrom?: Date;
      dateTo?: Date;
      limit?: number;
      offset?: number;
    }
  ) {
    try {
      const conditions = [
        eq(supplierAccountTransactions.supplierId, supplierId),
        eq(supplierAccountTransactions.storeId, storeId),
      ];

      if (options?.ledgerType && options.ledgerType !== 'both') {
        if (options.ledgerType === 'gold') {
          const goldCondition = or(
            eq(supplierAccountTransactions.ledgerType, 'gold'),
            and(
              eq(supplierAccountTransactions.ledgerType, 'monetary'),
              or(
                gt(supplierAccountTransactions.goldDebit, '0'),
                gt(supplierAccountTransactions.goldCredit, '0')
              )
            )
          );
          if (goldCondition) conditions.push(goldCondition);
        } else {
          conditions.push(eq(supplierAccountTransactions.ledgerType, options.ledgerType));
        }
      }

      if (options?.dateFrom) {
        conditions.push(
          sql`${supplierAccountTransactions.transactionDate} >= ${options.dateFrom}`
        );
      }
      if (options?.dateTo) {
        conditions.push(sql`${supplierAccountTransactions.transactionDate} <= ${options.dateTo}`);
      }

      const transactions = await db.query.supplierAccountTransactions.findMany({
        where: and(...conditions),
        orderBy: [desc(supplierAccountTransactions.transactionDate)],
        limit: options?.limit || 100,
        offset: options?.offset || 0,
        with: {
          createdByUser: {
            columns: {
              id: true,
              fullName: true,
            },
          },
        },
      });

      return transactions;
    } catch (error) {
      logger.error('Error fetching unified ledger:', error);
      throw error;
    }
  }
}

export const supplierAccountService = new SupplierAccountService();
