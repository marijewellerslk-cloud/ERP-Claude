'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import {
  RefreshCw,
  FileText,
  TrendingUp,
  TrendingDown,
  Scale,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

type ReportTab = 'income-statement' | 'balance-sheet' | 'trial-balance' | 'cash-flow';

interface AccountLine {
  accountCode: string;
  accountName: string;
  balance: number;
}

interface TrialBalanceLine {
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
}

export default function FinancialReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('income-statement');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const [incomeStatement, setIncomeStatement] = useState<any>(null);
  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [trialBalance, setTrialBalance] = useState<any>(null);
  const [cashFlow, setCashFlow] = useState<any>(null);

  useEffect(() => {
    fetchReports();
  }, [dateRange]);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const [incomeRes, balanceRes, trialRes, cashFlowRes] = await Promise.all([
        apiClient.get('/accounting/reports/income-statement', {
          params: { startDate: dateRange.startDate, endDate: dateRange.endDate },
        }),
        apiClient.get('/accounting/reports/balance-sheet', {
          params: { asOfDate: dateRange.endDate },
        }),
        apiClient.get('/accounting/reports/trial-balance', {
          params: { asOfDate: dateRange.endDate },
        }),
        apiClient.get('/accounting/reports/cash-flow', {
          params: { startDate: dateRange.startDate, endDate: dateRange.endDate },
        }),
      ]);

      if (incomeRes.data.success) setIncomeStatement(incomeRes.data.data);
      if (balanceRes.data.success) setBalanceSheet(balanceRes.data.data);
      if (trialRes.data.success) setTrialBalance(trialRes.data.data);
      if (cashFlowRes.data.success) setCashFlow(cashFlowRes.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: ReportTab; label: string; icon: any }[] = [
    { key: 'income-statement', label: 'Income Statement', icon: TrendingUp },
    { key: 'balance-sheet', label: 'Balance Sheet', icon: Scale },
    { key: 'trial-balance', label: 'Trial Balance', icon: FileText },
    { key: 'cash-flow', label: 'Cash Flow', icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Financial Reports</h1>
          <p className="text-gray-500 mt-1">Income Statement, Balance Sheet, Trial Balance & Cash Flow</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="startDate" className="text-sm whitespace-nowrap">From</Label>
            <Input
              id="startDate"
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-36"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="endDate" className="text-sm whitespace-nowrap">To</Label>
            <Input
              id="endDate"
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-36"
            />
          </div>
          <Button onClick={fetchReports} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map(tab => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'default' : 'ghost'}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-600">{error}</p>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-2">Loading reports...</p>
        </div>
      ) : (
        <>
          {/* Income Statement */}
          {activeTab === 'income-statement' && incomeStatement && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6">
                  <p className="text-sm text-gray-500">Total Income</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {formatCurrency(incomeStatement.income.total)}
                  </p>
                </Card>
                <Card className="p-6">
                  <p className="text-sm text-gray-500">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">
                    {formatCurrency(incomeStatement.expenses.total)}
                  </p>
                </Card>
                <Card className="p-6">
                  <p className="text-sm text-gray-500">Net Profit</p>
                  <p className={`text-2xl font-bold mt-1 ${incomeStatement.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(incomeStatement.netProfit)}
                  </p>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      Income
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {incomeStatement.income.accounts.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-2">Code</th>
                            <th className="text-left p-2">Account</th>
                            <th className="text-right p-2">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {incomeStatement.income.accounts.map((acc: AccountLine) => (
                            <tr key={acc.accountCode} className="border-t">
                              <td className="p-2 font-mono text-xs">{acc.accountCode}</td>
                              <td className="p-2">{acc.accountName}</td>
                              <td className="p-2 text-right font-medium">{formatCurrency(acc.balance)}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 font-bold">
                            <td colSpan={2} className="p-2">Total Income</td>
                            <td className="p-2 text-right">{formatCurrency(incomeStatement.income.total)}</td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-gray-400 text-center py-4">No income recorded</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                      Expenses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {incomeStatement.expenses.accounts.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-2">Code</th>
                            <th className="text-left p-2">Account</th>
                            <th className="text-right p-2">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {incomeStatement.expenses.accounts.map((acc: AccountLine) => (
                            <tr key={acc.accountCode} className="border-t">
                              <td className="p-2 font-mono text-xs">{acc.accountCode}</td>
                              <td className="p-2">{acc.accountName}</td>
                              <td className="p-2 text-right font-medium">{formatCurrency(acc.balance)}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 font-bold">
                            <td colSpan={2} className="p-2">Total Expenses</td>
                            <td className="p-2 text-right">{formatCurrency(incomeStatement.expenses.total)}</td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-gray-400 text-center py-4">No expenses recorded</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Balance Sheet */}
          {activeTab === 'balance-sheet' && balanceSheet && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6">
                  <p className="text-sm text-gray-500">Total Assets</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(balanceSheet.assets.total)}</p>
                </Card>
                <Card className="p-6">
                  <p className="text-sm text-gray-500">Total Liabilities</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(balanceSheet.liabilities.total)}</p>
                </Card>
                <Card className="p-6">
                  <p className="text-sm text-gray-500">Total Equity</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">{formatCurrency(balanceSheet.equity.total)}</p>
                </Card>
              </div>

              {[
                { key: 'assets', title: 'Assets', data: balanceSheet.assets, color: 'text-blue-600' },
                { key: 'liabilities', title: 'Liabilities', data: balanceSheet.liabilities, color: 'text-orange-600' },
                { key: 'equity', title: 'Equity', data: balanceSheet.equity, color: 'text-purple-600' },
              ].map(section => (
                <Card key={section.key}>
                  <CardHeader>
                    <CardTitle className={section.color}>{section.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {section.data.accounts.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-2">Code</th>
                            <th className="text-left p-2">Account</th>
                            <th className="text-right p-2">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.data.accounts.map((acc: AccountLine) => (
                            <tr key={acc.accountCode} className="border-t">
                              <td className="p-2 font-mono text-xs">{acc.accountCode}</td>
                              <td className="p-2">{acc.accountName}</td>
                              <td className="p-2 text-right font-medium">{formatCurrency(acc.balance)}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 font-bold">
                            <td colSpan={2} className="p-2">Total {section.title}</td>
                            <td className="p-2 text-right">{formatCurrency(section.data.total)}</td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-gray-400 text-center py-4">No {section.title.toLowerCase()} recorded</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Trial Balance */}
          {activeTab === 'trial-balance' && trialBalance && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6">
                  <p className="text-sm text-gray-500">Total Debits</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(trialBalance.totalDebit)}</p>
                </Card>
                <Card className="p-6">
                  <p className="text-sm text-gray-500">Total Credits</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(trialBalance.totalCredit)}</p>
                </Card>
                <Card className="p-6">
                  <p className="text-sm text-gray-500">Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    {trialBalance.isBalanced ? (
                      <>
                        <CheckCircle className="h-6 w-6 text-green-600" />
                        <span className="text-lg font-bold text-green-600">Balanced</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                        <span className="text-lg font-bold text-red-600">
                          Unbalanced ({formatCurrency(Math.abs(trialBalance.totalDebit - trialBalance.totalCredit))})
                        </span>
                      </>
                    )}
                  </div>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Trial Balance as of {trialBalance.asOf}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {trialBalance.accounts.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-2">Code</th>
                          <th className="text-left p-2">Account</th>
                          <th className="text-left p-2">Type</th>
                          <th className="text-right p-2">Debit</th>
                          <th className="text-right p-2">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trialBalance.accounts.map((acc: TrialBalanceLine) => (
                          <tr key={acc.accountCode} className="border-t hover:bg-gray-50">
                            <td className="p-2 font-mono text-xs">{acc.accountCode}</td>
                            <td className="p-2">{acc.accountName}</td>
                            <td className="p-2">
                              <Badge variant="secondary" className="capitalize text-xs">
                                {acc.accountType}
                              </Badge>
                            </td>
                            <td className="p-2 text-right font-medium">
                              {acc.debit > 0 ? formatCurrency(acc.debit) : '-'}
                            </td>
                            <td className="p-2 text-right font-medium">
                              {acc.credit > 0 ? formatCurrency(acc.credit) : '-'}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 font-bold bg-gray-50">
                          <td colSpan={3} className="p-2">Total</td>
                          <td className="p-2 text-right">{formatCurrency(trialBalance.totalDebit)}</td>
                          <td className="p-2 text-right">{formatCurrency(trialBalance.totalCredit)}</td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-gray-400 text-center py-8">No accounts with balance found</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Cash Flow */}
          {activeTab === 'cash-flow' && cashFlow && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6">
                  <p className="text-sm text-gray-500">Operating Inflows</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(cashFlow.operating.inflows)}</p>
                </Card>
                <Card className="p-6">
                  <p className="text-sm text-gray-500">Operating Outflows</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(cashFlow.operating.outflows)}</p>
                </Card>
                <Card className="p-6">
                  <p className="text-sm text-gray-500">Net Operating Cash Flow</p>
                  <p className={`text-2xl font-bold mt-1 ${cashFlow.operating.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(cashFlow.operating.net)}
                  </p>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Cash & Bank Movements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {cashFlow.cashMovements.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-2">Account</th>
                          <th className="text-right p-2">Inflow</th>
                          <th className="text-right p-2">Outflow</th>
                          <th className="text-right p-2">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cashFlow.cashMovements.map((m: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2">{m.accountName}</td>
                            <td className="p-2 text-right text-green-600">{formatCurrency(m.inflow)}</td>
                            <td className="p-2 text-right text-red-600">{formatCurrency(m.outflow)}</td>
                            <td className={`p-2 text-right font-medium ${m.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(m.net)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-gray-400 text-center py-4">No cash movements for this period</p>
                  )}
                </CardContent>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Closing Cash & Bank Balance</p>
                    <p className="text-3xl font-bold text-blue-600 mt-1">{formatCurrency(cashFlow.closingCashBalance)}</p>
                  </div>
                  <DollarSign className="h-12 w-12 text-blue-200" />
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
