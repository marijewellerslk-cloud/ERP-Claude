'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Coins,
  Scale,
  AlertTriangle,
  Calendar,
  RefreshCw,
  Phone,
  User,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';

interface StoreLoanData {
  storeId: string;
  storeName: string;
  storeCode: string;
  activeLoans: number;
  loanValue: number;
  goldWeight: number;
  goldValue: number;
  overdueLoans: number;
  interestCollected: number;
}

interface MaturingLoan {
  id: string;
  loanNumber: string;
  storeId: string;
  storeName: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  loanAmount: string;
  maturityDate: string;
}

interface OverdueLoan extends MaturingLoan {
  daysOverdue: number;
}

interface LoanDashboard {
  stores: StoreLoanData[];
  totals: {
    activeLoans: number;
    loanValue: number;
    goldWeight: number;
    goldValue: number;
    overdueLoans: number;
    interestCollected: number;
  };
  maturingLoans: MaturingLoan[];
  overdueLoans: OverdueLoan[];
}

export default function LoanDashboardPage() {
  const [data, setData] = useState<LoanDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const response = await apiClient.get('/command-center/loans');
      setData(response.data?.data || null);
    } catch (error) {
      console.error('Error fetching loan data:', error);
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
        <Coins className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No loan data available</h3>
        <p className="text-muted-foreground">No stores accessible for loan dashboard</p>
      </div>
    );
  }

  const totals = data.totals;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gold Loan Dashboard</h1>
          <p className="text-muted-foreground">
            Loan portfolio overview across {data.stores.length} store(s)
          </p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Portfolio Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <Coins className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.activeLoans}</div>
            <p className="text-xs text-muted-foreground">
              Value: {formatCurrency(totals.loanValue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gold Pledged</CardTitle>
            <Scale className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.goldWeight.toFixed(2)}g</div>
            <p className="text-xs text-muted-foreground">
              Market Value: {formatCurrency(totals.goldValue)}
            </p>
          </CardContent>
        </Card>

        <Card className={totals.overdueLoans > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${totals.overdueLoans > 0 ? 'text-red-700' : ''}`}>
              Overdue Loans
            </CardTitle>
            <AlertTriangle className={`h-4 w-4 ${totals.overdueLoans > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totals.overdueLoans > 0 ? 'text-red-700' : ''}`}>
              {totals.overdueLoans}
            </div>
            <p className={`text-xs ${totals.overdueLoans > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
              Past maturity date
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Interest Collected</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {formatCurrency(totals.interestCollected)}
            </div>
            <p className="text-xs text-green-600">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Loans Alert */}
      {data.overdueLoans.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-800">Overdue Loans ({data.overdueLoans.length})</CardTitle>
            </div>
            <CardDescription className="text-red-600">
              These loans have exceeded their maturity date
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.overdueLoans.map((loan) => (
                <div
                  key={loan.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">{loan.loanNumber}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        {loan.customerName || 'Unknown'}
                        {loan.customerPhone && (
                          <>
                            <Phone className="h-3 w-3 ml-2" />
                            {loan.customerPhone}
                          </>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline">{loan.storeName}</Badge>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(parseFloat(loan.loanAmount))}</p>
                    <p className="text-sm text-red-600">
                      {loan.daysOverdue} days overdue
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Maturing Loans */}
      {data.maturingLoans.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-yellow-800">Maturing Soon ({data.maturingLoans.length})</CardTitle>
            </div>
            <CardDescription className="text-yellow-600">
              Loans maturing within the next 7 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.maturingLoans.map((loan) => (
                <div
                  key={loan.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-yellow-200"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">{loan.loanNumber}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        {loan.customerName || 'Unknown'}
                        {loan.customerPhone && (
                          <>
                            <Phone className="h-3 w-3 ml-2" />
                            {loan.customerPhone}
                          </>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline">{loan.storeName}</Badge>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(parseFloat(loan.loanAmount))}</p>
                    <p className="text-sm text-yellow-600">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {new Date(loan.maturityDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Store-wise Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Store-wise Loan Portfolio</CardTitle>
          <CardDescription>Loan metrics for each branch</CardDescription>
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
                  {store.overdueLoans > 0 && (
                    <Badge variant="destructive">
                      {store.overdueLoans} overdue
                    </Badge>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Active Loans</p>
                    <p className="font-semibold">{store.activeLoans}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(store.loanValue)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Gold Pledged</p>
                    <p className="font-semibold">{store.goldWeight.toFixed(2)}g</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(store.goldValue)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Interest Collected</p>
                    <p className="font-semibold text-green-600">{formatCurrency(store.interestCollected)}</p>
                    <p className="text-xs text-muted-foreground">This month</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">LTV Ratio</p>
                    <p className="font-semibold">
                      {store.goldValue > 0 ? ((store.loanValue / store.goldValue) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-xs text-muted-foreground">Loan to Value</p>
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
