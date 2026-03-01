import { eq, and, desc, sql, ilike, or, gte, lte, asc } from 'drizzle-orm';
import { db } from '../../config/database.js';
import {
  accounts,
  bankAccounts,
  journalEntries,
  journalEntryLines,
  expenses,
  cashRegister,
  financialPeriods,
  users,
  invoices,
  payments,
  customers,
  suppliers,
} from '../../db/schema.js';
import { logger } from '../../utils/logger.js';

// Default chart of accounts for jewelry business
const DEFAULT_ACCOUNTS = [
  // Assets (1xxx)
  { code: '1000', name: 'Assets', type: 'asset', subType: null, normalBalance: 'debit', level: 1, isSystem: true },
  { code: '1100', name: 'Current Assets', type: 'asset', subType: 'current_asset', normalBalance: 'debit', level: 2, parent: '1000', isSystem: true },
  { code: '1101', name: 'Cash in Hand', type: 'asset', subType: 'cash', normalBalance: 'debit', level: 3, parent: '1100', isSystem: true },
  { code: '1102', name: 'Petty Cash', type: 'asset', subType: 'cash', normalBalance: 'debit', level: 3, parent: '1100', isSystem: false },
  { code: '1110', name: 'Bank Accounts', type: 'asset', subType: 'bank', normalBalance: 'debit', level: 3, parent: '1100', isSystem: true },
  { code: '1120', name: 'Accounts Receivable', type: 'asset', subType: 'receivable', normalBalance: 'debit', level: 3, parent: '1100', isSystem: true },
  { code: '1130', name: 'Inventory - Gold', type: 'asset', subType: 'inventory', normalBalance: 'debit', level: 3, parent: '1100', isSystem: true },
  { code: '1131', name: 'Inventory - Silver', type: 'asset', subType: 'inventory', normalBalance: 'debit', level: 3, parent: '1100', isSystem: true },
  { code: '1132', name: 'Inventory - Diamonds', type: 'asset', subType: 'inventory', normalBalance: 'debit', level: 3, parent: '1100', isSystem: true },
  { code: '1133', name: 'Inventory - Gemstones', type: 'asset', subType: 'inventory', normalBalance: 'debit', level: 3, parent: '1100', isSystem: true },
  { code: '1140', name: 'Advance to Suppliers', type: 'asset', subType: 'advance', normalBalance: 'debit', level: 3, parent: '1100', isSystem: false },
  { code: '1200', name: 'Fixed Assets', type: 'asset', subType: 'fixed_asset', normalBalance: 'debit', level: 2, parent: '1000', isSystem: true },
  { code: '1201', name: 'Furniture & Fixtures', type: 'asset', subType: 'fixed_asset', normalBalance: 'debit', level: 3, parent: '1200', isSystem: false },
  { code: '1202', name: 'Equipment', type: 'asset', subType: 'fixed_asset', normalBalance: 'debit', level: 3, parent: '1200', isSystem: false },

  // Liabilities (2xxx)
  { code: '2000', name: 'Liabilities', type: 'liability', subType: null, normalBalance: 'credit', level: 1, isSystem: true },
  { code: '2100', name: 'Current Liabilities', type: 'liability', subType: 'current_liability', normalBalance: 'credit', level: 2, parent: '2000', isSystem: true },
  { code: '2101', name: 'Accounts Payable', type: 'liability', subType: 'payable', normalBalance: 'credit', level: 3, parent: '2100', isSystem: true },
  { code: '2102', name: 'Customer Advances', type: 'liability', subType: 'advance', normalBalance: 'credit', level: 3, parent: '2100', isSystem: true },
  { code: '2110', name: 'GST Payable', type: 'liability', subType: 'tax', normalBalance: 'credit', level: 3, parent: '2100', isSystem: true },
  { code: '2111', name: 'CGST Payable', type: 'liability', subType: 'tax', normalBalance: 'credit', level: 3, parent: '2110', isSystem: true },
  { code: '2112', name: 'SGST Payable', type: 'liability', subType: 'tax', normalBalance: 'credit', level: 3, parent: '2110', isSystem: true },
  { code: '2120', name: 'Salaries Payable', type: 'liability', subType: 'payable', normalBalance: 'credit', level: 3, parent: '2100', isSystem: false },

  // Equity (3xxx)
  { code: '3000', name: 'Equity', type: 'equity', subType: null, normalBalance: 'credit', level: 1, isSystem: true },
  { code: '3100', name: 'Owner\'s Capital', type: 'equity', subType: 'capital', normalBalance: 'credit', level: 2, parent: '3000', isSystem: true },
  { code: '3200', name: 'Retained Earnings', type: 'equity', subType: 'retained', normalBalance: 'credit', level: 2, parent: '3000', isSystem: true },

  // Income (4xxx)
  { code: '4000', name: 'Income', type: 'income', subType: null, normalBalance: 'credit', level: 1, isSystem: true },
  { code: '4100', name: 'Sales Revenue', type: 'income', subType: 'sales', normalBalance: 'credit', level: 2, parent: '4000', isSystem: true },
  { code: '4101', name: 'Gold Sales', type: 'income', subType: 'sales', normalBalance: 'credit', level: 3, parent: '4100', isSystem: true },
  { code: '4102', name: 'Silver Sales', type: 'income', subType: 'sales', normalBalance: 'credit', level: 3, parent: '4100', isSystem: true },
  { code: '4103', name: 'Diamond Sales', type: 'income', subType: 'sales', normalBalance: 'credit', level: 3, parent: '4100', isSystem: true },
  { code: '4200', name: 'Service Income', type: 'income', subType: 'service', normalBalance: 'credit', level: 2, parent: '4000', isSystem: true },
  { code: '4201', name: 'Repair Income', type: 'income', subType: 'service', normalBalance: 'credit', level: 3, parent: '4200', isSystem: true },
  { code: '4202', name: 'Custom Order Income', type: 'income', subType: 'service', normalBalance: 'credit', level: 3, parent: '4200', isSystem: true },
  { code: '4203', name: 'Making Charges', type: 'income', subType: 'service', normalBalance: 'credit', level: 3, parent: '4200', isSystem: true },
  { code: '4300', name: 'Other Income', type: 'income', subType: 'other', normalBalance: 'credit', level: 2, parent: '4000', isSystem: false },
  { code: '4301', name: 'Interest Income', type: 'income', subType: 'other', normalBalance: 'credit', level: 3, parent: '4300', isSystem: false },

  // Expenses (5xxx)
  { code: '5000', name: 'Expenses', type: 'expense', subType: null, normalBalance: 'debit', level: 1, isSystem: true },
  { code: '5100', name: 'Cost of Goods Sold', type: 'expense', subType: 'cogs', normalBalance: 'debit', level: 2, parent: '5000', isSystem: true },
  { code: '5101', name: 'Gold Purchase Cost', type: 'expense', subType: 'cogs', normalBalance: 'debit', level: 3, parent: '5100', isSystem: true },
  { code: '5102', name: 'Silver Purchase Cost', type: 'expense', subType: 'cogs', normalBalance: 'debit', level: 3, parent: '5100', isSystem: true },
  { code: '5103', name: 'Diamond Purchase Cost', type: 'expense', subType: 'cogs', normalBalance: 'debit', level: 3, parent: '5100', isSystem: true },
  { code: '5200', name: 'Operating Expenses', type: 'expense', subType: 'operating', normalBalance: 'debit', level: 2, parent: '5000', isSystem: true },
  { code: '5201', name: 'Rent Expense', type: 'expense', subType: 'operating', normalBalance: 'debit', level: 3, parent: '5200', isSystem: false },
  { code: '5202', name: 'Utilities', type: 'expense', subType: 'operating', normalBalance: 'debit', level: 3, parent: '5200', isSystem: false },
  { code: '5203', name: 'Salaries & Wages', type: 'expense', subType: 'operating', normalBalance: 'debit', level: 3, parent: '5200', isSystem: false },
  { code: '5204', name: 'Insurance', type: 'expense', subType: 'operating', normalBalance: 'debit', level: 3, parent: '5200', isSystem: false },
  { code: '5205', name: 'Marketing & Advertising', type: 'expense', subType: 'operating', normalBalance: 'debit', level: 3, parent: '5200', isSystem: false },
  { code: '5206', name: 'Office Supplies', type: 'expense', subType: 'operating', normalBalance: 'debit', level: 3, parent: '5200', isSystem: false },
  { code: '5207', name: 'Bank Charges', type: 'expense', subType: 'operating', normalBalance: 'debit', level: 3, parent: '5200', isSystem: false },
  { code: '5208', name: 'Security Expenses', type: 'expense', subType: 'operating', normalBalance: 'debit', level: 3, parent: '5200', isSystem: false },
  { code: '5209', name: 'Maintenance & Repairs', type: 'expense', subType: 'operating', normalBalance: 'debit', level: 3, parent: '5200', isSystem: false },
  { code: '5210', name: 'Professional Fees', type: 'expense', subType: 'operating', normalBalance: 'debit', level: 3, parent: '5200', isSystem: false },
  { code: '5211', name: 'Travel & Conveyance', type: 'expense', subType: 'operating', normalBalance: 'debit', level: 3, parent: '5200', isSystem: false },
  { code: '5212', name: 'Miscellaneous Expense', type: 'expense', subType: 'operating', normalBalance: 'debit', level: 3, parent: '5200', isSystem: false },
];

