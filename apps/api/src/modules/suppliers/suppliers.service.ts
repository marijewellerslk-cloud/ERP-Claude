import { eq, and, sql, desc, or, like, ilike } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { suppliers, supplierContacts, inventoryBatches, purchasePayments, supplierAccountTransactions, accounts } from '../../db/schema.js';
import type { CreateSupplierInput, UpdateSupplierInput, ListSuppliersQuery, SettleBalanceInput } from './suppliers.validation.js';

import { supplierAccountService } from '../../services/supplier-account.service.js';
import { accountingService } from '../accounting/accounting.service.js';
import { logger } from '../../utils/logger.js';

export class SuppliersService {
  /**
   * Generate unique supplier code for a store
   * Format: SUP-00001, SUP-00002, etc.
   */
  async generateSupplierCode(storeId: string): Promise<string> {
    const lastSupplier = await db
      .select({ supplierCode: suppliers.supplierCode })
      .from(suppliers)
      .where(eq(suppliers.storeId, storeId))
      .orderBy(desc(suppliers.supplierCode))
      .limit(1);

    if (lastSupplier.length === 0) {
      return 'SUP-00001';
    }

    const lastCode = lastSupplier[0].supplierCode;
    const match = lastCode.match(/SUP-(\d+)/);

    if (!match) {
      return 'SUP-00001';
    }

    const nextNumber = parseInt(match[1], 10) + 1;
    return `SUP-${nextNumber.toString().padStart(5, '0')}`;
  }

  /**
   * Create a new supplier
   */
  async createSupplier(input: CreateSupplierInput, storeId: string) {
    const supplierCode = await this.generateSupplierCode(storeId);

    const [supplier] = await db
      .insert(suppliers)
      .values({
        storeId,
        supplierCode,
        businessName: input.businessName,
        contactPersonName: input.contactPersonName ?? null,
        email: input.email ?? null,
        phone: input.phone,
        whatsapp: input.whatsapp ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        pincode: input.pincode ?? null,
        gstNumber: input.gstNumber ?? null,
        panNumber: input.panNumber ?? null,
        supplierType: input.supplierType,
        specialization: input.specialization ? JSON.stringify(input.specialization) : null,
        bankName: input.bankName ?? null,
        accountNumber: input.accountNumber ?? null,
        ifscCode: input.ifscCode ?? null,
        upiId: input.upiId ?? null,
        defaultCreditDays: input.defaultCreditDays ?? 0,
        creditLimit: input.creditLimit?.toString() ?? '0',
        rating: input.rating ?? null,
        notes: input.notes ?? null,
      })
      .returning();

    // Add contacts if provided
    if (input.contacts && input.contacts.length > 0) {
      await db.insert(supplierContacts).values(
        input.contacts.map((contact) => ({
          supplierId: supplier.id,
          name: contact.name,
          phone: contact.phone,
          designation: contact.designation,
          email: contact.email,
          isPrimary: contact.isPrimary,
        }))
      );
    }

    return await this.getSupplier(supplier.id, storeId);
  }

  /**
   * Get supplier by ID
   */
  async getSupplier(supplierId: string, storeId: string) {
    const supplier = await db.query.suppliers.findFirst({
      where: and(eq(suppliers.id, supplierId), eq(suppliers.storeId, storeId)),
      with: {
        contacts: true,
      },
    });

    return supplier;
  }

