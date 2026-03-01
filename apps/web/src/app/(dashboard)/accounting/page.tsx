'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Calculator,
  FileText,
  TrendingUp,
  DollarSign,
  PieChart,
  Receipt,
  Plus,
  RefreshCcw,
  ArrowUpRight,
  ArrowDownRight,
  X,
  CreditCard,
  Wallet,
  Building2,
  AlertCircle,
  CheckCircle,
  Calendar,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface FinancialSummary {
  cashInHand: number;
  bankBalance: number;
  receivables: number;
  payables: number;
  todayIncome: number;
  todayExpenses: number;
  monthIncome: number;
  monthExpenses: number;
}

interface Expense {
  id: string;
  expenseNumber: string;
  expenseDate: string;
  amount: string;
  totalAmount: string;
  description: string;
  category?: string;
  paymentMethod: string;
  vendorName?: string;
  createdAt: string;
  expenseAccount?: {
    accountName: string;
    accountCode: string;
  };
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  entryType: string;
  totalDebit: string;
  totalCredit: string;
  narration?: string;
  status: string;
}

export default function AccountingPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expenseForm, setExpenseForm] = useState({
    expenseAccountId: '',
    paidFromAccountId: '',
    paymentMethod: 'cash',
    amount: '',
    description: '',
    category: '',
    vendorName: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Try to fetch summary - if fails, initialize chart of accounts
      const summaryRes = await apiClient.get('/accounting/summary');

      if (summaryRes.data.success) {
        setSummary(summaryRes.data.data);
        setInitialized(true);

        // Fetch additional data
        const [expensesRes, entriesRes, accountsRes, bankRes] = await Promise.all([
          apiClient.get('/accounting/expenses', { params: { limit: 5 } }),
          apiClient.get('/accounting/journal-entries', { params: { limit: 5 } }),
          apiClient.get('/accounting/accounts', { params: { accountType: 'expense', isActive: true } }),
          apiClient.get('/accounting/bank-accounts'),
        ]);

        if (expensesRes.data.success) setRecentExpenses(expensesRes.data.data);
        if (entriesRes.data.success) setRecentEntries(entriesRes.data.data);
        if (accountsRes.data.success) setExpenseAccounts(accountsRes.data.data);
        if (bankRes.data.success) setBankAccounts(bankRes.data.data);
      }
    } catch (err: any) {
      // If 404 or no accounts, try to initialize
      if (err.response?.status === 404 || err.response?.data?.error?.code === 'NO_ACCOUNTS') {
        await initializeAccounts();
      } else {
        setError(err.response?.data?.error?.message || 'Failed to load accounting data');
      }
    } finally {
      setLoading(false);
    }
  };

  const initializeAccounts = async () => {
    try {
      const res = await apiClient.post('/accounting/initialize');
      if (res.data.success) {
        setInitialized(true);
        await fetchData();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to initialize chart of accounts');
    }
  };

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.expenseAccountId || !expenseForm.amount || !expenseForm.description) {
      setError('Please fill required fields');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.post('/accounting/expenses', {
        expenseAccountId: expenseForm.expenseAccountId,
        paidFromAccountId: expenseForm.paidFromAccountId || undefined,
        paymentMethod: expenseForm.paymentMethod,
        amount: parseFloat(expenseForm.amount),
        description: expenseForm.description,
        category: expenseForm.category || undefined,
        vendorName: expenseForm.vendorName || undefined,
        expenseDate: new Date().toISOString(),
      });

      if (res.data.success) {
        setShowExpenseModal(false);
        setExpenseForm({
          expenseAccountId: '',
          paidFromAccountId: '',
          paymentMethod: 'cash',
          amount: '',
          description: '',
          category: '',
          vendorName: '',
        });
        fetchData();
      } else {
        setError(res.data.error?.message || 'Failed to record expense');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to record expense');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number | string | undefined) => {
    if (!amount) return 'Rs 0';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `Rs ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Accounting & Finance</h1>
          <p className="text-gray-500 mt-1">Manage accounts, ledgers, and financial reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowExpenseModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Record Expense
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Cash in Hand</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(summary?.cashInHand)}</p>
            </div>
            <Wallet className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Bank Balance</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(summary?.bankBalance)}</p>
            </div>
            <Building2 className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Receivables</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(summary?.receivables)}</p>
            </div>
            <ArrowDownRight className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Payables</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(summary?.payables)}</p>
            </div>
            <ArrowUpRight className="h-8 w-8 text-red-600" />
          </div>
        </Card>
      </div>

      {/* Today/Month Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4">Today's Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Income</span>
              <span className="font-semibold text-green-600">{formatCurrency(summary?.todayIncome)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Expenses</span>
              <span className="font-semibold text-red-600">{formatCurrency(summary?.todayExpenses)}</span>
            </div>
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="font-medium">Net</span>
              <span className={`font-bold ${(summary?.todayIncome || 0) - (summary?.todayExpenses || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency((summary?.todayIncome || 0) - (summary?.todayExpenses || 0))}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4">This Month</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Income</span>
              <span className="font-semibold text-green-600">{formatCurrency(summary?.monthIncome)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Expenses</span>
              <span className="font-semibold text-red-600">{formatCurrency(summary?.monthExpenses)}</span>
            </div>
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="font-medium">Net</span>
              <span className={`font-bold ${(summary?.monthIncome || 0) - (summary?.monthExpenses || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency((summary?.monthIncome || 0) - (summary?.monthExpenses || 0))}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Link href="/accounting/chart-of-accounts">
          <Card className="p-6 hover:bg-gray-50 cursor-pointer transition h-full">
            <Calculator className="h-8 w-8 text-blue-600 mb-3" />
            <h3 className="font-semibold text-lg">Chart of Accounts</h3>
            <p className="text-sm text-gray-500 mt-1">Manage account heads</p>
          </Card>
        </Link>

        <Link href="/accounting/journal-entries">
          <Card className="p-6 hover:bg-gray-50 cursor-pointer transition h-full">
            <FileText className="h-8 w-8 text-green-600 mb-3" />
            <h3 className="font-semibold text-lg">Journal Entries</h3>
            <p className="text-sm text-gray-500 mt-1">Record transactions</p>
          </Card>
        </Link>

        <Link href="/accounting/expenses">
          <Card className="p-6 hover:bg-gray-50 cursor-pointer transition h-full">
            <Receipt className="h-8 w-8 text-orange-600 mb-3" />
            <h3 className="font-semibold text-lg">Expenses</h3>
            <p className="text-sm text-gray-500 mt-1">Track all expenses</p>
          </Card>
        </Link>

        <Link href="/accounting/reports">
          <Card className="p-6 hover:bg-gray-50 cursor-pointer transition h-full">
            <PieChart className="h-8 w-8 text-purple-600 mb-3" />
            <h3 className="font-semibold text-lg">Financial Reports</h3>
            <p className="text-sm text-gray-500 mt-1">P&L, Balance Sheet</p>
          </Card>
        </Link>

        <Link href="/accounting/petty-cash">
          <Card className="p-6 hover:bg-gray-50 cursor-pointer transition h-full">
            <DollarSign className="h-8 w-8 text-teal-600 mb-3" />
            <h3 className="font-semibold text-lg">Petty Cash Book</h3>
            <p className="text-sm text-gray-500 mt-1">Daily cash mgmt</p>
          </Card>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Expenses */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-lg">Recent Expenses</h3>
            <Link href="/accounting/expenses">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>
          {recentExpenses.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No expenses recorded yet</p>
          ) : (
            <div className="space-y-3">
              {recentExpenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{expense.description}</p>
                    <p className="text-xs text-gray-500">
                      {expense.expenseAccount?.accountName || expense.category} • {formatDate(expense.expenseDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-600">{formatCurrency(expense.totalAmount)}</p>
                    <Badge variant="outline" className="text-xs capitalize">{expense.paymentMethod}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Journal Entries */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-lg">Recent Journal Entries</h3>
            <Link href="/accounting/journal-entries">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>
          {recentEntries.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No journal entries yet</p>
          ) : (
            <div className="space-y-3">
              {recentEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium font-mono">{entry.entryNumber}</p>
                    <p className="text-xs text-gray-500">
                      {entry.entryType.replace('_', ' ')} • {formatDate(entry.entryDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(entry.totalDebit)}</p>
                    <Badge
                      variant="outline"
                      className={`text-xs ${entry.status === 'posted' ? 'text-green-600' : 'text-yellow-600'}`}
                    >
                      {entry.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Record Expense</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowExpenseModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleRecordExpense} className="space-y-4">
              <div>
                <Label>Expense Account *</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md mt-1"
                  value={expenseForm.expenseAccountId}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expenseAccountId: e.target.value })}
                  required
                >
                  <option value="">Select Account</option>
                  {expenseAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountCode} - {acc.accountName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="mt-1"
                    placeholder="0.00"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <select
                    className="w-full px-3 py-2 border rounded-md mt-1"
                    value={expenseForm.paymentMethod}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

              {expenseForm.paymentMethod !== 'cash' && bankAccounts.length > 0 && (
                <div>
                  <Label>Paid From Account</Label>
                  <select
                    className="w-full px-3 py-2 border rounded-md mt-1"
                    value={expenseForm.paidFromAccountId}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paidFromAccountId: e.target.value })}
                  >
                    <option value="">Select Bank Account</option>
                    {bankAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.bankName} - {acc.accountNumber}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <Label>Description *</Label>
                <Input
                  className="mt-1"
                  placeholder="What was this expense for?"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Input
                    className="mt-1"
                    placeholder="e.g., Utilities, Rent"
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Vendor Name</Label>
                  <Input
                    className="mt-1"
                    placeholder="Paid to..."
                    value={expenseForm.vendorName}
                    onChange={(e) => setExpenseForm({ ...expenseForm, vendorName: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowExpenseModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Recording...' : 'Record Expense'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
