'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Plus,
  RefreshCcw,
  Search,
  X,
  AlertCircle,
  Receipt,
  Calendar,
  Filter,
  Download,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface Expense {
  id: string;
  expenseNumber: string;
  expenseDate: string;
  amount: string;
  gstAmount: string;
  totalAmount: string;
  description: string;
  category?: string;
  paymentMethod: string;
  vendorName?: string;
  receiptNumber?: string;
  isReimbursable: boolean;
  isReimbursed: boolean;
  createdAt: string;
  expenseAccount?: {
    accountCode: string;
    accountName: string;
  };
  paidFromAccount?: {
    accountCode: string;
    accountName: string;
  };
}

interface ExpenseAccount {
  id: string;
  accountCode: string;
  accountName: string;
}

interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
}

const paymentMethodLabels: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  upi: 'UPI',
  card: 'Card',
  cheque: 'Cheque',
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<ExpenseAccount[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const [formData, setFormData] = useState({
    expenseAccountId: '',
    paidFromAccountId: '',
    paymentMethod: 'cash',
    amount: '',
    gstAmount: '',
    description: '',
    category: '',
    vendorName: '',
    receiptNumber: '',
    expenseDate: new Date().toISOString().split('T')[0],
    isReimbursable: false,
  });

  useEffect(() => {
    fetchData();
  }, [dateRange, categoryFilter, paymentFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [expensesRes, accountsRes, bankRes] = await Promise.all([
        apiClient.get('/accounting/expenses', {
          params: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            category: categoryFilter || undefined,
            paymentMethod: paymentFilter || undefined,
            limit: 100,
          },
        }),
        apiClient.get('/accounting/accounts', { params: { accountType: 'expense', isActive: true } }),
        apiClient.get('/accounting/bank-accounts'),
      ]);

      if (expensesRes.data.success) setExpenses(expensesRes.data.data);
      if (accountsRes.data.success) setExpenseAccounts(accountsRes.data.data);
      if (bankRes.data.success) setBankAccounts(bankRes.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.expenseAccountId || !formData.amount || !formData.description) {
      setError('Please fill required fields');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.post('/accounting/expenses', {
        expenseAccountId: formData.expenseAccountId,
        paidFromAccountId: formData.paidFromAccountId || undefined,
        paymentMethod: formData.paymentMethod,
        amount: parseFloat(formData.amount),
        gstAmount: formData.gstAmount ? parseFloat(formData.gstAmount) : undefined,
        description: formData.description,
        category: formData.category || undefined,
        vendorName: formData.vendorName || undefined,
        receiptNumber: formData.receiptNumber || undefined,
        expenseDate: formData.expenseDate,
        isReimbursable: formData.isReimbursable,
      });

      if (res.data.success) {
        setShowCreateModal(false);
        setFormData({
          expenseAccountId: '',
          paidFromAccountId: '',
          paymentMethod: 'cash',
          amount: '',
          gstAmount: '',
          description: '',
          category: '',
          vendorName: '',
          receiptNumber: '',
          expenseDate: new Date().toISOString().split('T')[0],
          isReimbursable: false,
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

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `Rs ${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Calculate totals
  const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.totalAmount || '0'), 0);
  const cashExpenses = expenses
    .filter((exp) => exp.paymentMethod === 'cash')
    .reduce((sum, exp) => sum + parseFloat(exp.totalAmount || '0'), 0);
  const bankExpenses = expenses
    .filter((exp) => exp.paymentMethod !== 'cash')
    .reduce((sum, exp) => sum + parseFloat(exp.totalAmount || '0'), 0);

  // Get unique categories
  const categories = [...new Set(expenses.map((e) => e.category).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/accounting">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-gray-500">Track and manage all expenses</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Record Expense
        </Button>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-500">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
          <p className="text-xs text-gray-400">{expenses.length} transactions</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Cash Expenses</p>
          <p className="text-2xl font-bold">{formatCurrency(cashExpenses)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Bank/Digital Expenses</p>
          <p className="text-2xl font-bold">{formatCurrency(bankExpenses)}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <input
              type="date"
              className="px-3 py-1.5 border rounded-md text-sm"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              className="px-3 py-1.5 border rounded-md text-sm"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search expenses..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <select
            className="px-3 py-2 border rounded-md"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            className="px-3 py-2 border rounded-md"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="">All Payments</option>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="cheque">Cheque</option>
          </select>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Expenses List */}
      <Card>
        <div className="p-4 border-b bg-gray-50">
          <div className="grid grid-cols-8 gap-4 text-sm font-medium text-gray-600">
            <div>Expense #</div>
            <div>Date</div>
            <div className="col-span-2">Description</div>
            <div>Category</div>
            <div>Payment</div>
            <div className="text-right">Amount</div>
            <div className="text-center">Actions</div>
          </div>
        </div>
        <div className="divide-y max-h-[500px] overflow-y-auto">
          {expenses.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Receipt className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p>No expenses recorded yet</p>
            </div>
          ) : (
            expenses
              .filter(
                (expense) =>
                  !searchQuery ||
                  expense.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  expense.expenseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  expense.vendorName?.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((expense) => (
                <div key={expense.id} className="p-4 hover:bg-gray-50">
                  <div className="grid grid-cols-8 gap-4 items-center">
                    <div className="font-mono text-sm">{expense.expenseNumber}</div>
                    <div className="text-sm text-gray-600">{formatDate(expense.expenseDate)}</div>
                    <div className="col-span-2">
                      <p className="font-medium truncate">{expense.description}</p>
                      {expense.vendorName && (
                        <p className="text-xs text-gray-500">Paid to: {expense.vendorName}</p>
                      )}
                    </div>
                    <div>
                      <Badge variant="outline" className="text-xs">
                        {expense.category || expense.expenseAccount?.accountName || '-'}
                      </Badge>
                    </div>
                    <div>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {paymentMethodLabels[expense.paymentMethod] || expense.paymentMethod}
                      </Badge>
                    </div>
                    <div className="text-right font-mono font-medium text-red-600">
                      {formatCurrency(expense.totalAmount)}
                    </div>
                    <div className="flex justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedExpense(expense);
                          setShowDetailModal(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </Card>

      {/* Create Expense Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Record Expense</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowCreateModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={formData.expenseDate}
                    onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Expense Account *</Label>
                  <select
                    className="w-full px-3 py-2 border rounded-md mt-1"
                    value={formData.expenseAccountId}
                    onChange={(e) => setFormData({ ...formData, expenseAccountId: e.target.value })}
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
              </div>

              <div>
                <Label>Description *</Label>
                <Input
                  className="mt-1"
                  placeholder="What was this expense for?"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="mt-1"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>GST Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="mt-1"
                    placeholder="0.00"
                    value={formData.gstAmount}
                    onChange={(e) => setFormData({ ...formData, gstAmount: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <select
                    className="w-full px-3 py-2 border rounded-md mt-1"
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

              {formData.paymentMethod !== 'cash' && bankAccounts.length > 0 && (
                <div>
                  <Label>Paid From Account</Label>
                  <select
                    className="w-full px-3 py-2 border rounded-md mt-1"
                    value={formData.paidFromAccountId}
                    onChange={(e) => setFormData({ ...formData, paidFromAccountId: e.target.value })}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Input
                    className="mt-1"
                    placeholder="e.g., Utilities, Rent"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Vendor Name</Label>
                  <Input
                    className="mt-1"
                    placeholder="Paid to..."
                    value={formData.vendorName}
                    onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Receipt Number</Label>
                  <Input
                    className="mt-1"
                    placeholder="Bill/Receipt #"
                    value={formData.receiptNumber}
                    onChange={(e) => setFormData({ ...formData, receiptNumber: e.target.value })}
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isReimbursable}
                      onChange={(e) => setFormData({ ...formData, isReimbursable: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm">Reimbursable expense</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
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

      {/* Expense Detail Modal */}
      {showDetailModal && selectedExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{selectedExpense.expenseNumber}</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowDetailModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(selectedExpense.totalAmount)}
                </p>
                {parseFloat(selectedExpense.gstAmount || '0') > 0 && (
                  <p className="text-xs text-gray-500">
                    Base: {formatCurrency(selectedExpense.amount)} + GST:{' '}
                    {formatCurrency(selectedExpense.gstAmount)}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span>{formatDate(selectedExpense.expenseDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Description</span>
                  <span className="text-right max-w-[200px]">{selectedExpense.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Category</span>
                  <span>{selectedExpense.category || selectedExpense.expenseAccount?.accountName || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Method</span>
                  <Badge variant="outline" className="capitalize">
                    {paymentMethodLabels[selectedExpense.paymentMethod]}
                  </Badge>
                </div>
                {selectedExpense.vendorName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Vendor</span>
                    <span>{selectedExpense.vendorName}</span>
                  </div>
                )}
                {selectedExpense.receiptNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Receipt #</span>
                    <span>{selectedExpense.receiptNumber}</span>
                  </div>
                )}
                {selectedExpense.expenseAccount && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Account</span>
                    <span>
                      {selectedExpense.expenseAccount.accountCode} -{' '}
                      {selectedExpense.expenseAccount.accountName}
                    </span>
                  </div>
                )}
                {selectedExpense.isReimbursable && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Reimbursement</span>
                    <Badge className={selectedExpense.isReimbursed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                      {selectedExpense.isReimbursed ? 'Reimbursed' : 'Pending'}
                    </Badge>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4">
                <Button variant="outline" onClick={() => setShowDetailModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