  /**
   * Update supplier
   */
  async updateSupplier(supplierId: string, storeId: string, input: UpdateSupplierInput) {
    const updateData: any = { ...input };

    if (input.specialization) {
      updateData.specialization = JSON.stringify(input.specialization);
    }

    if (input.creditLimit !== undefined) {
      updateData.creditLimit = input.creditLimit.toString();
    }

    const [updatedSupplier] = await db
      .update(suppliers)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(and(eq(suppliers.id, supplierId), eq(suppliers.storeId, storeId)))
      .returning();

    // Handle contacts update if provided
    if (input.contacts) {
      // Get existing contacts
      const existingContacts = await db
        .select()
        .from(supplierContacts)
        .where(eq(supplierContacts.supplierId, supplierId));

      const existingContactIds = existingContacts.map((c) => c.id);
      const incomingContactIds = input.contacts
        .filter((c) => c.id)
        .map((c) => c.id as string);

      // Delete contacts not in incoming list
      const contactsToDelete = existingContactIds.filter(
        (id) => !incomingContactIds.includes(id)
      );

      if (contactsToDelete.length > 0) {
        await db
          .delete(supplierContacts)
          .where(
            and(
              eq(supplierContacts.supplierId, supplierId),
              sql`${supplierContacts.id} IN ${contactsToDelete}`
            )
          );
      }

      // Upsert contacts
      for (const contact of input.contacts) {
        if (contact.id) {
          // Update existing
          await db
            .update(supplierContacts)
            .set({
              name: contact.name,
              phone: contact.phone,
              designation: contact.designation,
              email: contact.email,
              isPrimary: contact.isPrimary,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(supplierContacts.id, contact.id),
                eq(supplierContacts.supplierId, supplierId)
              )
            );
        } else {
          // Create new
          await db.insert(supplierContacts).values({
            supplierId: supplierId,
            name: contact.name,
            phone: contact.phone,
            designation: contact.designation,
            email: contact.email,
            isPrimary: contact.isPrimary,
          });
        }
      }
    }

    return await this.getSupplier(supplierId, storeId);
  }

  /**
   * Soft delete supplier
   */
  async deleteSupplier(supplierId: string, storeId: string) {
    // Check if supplier has any batches
    const batchCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryBatches)
      .where(eq(inventoryBatches.supplierId, supplierId));

    if (batchCount[0].count > 0) {
      throw new Error('Cannot delete supplier with existing purchase batches. Please deactivate instead.');
    }

    const [deletedSupplier] = await db
      .update(suppliers)
      .set({ deletedAt: new Date() })
      .where(and(eq(suppliers.id, supplierId), eq(suppliers.storeId, storeId)))
      .returning();

