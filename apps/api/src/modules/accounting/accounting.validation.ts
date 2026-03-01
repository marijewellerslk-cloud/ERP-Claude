import { z } from 'zod';

export const createAccountSchema = z.object({
  accountCode: z.string().min(1).max(50),
  accountName: z.string().min(1).max(255),
  accountType: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
  accountSubType: z.string().max(50).optional(),
  parentAccountId: z.string().uuid().optional(),
  normalBalance: z.enum(['debit', 'credit']),
  openingBalance: z.number().optional(),
  openingBalanceDate: z.string().optional(),
  gstApplicable: z.boolean().optional(),
  gstRate: z.number().min(0).max(100).optional(),
  hsnSacCode: z.string().max(20).optional(),
  description: z.string().optional(),
});

export const updateAccountSchema = z.object({
  accountName: z.string().min(1).max(255).optional(),
  accountSubType: z.string().max(50).optional(),
  gstApplicable: z.boolean().optional(),
  gstRate: z.number().min(0).max(100).optional(),
  hsnSacCode: z.string().max(20).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const createBankAccountSchema = z.object({
  accountId: z.string().uuid(),
  bankName: z.string().max(255).optional(),
  branchName: z.string().max(255).optional(),
  accountNumber: z.string().max(50).optional(),
  ifscCode: z.string().max(20).optional(),
  accountHolderName: z.string().max(255).optional(),
  bankAccountType: z.enum(['cash', 'savings', 'current', 'credit_card', 'upi']),
  openingBalance: z.number().optional(),
  creditLimit: z.number().optional(),
  notes: z.string().optional(),
});

export const journalEntryLineSchema = z.object({
  accountId: z.string().uuid(),
  debitAmount: z.number().nonnegative().optional(),
  creditAmount: z.number().nonnegative().optional(),
  description: z.string().optional(),
  partyType: z.enum(['customer', 'supplier']).optional(),
  partyId: z.string().uuid().optional(),
});

export const createJournalEntrySchema = z.object({
  entryDate: z.string(),
  entryType: z.enum(['sales', 'purchase', 'payment', 'receipt', 'expense', 'transfer', 'adjustment', 'opening']),
  narration: z.string().min(1),
  lines: z.array(journalEntryLineSchema).min(2),
  referenceType: z.string().max(50).optional(),
  referenceId: z.string().uuid().optional(),
  referenceNumber: z.string().max(100).optional(),
}).refine(
  (data) => {
    const totalDebit = data.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
    const totalCredit = data.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);
    return Math.abs(totalDebit - totalCredit) < 0.01;
  },
  { message: 'Journal entry must be balanced (debits must equal credits)' }
);

export const createExpenseSchema = z.object({
  expenseDate: z.string(),
  expenseAccountId: z.string().uuid(),
  paidFromAccountId: z.string().uuid().optional(),
  paymentMethod: z.enum(['cash', 'bank', 'upi', 'card', 'cheque']),
  amount: z.number().positive(),
  gstAmount: z.number().nonnegative().optional(),
  vendorName: z.string().max(255).optional(),
  vendorGstin: z.string().max(20).optional(),
  invoiceNumber: z.string().max(100).optional(),
  invoiceDate: z.string().optional(),
  description: z.string().min(1),
  category: z.string().max(100).optional(),
  receiptUrls: z.array(z.string().url()).optional(),
  notes: z.string().optional(),
});

export const openCashRegisterSchema = z.object({
  openingBalance: z.number().nonnegative(),
});

export const closeCashRegisterSchema = z.object({
  closingBalance: z.number().nonnegative(),
  varianceExplanation: z.string().optional(),
});

export const dateRangeSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
});

export const accountLedgerQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export const createPettyCashEntrySchema = z.object({
  date: z.string(),
  description: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(['receipt', 'payment']),
  categoryId: z.string().uuid().optional(),
  receiptUrl: z.string().url().optional(),
});

