'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DollarSign,
  Scale,
  Calendar,
  Download,
  Filter,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';

interface SupplierStats {
  currentBalance: number;
  totalLifetimePurchases: number;
  totalLifetimePayments: number;
  creditLimit: number;
  availableCredit: number;
  accountStatus: string;
  goldBalanceGrams: number;
  totalGoldReceived: number;
  totalGoldReturned: number;
  goldExchangeBalanceGrams: number;
  totalGoldGivenInExchange: number;
  totalGoldReceivedInExchange: number;
  totalBatches: number;
  completedBatches: number;
  activeBatches: number;
  totalWeight: number;
}

interface Transaction {
  id: string;
  ledgerType: 'monetary' | 'gold' | 'gold_exchange';
  transactionType: string;
  referenceType: string;
  referenceId?: string;
  debit: string;
  credit: string;
  balance: string;
  goldDebit: string;
  goldCredit: string;
  goldBalance: string;
  paymentMethod?: string;
  paymentReference?: string;
  description: string;
  transactionDate: string;
  createdBy: string;
  createdByUser?: {
    id: string;
    fullName: string;
  };
}

interface DualLedgerViewProps {
  supplierId: string;
}

export default function DualLedgerView({ supplierId }: DualLedgerViewProps) {
  const [stats, setStats] = useState<SupplierStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLedger, setSelectedLedger] = useState<'both' | 'monetary' | 'gold' | 'gold_exchange'>('both');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Settlement State
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleType, setSettleType] = useState<'monetary' | 'gold'>('monetary');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleGoldWeight, setSettleGoldWeight] = useState('');
  const [settlePaymentMethod, setSettlePaymentMethod] = useState('cash');
  const [settleReference, setSettleReference] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [supplierId]);

  useEffect(() => {
    fetchTransactions();
  }, [supplierId, selectedLedger, dateFrom, dateTo]);

  const fetchStats = async () => {
    try {
      const response = await apiClient.get(`/suppliers/${supplierId}/stats`);
      if (response.data.success) {
        setStats(response.data.data.statistics);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('ledgerType', selectedLedger);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      params.append('limit', '100');

      const response = await apiClient.get(`/suppliers/${supplierId}/unified-ledger?${params}`);
      if (response.data.success) {
        setTransactions(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettle = async () => {
    if (settleType === 'monetary' && (!settleAmount || parseFloat(settleAmount) <= 0)) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (settleType === 'gold' && (!settleGoldWeight || parseFloat(settleGoldWeight) <= 0)) {
      toast.error('Please enter a valid gold weight');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        settlementType: settleType,
        notes: settleNotes,
      };

      if (settleType === 'monetary') {
        payload.amount = parseFloat(settleAmount);
        payload.paymentMethod = settlePaymentMethod;
        payload.paymentReference = settleReference;
      } else {
        payload.goldWeightGrams = parseFloat(settleGoldWeight);
      }

      const response = await apiClient.post(`/suppliers/${supplierId}/settle-balance`, payload);

      if (response.data.success) {
        toast.success('Balance settled successfully');
        setIsSettleModalOpen(false);
        // Reset form
        setSettleAmount('');
        setSettleGoldWeight('');
        setSettleNotes('');
        setSettleReference('');
        // Refresh data
        fetchStats();
        fetchTransactions();
      } else {
        toast.error(response.data.message || 'Failed to settle balance');
      }
    } catch (error: any) {
      console.error('Error settling balance:', error);
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'An error occurred while settling balance');
    } finally {
      setIsSubmitting(false);
    }
  };


  const getAccountStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'on_hold':
        return 'bg-yellow-100 text-yellow-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'purchase':
      case 'gold_received':
      case 'gold_exchange_given':
        return 'text-red-600';
      case 'payment':
      case 'gold_returned':
      case 'gold_exchange_received':
        return 'text-green-600';
      case 'reversal':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const exportToCSV = () => {
    if (transactions.length === 0) return;

    const headers = selectedLedger === 'gold'
      ? ['Date', 'Type', 'Description', 'Gold Received (g)', 'Gold Returned (g)', 'Gold Balance (g)', 'Created By']
      : selectedLedger === 'gold_exchange'
        ? ['Date', 'Type', 'Description', 'Gold Given (g)', 'Gold Received (g)', 'Gold Balance (g)', 'Created By']
        : selectedLedger === 'monetary'
          ? ['Date', 'Type', 'Description', 'Debit', 'Credit', 'Balance', 'Payment Method', 'Payment Ref', 'Created By']
          : ['Date', 'Ledger', 'Type', 'Description', 'Debit', 'Credit', 'Balance', 'Gold Debit', 'Gold Credit', 'Gold Balance', 'Created By'];

    const rows = transactions.map(txn => {
      const date = new Date(txn.transactionDate).toLocaleDateString();
      const createdBy = txn.createdByUser?.fullName || 'Unknown';

      if (selectedLedger === 'gold' || selectedLedger === 'gold_exchange') {
        return [
          date,
          txn.transactionType,
          txn.description,
          txn.goldDebit,
          txn.goldCredit,
          txn.goldBalance,
          createdBy
        ];
      } else if (selectedLedger === 'monetary') {
        return [
          date,
          txn.transactionType,
          txn.description,
          txn.debit,
          txn.credit,
          txn.balance,
          txn.paymentMethod || '-',
          txn.paymentReference || '-',
          createdBy
        ];
      } else {
        return [
          date,
          txn.ledgerType,
          txn.transactionType,
          txn.description,
          txn.debit,
          txn.credit,
          txn.balance,
          txn.goldDebit,
          txn.goldCredit,
          txn.goldBalance,
          createdBy
        ];
      }
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supplier-ledger-${selectedLedger}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!stats) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const creditUtilization = stats.creditLimit > 0
    ? (stats.currentBalance / stats.creditLimit) * 100
    : 0;

  return (
    <div className="space-y-6">



      {/* Actions Bar */}
      <div className="flex justify-end">
        <Dialog open={isSettleModalOpen} onOpenChange={setIsSettleModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Wallet className="h-4 w-4 mr-2" />
              Settle Balance
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Settle Supplier Balance</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Settlement Type</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={settleType === 'monetary' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setSettleType('monetary')}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Cash / Bank
                  </Button>
                  <Button
                    type="button"
                    variant={settleType === 'gold' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setSettleType('gold')}
                  >
                    <Scale className="h-4 w-4 mr-2" />
                    Gold
                  </Button>
                </div>
              </div>

              {settleType === 'monetary' ? (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Amount *</Label>
                    <Input
                      id="amount"
                      type="number"
                      value={settleAmount}
                      onChange={(e) => setSettleAmount(e.target.value)}
                      placeholder="Enter amount"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="method">Payment Method</Label>
                    <Select value={settlePaymentMethod} onValueChange={setSettlePaymentMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="reference">Reference / Cheque No.</Label>
                    <Input
                      id="reference"
                      value={settleReference}
                      onChange={(e) => setSettleReference(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="weight">Gold Weight (g) *</Label>
                  <Input
                    id="weight"
                    type="number"
                    value={settleGoldWeight}
                    onChange={(e) => setSettleGoldWeight(e.target.value)}
                    placeholder="Enter weight in grams"
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="Optional notes about this settlement"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSettleModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSettle} disabled={isSubmitting}>
                {isSubmitting ? 'Processing...' : 'Settle Balance'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Monetary Balance */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Current Balance</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(stats.currentBalance)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-red-400" />
            </div>
            <div className="mt-2">
              <Badge className={getAccountStatusColor(stats.accountStatus)}>
                {stats.accountStatus.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Gold Balance */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Gold Balance</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats.goldBalanceGrams.toFixed(3)}g
                </p>
              </div>
              <Scale className="h-8 w-8 text-yellow-400" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Outstanding gold inventory
            </p>
          </CardContent>
        </Card>

        {/* Gold Exchange Balance */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Gold Exchange</p>
                <p className={`text-2xl font-bold ${stats.goldExchangeBalanceGrams > 0 ? 'text-red-600' :
                  stats.goldExchangeBalanceGrams < 0 ? 'text-green-600' :
                    'text-gray-600'
                  }`}>
                  {stats.goldExchangeBalanceGrams > 0 ? '+' : ''}{stats.goldExchangeBalanceGrams.toFixed(3)}g
                </p>
              </div>
              <Scale className="h-8 w-8 text-purple-400" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {stats.goldExchangeBalanceGrams > 0
                ? 'They owe us gold'
                : stats.goldExchangeBalanceGrams < 0
                  ? 'We owe them gold'
                  : 'Exchange balanced'}
            </p>
          </CardContent>
        </Card>

        {/* Available Credit */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Available Credit</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats.availableCredit)}
                </p>
              </div>
              <CreditCard className="h-8 w-8 text-green-400" />
            </div>
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${creditUtilization > 90 ? 'bg-red-500' :
                    creditUtilization > 70 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                  style={{ width: `${Math.min(creditUtilization, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {creditUtilization.toFixed(1)}% utilized
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Lifetime Purchases */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Lifetime Purchases</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(stats.totalLifetimePurchases)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-400" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {stats.totalBatches} batches total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gold Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-yellow-600" />
              Gold Purchase Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Gold Purchased</p>
                <p className="text-xl font-bold text-yellow-600">
                  {stats.totalWeight.toFixed(3)}g
                </p>
                <p className="text-xs text-gray-500">From batches</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Gold Received</p>
                <p className="text-xl font-bold text-green-600">
                  {stats.totalGoldReceivedInExchange.toFixed(3)}g
                </p>
                <p className="text-xs text-gray-500">From exchange</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-yellow-600" />
              Gold Ledger Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Received</p>
                <p className="text-xl font-bold text-green-600">
                  {stats.totalGoldReceived.toFixed(3)}g
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Returned</p>
                <p className="text-xl font-bold text-red-600">
                  {stats.totalGoldReturned.toFixed(3)}g
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Net Outstanding</p>
                <p className="text-xl font-bold text-yellow-600">
                  {stats.goldBalanceGrams.toFixed(3)}g
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-purple-600" />
              Gold Exchange Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Given</p>
                <p className="text-xl font-bold text-red-600">
                  {stats.totalGoldGivenInExchange.toFixed(3)}g
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Received</p>
                <p className="text-xl font-bold text-green-600">
                  {stats.totalGoldReceivedInExchange.toFixed(3)}g
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Net Balance</p>
                <p className={`text-xl font-bold ${stats.goldExchangeBalanceGrams > 0 ? 'text-red-600' :
                  stats.goldExchangeBalanceGrams < 0 ? 'text-green-600' :
                    'text-gray-600'
                  }`}>
                  {stats.goldExchangeBalanceGrams > 0 ? '+' : ''}{stats.goldExchangeBalanceGrams.toFixed(3)}g
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Ledger */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transaction Ledger</CardTitle>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap gap-4">
            <div className="flex gap-2">
              <Button
                variant={selectedLedger === 'both' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedLedger('both')}
              >
                All Ledgers
              </Button>
              <Button
                variant={selectedLedger === 'monetary' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedLedger('monetary')}
              >
                <DollarSign className="h-4 w-4 mr-1" />
                Monetary
              </Button>
              <Button
                variant={selectedLedger === 'gold' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedLedger('gold')}
              >
                <Scale className="h-4 w-4 mr-1" />
                Gold
              </Button>
              <Button
                variant={selectedLedger === 'gold_exchange' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedLedger('gold_exchange')}
              >
                <Scale className="h-4 w-4 mr-1" />
                Gold Exchange
              </Button>
            </div>

            <div className="flex gap-2">
              <Input
                type="date"
                placeholder="From"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
              <Input
                type="date"
                placeholder="To"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
          </div>

          {/* Transactions Table */}
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading transactions...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No transactions found</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium text-gray-600">Date</th>
                    {selectedLedger === 'both' && (
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Ledger</th>
                    )}
                    <th className="text-left p-3 text-sm font-medium text-gray-600">Type</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-600">Description</th>

                    {selectedLedger !== 'gold' && selectedLedger !== 'gold_exchange' && (
                      <>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">Debit</th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">Credit</th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">Balance</th>
                        {selectedLedger === 'monetary' && (
                          <th className="text-left p-3 text-sm font-medium text-gray-600">Payment</th>
                        )}
                      </>
                    )}

                    {(selectedLedger === 'gold' || selectedLedger === 'gold_exchange' || selectedLedger === 'both') && (
                      <>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">
                          {selectedLedger === 'gold_exchange' ? 'Gold Given (g)' : 'Gold Received (g)'}
                        </th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">
                          {selectedLedger === 'gold_exchange' ? 'Gold Received (g)' : 'Gold Returned (g)'}
                        </th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">Gold Balance (g)</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => (
                    <tr key={txn.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-sm">
                        {new Date(txn.transactionDate).toLocaleDateString('en-LK', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      {selectedLedger === 'both' && (
                        <td className="p-3">
                          <Badge variant={
                            txn.ledgerType === 'monetary' ? 'default' :
                              txn.ledgerType === 'gold_exchange' ? 'outline' :
                                'secondary'
                          }>
                            {txn.ledgerType === 'monetary' ? (
                              <DollarSign className="h-3 w-3 mr-1 inline" />
                            ) : (
                              <Scale className="h-3 w-3 mr-1 inline" />
                            )}
                            {txn.ledgerType.replace('_', ' ')}
                          </Badge>
                        </td>
                      )}
                      <td className="p-3">
                        <span className={`text-sm font-medium ${getTransactionTypeColor(txn.transactionType)}`}>
                          {txn.transactionType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-gray-700 max-w-xs truncate">
                        {txn.description}
                      </td>

                      {selectedLedger !== 'gold' && selectedLedger !== 'gold_exchange' && (
                        <>
                          <td className="p-3 text-right text-sm font-medium text-red-600">
                            {parseFloat(txn.debit) > 0 ? formatCurrency(parseFloat(txn.debit)) : '-'}
                          </td>
                          <td className="p-3 text-right text-sm font-medium text-green-600">
                            {parseFloat(txn.credit) > 0 ? formatCurrency(parseFloat(txn.credit)) : '-'}
                          </td>
                          <td className="p-3 text-right text-sm font-bold">
                            {formatCurrency(parseFloat(txn.balance))}
                          </td>
                          {selectedLedger === 'monetary' && (
                            <td className="p-3 text-sm text-gray-600">
                              {txn.paymentMethod && (
                                <div>
                                  <div className="font-medium">{txn.paymentMethod}</div>
                                  {txn.paymentReference && (
                                    <div className="text-xs text-gray-500">{txn.paymentReference}</div>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                        </>
                      )}

                      {(selectedLedger === 'gold' || selectedLedger === 'gold_exchange' || selectedLedger === 'both') && (
                        <>
                          <td className="p-3 text-right text-sm font-medium text-green-600">
                            {parseFloat(txn.goldDebit) > 0 ? `${parseFloat(txn.goldDebit).toFixed(3)}g` : '-'}
                          </td>
                          <td className="p-3 text-right text-sm font-medium text-red-600">
                            {parseFloat(txn.goldCredit) > 0 ? `${parseFloat(txn.goldCredit).toFixed(3)}g` : '-'}
                          </td>
                          <td className="p-3 text-right text-sm font-bold text-yellow-600">
                            {parseFloat(txn.goldBalance).toFixed(3)}g
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </div >
  );
}
