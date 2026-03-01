'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import {
  Plus,
  Coins,
  TrendingUp,
  Scale,
  Gauge,
  AlertTriangle,
  AlertCircle,
  Clock,
  Eye,
  ShieldCheck,
  Gavel,
  Settings,
  ArrowRight,
  CalendarDays,
  Banknote,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardStats {
  totalLoans: number;
  activeLoans: number;
  totalDisbursed: number;
  totalOutstanding: number;
  totalPledgedGoldWeight: number;
  totalPledgedGoldValue: number;
  overdueLoans: number;
  marginCallLoans: number;
  averageLtv: number;
  ltvBreachCount: number;
}

interface LoanRecord {
  id: string;
  loanNumber: string;
  loanAmount: number;
  currentLtv: number;
  ltvStatus: string;
  maturityDate: string;
  outstandingAmount?: number;
}

interface CustomerRecord {
  firstName: string;
  lastName: string;
  phone: string;
}

interface LtvAlert {
  loan: LoanRecord;
  customer: CustomerRecord;
}

interface OverdueLoan {
  loan: LoanRecord;
  customer: CustomerRecord;
}

interface MaturingLoan {
  loan: LoanRecord;
  customer: CustomerRecord;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  const day = date.getDate().toString().padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function getLtvColor(ltv: number): string {
  if (ltv >= 80) return 'text-red-600';
  if (ltv >= 65) return 'text-amber-600';
  return 'text-green-600';
}

function getLtvBgColor(ltv: number): string {
  if (ltv >= 80) return 'bg-red-100';
  if (ltv >= 65) return 'bg-amber-100';
  return 'bg-green-100';
}

export default function GoldPawningDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [ltvAlerts, setLtvAlerts] = useState<LtvAlert[]>([]);
  const [overdueLoans, setOverdueLoans] = useState<OverdueLoan[]>([]);
  const [maturingLoans, setMaturingLoans] = useState<MaturingLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [statsRes, alertsRes, overdueRes, maturingRes] = await Promise.all([
          apiClient.get('/pawning/dashboard/stats').catch(() => ({ data: { success: false } })),
          apiClient.get('/pawning/ltv/alerts').catch(() => ({ data: { success: false } })),
          apiClient.get('/pawning/dashboard/overdue').catch(() => ({ data: { success: false } })),
          apiClient.get('/pawning/dashboard/maturing', { params: { days: 7 } }).catch(() => ({ data: { success: false } })),
        ]);

        if (statsRes.data?.success) {
          setStats(statsRes.data.data);
        }

        if (alertsRes.data?.success && Array.isArray(alertsRes.data.data)) {
          setLtvAlerts(alertsRes.data.data);
        }

        if (overdueRes.data?.success && Array.isArray(overdueRes.data.data)) {
          setOverdueLoans(overdueRes.data.data);
        }

        if (maturingRes.data?.success && Array.isArray(maturingRes.data.data)) {
          setMaturingLoans(maturingRes.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch pawning dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gold Pawning Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage gold pawning loans, LTV monitoring, and collections</p>
        </div>
        <Link href="/loans/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Loan Application
          </Button>
        </Link>
      </div>

      {/* Error Banner */}
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </Card>
      )}

