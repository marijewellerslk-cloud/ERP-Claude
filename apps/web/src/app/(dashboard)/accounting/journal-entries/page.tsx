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
  FileText,
  Eye,
  Trash2,
  Calendar,
  CheckCircle,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  entryType: string;
  referenceType?: string;
  referenceNumber?: string;
  totalDebit: string;
  totalCredit: string;
  narration?: string;
  status: string;
  createdAt: string;
  lines?: JournalEntryLine[];
}

interface JournalEntryLine {
  id: string;
  accountId: string;
  debitAmount: string;
  creditAmount: string;
  description?: string;
  account?: {
    accountCode: string;
    accountName: string;
  };
}

interface Account {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  posted: 'bg-green-100 text-green-800',
  reversed: 'bg-red-100 text-red-800',
};

const entryTypeLabels: Record<string, string> = {
  manual: 'Manual Entry',
  sales: 'Sales',
  purchase: 'Purchase',
  receipt: 'Receipt',
  payment: 'Payment',
  expense: 'Expense',
  adjustment: 'Adjustment',
  opening: 'Opening Balance',
};

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    entryType: 'manual',
    narration: '',
    lines: [
      { accountId: '', debitAmount: '', creditAmount: '', description: '' },
      { accountId: '', debitAmount: '', creditAmount: '', description: '' },
    ],
  });

  useEffect(() => {
    fetchData();
  }, [typeFilter, statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [entriesRes, accountsRes] = await Promise.all([
        apiClient.get('/accounting/journal-entries', {
          params: {
            entryType: typeFilter || undefined,
            status: statusFilter || undefined,
            limit: 50,
          },
        }),
        apiClient.get('/accounting/accounts', { params: { isActive: true } }),
      ]);

      if (entriesRes.data.success) setEntries(entriesRes.data.data);
      if (accountsRes.data.success) setAccounts(accountsRes.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load journal entries');
    } finally {
      setLoading(false);
    }
  };

  const viewEntry = async (entry: JournalEntry) => {
    try {
      const res = await apiClient.get(`/accounting/journal-entries/${entry.id}`);
      if (res.data.success) {
        setSelectedEntry(res.data.data);
        setShowDetailModal(true);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load entry details');
    }
  };

  const handleAddLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { accountId: '', debitAmount: '', creditAmount: '', description: '' }],
    });
  };

  const handleRemoveLine = (index: number) => {
    if (formData.lines.length <= 2) return;
    const newLines = formData.lines.filter((_, i) => i !== index);
    setFormData({ ...formData, lines: newLines });
  };

  const handleLineChange = (index: number, field: string, value: string) => {
    const newLines = [...formData.lines];
    (newLines[index] as any)[field] = value;

    // If debit entered, clear credit (and vice versa)
    if (field === 'debitAmount' && value) {
      newLines[index].creditAmount = '';
    } else if (field === 'creditAmount' && value) {
      newLines[index].debitAmount = '';
    }

    setFormData({ ...formData, lines: newLines });
  };

  const calculateTotals = () => {
    const totalDebit = formData.lines.reduce((sum, line) => sum + (parseFloat(line.debitAmount) || 0), 0);
    const totalCredit = formData.lines.reduce((sum, line) => sum + (parseFloat(line.creditAmount) || 0), 0);
    return { totalDebit, totalCredit, difference: totalDebit - totalCredit };
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const { totalDebit, totalCredit, difference } = calculateTotals();

    if (difference !== 0) {
      setError(`Debits (${formatCurrency(totalDebit)}) must equal Credits (${formatCurrency(totalCredit)})`);
      return;
    }

    const validLines = formData.lines.filter(
      (line) => line.accountId && (parseFloat(line.debitAmount) > 0 || parseFloat(line.creditAmount) > 0)
    );

    if (validLines.length < 2) {
      setError('At least 2 line items are required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.post('/accounting/journal-entries', {
        entryType: formData.entryType,
        narration: formData.narration || undefined,
        lines: validLines.map((line) => ({
          accountId: line.accountId,
          debitAmount: parseFloat(line.debitAmount) || 0,
          creditAmount: parseFloat(line.creditAmount) || 0,
          description: line.description || undefined,
        })),
      });

      if (res.data.success) {
        setShowCreateModal(false);
        setFormData({
          entryType: 'manual',
          narration: '',
          lines: [
            { accountId: '', debitAmount: '', creditAmount: '', description: '' },
            { accountId: '', debitAmount: '', creditAmount: '', description: '' },
          ],
        });
        fetchData();
      } else {
        setError(res.data.error?.message || 'Failed to create journal entry');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create journal entry');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const { totalDebit, totalCredit, difference } = calculateTotals();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/accounting">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Journal Entries</h1>
          <p className="text-gray-500">Record and view double-entry transactions</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Journal Entry
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
                placeholder="Search by entry number..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <select
            className="px-3 py-2 border rounded-md"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="manual">Manual</option>
            <option value="sales">Sales</option>
            <option value="purchase">Purchase</option>
            <option value="expense">Expense</option>
            <option value="receipt">Receipt</option>
            <option value="payment">Payment</option>
          </select>
          <select
            className="px-3 py-2 border rounded-md"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="posted">Posted</option>
            <option value="draft">Draft</option>
            <option value="reversed">Reversed</option>
          </select>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Entries List */}
      <Card>
        <div className="p-4 border-b bg-gray-50">
          <div className="grid grid-cols-7 gap-4 text-sm font-medium text-gray-600">
            <div>Entry #</div>
            <div>Date</div>
            <div>Type</div>
            <div>Narration</div>
            <div className="text-right">Amount</div>
            <div className="text-center">Status</div>
            <div className="text-center">Actions</div>
          </div>
        </div>
        <div className="divide-y">
          {entries.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p>No journal entries found</p>
            </div>
          ) : (
            entries
              .filter(
                (entry) =>
                  !searchQuery ||
                  entry.entryNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  entry.narration?.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((entry) => (
                <div key={entry.id} className="p-4 hover:bg-gray-50">
                  <div className="grid grid-cols-7 gap-4 items-center">
                    <div className="font-mono font-medium">{entry.entryNumber}</div>
                    <div className="text-sm text-gray-600">{formatDate(entry.entryDate)}</div>
                    <div>
                      <Badge variant="outline">{entryTypeLabels[entry.entryType] || entry.entryType}</Badge>
                    </div>
                    <div className="text-sm text-gray-600 truncate">{entry.narration || '-'}</div>
                    <div className="text-right font-mono">{formatCurrency(entry.totalDebit)}</div>
                    <div className="text-center">
                      <Badge className={statusColors[entry.status]}>{entry.status}</Badge>
                    </div>
                    <div className="flex justify-center">
                      <Button variant="ghost" size="sm" onClick={() => viewEntry(entry)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </Card>

      {/* Create Entry Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">New Journal Entry</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowCreateModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateEntry} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Entry Type</Label>
                  <select
                    className="w-full px-3 py-2 border rounded-md mt-1"
                    value={formData.entryType}
                    onChange={(e) => setFormData({ ...formData, entryType: e.target.value })}
                  >
                    <option value="manual">Manual Entry</option>
                    <option value="adjustment">Adjustment</option>
                    <option value="opening">Opening Balance</option>
                  </select>
                </div>
                <div>
                  <Label>Narration / Description</Label>
                  <Input
                    className="mt-1"
                    placeholder="Brief description of this entry..."
                    value={formData.narration}
                    onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
                  />
                </div>
              </div>

              {/* Entry Lines */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 p-3 border-b">
                  <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-600">
                    <div className="col-span-4">Account</div>
                    <div className="col-span-2 text-right">Debit</div>
                    <div className="col-span-2 text-right">Credit</div>
                    <div className="col-span-3">Description</div>
                    <div className="col-span-1"></div>
                  </div>
                </div>
                <div className="divide-y">
                  {formData.lines.map((line, index) => (
                    <div key={index} className="p-3">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                          <select
                            className="w-full px-2 py-1.5 border rounded text-sm"
                            value={line.accountId}
                            onChange={(e) => handleLineChange(index, 'accountId', e.target.value)}
                          >
                            <option value="">Select Account</option>
                            {accounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.accountCode} - {acc.accountName}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            step="0.01"
                            className="text-right text-sm"
                            placeholder="0.00"
                            value={line.debitAmount}
                            onChange={(e) => handleLineChange(index, 'debitAmount', e.target.value)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            step="0.01"
                            className="text-right text-sm"
                            placeholder="0.00"
                            value={line.creditAmount}
                            onChange={(e) => handleLineChange(index, 'creditAmount', e.target.value)}
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            className="text-sm"
                            placeholder="Optional"
                            value={line.description}
                            onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                          />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveLine(index)}
                            disabled={formData.lines.length <= 2}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-gray-50 border-t">
                  <Button type="button" variant="outline" size="sm" onClick={handleAddLine}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Line
                  </Button>
                </div>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between">
                    <span>Total Debit:</span>
                    <span className="font-mono font-medium">{formatCurrency(totalDebit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Credit:</span>
                    <span className="font-mono font-medium">{formatCurrency(totalCredit)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span>Difference:</span>
                    <span className={`font-mono font-medium ${difference === 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(Math.abs(difference))}
                      {difference !== 0 && (
                        <span className="text-xs ml-1">({difference > 0 ? 'Dr' : 'Cr'})</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {difference !== 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-yellow-700">
                  <AlertCircle className="h-5 w-5" />
                  <span>Debits must equal Credits. Please balance the entry.</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || difference !== 0}>
                  {submitting ? 'Creating...' : 'Create Entry'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Entry Detail Modal */}
      {showDetailModal && selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold">{selectedEntry.entryNumber}</h2>
                <p className="text-sm text-gray-500">
                  {formatDate(selectedEntry.entryDate)} • {entryTypeLabels[selectedEntry.entryType]}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowDetailModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge className={statusColors[selectedEntry.status]}>{selectedEntry.status}</Badge>
                {selectedEntry.referenceNumber && (
                  <span className="text-sm text-gray-500">
                    Ref: {selectedEntry.referenceType} #{selectedEntry.referenceNumber}
                  </span>
                )}
              </div>

              {selectedEntry.narration && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">{selectedEntry.narration}</p>
                </div>
              )}

              {/* Lines */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 p-3 border-b">
                  <div className="grid grid-cols-5 gap-4 text-sm font-medium text-gray-600">
                    <div className="col-span-2">Account</div>
                    <div className="text-right">Debit</div>
                    <div className="text-right">Credit</div>
                    <div>Description</div>
                  </div>
                </div>
                <div className="divide-y">
                  {selectedEntry.lines?.map((line) => (
                    <div key={line.id} className="p-3">
                      <div className="grid grid-cols-5 gap-4 items-center">
                        <div className="col-span-2">
                          <span className="font-mono text-sm text-gray-500 mr-2">
                            {line.account?.accountCode}
                          </span>
                          <span>{line.account?.accountName}</span>
                        </div>
                        <div className="text-right font-mono">
                          {parseFloat(line.debitAmount) > 0 ? formatCurrency(line.debitAmount) : '-'}
                        </div>
                        <div className="text-right font-mono">
                          {parseFloat(line.creditAmount) > 0 ? formatCurrency(line.creditAmount) : '-'}
                        </div>
                        <div className="text-sm text-gray-500">{line.description || '-'}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-gray-50 border-t">
                  <div className="grid grid-cols-5 gap-4 font-medium">
                    <div className="col-span-2">Total</div>
                    <div className="text-right font-mono">{formatCurrency(selectedEntry.totalDebit)}</div>
                    <div className="text-right font-mono">{formatCurrency(selectedEntry.totalCredit)}</div>
                    <div></div>
                  </div>
                </div>
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
