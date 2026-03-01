'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  DollarSign,
  Percent,
  Coins,
  TrendingUp,
  RefreshCw,
  CreditCard,
  Bell,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  Phone,
  Mail,
  Scale,
  History,
  Loader2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface PledgedGoldItem {
  itemDescription: string;
  grossWeight: number | string;
  netWeight: number | string;
  purity: string;
  goldValue: number | string;
  appraisalValue: number | string;
}

interface Payment {
  amount: number | string;
  paymentType: string;
  paymentDate: string;
  principalAmount: number | string;
  interestAmount: number | string;
}

interface LoanCustomer {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

interface LoanDetail {
  id: string;
  loanNumber: string;
  loanAmount: number | string;
  interestRate: number | string;
  tenure: number | string;
  monthlyEmi: number | string;
  status: string;
  maturityDate: string;
  loanType: string;
  currentLtv: number | string;
  ltvStatus: string;
  totalGoldValue: number | string;
  kycVerified: boolean;
  accruedInterest: number | string;
  outstandingBalance: number | string;
  renewalCount: number;
  applicationDate: string;
  disbursementDate: string;
  customer: LoanCustomer;
  pledgedGoldItems: PledgedGoldItem[];
  payments: Payment[];
}

interface LtvData {
  currentLtv: number | string;
  maxAllowedLtv: number | string;
  ltvStatus: string;
  goldRateUsed: number | string;
  totalGoldValue: number | string;
  outstandingAmount: number | string;
}

interface LtvHistoryEntry {
  calculationDate: string;
  currentLtv: number | string;
  goldRateUsed: number | string;
  totalGoldValue: number | string;
  ltvStatus: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function toNum(v: number | string | undefined | null): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'margin_call':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'closed':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'auction_initiated':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    default:
      return 'bg-blue-100 text-blue-800 border-blue-200';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'margin_call':
      return 'Margin Call';
    case 'closed':
      return 'Closed';
    case 'auction_initiated':
      return 'Auction Initiated';
    default:
      return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function ltvColor(ltv: number): string {
  if (ltv < 70) return 'text-green-600';
  if (ltv <= 80) return 'text-amber-600';
  return 'text-red-600';
}

function ltvBgColor(ltv: number): string {
  if (ltv < 70) return 'bg-green-500';
  if (ltv <= 80) return 'bg-amber-500';
  return 'bg-red-500';
}

function ltvStatusBadgeClass(status: string): string {
  switch (status) {
    case 'safe':
      return 'bg-green-100 text-green-800';
    case 'warning':
      return 'bg-amber-100 text-amber-800';
    case 'critical':
    case 'margin_call':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function LoanDetailPage() {
  const params = useParams();
  const loanId = params.loanId as string;

  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [ltvData, setLtvData] = useState<LtvData | null>(null);
  const [ltvHistory, setLtvHistory] = useState<LtvHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const fetchLoan = useCallback(async () => {
    try {
      const response = await apiClient.get(`/loans/${loanId}`);
      if (response.data.success) {
        setLoan(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load loan details');
    }
  }, [loanId]);

  const fetchLtv = useCallback(async () => {
    try {
      const response = await apiClient.get(`/pawning/ltv/${loanId}`);
      if (response.data.success) {
        setLtvData(response.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch LTV data:', err);
    }
  }, [loanId]);

  const fetchLtvHistory = useCallback(async () => {
    try {
      const response = await apiClient.get(`/pawning/ltv/${loanId}/history`);
      if (response.data.success) {
        setLtvHistory(response.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch LTV history:', err);
    }
  }, [loanId]);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchLoan(), fetchLtv(), fetchLtvHistory()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchLoan, fetchLtv, fetchLtvHistory]);

  const handleRecalculateLtv = async () => {
    setRecalculating(true);
    try {
      const response = await apiClient.post(`/pawning/ltv/${loanId}/recalculate`);
      if (response.data.success) {
        await Promise.all([fetchLtv(), fetchLtvHistory()]);
      }
    } catch (err: any) {
      console.error('Failed to recalculate LTV:', err);
    } finally {
      setRecalculating(false);
    }
  };

  // ── Loading state ──

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-9 w-20 bg-gray-200 rounded animate-pulse" />
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-64 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    );
  }

  // ── Error state ──

  if (error || !loan) {
    return (
      <div className="space-y-6">
        <Link href="/loans" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          Back to Loans
        </Link>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Error Loading Loan</h3>
                <p className="text-sm text-red-700 mt-1">{error || 'Loan not found'}</p>
                <Link href="/loans">
                  <Button variant="outline" size="sm" className="mt-3">
                    Return to Loans
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Derived values ──

  const loanAmount = toNum(loan.loanAmount);
  const outstandingBalance = toNum(loan.outstandingBalance);
  const currentLtv = toNum(ltvData?.currentLtv ?? loan.currentLtv);
  const totalGoldValue = toNum(ltvData?.totalGoldValue ?? loan.totalGoldValue);
  const maxAllowedLtv = toNum(ltvData?.maxAllowedLtv ?? 80);
  const ltvPercent = Math.min(currentLtv, 100);

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/loans">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{loan.loanNumber}</h1>
              <Badge className={statusBadgeClass(loan.status)}>
                {statusLabel(loan.status)}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Gold Loan Details</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/loans/${loanId}/payment`}>
            <Button size="sm">
              <CreditCard className="h-4 w-4 mr-1" />
              Add Payment
            </Button>
          </Link>
          <Link href={`/loans/${loanId}/renew`}>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              Renew Loan
            </Button>
          </Link>
          <Button variant="outline" size="sm">
            <Bell className="h-4 w-4 mr-1" />
            Send Notification
          </Button>
        </div>
      </div>

      {/* ── Key Metrics Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Loan Amount</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(loanAmount)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Outstanding Balance</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(outstandingBalance)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-600" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Current LTV</p>
              <p className={`text-xl font-bold mt-1 ${ltvColor(currentLtv)}`}>
                {currentLtv.toFixed(1)}%
              </p>
            </div>
            <Percent className="h-8 w-8 text-amber-600" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Gold Value</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(totalGoldValue)}</p>
            </div>
            <Coins className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>
      </div>

      {/* ── Loan Details & Customer Info ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Loan Details Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Loan Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
              <div>
                <p className="text-sm text-gray-500">Interest Rate</p>
                <p className="font-medium">{toNum(loan.interestRate)}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tenure</p>
                <p className="font-medium">{loan.tenure} months</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Monthly EMI</p>
                <p className="font-medium">{formatCurrency(loan.monthlyEmi)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Maturity Date</p>
                <p className="font-medium">{formatDate(loan.maturityDate)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Loan Type</p>
                <p className="font-medium capitalize">{loan.loanType?.replace(/_/g, ' ') || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Application Date</p>
                <p className="font-medium">{formatDate(loan.applicationDate)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Disbursement Date</p>
                <p className="font-medium">{formatDate(loan.disbursementDate)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Accrued Interest</p>
                <p className="font-medium">{formatCurrency(loan.accruedInterest)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Renewal Count</p>
                <p className="font-medium">{loan.renewalCount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">KYC Verified</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {loan.kycVerified ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-700">Verified</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="font-medium text-red-600">Not Verified</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-100">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {loan.customer.firstName} {loan.customer.lastName}
                </p>
                <p className="text-xs text-gray-500">Customer</p>
              </div>
            </div>
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">{loan.customer.phone || '-'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">{loan.customer.email || '-'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Pledged Gold Items ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pledged Gold Items</CardTitle>
        </CardHeader>
        <CardContent>
          {loan.pledgedGoldItems && loan.pledgedGoldItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Description</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Gross Weight (g)</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Net Weight (g)</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Purity</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Gold Value</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Appraisal Value</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.pledgedGoldItems.map((item, index) => (
                    <tr key={index} className="border-b last:border-b-0 hover:bg-gray-50">
                      <td className="py-3 px-4">{item.itemDescription}</td>
                      <td className="py-3 px-4 text-right font-mono">
                        {toNum(item.grossWeight).toFixed(3)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {toNum(item.netWeight).toFixed(3)}
                      </td>
                      <td className="py-3 px-4 text-center">{item.purity}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(item.goldValue)}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(item.appraisalValue)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="py-3 px-4" colSpan={2}>Total</td>
                    <td className="py-3 px-4 text-right font-mono">
                      {loan.pledgedGoldItems
                        .reduce((sum, item) => sum + toNum(item.netWeight), 0)
                        .toFixed(3)}
                    </td>
                    <td className="py-3 px-4" />
                    <td className="py-3 px-4 text-right">
                      {formatCurrency(
                        loan.pledgedGoldItems.reduce((sum, item) => sum + toNum(item.goldValue), 0)
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {formatCurrency(
                        loan.pledgedGoldItems.reduce((sum, item) => sum + toNum(item.appraisalValue), 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-4 text-center">No pledged gold items found.</p>
          )}
        </CardContent>
      </Card>

      {/* ── LTV Monitor & LTV History ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LTV Monitor Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-gray-600" />
                LTV Monitor
              </div>
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalculateLtv}
              disabled={recalculating}
            >
              {recalculating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Recalculate LTV
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* LTV Bar Meter */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">
                  Current: <span className={`font-bold ${ltvColor(currentLtv)}`}>{currentLtv.toFixed(1)}%</span>
                </span>
                <span className="text-sm text-gray-600">
                  Max Allowed: <span className="font-bold">{toNum(maxAllowedLtv).toFixed(1)}%</span>
                </span>
              </div>
              <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${ltvBgColor(currentLtv)}`}
                  style={{ width: `${Math.min((ltvPercent / toNum(maxAllowedLtv)) * 100, 100)}%` }}
                />
                {/* Max allowed marker */}
                <div
                  className="absolute top-0 h-full w-0.5 bg-gray-800"
                  style={{ left: '100%' }}
                  title={`Max: ${toNum(maxAllowedLtv).toFixed(1)}%`}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-gray-400">0%</span>
                <span className="text-xs text-gray-400">{toNum(maxAllowedLtv).toFixed(0)}%</span>
              </div>
            </div>

            {/* LTV Status & Details */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <p className="text-sm text-gray-500">LTV Status</p>
                <Badge className={`mt-1 ${ltvStatusBadgeClass(ltvData?.ltvStatus || loan.ltvStatus)}`}>
                  {(ltvData?.ltvStatus || loan.ltvStatus || 'unknown').replace(/_/g, ' ').toUpperCase()}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Gold Rate Used</p>
                <p className="font-medium mt-1">
                  {ltvData?.goldRateUsed ? formatCurrency(ltvData.goldRateUsed) + '/g' : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Gold Value</p>
                <p className="font-medium mt-1">{formatCurrency(totalGoldValue)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Outstanding Amount</p>
                <p className="font-medium mt-1">
                  {ltvData?.outstandingAmount ? formatCurrency(ltvData.outstandingAmount) : formatCurrency(outstandingBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* LTV History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-gray-600" />
                LTV History
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ltvHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-2.5 px-3 font-medium text-gray-600">Date</th>
                      <th className="text-right py-2.5 px-3 font-medium text-gray-600">LTV %</th>
                      <th className="text-right py-2.5 px-3 font-medium text-gray-600">Gold Rate</th>
                      <th className="text-center py-2.5 px-3 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ltvHistory.slice(0, 10).map((entry, index) => {
                      const entryLtv = toNum(entry.currentLtv);
                      return (
                        <tr key={index} className="border-b last:border-b-0 hover:bg-gray-50">
                          <td className="py-2.5 px-3 text-gray-700">
                            {formatDate(entry.calculationDate)}
                          </td>
                          <td className={`py-2.5 px-3 text-right font-mono font-medium ${ltvColor(entryLtv)}`}>
                            {entryLtv.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {formatCurrency(entry.goldRateUsed)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge className={`text-xs ${ltvStatusBadgeClass(entry.ltvStatus)}`}>
                              {entry.ltvStatus?.replace(/_/g, ' ').toUpperCase() || '-'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <Clock className="h-8 w-8 mb-2" />
                <p className="text-sm">No LTV history available yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Payments History ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-gray-600" />
              Payment History
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loan.payments && loan.payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Amount</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Type</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Principal</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Interest</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.payments.map((payment, index) => (
                    <tr key={index} className="border-b last:border-b-0 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-700">{formatDate(payment.paymentDate)}</td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className="capitalize text-xs">
                          {payment.paymentType?.replace(/_/g, ' ') || '-'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">{formatCurrency(payment.principalAmount)}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(payment.interestAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="py-3 px-4">Total</td>
                    <td className="py-3 px-4 text-right">
                      {formatCurrency(
                        loan.payments.reduce((sum, p) => sum + toNum(p.amount), 0)
                      )}
                    </td>
                    <td className="py-3 px-4" />
                    <td className="py-3 px-4 text-right">
                      {formatCurrency(
                        loan.payments.reduce((sum, p) => sum + toNum(p.principalAmount), 0)
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {formatCurrency(
                        loan.payments.reduce((sum, p) => sum + toNum(p.interestAmount), 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <CreditCard className="h-8 w-8 mb-2" />
              <p className="text-sm">No payments recorded yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