      {/* Stats Row - 4 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Loans</p>
              <p className="text-2xl font-bold mt-1">
                {loading ? '...' : stats?.activeLoans ?? 0}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                of {loading ? '...' : stats?.totalLoans ?? 0} total
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Coins className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Outstanding</p>
              <p className="text-2xl font-bold mt-1">
                {loading ? '...' : formatCurrency(stats?.totalOutstanding ?? 0)}
              </p>
            </div>
            <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pledged Gold</p>
              <p className="text-2xl font-bold mt-1">
                {loading ? '...' : `${(stats?.totalPledgedGoldWeight ?? 0).toFixed(2)}g`}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {loading ? '' : formatCurrency(stats?.totalPledgedGoldValue ?? 0)}
              </p>
            </div>
            <div className="h-12 w-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <Scale className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Average LTV</p>
              <p className={`text-2xl font-bold mt-1 ${loading ? '' : getLtvColor(stats?.averageLtv ?? 0)}`}>
                {loading ? '...' : `${(stats?.averageLtv ?? 0).toFixed(1)}%`}
              </p>
              {!loading && (stats?.ltvBreachCount ?? 0) > 0 && (
                <p className="text-xs text-red-500 mt-1">
                  {stats?.ltvBreachCount} breach{(stats?.ltvBreachCount ?? 0) !== 1 ? 'es' : ''}
                </p>
              )}
            </div>
            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${loading ? 'bg-gray-100' : getLtvBgColor(stats?.averageLtv ?? 0)}`}>
              <Gauge className={`h-6 w-6 ${loading ? 'text-gray-400' : getLtvColor(stats?.averageLtv ?? 0)}`} />
            </div>
          </div>
        </Card>
      </div>

      {/* Summary Row - 3 cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Disbursed</p>
              <p className="text-lg font-semibold mt-1">
                {loading ? '...' : formatCurrency(stats?.totalDisbursed ?? 0)}
              </p>
            </div>
            <Banknote className="h-6 w-6 text-gray-400" />
          </div>
        </Card>

        <Card className={`p-5 ${!loading && (stats?.overdueLoans ?? 0) > 0 ? 'border-red-200 bg-red-50' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Overdue Loans</p>
              <p className={`text-lg font-semibold mt-1 ${!loading && (stats?.overdueLoans ?? 0) > 0 ? 'text-red-600' : ''}`}>
                {loading ? '...' : stats?.overdueLoans ?? 0}
              </p>
            </div>
            <AlertCircle className={`h-6 w-6 ${!loading && (stats?.overdueLoans ?? 0) > 0 ? 'text-red-600' : 'text-gray-400'}`} />
          </div>
        </Card>

        <Card className={`p-5 ${!loading && (stats?.marginCallLoans ?? 0) > 0 ? 'border-orange-200 bg-orange-50' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Margin Call Loans</p>
              <p className={`text-lg font-semibold mt-1 ${!loading && (stats?.marginCallLoans ?? 0) > 0 ? 'text-orange-600' : ''}`}>
                {loading ? '...' : stats?.marginCallLoans ?? 0}
              </p>
            </div>
            <AlertTriangle className={`h-6 w-6 ${!loading && (stats?.marginCallLoans ?? 0) > 0 ? 'text-orange-600' : 'text-gray-400'}`} />
          </div>
        </Card>
      </div>

      {/* LTV Alerts Section */}
      {!loading && ltvAlerts.length > 0 && (
        <Card className="p-6 border-red-200">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold text-red-900">LTV Alerts</h2>
            <Badge className="bg-red-100 text-red-700 ml-2">{ltvAlerts.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-3 font-medium text-gray-600">Loan #</th>
                  <th className="text-left p-3 font-medium text-gray-600">Customer</th>
                  <th className="text-right p-3 font-medium text-gray-600">Loan Amount</th>
                  <th className="text-right p-3 font-medium text-gray-600">Current LTV</th>
                  <th className="text-center p-3 font-medium text-gray-600">Status</th>
                  <th className="text-center p-3 font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {ltvAlerts.map((alert) => (
                  <tr key={alert.loan.id} className="border-b hover:bg-gray-50 transition">
                    <td className="p-3 font-medium">{alert.loan.loanNumber}</td>
                    <td className="p-3">
                      <div>
                        <p>{alert.customer.firstName} {alert.customer.lastName}</p>
                        <p className="text-xs text-gray-400">{alert.customer.phone}</p>
                      </div>
                    </td>
                    <td className="p-3 text-right">{formatCurrency(alert.loan.loanAmount)}</td>
                    <td className={`p-3 text-right font-semibold ${getLtvColor(alert.loan.currentLtv)}`}>
                      {alert.loan.currentLtv.toFixed(1)}%
                    </td>
                    <td className="p-3 text-center">
                      {alert.loan.ltvStatus === 'breach' ? (
                        <Badge className="bg-red-100 text-red-700">Breach</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700">Warning</Badge>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <Link href={`/loans/${alert.loan.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Two-column layout: Overdue Loans & Maturing Soon */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue Loans */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-semibold">Overdue Loans</h2>
            </div>
            {overdueLoans.length > 0 && (
              <Badge className="bg-red-100 text-red-700">{overdueLoans.length}</Badge>
            )}
          </div>
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : overdueLoans.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No overdue loans</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {overdueLoans.map((item) => (
                <div key={item.loan.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.loan.loanNumber}</p>
                    <p className="text-xs text-gray-600 truncate">
                      {item.customer.firstName} {item.customer.lastName}
                    </p>
                    <p className="text-xs text-red-500 mt-1">
                      <CalendarDays className="h-3 w-3 inline mr-1" />
                      Due: {formatDate(item.loan.maturityDate)}
                    </p>
                  </div>
                  <div className="text-right ml-3">
                    <p className="font-semibold text-sm">
                      {formatCurrency(item.loan.outstandingAmount ?? item.loan.loanAmount)}
                    </p>
                    <Link href={`/loans/${item.loan.id}`}>
                      <Button variant="ghost" size="sm" className="mt-1 text-red-600 hover:text-red-700">
                        View <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Maturing Soon */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold">Maturing Soon (7 Days)</h2>
            </div>
            {maturingLoans.length > 0 && (
              <Badge className="bg-amber-100 text-amber-700">{maturingLoans.length}</Badge>
            )}
          </div>
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : maturingLoans.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No loans maturing in the next 7 days</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {maturingLoans.map((item) => (
                <div key={item.loan.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.loan.loanNumber}</p>
                    <p className="text-xs text-gray-600 truncate">
                      {item.customer.firstName} {item.customer.lastName}
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      <CalendarDays className="h-3 w-3 inline mr-1" />
                      Matures: {formatDate(item.loan.maturityDate)}
                    </p>
                  </div>
                  <div className="text-right ml-3">
                    <p className="font-semibold text-sm">
                      {formatCurrency(item.loan.outstandingAmount ?? item.loan.loanAmount)}
                    </p>
                    <Link href={`/loans/${item.loan.id}`}>
                      <Button variant="ghost" size="sm" className="mt-1 text-amber-600 hover:text-amber-700">
                        View <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions Row */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/loans/kyc">
            <Card className="p-5 hover:bg-gray-50 cursor-pointer transition hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">KYC Verification</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Customer identity checks</p>
                </div>
              </div>
            </Card>
          </Link>

          <Link href="/loans/margin-calls">
            <Card className="p-5 hover:bg-gray-50 cursor-pointer transition hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Margin Calls</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Manage LTV breaches</p>
                </div>
              </div>
            </Card>
          </Link>

          <Link href="/loans/auctions">
            <Card className="p-5 hover:bg-gray-50 cursor-pointer transition hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Gavel className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Auctions</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Defaulted loan auctions</p>
                </div>
              </div>
            </Card>
          </Link>

          <Link href="/loans/interest-rates">
            <Card className="p-5 hover:bg-gray-50 cursor-pointer transition hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Settings className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Interest Rate Config</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Rate slabs and policies</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
