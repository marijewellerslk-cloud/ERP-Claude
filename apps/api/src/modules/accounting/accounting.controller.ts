import { Response } from 'express';
import { accountingService } from './accounting.service.js';
import {
  createAccountSchema,
  updateAccountSchema,
  createBankAccountSchema,
  createJournalEntrySchema,
  createExpenseSchema,
  openCashRegisterSchema,
  closeCashRegisterSchema,
  closeCashRegisterSchema,
  dateRangeSchema,
  createPettyCashEntrySchema,
} from './accounting.validation.js';
import { logger } from '../../utils/logger.js';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    storeId: string;
    email: string;
    permissions: string[];
  };
  params: any;
  query: any;
  body: any;
}

class AccountingController {
  // Initialize chart of accounts
  async initializeAccounts(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      await accountingService.initializeChartOfAccounts(req.user.storeId);

      res.json({
        success: true,
        message: 'Chart of accounts initialized successfully',
      });
    } catch (error: any) {
      logger.error('Initialize accounts error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INIT_ACCOUNTS_FAILED',
          message: error.message || 'Failed to initialize accounts',
        },
      });
    }
  }

  // Get chart of accounts (hierarchical)
  async getChartOfAccounts(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const accounts = await accountingService.getChartOfAccounts(req.user.storeId);

      res.json({
        success: true,
        data: accounts,
      });
    } catch (error: any) {
      logger.error('Get chart of accounts error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_ACCOUNTS_FAILED',
          message: 'Failed to fetch chart of accounts',
        },
      });
    }
  }

  // Get flat list of accounts
  async getAccountsList(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { type, subType, search } = req.query;
      const accounts = await accountingService.getAccountsList(req.user.storeId, {
        type: type as string,
        subType: subType as string,
        search: search as string,
      });

      res.json({
        success: true,
        data: accounts,
      });
    } catch (error: any) {
      logger.error('Get accounts list error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_ACCOUNTS_FAILED',
          message: 'Failed to fetch accounts',
        },
      });
    }
  }

  // Create account
  async createAccount(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const validatedData = createAccountSchema.parse(req.body);
      const account = await accountingService.createAccount(req.user.storeId, validatedData);

      res.status(201).json({
        success: true,
        data: account,
        message: 'Account created successfully',
      });
    } catch (error: any) {
      logger.error('Create account error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: error.errors,
          },
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_ACCOUNT_FAILED',
          message: error.message || 'Failed to create account',
        },
      });
    }
  }

  // Get bank accounts
  async getBankAccounts(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const bankAccounts = await accountingService.getBankAccounts(req.user.storeId);

      res.json({
        success: true,
        data: bankAccounts,
      });
    } catch (error: any) {
      logger.error('Get bank accounts error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_BANK_ACCOUNTS_FAILED',
          message: 'Failed to fetch bank accounts',
        },
      });
    }
  }

  // Create bank account
  async createBankAccount(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const validatedData = createBankAccountSchema.parse(req.body);
      const bankAccount = await accountingService.createBankAccount(req.user.storeId, validatedData);

      res.status(201).json({
        success: true,
        data: bankAccount,
        message: 'Bank account created successfully',
      });
    } catch (error: any) {
      logger.error('Create bank account error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: error.errors,
          },
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_BANK_ACCOUNT_FAILED',
          message: error.message || 'Failed to create bank account',
        },
      });
    }
  }

  // Create journal entry
  async createJournalEntry(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const validatedData = createJournalEntrySchema.parse(req.body);
      const entry = await accountingService.createJournalEntry(
        req.user.storeId,
        req.user.userId,
        validatedData
      );

      res.status(201).json({
        success: true,
        data: entry,
        message: 'Journal entry created successfully',
      });
    } catch (error: any) {
      logger.error('Create journal entry error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: error.errors,
          },
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_ENTRY_FAILED',
          message: error.message || 'Failed to create journal entry',
        },
      });
    }
  }

  // List journal entries
  async listJournalEntries(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { dateFrom, dateTo, entryType, search, visibility, limit, offset } = req.query;

      const result = await accountingService.listJournalEntries(
        req.user.storeId,
        {
          dateFrom: dateFrom as string,
          dateTo: dateTo as string,
          entryType: entryType as string,
          search: search as string,
          visibility: visibility as string,
        },
        limit ? parseInt(limit as string) : 50,
        offset ? parseInt(offset as string) : 0
      );

      res.json({
        success: true,
        data: result.entries,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      });
    } catch (error: any) {
      logger.error('List journal entries error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'LIST_ENTRIES_FAILED',
          message: 'Failed to fetch journal entries',
        },
      });
    }
  }

  // Get journal entry by ID
  async getJournalEntry(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { entryId } = req.params;
      const entry = await accountingService.getJournalEntryById(entryId, req.user.storeId);

      if (!entry) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Journal entry not found' },
        });
      }

      res.json({
        success: true,
        data: entry,
      });
    } catch (error: any) {
      logger.error('Get journal entry error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_ENTRY_FAILED',
          message: 'Failed to fetch journal entry',
        },
      });
    }
  }

  // Create expense
  async createExpense(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const validatedData = createExpenseSchema.parse(req.body);
      const expense = await accountingService.createExpense(
        req.user.storeId,
        req.user.userId,
        validatedData
      );

      res.status(201).json({
        success: true,
        data: expense,
        message: 'Expense recorded successfully',
      });
    } catch (error: any) {
      logger.error('Create expense error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: error.errors,
          },
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_EXPENSE_FAILED',
          message: error.message || 'Failed to create expense',
        },
      });
    }
  }

  // List expenses
  async listExpenses(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { dateFrom, dateTo, category, search, limit, offset } = req.query;

      const result = await accountingService.listExpenses(
        req.user.storeId,
        {
          dateFrom: dateFrom as string,
          dateTo: dateTo as string,
          category: category as string,
          search: search as string,
        },
        limit ? parseInt(limit as string) : 50,
        offset ? parseInt(offset as string) : 0
      );

      res.json({
        success: true,
        data: result.expenses,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      });
    } catch (error: any) {
      logger.error('List expenses error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'LIST_EXPENSES_FAILED',
          message: 'Failed to fetch expenses',
        },
      });
    }
  }

  // Get account ledger
  async getAccountLedger(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { accountId } = req.params;
      const { dateFrom, dateTo, limit, offset } = req.query;

      const result = await accountingService.getAccountLedger(
        accountId,
        req.user.storeId,
        {
          dateFrom: dateFrom as string,
          dateTo: dateTo as string,
        },
        limit ? parseInt(limit as string) : 100,
        offset ? parseInt(offset as string) : 0
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Get account ledger error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_LEDGER_FAILED',
          message: 'Failed to fetch account ledger',
        },
      });
    }
  }

  // Get financial summary
  async getFinancialSummary(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const summary = await accountingService.getFinancialSummary(req.user.storeId);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      logger.error('Get financial summary error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_SUMMARY_FAILED',
          message: 'Failed to fetch financial summary',
        },
      });
    }
  }

  // Get income statement (P&L)
  async getIncomeStatement(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { startDate, endDate } = dateRangeSchema.parse(req.query);
      const report = await accountingService.getIncomeStatement(req.user.storeId, startDate, endDate);

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Get income statement error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Start date and end date are required',
          },
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_INCOME_STATEMENT_FAILED',
          message: 'Failed to generate income statement',
        },
      });
    }
  }

  // Get balance sheet
  async getBalanceSheet(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const asOfDate = (req.query.asOfDate as string) || new Date().toISOString().split('T')[0];
      const report = await accountingService.getBalanceSheet(req.user.storeId, asOfDate);

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Get balance sheet error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_BALANCE_SHEET_FAILED',
          message: 'Failed to generate balance sheet',
        },
      });
    }
  }

  // Get trial balance
  async getTrialBalance(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const asOfDate = req.query.asOfDate as string;
      const report = await accountingService.getTrialBalance(req.user.storeId, asOfDate);

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Get trial balance error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_TRIAL_BALANCE_FAILED',
          message: 'Failed to generate trial balance',
        },
      });
    }
  }

  // Get cash flow statement
  async getCashFlowStatement(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { startDate, endDate } = dateRangeSchema.parse(req.query);
      const report = await accountingService.getCashFlowStatement(req.user.storeId, startDate, endDate);

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Get cash flow statement error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Start date and end date are required',
          },
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_CASH_FLOW_FAILED',
          message: 'Failed to generate cash flow statement',
        },
      });
    }
  }

  // Open cash register
  async openCashRegister(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { openingBalance } = openCashRegisterSchema.parse(req.body);
      const register = await accountingService.openCashRegister(
        req.user.storeId,
        req.user.userId,
        openingBalance
      );

      res.status(201).json({
        success: true,
        data: register,
        message: 'Cash register opened',
      });
    } catch (error: any) {
      logger.error('Open cash register error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Opening balance is required',
          },
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'OPEN_REGISTER_FAILED',
          message: error.message || 'Failed to open cash register',
        },
      });
    }
  }

  // Close cash register
  async closeCashRegister(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { closingBalance, varianceExplanation } = closeCashRegisterSchema.parse(req.body);
      const register = await accountingService.closeCashRegister(
        req.user.storeId,
        req.user.userId,
        closingBalance,
        varianceExplanation
      );

      res.json({
        success: true,
        data: register,
        message: 'Cash register closed',
      });
    } catch (error: any) {
      logger.error('Close cash register error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Closing balance is required',
          },
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'CLOSE_REGISTER_FAILED',
          message: error.message || 'Failed to close cash register',
        },
      });
    }
  }

  // Get cash register status
  async getCashRegister(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const date = req.query.date as string;
      const register = await accountingService.getCashRegister(req.user.storeId, date);

      res.json({
        success: true,
        data: register,
      });
    } catch (error: any) {
      logger.error('Get cash register error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_REGISTER_FAILED',
          message: 'Failed to fetch cash register',
        },
      });
    }
  }

  // Get Petty Cash Book
  async getPettyCashBook(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { dateFrom, dateTo, limit, offset } = req.query;
      const result = await accountingService.getPettyCashBook(
        req.user.storeId,
        {
          dateFrom: dateFrom as string,
          dateTo: dateTo as string,
        },
        limit ? parseInt(limit as string) : 100,
        offset ? parseInt(offset as string) : 0
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Get petty cash book error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_PETTY_CASH_FAILED',
          message: 'Failed to fetch petty cash book',
        },
      });
    }
  }

  // Record Petty Cash Entry
  async recordPettyCashEntry(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const validatedData = createPettyCashEntrySchema.parse(req.body);
      const entry = await accountingService.recordPettyCashEntry(
        req.user.storeId,
        req.user.userId,
        validatedData
      );

      res.status(201).json({
        success: true,
        data: entry,
        message: 'Petty cash entry recorded successfully',
      });
    } catch (error: any) {
      logger.error('Record petty cash entry error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: error.errors,
          },
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'RECORD_PETTY_CASH_FAILED',
          message: error.message || 'Failed to record petty cash entry',
        },
      });
    }
  }
}

export const accountingController = new AccountingController();