interface CreateAccountInput {
  accountCode: string;
  accountName: string;
  accountType: string;
  accountSubType?: string;
  parentAccountId?: string;
  normalBalance: string;
  openingBalance?: number;
  openingBalanceDate?: string;
  gstApplicable?: boolean;
  gstRate?: number;
  hsnSacCode?: string;
  description?: string;
}

interface CreateExpenseInput {
  expenseDate: string;
  expenseAccountId: string;
  paidFromAccountId?: string;
  paymentMethod: string;
  amount: number;
  gstAmount?: number;
  vendorName?: string;
  vendorGstin?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  description: string;
  category?: string;
  receiptUrls?: string[];
  notes?: string;
}

interface CreateJournalEntryInput {
  entryDate: string;
  entryType: string;
  narration: string;
  lines: Array<{
    accountId: string;
    debitAmount?: number;
    creditAmount?: number;
    description?: string;
    partyType?: string;
    partyId?: string;
  }>;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  ledgerVisibility?: 'public' | 'private';
}

class AccountingService {
  // Generate unique entry/expense numbers
  private async generateNumber(prefix: string, table: any): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(table)
      .where(ilike(table.entryNumber || table.expenseNumber, `${prefix}-${dateStr}%`));

    const count = (result[0]?.count || 0) + 1;
    return `${prefix}-${dateStr}-${count.toString().padStart(3, '0')}`;
  }

  // Initialize default chart of accounts for a store
  async initializeChartOfAccounts(storeId: string): Promise<void> {
    // Check if already initialized
    const existingAccounts = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(accounts)
      .where(eq(accounts.storeId, storeId));

    if ((existingAccounts[0]?.count || 0) > 0) {
      logger.info(`Chart of accounts already initialized for store ${storeId}`);
      return;
    }

    const now = new Date();
    const accountMap: Record<string, string> = {};

    // Create accounts in order (parents first)
    for (const acc of DEFAULT_ACCOUNTS) {
      const parentId = acc.parent ? accountMap[acc.parent] : null;

      const [created] = await db
        .insert(accounts)
        .values({
          storeId,
          accountCode: acc.code,
          accountName: acc.name,
          accountType: acc.type,
          accountSubType: acc.subType,
          parentAccountId: parentId,
          level: acc.level,
          normalBalance: acc.normalBalance,
          isSystemAccount: acc.isSystem,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      accountMap[acc.code] = created.id;
    }

    // Create default cash account
    const cashAccountId = accountMap['1101'];
    if (cashAccountId) {
      await db.insert(bankAccounts).values({
        storeId,
        accountId: cashAccountId,
        bankAccountType: 'cash',
        isDefault: true,
        currentBalance: '0',
        createdAt: now,
        updatedAt: now,
      });
    }

    logger.info(`Chart of accounts initialized for store ${storeId}`);
  }

  // Get chart of accounts (hierarchical)
  async getChartOfAccounts(storeId: string) {
    const allAccounts = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.storeId, storeId), eq(accounts.isActive, true)))
      .orderBy(accounts.accountCode);

    // Build hierarchy
    const accountMap = new Map();
    const rootAccounts: any[] = [];

    for (const acc of allAccounts) {
      accountMap.set(acc.id, { ...acc, children: [] });
    }

    for (const acc of allAccounts) {
      const account = accountMap.get(acc.id);
      if (acc.parentAccountId) {
        const parent = accountMap.get(acc.parentAccountId);
        if (parent) {
          parent.children.push(account);
        }
      } else {
        rootAccounts.push(account);
      }
    }

    return rootAccounts;
  }

  // Get flat list of accounts
  async getAccountsList(storeId: string, filters: { type?: string; subType?: string; search?: string } = {}) {
    let conditions = [eq(accounts.storeId, storeId), eq(accounts.isActive, true)];

    if (filters.type) {
      conditions.push(eq(accounts.accountType, filters.type));
    }
    if (filters.subType) {
      conditions.push(eq(accounts.accountSubType, filters.subType));
    }
    if (filters.search) {
      conditions.push(
        or(
          ilike(accounts.accountCode, `%${filters.search}%`),
          ilike(accounts.accountName, `%${filters.search}%`)
        )!
      );
    }

    return db
      .select()
      .from(accounts)
      .where(and(...conditions))
      .orderBy(accounts.accountCode);
  }

  // Create a new account
  async createAccount(storeId: string, input: CreateAccountInput) {
    const now = new Date();

    // Determine level based on parent
    let level = 1;
    if (input.parentAccountId) {
      const [parent] = await db
        .select({ level: accounts.level })
        .from(accounts)
        .where(eq(accounts.id, input.parentAccountId));
      if (parent) level = parent.level + 1;
    }

    const [account] = await db
      .insert(accounts)
      .values({
        storeId,
        accountCode: input.accountCode,
        accountName: input.accountName,
        accountType: input.accountType,
        accountSubType: input.accountSubType,
        parentAccountId: input.parentAccountId,
        level,
        normalBalance: input.normalBalance,
        openingBalance: input.openingBalance?.toString(),
        openingBalanceDate: input.openingBalanceDate ? new Date(input.openingBalanceDate) : null,
        currentBalance: input.openingBalance?.toString() || '0',
        gstApplicable: input.gstApplicable,
        gstRate: input.gstRate?.toString(),
        hsnSacCode: input.hsnSacCode,
        description: input.description,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    logger.info(`Account created: ${input.accountCode} - ${input.accountName}`, { storeId });
    return account;
  }

  // Get bank accounts
  async getBankAccounts(storeId: string) {
    const results = await db
      .select({
        bankAccount: bankAccounts,
        account: accounts,
      })
      .from(bankAccounts)
      .innerJoin(accounts, eq(bankAccounts.accountId, accounts.id))
      .where(and(eq(bankAccounts.storeId, storeId), eq(bankAccounts.isActive, true)))
      .orderBy(desc(bankAccounts.isDefault), accounts.accountName);

    // Map to flat format for frontend
    return results.map(({ bankAccount, account }) => ({
      ...bankAccount,
      accountName: account.accountName,
      accountCode: account.accountCode,
    }));
  }

  // Create bank account
  async createBankAccount(storeId: string, input: any) {
    const now = new Date();

    // Create the bank account
    const [bankAccount] = await db
      .insert(bankAccounts)
      .values({
        storeId,
        accountId: input.accountId,
        bankName: input.bankName,
        branchName: input.branchName,
        accountNumber: input.accountNumber,
        ifscCode: input.ifscCode,
        accountHolderName: input.accountHolderName,
        bankAccountType: input.bankAccountType,
        currentBalance: input.openingBalance?.toString() || '0',
        creditLimit: input.creditLimit?.toString(),
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Update account opening balance
    if (input.openingBalance) {
      await db
        .update(accounts)
        .set({
          openingBalance: input.openingBalance.toString(),
          currentBalance: input.openingBalance.toString(),
          updatedAt: now,
        })
        .where(eq(accounts.id, input.accountId));
    }

    logger.info(`Bank account created: ${input.bankName || input.bankAccountType}`, { storeId });
    return bankAccount;
  }

  // Create journal entry (double-entry)
  async createJournalEntry(storeId: string, userId: string, input: CreateJournalEntryInput, tx?: any) {
    const dbClient = tx || db;
    // Validate double-entry: total debits must equal total credits
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of input.lines) {
      totalDebit += line.debitAmount || 0;
      totalCredit += line.creditAmount || 0;
    }

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Journal entry is not balanced. Debits: ${totalDebit}, Credits: ${totalCredit}`);
    }

    const entryNumber = await this.generateNumber('JE', journalEntries);
    const now = new Date();

    // Create journal entry
    const [entry] = await dbClient
      .insert(journalEntries)
      .values({
        storeId,
        entryNumber,
        entryDate: new Date(input.entryDate),
        entryType: input.entryType,
        totalDebit: totalDebit.toString(),
        totalCredit: totalCredit.toString(),
        narration: input.narration,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        referenceNumber: input.referenceNumber,
        ledgerVisibility: input.ledgerVisibility || 'public',
        status: 'posted',
        postedAt: now,
        postedBy: userId,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Create line items
    for (let i = 0; i < input.lines.length; i++) {
      const line = input.lines[i];
      await dbClient.insert(journalEntryLines).values({
        journalEntryId: entry.id,
        accountId: line.accountId,
        debitAmount: (line.debitAmount || 0).toString(),
        creditAmount: (line.creditAmount || 0).toString(),
        description: line.description,
        partyType: line.partyType,
        partyId: line.partyId,
        lineOrder: i + 1,
        createdAt: now,
      });

      // Update account balance
      await this.updateAccountBalance(line.accountId, line.debitAmount || 0, line.creditAmount || 0, tx);
    }

    logger.info(`Journal entry created: ${entryNumber}`, { storeId, totalDebit });
    return this.getJournalEntryById(entry.id, storeId);
  }

  // Update account balance based on debit/credit
  private async updateAccountBalance(accountId: string, debit: number, credit: number, tx?: any) {
    const dbClient = tx || db;

    const [account] = await dbClient
      .select({ normalBalance: accounts.normalBalance, currentBalance: accounts.currentBalance })
      .from(accounts)
      .where(eq(accounts.id, accountId));

    if (!account) return;

    let currentBalance = parseFloat(account.currentBalance?.toString() || '0');

    // For debit normal accounts (assets, expenses): debit increases, credit decreases
    // For credit normal accounts (liabilities, equity, income): credit increases, debit decreases
    if (account.normalBalance === 'debit') {
      currentBalance += debit - credit;
    } else {
      currentBalance += credit - debit;
    }

    await dbClient
      .update(accounts)
      .set({ currentBalance: currentBalance.toString(), updatedAt: new Date() })
      .where(eq(accounts.id, accountId));
  }

  // Get journal entry by ID
  async getJournalEntryById(entryId: string, storeId: string) {
    const [entry] = await db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.id, entryId), eq(journalEntries.storeId, storeId)));

    if (!entry) return null;

    const linesData = await db
      .select({
        line: journalEntryLines,
        account: accounts,
      })
      .from(journalEntryLines)
      .innerJoin(accounts, eq(journalEntryLines.accountId, accounts.id))
      .where(eq(journalEntryLines.journalEntryId, entryId))
      .orderBy(journalEntryLines.lineOrder);

    // Map lines to include account details
    const lines = linesData.map(({ line, account }) => ({
      ...line,
      account: account ? {
        accountCode: account.accountCode,
        accountName: account.accountName,
      } : null,
    }));

    return { ...entry, lines };
  }

  // List journal entries
  async listJournalEntries(
    storeId: string,
    filters: { dateFrom?: string; dateTo?: string; entryType?: string; search?: string; visibility?: string },
    limit = 50,
    offset = 0
  ) {
    let conditions = [eq(journalEntries.storeId, storeId)];

    if (filters.dateFrom) {
      conditions.push(gte(journalEntries.entryDate, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      conditions.push(lte(journalEntries.entryDate, new Date(filters.dateTo)));
    }
    if (filters.entryType) {
      conditions.push(eq(journalEntries.entryType, filters.entryType));
    }
    if (filters.visibility) {
      conditions.push(eq(journalEntries.ledgerVisibility, filters.visibility));
    }
    if (filters.search) {
      conditions.push(
        or(
          ilike(journalEntries.entryNumber, `%${filters.search}%`),
          ilike(journalEntries.narration, `%${filters.search}%`)
        )!
      );
    }

    const entries = await db
      .select()
      .from(journalEntries)
      .where(and(...conditions))
      .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(journalEntries)
      .where(and(...conditions));

    return {
      entries,
      total: countResult?.count || 0,
      limit,
      offset,
    };
  }

  // Create expense
  async createExpense(storeId: string, userId: string, input: CreateExpenseInput) {
    const expenseNumber = await this.generateNumber('EXP', expenses);
    const totalAmount = (input.amount || 0) + (input.gstAmount || 0);
    const now = new Date();

    // Create expense record
    const [expense] = await db
      .insert(expenses)
      .values({
        storeId,
        expenseNumber,
        expenseDate: new Date(input.expenseDate),
        expenseAccountId: input.expenseAccountId,
        paidFromAccountId: input.paidFromAccountId,
        paymentMethod: input.paymentMethod,
        amount: input.amount.toString(),
        gstAmount: input.gstAmount?.toString(),
        totalAmount: totalAmount.toString(),
        vendorName: input.vendorName,
        vendorGstin: input.vendorGstin,
        invoiceNumber: input.invoiceNumber,
        invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : null,
        description: input.description,
        category: input.category,
        receiptUrls: input.receiptUrls,
        approvalStatus: 'approved',
        approvedBy: userId,
        approvedAt: now,
        notes: input.notes,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Create journal entry for the expense
    const lines: any[] = [
      { accountId: input.expenseAccountId, debitAmount: totalAmount, creditAmount: 0 },
    ];

    // If paid from bank account, get the linked account
    if (input.paidFromAccountId) {
      const [bankAcc] = await db
        .select({ accountId: bankAccounts.accountId })
        .from(bankAccounts)
        .where(eq(bankAccounts.id, input.paidFromAccountId));

      if (bankAcc) {
        lines.push({ accountId: bankAcc.accountId, debitAmount: 0, creditAmount: totalAmount });
      }
    } else {
      // Paid from cash - find cash account
      const [cashAccount] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.storeId, storeId), eq(accounts.accountCode, '1101')));

      if (cashAccount) {
        lines.push({ accountId: cashAccount.id, debitAmount: 0, creditAmount: totalAmount });
      }
    }

    if (lines.length === 2) {
      const journalEntry = await this.createJournalEntry(storeId, userId, {
        entryDate: input.expenseDate,
        entryType: 'expense',
        narration: `Expense: ${input.description}`,
        lines,
        referenceType: 'expense',
        referenceId: expense.id,
        referenceNumber: expenseNumber,
      });

      // Update expense with journal entry reference
      await db
        .update(expenses)
        .set({ journalEntryId: journalEntry.id })
        .where(eq(expenses.id, expense.id));
    }

    logger.info(`Expense created: ${expenseNumber}`, { storeId, amount: totalAmount });
    return this.getExpenseById(expense.id, storeId);
  }

  // Get expense by ID
  async getExpenseById(expenseId: string, storeId: string) {
    const [expense] = await db
      .select({
        expense: expenses,
        account: accounts,
      })
      .from(expenses)
      .innerJoin(accounts, eq(expenses.expenseAccountId, accounts.id))
      .where(and(eq(expenses.id, expenseId), eq(expenses.storeId, storeId)));

    return expense;
  }

  // List expenses
  async listExpenses(
    storeId: string,
    filters: { dateFrom?: string; dateTo?: string; category?: string; search?: string },
    limit = 50,
    offset = 0
  ) {
    let conditions = [eq(expenses.storeId, storeId)];

    if (filters.dateFrom) {
      conditions.push(gte(expenses.expenseDate, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      conditions.push(lte(expenses.expenseDate, new Date(filters.dateTo)));
    }
    if (filters.category) {
      conditions.push(eq(expenses.category, filters.category));
    }
    if (filters.search) {
      conditions.push(
        or(
          ilike(expenses.expenseNumber, `%${filters.search}%`),
          ilike(expenses.description, `%${filters.search}%`),
          ilike(expenses.vendorName, `%${filters.search}%`)
        )!
      );
    }

    const expenseList = await db
      .select({
        expense: expenses,
        account: accounts,
      })
      .from(expenses)
      .innerJoin(accounts, eq(expenses.expenseAccountId, accounts.id))
      .where(and(...conditions))
      .orderBy(desc(expenses.expenseDate))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(expenses)
      .where(and(...conditions));

    // Map to expected format with expense account nested
    const mappedExpenses = expenseList.map(({ expense, account }) => ({
      ...expense,
      expenseAccount: account ? {
        accountCode: account.accountCode,
        accountName: account.accountName,
      } : null,
    }));

    return {
      expenses: mappedExpenses,
      total: countResult?.count || 0,
      limit,
      offset,
    };
  }

  // Get account ledger (transaction history)
  async getAccountLedger(
    accountId: string,
    storeId: string,
    filters: { dateFrom?: string; dateTo?: string },
    limit = 100,
    offset = 0
  ) {
    let conditions = [eq(journalEntryLines.accountId, accountId)];

    // Join with journal entries to get dates
    const ledgerQuery = db
      .select({
        line: journalEntryLines,
        entry: journalEntries,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(eq(journalEntryLines.accountId, accountId))
      .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
      .limit(limit)
      .offset(offset);

    const transactions = await ledgerQuery;

    // Get account details
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));

    return {
      account,
      transactions,
    };
  }

  // Get financial summary (dashboard)
  async getFinancialSummary(storeId: string) {
    // Get cash balance
    const [cashResult] = await db
      .select({ balance: sql<string>`COALESCE(sum(${accounts.currentBalance}), 0)` })
      .from(accounts)
      .innerJoin(bankAccounts, eq(accounts.id, bankAccounts.accountId))
      .where(and(eq(accounts.storeId, storeId), eq(bankAccounts.bankAccountType, 'cash')));

    // Get bank balances
    const [bankResult] = await db
      .select({ balance: sql<string>`COALESCE(sum(${accounts.currentBalance}), 0)` })
      .from(accounts)
      .innerJoin(bankAccounts, eq(accounts.id, bankAccounts.accountId))
      .where(and(eq(accounts.storeId, storeId), sql`${bankAccounts.bankAccountType} != 'cash'`));

    // Get accounts receivable
    const [receivableResult] = await db
      .select({ balance: accounts.currentBalance })
      .from(accounts)
      .where(and(eq(accounts.storeId, storeId), eq(accounts.accountCode, '1120')));

    // Get accounts payable
    const [payableResult] = await db
      .select({ balance: accounts.currentBalance })
      .from(accounts)
      .where(and(eq(accounts.storeId, storeId), eq(accounts.accountCode, '2101')));

    // Get today's dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get month dates
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get today's income (sum of credits to income accounts)
    const [todayIncomeResult] = await db
      .select({ total: sql<string>`COALESCE(sum(${journalEntryLines.creditAmount}), 0)` })
      .from(journalEntryLines)
      .innerJoin(accounts, eq(journalEntryLines.accountId, accounts.id))
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(accounts.storeId, storeId),
          eq(accounts.accountType, 'income'),
          gte(journalEntries.entryDate, today),
          lte(journalEntries.entryDate, tomorrow)
        )
      );

    // Get today's expenses
    const [todayExpensesResult] = await db
      .select({ total: sql<string>`COALESCE(sum(${expenses.totalAmount}), 0)` })
      .from(expenses)
      .where(
        and(
          eq(expenses.storeId, storeId),
          gte(expenses.expenseDate, today),
          lte(expenses.expenseDate, tomorrow)
        )
      );

    // Get month's income
    const [monthIncomeResult] = await db
      .select({ total: sql<string>`COALESCE(sum(${journalEntryLines.creditAmount}), 0)` })
      .from(journalEntryLines)
      .innerJoin(accounts, eq(journalEntryLines.accountId, accounts.id))
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(accounts.storeId, storeId),
          eq(accounts.accountType, 'income'),
          gte(journalEntries.entryDate, monthStart)
        )
      );

    // Get month's expenses
    const [monthExpensesResult] = await db
      .select({ total: sql<string>`COALESCE(sum(${expenses.totalAmount}), 0)` })
      .from(expenses)
      .where(and(eq(expenses.storeId, storeId), gte(expenses.expenseDate, monthStart)));

    return {
      cashInHand: parseFloat(cashResult?.balance || '0'),
      bankBalance: parseFloat(bankResult?.balance || '0'),
      receivables: parseFloat(receivableResult?.balance || '0'),
      payables: parseFloat(payableResult?.balance || '0'),
      todayIncome: parseFloat(todayIncomeResult?.total || '0'),
      todayExpenses: parseFloat(todayExpensesResult?.total || '0'),
      monthIncome: parseFloat(monthIncomeResult?.total || '0'),
      monthExpenses: parseFloat(monthExpensesResult?.total || '0'),
    };
  }

  // Get income statement (P&L)
  async getIncomeStatement(storeId: string, startDate: string, endDate: string) {
    // Get income accounts totals
    const incomeAccounts = await db
      .select({
        account: accounts,
        total: sql<string>`COALESCE(SUM(${journalEntryLines.creditAmount}) - SUM(${journalEntryLines.debitAmount}), 0)`,
      })
      .from(accounts)
      .leftJoin(journalEntryLines, eq(accounts.id, journalEntryLines.accountId))
      .leftJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(accounts.storeId, storeId),
          eq(accounts.accountType, 'income'),
          or(
            sql`${journalEntries.entryDate} IS NULL`,
            and(
              gte(journalEntries.entryDate, new Date(startDate)),
              lte(journalEntries.entryDate, new Date(endDate))
            )
          )
        )
      )
      .groupBy(accounts.id)
      .orderBy(accounts.accountCode);

    // Get expense accounts totals
    const expenseAccounts = await db
      .select({
        account: accounts,
        total: sql<string>`COALESCE(SUM(${journalEntryLines.debitAmount}) - SUM(${journalEntryLines.creditAmount}), 0)`,
      })
      .from(accounts)
      .leftJoin(journalEntryLines, eq(accounts.id, journalEntryLines.accountId))
      .leftJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(accounts.storeId, storeId),
          eq(accounts.accountType, 'expense'),
          or(
            sql`${journalEntries.entryDate} IS NULL`,
            and(
              gte(journalEntries.entryDate, new Date(startDate)),
              lte(journalEntries.entryDate, new Date(endDate))
            )
          )
        )
      )
      .groupBy(accounts.id)
      .orderBy(accounts.accountCode);

    // Map to expected format
    const incomeData = incomeAccounts
      .filter(acc => parseFloat(acc.total || '0') !== 0)
      .map(acc => ({
        accountCode: acc.account.accountCode,
        accountName: acc.account.accountName,
        balance: parseFloat(acc.total || '0'),
      }));

    const expenseData = expenseAccounts
      .filter(acc => parseFloat(acc.total || '0') !== 0)
      .map(acc => ({
        accountCode: acc.account.accountCode,
        accountName: acc.account.accountName,
        balance: parseFloat(acc.total || '0'),
      }));

    const totalIncome = incomeData.reduce((sum, acc) => sum + acc.balance, 0);
    const totalExpenses = expenseData.reduce((sum, acc) => sum + acc.balance, 0);
    const netProfit = totalIncome - totalExpenses;

    return {
      period: { startDate, endDate },
      income: {
        accounts: incomeData,
        total: totalIncome,
      },
      expenses: {
        accounts: expenseData,
        total: totalExpenses,
      },
      netProfit,
    };
  }

  // Get balance sheet
  async getBalanceSheet(storeId: string, asOfDate: string) {
    const date = new Date(asOfDate);

    // Get all accounts with their balances as of the date
    const allAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.storeId, storeId))
      .orderBy(accounts.accountCode);

    // Map accounts to expected format
    const mapAccounts = (accs: typeof allAccounts) =>
      accs
        .filter(a => parseFloat(a.currentBalance?.toString() || '0') !== 0)
        .map(a => ({
          accountCode: a.accountCode,
          accountName: a.accountName,
          balance: parseFloat(a.currentBalance?.toString() || '0'),
        }));

    const assetAccounts = allAccounts.filter(a => a.accountType === 'asset');
    const liabilityAccounts = allAccounts.filter(a => a.accountType === 'liability');
    const equityAccounts = allAccounts.filter(a => a.accountType === 'equity');

    const assetsData = mapAccounts(assetAccounts);
    const liabilitiesData = mapAccounts(liabilityAccounts);
    const equityData = mapAccounts(equityAccounts);

    const totalAssets = assetsData.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilitiesData.reduce((sum, a) => sum + a.balance, 0);
    const totalEquity = equityData.reduce((sum, a) => sum + a.balance, 0);

    return {
      asOf: asOfDate,
      assets: {
        accounts: assetsData,
        total: totalAssets,
      },
      liabilities: {
        accounts: liabilitiesData,
        total: totalLiabilities,
      },
      equity: {
        accounts: equityData,
        total: totalEquity,
      },
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
    };
  }

  // Trial Balance
  async getTrialBalance(storeId: string, asOfDate?: string) {
    const allAccounts = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.storeId, storeId), eq(accounts.isActive, true)))
      .orderBy(accounts.accountCode);

    const trialBalanceAccounts = allAccounts
      .filter(a => parseFloat(a.currentBalance?.toString() || '0') !== 0 && a.level >= 3)
      .map(a => {
        const balance = parseFloat(a.currentBalance?.toString() || '0');
        const isDebitNormal = a.normalBalance === 'debit';
        return {
          accountCode: a.accountCode,
          accountName: a.accountName,
          accountType: a.accountType,
          debit: (isDebitNormal && balance >= 0) || (!isDebitNormal && balance < 0)
            ? Math.abs(balance) : 0,
          credit: (!isDebitNormal && balance >= 0) || (isDebitNormal && balance < 0)
            ? Math.abs(balance) : 0,
        };
      });

    const totalDebit = trialBalanceAccounts.reduce((sum, a) => sum + a.debit, 0);
    const totalCredit = trialBalanceAccounts.reduce((sum, a) => sum + a.credit, 0);

    return {
      asOf: asOfDate || new Date().toISOString().split('T')[0],
      accounts: trialBalanceAccounts,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    };
  }

  // Cash Flow Statement
  async getCashFlowStatement(storeId: string, startDate: string, endDate: string) {
    // Operating activities: income/expense entries
    const operatingInflows = await db
      .select({
        total: sql<string>`COALESCE(SUM(${journalEntryLines.creditAmount}), 0)`,
      })
      .from(journalEntryLines)
      .innerJoin(accounts, eq(journalEntryLines.accountId, accounts.id))
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(accounts.storeId, storeId),
          eq(accounts.accountType, 'income'),
          gte(journalEntries.entryDate, new Date(startDate)),
          lte(journalEntries.entryDate, new Date(endDate)),
          eq(journalEntries.status, 'posted')
        )
      );

    const operatingOutflows = await db
      .select({
        total: sql<string>`COALESCE(SUM(${journalEntryLines.debitAmount}), 0)`,
      })
      .from(journalEntryLines)
      .innerJoin(accounts, eq(journalEntryLines.accountId, accounts.id))
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(accounts.storeId, storeId),
          eq(accounts.accountType, 'expense'),
          gte(journalEntries.entryDate, new Date(startDate)),
          lte(journalEntries.entryDate, new Date(endDate)),
          eq(journalEntries.status, 'posted')
        )
      );

    // Cash & bank movements
    const cashMovements = await db
      .select({
        accountName: accounts.accountName,
        totalDebit: sql<string>`COALESCE(SUM(${journalEntryLines.debitAmount}), 0)`,
        totalCredit: sql<string>`COALESCE(SUM(${journalEntryLines.creditAmount}), 0)`,
      })
      .from(journalEntryLines)
      .innerJoin(accounts, eq(journalEntryLines.accountId, accounts.id))
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(accounts.storeId, storeId),
          or(eq(accounts.accountSubType, 'cash'), eq(accounts.accountSubType, 'bank')),
          gte(journalEntries.entryDate, new Date(startDate)),
          lte(journalEntries.entryDate, new Date(endDate)),
          eq(journalEntries.status, 'posted')
        )
      )
      .groupBy(accounts.id, accounts.accountName);

    const inflows = parseFloat(operatingInflows[0]?.total || '0');
    const outflows = parseFloat(operatingOutflows[0]?.total || '0');
    const netOperating = inflows - outflows;

    // Opening and closing cash balances
    const cashAccounts = await db
      .select({
        accountName: accounts.accountName,
        balance: accounts.currentBalance,
      })
      .from(accounts)
      .innerJoin(bankAccounts, eq(accounts.id, bankAccounts.accountId))
      .where(and(eq(accounts.storeId, storeId)));

    const totalCashBalance = cashAccounts.reduce(
      (sum, a) => sum + parseFloat(a.balance?.toString() || '0'), 0
    );

    return {
      period: { startDate, endDate },
      operating: {
        inflows,
        outflows,
        net: netOperating,
      },
      cashMovements: cashMovements.map(m => ({
        accountName: m.accountName,
        inflow: parseFloat(m.totalDebit || '0'),
        outflow: parseFloat(m.totalCredit || '0'),
        net: parseFloat(m.totalDebit || '0') - parseFloat(m.totalCredit || '0'),
      })),
      closingCashBalance: totalCashBalance,
    };
  }

  // Cash register operations
  async openCashRegister(storeId: string, userId: string, openingBalance: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    // Check if already open
    const [existing] = await db
      .select()
      .from(cashRegister)
      .where(and(eq(cashRegister.storeId, storeId), eq(cashRegister.registerDate, today)));

    if (existing) {
      if (existing.status === 'open') {
        throw new Error('Cash register is already open for today');
      }
      throw new Error('Cash register has already been closed for today');
    }

    const [register] = await db
      .insert(cashRegister)
      .values({
        storeId,
        registerDate: today,
        openingBalance: openingBalance.toString(),
        openingTime: now,
        openedBy: userId,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    logger.info(`Cash register opened for store ${storeId}`, { openingBalance });
    return register;
  }

  async closeCashRegister(
    storeId: string,
    userId: string,
    closingBalance: number,
    varianceExplanation?: string
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    const [register] = await db
      .select()
      .from(cashRegister)
      .where(and(eq(cashRegister.storeId, storeId), eq(cashRegister.registerDate, today), eq(cashRegister.status, 'open')));

    if (!register) {
      throw new Error('No open cash register found for today');
    }

    // Calculate expected closing
    const opening = parseFloat(register.openingBalance.toString());
    const cashSales = parseFloat(register.totalCashSales?.toString() || '0');
    const cashReceived = parseFloat(register.totalCashReceived?.toString() || '0');
    const cashExpenses = parseFloat(register.totalCashExpenses?.toString() || '0');
    const cashPayments = parseFloat(register.totalCashPayments?.toString() || '0');

    const expectedClosing = opening + cashSales + cashReceived - cashExpenses - cashPayments;
    const variance = closingBalance - expectedClosing;

    await db
      .update(cashRegister)
      .set({
        closingBalance: closingBalance.toString(),
        closingTime: now,
        closedBy: userId,
        expectedClosingBalance: expectedClosing.toString(),
        variance: variance.toString(),
        varianceExplanation,
        status: 'closed',
        updatedAt: now,
      })
      .where(eq(cashRegister.id, register.id));

    logger.info(`Cash register closed for store ${storeId}`, { closingBalance, expectedClosing, variance });
    return this.getCashRegister(storeId, today.toISOString().split('T')[0]);
  }

  async getCashRegister(storeId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const [register] = await db
      .select({
        register: cashRegister,
        openedByUser: users,
      })
      .from(cashRegister)
      .leftJoin(users, eq(cashRegister.openedBy, users.id))
      .where(and(eq(cashRegister.storeId, storeId), eq(cashRegister.registerDate, targetDate)));

    return register;
  }

  // Petty Cash Methods

  // Get Petty Cash Book
  async getPettyCashBook(storeId: string, filters: { dateFrom?: string; dateTo?: string }, limit = 100, offset = 0) {
    // Find Petty Cash account
    const [pettyCashAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.storeId, storeId), eq(accounts.accountCode, '1102')));

    if (!pettyCashAccount) {
      // Create if not exists (should be there from defaults, but safety first)
      // For now, return empty
      return { entries: [], total: 0, balance: 0 };
    }

    // Get ledger for this account
    const result = await this.getAccountLedger(pettyCashAccount.id, storeId, filters, limit, offset);

    // Calculate current running balance (from account reference)
    const currentBalance = parseFloat(pettyCashAccount.currentBalance || '0');

    return {
      entries: result.transactions.map((t) => ({
        ...t.line,
        entry: t.entry,
        // Calculate running balance for this line?
        // Typically handled by frontend or calculated here by iterating backwards from current balance
      })),
      balance: currentBalance,
      account: pettyCashAccount,
    };
  }

  // Record Petty Cash Entry
  async recordPettyCashEntry(
    storeId: string,
    userId: string,
    input: {
      date: string;
      description: string;
      amount: number;
      type: 'receipt' | 'payment';
      categoryId?: string; // Account ID for the other side
      receiptUrl?: string;
    }
  ) {
    // Find Petty Cash account
    const [pettyCashAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.storeId, storeId), eq(accounts.accountCode, '1102')));

    if (!pettyCashAccount) {
      throw new Error('Petty Cash account (1102) not found');
    }

    // Determine contra account (default to Suspense or specific category)
    let contraAccountId = input.categoryId;
    if (!contraAccountId) {
      // Default to Miscellaneous Expense (5212) or Other Income (4300) depending on type
      const code = input.type === 'payment' ? '5212' : '4300';
      const [defaultAccount] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.storeId, storeId), eq(accounts.accountCode, code)));

      if (defaultAccount) contraAccountId = defaultAccount.id;
    }

    if (!contraAccountId) {
      throw new Error('Category account not found');
    }

    const lines = [];

    if (input.type === 'receipt') {
      // Money In: Dr Petty Cash, Cr Category
      lines.push({ accountId: pettyCashAccount.id, debitAmount: input.amount, creditAmount: 0, description: 'Petty Cash Receipt' });
      lines.push({ accountId: contraAccountId, debitAmount: 0, creditAmount: input.amount, description: input.description });
    } else {
      // Money Out: Dr Category, Cr Petty Cash
      lines.push({ accountId: contraAccountId, debitAmount: input.amount, creditAmount: 0, description: input.description });
      lines.push({ accountId: pettyCashAccount.id, debitAmount: 0, creditAmount: input.amount, description: 'Petty Cash Payment' });
    }

    return await this.createJournalEntry(storeId, userId, {
      entryDate: input.date,
      entryType: 'petty_cash',
      narration: `Petty Cash ${input.type === 'receipt' ? 'Receipt' : 'Payment'}: ${input.description}`,
      lines,
      referenceType: 'petty_cash',
      // Store receipt URL in reference or separate field? JournalEntry doesn't have URL field.
      // Append to narration?
    });
  }
}

export const accountingService = new AccountingService();
