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
  ChevronRight,
  ChevronDown,
  Edit2,
  Folder,
  FolderOpen,
  File,
  Search,
  X,
  AlertCircle,
  Wallet,
  CreditCard,
  TrendingUp,
  Receipt,
  DollarSign,
} from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface Account {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  accountSubType?: string;
  parentAccountId?: string;
  level: number;
  normalBalance: string;
  openingBalance: string;
  currentBalance: string;
  isSystemAccount: boolean;
  isActive: boolean;
  description?: string;
  children?: Account[];
}

const accountTypeColors: Record<string, string> = {
  asset: 'bg-blue-100 text-blue-800',
  liability: 'bg-red-100 text-red-800',
  equity: 'bg-purple-100 text-purple-800',
  income: 'bg-green-100 text-green-800',
  expense: 'bg-orange-100 text-orange-800',
};

const accountTypeIcons: Record<string, any> = {
  asset: Wallet,
  liability: CreditCard,
  equity: TrendingUp,
  income: DollarSign,
  expense: Receipt,
};

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [selectedType, setSelectedType] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    accountCode: '',
    accountName: '',
    accountType: 'expense',
    accountSubType: '',
    parentAccountId: '',
    normalBalance: 'debit',
    openingBalance: '',
    description: '',
  });

  useEffect(() => {
    fetchAccounts();
  }, [selectedType]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/accounting/chart-of-accounts', {
        params: { accountType: selectedType || undefined },
      });
      if (res.data.success) {
        setAccounts(res.data.data);
        // Auto-expand first level
        const firstLevel = res.data.data.map((a: Account) => a.id);
        setExpandedAccounts(new Set(firstLevel));
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load chart of accounts');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (accountId: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedAccounts(newExpanded);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accountCode || !formData.accountName) {
      setError('Account code and name are required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.post('/accounting/accounts', {
        accountCode: formData.accountCode,
        accountName: formData.accountName,
        accountType: formData.accountType,
        accountSubType: formData.accountSubType || undefined,
        parentAccountId: formData.parentAccountId || undefined,
        normalBalance: formData.normalBalance,
        openingBalance: formData.openingBalance ? parseFloat(formData.openingBalance) : 0,
        description: formData.description || undefined,
      });

      if (res.data.success) {
        setShowAddModal(false);
        setFormData({
          accountCode: '',
          accountName: '',
          accountType: 'expense',
          accountSubType: '',
          parentAccountId: '',
          normalBalance: 'debit',
          openingBalance: '',
          description: '',
        });
        fetchAccounts();
      } else {
        setError(res.data.error?.message || 'Failed to create account');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `Rs ${Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const renderAccountTree = (account: Account, depth: number = 0) => {
    const hasChildren = account.children && account.children.length > 0;
    const isExpanded = expandedAccounts.has(account.id);
    const Icon = accountTypeIcons[account.accountType] || File;

    // Filter by search
    if (searchQuery) {
      const matchesSearch =
        account.accountCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.accountName.toLowerCase().includes(searchQuery.toLowerCase());
      const childrenMatch =
        account.children?.some(
          (child) =>
            child.accountCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
            child.accountName.toLowerCase().includes(searchQuery.toLowerCase())
        ) || false;
      if (!matchesSearch && !childrenMatch) return null;
    }

    return (
      <div key={account.id}>
        <div
          className={`flex items-center gap-2 p-3 hover:bg-gray-50 border-b cursor-pointer ${
            !account.isActive ? 'opacity-50' : ''
          }`}
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
          onClick={() => hasChildren && toggleExpand(account.id)}
        >
          <div className="w-6 flex justify-center">
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )
            ) : (
              <div className="w-4" />
            )}
          </div>

          <div className="w-6">
            {hasChildren ? (
              isExpanded ? (
                <FolderOpen className="h-4 w-4 text-yellow-500" />
              ) : (
                <Folder className="h-4 w-4 text-yellow-500" />
              )
            ) : (
              <Icon className="h-4 w-4 text-gray-400" />
            )}
          </div>

          <div className="flex-1 flex items-center gap-3">
            <span className="font-mono text-sm text-gray-600 w-20">{account.accountCode}</span>
            <span className="font-medium">{account.accountName}</span>
            <Badge className={accountTypeColors[account.accountType]} variant="secondary">
              {account.accountType}
            </Badge>
            {account.isSystemAccount && (
              <Badge variant="outline" className="text-xs">
                System
              </Badge>
            )}
          </div>

          <div className="text-right min-w-[120px]">
            <span
              className={`font-mono ${
                parseFloat(account.currentBalance) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatCurrency(account.currentBalance)}
            </span>
          </div>

          <div className="w-10 text-center">
            <span className="text-xs text-gray-500 uppercase">{account.normalBalance[0]}</span>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>{account.children!.map((child) => renderAccountTree(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  const flattenAccounts = (accounts: Account[]): Account[] => {
    const result: Account[] = [];
    const flatten = (accs: Account[]) => {
      accs.forEach((acc) => {
        result.push(acc);
        if (acc.children) flatten(acc.children);
      });
    };
    flatten(accounts);
    return result;
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
      <div className="flex items-center gap-4">
        <Link href="/accounting">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Chart of Accounts</h1>
          <p className="text-gray-500">Manage your account structure</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Account
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

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by code or name..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <select
            className="px-3 py-2 border rounded-md"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="asset">Assets</option>
            <option value="liability">Liabilities</option>
            <option value="equity">Equity</option>
            <option value="income">Income</option>
            <option value="expense">Expenses</option>
          </select>
          <Button variant="outline" onClick={fetchAccounts}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Account Type Summary */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { type: 'asset', label: 'Assets', icon: Wallet },
          { type: 'liability', label: 'Liabilities', icon: CreditCard },
          { type: 'equity', label: 'Equity', icon: TrendingUp },
          { type: 'income', label: 'Income', icon: DollarSign },
          { type: 'expense', label: 'Expenses', icon: Receipt },
        ].map(({ type, label, icon: TypeIcon }) => {
          const typeAccounts = flattenAccounts(accounts).filter((a) => a.accountType === type);
          const total = typeAccounts.reduce((sum, a) => sum + parseFloat(a.currentBalance || '0'), 0);
          return (
            <Card
              key={type}
              className={`p-4 cursor-pointer transition hover:shadow-md ${
                selectedType === type ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedType(selectedType === type ? '' : type)}
            >
              <div className="flex items-center gap-2 mb-2">
                <TypeIcon className="h-5 w-5 text-gray-500" />
                <span className="font-medium">{label}</span>
              </div>
              <p className="text-lg font-semibold">{formatCurrency(total)}</p>
              <p className="text-xs text-gray-500">{typeAccounts.length} accounts</p>
            </Card>
          );
        })}
      </div>

      {/* Accounts Tree */}
      <Card>
        <div className="p-4 border-b bg-gray-50 flex items-center gap-4 text-sm font-medium text-gray-600">
          <div className="w-6" />
          <div className="w-6" />
          <div className="flex-1 flex items-center gap-3">
            <span className="w-20">Code</span>
            <span>Account Name</span>
          </div>
          <div className="text-right min-w-[120px]">Balance</div>
          <div className="w-10 text-center">Type</div>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          {accounts.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No accounts found. Click "Add Account" to create one.
            </div>
          ) : (
            accounts.map((account) => renderAccountTree(account))
          )}
        </div>
      </Card>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Add New Account</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowAddModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Account Code *</Label>
                  <Input
                    className="mt-1"
                    placeholder="e.g., 5001"
                    value={formData.accountCode}
                    onChange={(e) => setFormData({ ...formData, accountCode: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Account Type *</Label>
                  <select
                    className="w-full px-3 py-2 border rounded-md mt-1"
                    value={formData.accountType}
                    onChange={(e) => {
                      const type = e.target.value;
                      setFormData({
                        ...formData,
                        accountType: type,
                        normalBalance: ['asset', 'expense'].includes(type) ? 'debit' : 'credit',
                      });
                    }}
                  >
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="equity">Equity</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
              </div>

              <div>
                <Label>Account Name *</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g., Office Supplies Expense"
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Sub Type</Label>
                  <Input
                    className="mt-1"
                    placeholder="e.g., operating_expense"
                    value={formData.accountSubType}
                    onChange={(e) => setFormData({ ...formData, accountSubType: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Normal Balance</Label>
                  <select
                    className="w-full px-3 py-2 border rounded-md mt-1"
                    value={formData.normalBalance}
                    onChange={(e) => setFormData({ ...formData, normalBalance: e.target.value })}
                  >
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Parent Account</Label>
                  <select
                    className="w-full px-3 py-2 border rounded-md mt-1"
                    value={formData.parentAccountId}
                    onChange={(e) => setFormData({ ...formData, parentAccountId: e.target.value })}
                  >
                    <option value="">None (Top Level)</option>
                    {flattenAccounts(accounts)
                      .filter((a) => a.accountType === formData.accountType)
                      .map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.accountCode} - {acc.accountName}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <Label>Opening Balance</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="mt-1"
                    placeholder="0.00"
                    value={formData.openingBalance}
                    onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md mt-1"
                  placeholder="Optional description..."
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Account'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