    return deletedSupplier;
  }

  /**
   * List suppliers with optional filters
   */
  async listSuppliers(storeId: string, query: ListSuppliersQuery) {
    const conditions = [eq(suppliers.storeId, storeId), sql`${suppliers.deletedAt} IS NULL`];

    if (query.search) {
      conditions.push(
        or(
          ilike(suppliers.businessName, `%${query.search}%`),
          ilike(suppliers.phone, `%${query.search}%`),
          ilike(suppliers.email, `%${query.search}%`)
        )!
      );
    }

    if (query.supplierType) {
      conditions.push(eq(suppliers.supplierType, query.supplierType));
    }

    if (query.isActive !== undefined) {
      conditions.push(eq(suppliers.isActive, query.isActive === 'true'));
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const offset = (page - 1) * limit;

    const suppliersList = await db
      .select()
      .from(suppliers)
      .where(and(...conditions))
      .orderBy(desc(suppliers.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(suppliers)
      .where(and(...conditions));

    return {
      data: suppliersList,
      pagination: {
        page,
        limit,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / limit),
      },
    };
  }

  /**
   * Get supplier statistics with aggregations
   */
  async getSupplierStats(supplierId: string, storeId: string) {
    const supplier = await this.getSupplier(supplierId, storeId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    // Use denormalized fields from supplier table
    const currentBalance = parseFloat(supplier.currentBalance || '0');
    const totalLifetimePurchases = parseFloat(supplier.totalLifetimePurchases || '0');
    const totalLifetimePayments = parseFloat(supplier.totalLifetimePayments || '0');
    const creditLimit = parseFloat(supplier.creditLimit || '0');
    const availableCredit = creditLimit - currentBalance;

    // Get batch counts for verification and additional context
    const [batchStats] = await db
      .select({
        totalBatches: sql<number>`COUNT(${inventoryBatches.id})`,
        completedBatches: sql<number>`COUNT(CASE WHEN ${inventoryBatches.status} = 'completed' THEN 1 END)`,
        activeBatches: sql<number>`COUNT(CASE WHEN ${inventoryBatches.status} = 'in_progress' THEN 1 END)`,
        totalWeight: sql<string>`COALESCE(SUM(${inventoryBatches.actualTotalWeight}), 0)`,
      })
      .from(inventoryBatches)
      .where(eq(inventoryBatches.supplierId, supplierId));

    // Gold ledger fields
    const goldBalanceGrams = parseFloat(supplier.goldBalanceGrams || '0');
    const totalGoldReceived = parseFloat(supplier.totalGoldReceived || '0');
    const totalGoldReturned = parseFloat(supplier.totalGoldReturned || '0');

    // Gold exchange ledger fields
    const goldExchangeBalanceGrams = parseFloat(supplier.goldExchangeBalanceGrams || '0');
    const totalGoldGivenInExchange = parseFloat(supplier.totalGoldGivenInExchange || '0');
    const totalGoldReceivedInExchange = parseFloat(supplier.totalGoldReceivedInExchange || '0');

    return {
      supplier,
      statistics: {
        // Denormalized financial data (fast)
        currentBalance,
        totalLifetimePurchases,
        totalLifetimePayments,
        creditLimit,
        availableCredit,
        accountStatus: supplier.accountStatus,
        lastPurchaseDate: supplier.lastPurchaseDate,
        lastPaymentDate: supplier.lastPaymentDate,
        // Gold ledger data
        goldBalanceGrams,
        totalGoldReceived,
        totalGoldReturned,
        // Gold exchange ledger data
        goldExchangeBalanceGrams,
        totalGoldGivenInExchange,
        totalGoldReceivedInExchange,
        // Batch counts (for context)
        totalBatches: Number(batchStats.totalBatches) || 0,
        completedBatches: Number(batchStats.completedBatches) || 0,
        activeBatches: Number(batchStats.activeBatches) || 0,
        totalWeight: parseFloat(batchStats.totalWeight || '0'),
      },
    };
  }

  /**
   * Get supplier purchase history (all batches from this supplier)
   */
  async getSupplierPurchaseHistory(supplierId: string, storeId: string) {
    const supplier = await this.getSupplier(supplierId, storeId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    const batches = await db
      .select({
        id: inventoryBatches.id,
        batchNumber: inventoryBatches.batchNumber,
        purchaseDate: inventoryBatches.purchaseDate,
        expectedTotalItems: inventoryBatches.expectedTotalItems,
        actualTotalItems: inventoryBatches.actualTotalItems,
        expectedTotalWeight: inventoryBatches.expectedTotalWeight,
        actualTotalWeight: inventoryBatches.actualTotalWeight,
        totalCost: inventoryBatches.totalCost,
        goldRatePerGram: inventoryBatches.goldRatePerGram,
        totalPaid: inventoryBatches.totalPaid,
        outstandingBalance: inventoryBatches.outstandingBalance,
        dueDate: inventoryBatches.dueDate,
        paymentStatus: inventoryBatches.paymentStatus,
        status: inventoryBatches.status,
        notes: inventoryBatches.notes,
        createdAt: inventoryBatches.createdAt,
      })
      .from(inventoryBatches)
      .where(eq(inventoryBatches.supplierId, supplierId))
      .orderBy(desc(inventoryBatches.purchaseDate));

    return batches;
  }

  /**
   * Get supplier ledger (transaction history: purchases + payments)
   */
  async getSupplierLedger(supplierId: string, storeId: string) {
    const supplier = await this.getSupplier(supplierId, storeId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    // Get all batches (purchases - debits)
    const purchases = await db
      .select({
        id: inventoryBatches.id,
        date: inventoryBatches.purchaseDate,
        type: sql<string>`'purchase'`,
        reference: inventoryBatches.batchNumber,
        debit: inventoryBatches.totalCost,
        credit: sql<string>`NULL`,
        description: sql<string>`CONCAT('Batch Purchase: ', ${inventoryBatches.batchNumber})`,
      })
      .from(inventoryBatches)
      .where(eq(inventoryBatches.supplierId, supplierId));

    // Get all payments (credits)
    const payments = await db
      .select({
        id: purchasePayments.id,
        date: purchasePayments.paymentDate,
        type: sql<string>`'payment'`,
        reference: purchasePayments.transactionReference,
        debit: sql<string>`NULL`,
        credit: purchasePayments.amount,
        description: sql<string>`CONCAT('Payment - ', ${purchasePayments.paymentMethod}, ' (', ${purchasePayments.paymentType}, ')')`,
      })
      .from(purchasePayments)
      .innerJoin(inventoryBatches, eq(purchasePayments.batchId, inventoryBatches.id))
      .where(eq(inventoryBatches.supplierId, supplierId));

    // Combine and sort by date
    const transactions = [...purchases, ...payments].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // Calculate running balance
    let runningBalance = 0;
    const ledgerWithBalance = transactions.reverse().map((txn) => {
      const debitAmount = txn.debit ? parseFloat(txn.debit) : 0;
      const creditAmount = txn.credit ? parseFloat(txn.credit) : 0;

      runningBalance += debitAmount - creditAmount;

      return {
        ...txn,
        debit: debitAmount > 0 ? debitAmount : null,
        credit: creditAmount > 0 ? creditAmount : null,
        balance: runningBalance,
      };
    }).reverse();

    return ledgerWithBalance;
  }

  /**
   * Get suppliers overview for dashboard
   */
  async getSuppliersOverview(storeId: string) {
    const [totalSuppliers] = await db
      .select({ count: sql<number>`count(*)` })
      .from(suppliers)
      .where(and(eq(suppliers.storeId, storeId), sql`${suppliers.deletedAt} IS NULL`));

    const [activeSuppliers] = await db
      .select({ count: sql<number>`count(*)` })
      .from(suppliers)
      .where(
        and(
          eq(suppliers.storeId, storeId),
          eq(suppliers.isActive, true),
          sql`${suppliers.deletedAt} IS NULL`
        )
      );

    const [financialStats] = await db
      .select({
        totalOutstanding: sql<string>`COALESCE(SUM(CAST(${suppliers.currentBalance} AS DECIMAL)), 0)`,
        totalPurchases: sql<string>`COALESCE(SUM(CAST(${suppliers.totalLifetimePurchases} AS DECIMAL)), 0)`,
      })
      .from(suppliers)
      .where(and(eq(suppliers.storeId, storeId), sql`${suppliers.deletedAt} IS NULL`));

    // Purchases this month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [monthlyStats] = await db
      .select({
        purchasesThisMonth: sql<string>`COALESCE(SUM(${inventoryBatches.totalCost}), 0)`,
      })
      .from(inventoryBatches)
      .innerJoin(suppliers, eq(inventoryBatches.supplierId, suppliers.id))
      .where(
        and(
          eq(suppliers.storeId, storeId),
          sql`${inventoryBatches.purchaseDate} >= ${firstDayOfMonth.toISOString()}`
        )
      );

    // Total gold balance across all suppliers
    const [goldStats] = await db
      .select({
        totalGoldBalance: sql<string>`COALESCE(SUM(CAST(${suppliers.goldBalanceGrams} AS DECIMAL)), 0)`,
        totalGoldExchangeBalance: sql<string>`COALESCE(SUM(CAST(${suppliers.goldExchangeBalanceGrams} AS DECIMAL)), 0)`,
      })
      .from(suppliers)
      .where(and(eq(suppliers.storeId, storeId), sql`${suppliers.deletedAt} IS NULL`));

    // Top 5 suppliers by outstanding balance (monetary)
    const topSuppliers = await db
      .select({
        id: suppliers.id,
        businessName: suppliers.businessName,
        currentBalance: suppliers.currentBalance,
        goldBalanceGrams: suppliers.goldBalanceGrams,
        lastPurchaseDate: suppliers.lastPurchaseDate,
      })
      .from(suppliers)
      .where(
        and(
          eq(suppliers.storeId, storeId),
          sql`${suppliers.deletedAt} IS NULL`,
          sql`CAST(${suppliers.currentBalance} AS DECIMAL) > 0`
        )
      )
      .orderBy(sql`CAST(${suppliers.currentBalance} AS DECIMAL) DESC`)
      .limit(5);

    // Recent 5 purchases
    const recentPurchases = await db
      .select({
        id: inventoryBatches.id,
        batchNumber: inventoryBatches.batchNumber,
        purchaseDate: inventoryBatches.purchaseDate,
        totalCost: inventoryBatches.totalCost,
        purchaseType: inventoryBatches.purchaseType,
        paymentStatus: inventoryBatches.paymentStatus,
        outstandingBalance: inventoryBatches.outstandingBalance,
        supplierName: suppliers.businessName,
        supplierId: suppliers.id,
      })
      .from(inventoryBatches)
      .innerJoin(suppliers, eq(inventoryBatches.supplierId, suppliers.id))
      .where(eq(suppliers.storeId, storeId))
      .orderBy(desc(inventoryBatches.purchaseDate))
      .limit(5);

    // Overdue payments count
    const [overdueStats] = await db
      .select({
        count: sql<number>`count(*)`,
        totalOverdue: sql<string>`COALESCE(SUM(CAST(${inventoryBatches.outstandingBalance} AS DECIMAL)), 0)`,
      })
      .from(inventoryBatches)
      .innerJoin(suppliers, eq(inventoryBatches.supplierId, suppliers.id))
      .where(
        and(
          eq(suppliers.storeId, storeId),
          sql`${inventoryBatches.dueDate} < NOW()`,
          sql`CAST(${inventoryBatches.outstandingBalance} AS DECIMAL) > 0`
        )
      );

    return {
      totalSuppliers: Number(totalSuppliers.count) || 0,
      activeSuppliers: Number(activeSuppliers.count) || 0,
      totalOutstanding: parseFloat(financialStats.totalOutstanding || '0'),
      totalPurchases: parseFloat(financialStats.totalPurchases || '0'),
      purchasesThisMonth: parseFloat(monthlyStats.purchasesThisMonth || '0'),
      totalGoldBalance: parseFloat(goldStats.totalGoldBalance || '0'),
      totalGoldExchangeBalance: parseFloat(goldStats.totalGoldExchangeBalance || '0'),
      topSuppliers: topSuppliers.map(s => ({
        id: s.id,
        businessName: s.businessName,
        currentBalance: parseFloat(s.currentBalance || '0'),
        goldBalanceGrams: parseFloat(s.goldBalanceGrams || '0'),
        lastPurchaseDate: s.lastPurchaseDate,
      })),
      recentPurchases: recentPurchases.map(p => ({
        id: p.id,
        batchNumber: p.batchNumber,
        purchaseDate: p.purchaseDate,
        totalCost: parseFloat(p.totalCost || '0'),
        purchaseType: p.purchaseType,
        paymentStatus: p.paymentStatus,
        outstandingBalance: parseFloat(p.outstandingBalance || '0'),
        supplierName: p.supplierName,
        supplierId: p.supplierId,
      })),
      overduePayments: Number(overdueStats.count) || 0,
      totalOverdue: parseFloat(overdueStats.totalOverdue || '0'),
    };
  }

  /**
   * Get supplier account transactions (ledger from new table)
   */
  async getAccountTransactions(
    supplierId: string,
    storeId: string,
    options?: {
      dateFrom?: string;
      dateTo?: string;
      transactionType?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const supplier = await this.getSupplier(supplierId, storeId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    const transactionOptions: any = {};
    if (options?.dateFrom) {
      transactionOptions.dateFrom = new Date(options.dateFrom);
    }
    if (options?.dateTo) {
      transactionOptions.dateTo = new Date(options.dateTo);
    }
    if (options?.transactionType) {
      transactionOptions.transactionType = options.transactionType;
    }
    if (options?.limit) {
      transactionOptions.limit = options.limit;
    }
    if (options?.offset) {
      transactionOptions.offset = options.offset;
    }

    return await supplierAccountService.getAccountTransactions(
      supplierId,
      storeId,
      transactionOptions
    );
  }

  /**
   * Get unified ledger with dual-ledger support (monetary + gold)
   */
  async getUnifiedLedger(
    supplierId: string,
    storeId: string,
    options?: {
      ledgerType?: 'monetary' | 'gold' | 'gold_exchange' | 'both';
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const supplier = await this.getSupplier(supplierId, storeId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    const ledgerOptions: any = {};
    if (options?.ledgerType) {
      ledgerOptions.ledgerType = options.ledgerType;
    }
    if (options?.dateFrom) {
      ledgerOptions.dateFrom = new Date(options.dateFrom);
    }
    if (options?.dateTo) {
      ledgerOptions.dateTo = new Date(options.dateTo);
    }
    if (options?.limit) {
      ledgerOptions.limit = options.limit;
    }
    if (options?.offset) {
      ledgerOptions.offset = options.offset;
    }

    return await supplierAccountService.getUnifiedLedger(
      supplierId,
      storeId,
      ledgerOptions
    );
  }

  /**
   * Settle pending balance (monetary or gold)
   */
  async settleBalance(supplierId: string, storeId: string, input: SettleBalanceInput, userId: string) {
    const supplier = await this.getSupplier(supplierId, storeId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    const transactionDate = input.transactionDate ? new Date(input.transactionDate) : new Date();

    // Use transaction to ensure consistency
    return await db.transaction(async (tx) => {
      // 1. Monetary Settlement
      if (input.settlementType === 'monetary') {
        const amount = input.amount || 0;
        if (amount <= 0) {
          throw new Error('Amount must be greater than 0');
        }

        // Create transaction record
        await supplierAccountService.createMonetaryTransaction(
          supplierId,
          storeId,
          {
            type: 'payment',
            referenceType: 'payment',
            debit: 0,
            credit: amount, // Payment reduces balance (credit)
            paymentMethod: input.paymentMethod || 'cash',
            paymentReference: input.paymentReference,
            description: input.notes || `Balance settlement payment via ${input.paymentMethod}`,
            transactionDate,
            userId,
          },
          tx
        );

        // Update supplier balance (payment reduces balance)
        const balanceUpdate = {
          balanceChange: -amount, // Negative because we are paying, so debt reduces
          paymentChange: amount,
        };

        await supplierAccountService.updateSupplierBalance(supplierId, storeId, balanceUpdate, tx);

        // Accounting integration: Debit Accounts Payable, Credit Cash/Bank
        try {
          const [payableAccount] = await tx
            .select()
            .from(accounts)
            .where(and(eq(accounts.storeId, storeId), eq(accounts.accountCode, '2101')));

          const creditCode = (input.paymentMethod || 'cash') === 'cash' ? '1101' : '1110';
          const [creditAccount] = await tx
            .select()
            .from(accounts)
            .where(and(eq(accounts.storeId, storeId), eq(accounts.accountCode, creditCode)));

          if (payableAccount && creditAccount) {
            await accountingService.createJournalEntry(
              storeId,
              userId,
              {
                entryDate: transactionDate.toISOString(),
                entryType: 'payment',
                narration: `Supplier settlement payment - ${supplier.businessName}`,
                referenceType: 'supplier_settlement',
                referenceId: supplierId,
                lines: [
                  {
                    accountId: payableAccount.id,
                    debitAmount: amount,
                    creditAmount: 0,
                    description: `Settle supplier balance - ${supplier.businessName}`,
                    partyType: 'supplier',
                    partyId: supplierId,
                  },
                  {
                    accountId: creditAccount.id,
                    debitAmount: 0,
                    creditAmount: amount,
                    description: `Payment to ${supplier.businessName} via ${input.paymentMethod || 'cash'}`,
                  },
                ],
              },
              tx
            );
            logger.info('Settlement journal entry created', { supplierId, amount });
          }
        } catch (accountingError) {
          logger.warn('Could not create accounting entry for settlement', { error: accountingError });
          // Don't fail the settlement if accounting integration fails
        }
      }

      // 2. Gold Settlement
      else if (input.settlementType === 'gold') {
        const weight = input.goldWeightGrams || 0;
        if (weight <= 0) {
          throw new Error('Gold weight must be greater than 0');
        }

        // Create gold transaction record
        await supplierAccountService.createGoldTransaction(
          supplierId,
          storeId,
          {
            type: 'gold_returned', // We are returning gold to supplier to settle balance
            referenceType: 'manual',
            goldDebit: 0,
            goldCredit: weight, // Gold returned (decrease balance)
            description: input.notes || 'Gold returned for balance settlement',
            transactionDate,
            userId,
          },
          tx
        );

        // Update supplier gold balance (returning gold reduces what we owe)
        await supplierAccountService.updateGoldBalance(
          supplierId,
          storeId,
          {
            goldBalanceChange: -weight, // Negative change to reduce balance
            goldReturnedChange: weight,
          },
          tx
        );
      }

      return { success: true };
    });
  }
}
