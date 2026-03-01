'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Building2,
  Wallet,
  Landmark,
  TrendingUp,
  TrendingDown,
  Receipt,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  CreditCard,
  FileText,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';

interface StoreFinancials {
  storeId: string;
  storeName: string;
  storeCode: string;
  cashBalance: number;
  bankBalance: number;
  accountsReceivable: number;
  accountsPayable: number;
  todayIncome: number;
  todayExpenses: number;
  monthIncome: number;
  monthExpenses: number;
  gstLiability: number;
}

interface FinancialOverview {
  stores: StoreFinancials[];
  totals: {
    cashBalance: number;
    bankBalance: number;
    totalLiquidity: number;
    accountsReceivable: number;
    accountsPayable: number;
    todayIncome: number;
    todayExpenses: number;
    todayProfit: number;
    monthIncome: number;
    monthExpenses: number;
    monthProfit: number;
    gstLiability: number;
  };
}

export default function FinancialDashboardPage() {
  const [data, setData] = useState<FinancialOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const response = await apiClient.get('/command-center/financials');
      setData(response.data?.data || null);
    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data || data.stores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No financial data available</h3>
        <p className="text-muted-foreground">No stores accessible for financial overview</p>
      </div>
    );
  }

  const totals = data.totals;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financial Dashboard</h1>
          <p className="text-muted-foreground">
            Consolidated financial view across {data.stores.length} store(s)
          </p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Liquidity Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Balance</CardTitle>
            <Wallet className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totals.cashBalance)}
            </div>
            <p className="text-xs text-muted-foreground">Cash in hand across stores</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bank Balance</CardTitle>
            <Landmark className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(totals.bankBalance)}
            </div>
            <p className="text-xs text-muted-foreground">Total bank deposits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receivables</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(totals.accountsReceivable)}
            </div>
            <p className="text-xs text-muted-foreground">Outstanding from customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payables</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totals.accountsPayable)}
            </div>
            <p className="text-xs text-muted-foreground">Due to suppliers</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's P&L */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Today's Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {formatCurrency(totals.todayIncome)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Today's Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {formatCurrency(totals.todayExpenses)}
            </div>
          </CardContent>
        </Card>

        <Card className={totals.todayProfit >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${totals.todayProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              Today's Profit
            </CardTitle>
            <DollarSign className={`h-4 w-4 ${totals.todayProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totals.todayProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(totals.todayProfit)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly P&L */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Summary</CardTitle>
          <CardDescription>This month's financial performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Income</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(totals.monthIncome)}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Expenses</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(totals.monthExpenses)}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Net Profit</p>
              <p className={`text-2xl font-bold ${totals.monthProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totals.monthProfit)}
              </p>
            </div>
          </div>

          {/* Profit margin indicator */}
          {totals.monthIncome > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Profit Margin</span>
                <span className={totals.monthProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {((totals.monthProfit / totals.monthIncome) * 100).toFixed(1)}%
                </span>
              </div>
              <Progress
                value={Math.max(0, Math.min(100, (totals.monthProfit / totals.monthIncome) * 100))}
                className="h-2"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* GST Liability */}
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-purple-700">GST Liability</CardTitle>
          <Receipt className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-700">
            {formatCurrency(totals.gstLiability)}
          </div>
          <p className="text-xs text-purple-600">Total GST payable across all stores</p>
        </CardContent>
      </Card>

      {/* Store-wise Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Store-wise Financials</CardTitle>
          <CardDescription>Financial metrics for each branch</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {data.stores.map((store) => (
              <div key={store.storeId} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h4 className="font-semibold">{store.storeName}</h4>
                      <p className="text-sm text-muted-foreground">{store.storeCode}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Cash</p>
                    <p className="font-semibold text-green-600">{formatCurrency(store.cashBalance)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Bank</p>
                    <p className="font-semibold text-blue-600">{formatCurrency(store.bankBalance)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Receivables</p>
                    <p className="font-semibold text-orange-600">{formatCurrency(store.accountsReceivable)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Payables</p>
                    <p className="font-semibold text-red-600">{formatCurrency(store.accountsPayable)}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3 mt-4 pt-4 border-t">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Today's Income</p>
                    <p className="font-semibold">{formatCurrency(store.todayIncome)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Today's Expenses</p>
                    <p className="font-semibold">{formatCurrency(store.todayExpenses)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Today's Net</p>
                    <p className={`font-semibold ${store.todayIncome - store.todayExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(store.todayIncome - store.todayExpenses)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
