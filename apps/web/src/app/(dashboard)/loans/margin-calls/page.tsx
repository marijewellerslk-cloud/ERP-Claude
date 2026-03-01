'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import {
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  TrendingUp,
  Phone,
} from 'lucide-react';

interface MarginCallEntry {
  marginCall: {
    id: string;
    ltvAtCall: number | string;
    requiredAction: string;
    additionalCollateralNeeded: number | string | null;
    partialRepaymentNeeded: number | string | null;
    deadline: string;
    status: string;
    createdAt: string;
    resolvedAt: string | null;
  };
  loan: {
    id: string;
    loanNumber: string;
    loanAmount: number | string;
    outstandingBalance: number | string;
    currentLtv: number | string;
  };
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
  };
}

type FilterTab = 'all' | 'pending' | 'resolved';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  const day = date.getDate().toString().padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function toNum(val: number | string | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return typeof val === 'string' ? parseFloat(val) || 0 : val;
}

function getStatusBadge(status: string) {
  switch (status.toLowerCase()) {
    case 'pending':
      return <Badge className="bg-red-100 text-red-800 border-red-200">Pending</Badge>;
    case 'resolved':
    case 'complied':
      return <Badge className="bg-green-100 text-green-800 border-green-200">Resolved</Badge>;
    case 'escalated':
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Escalated</Badge>;
    case 'expired':
      return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Expired</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getLtvColor(ltv: number): string {
  if (ltv >= 80) return 'text-red-600';
  if (ltv >= 65) return 'text-amber-600';
  return 'text-green-600';
}

export default function MarginCallsPage() {
  const [calls, setCalls] = useState<MarginCallEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetchMarginCalls();
  }, []);

  const fetchMarginCalls = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/pawning/margin-calls');
      if (response.data.success) {
        setCalls(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch margin calls:', err);
      setError('Failed to load margin calls. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAll = async () => {
    setChecking(true);
    try {
      const response = await apiClient.post('/pawning/margin-calls/check-all');
      if (response.data.success) {
        await fetchMarginCalls();
      }
    } catch (err) {
      console.error('Failed to check margin calls:', err);
    } finally {
      setChecking(false);
    }
  };

  const filteredCalls = calls.filter((entry) => {
    const status = entry.marginCall.status.toLowerCase();
    const matchesTab =
      activeTab === 'all' ||
      (activeTab === 'pending' && (status === 'pending' || status === 'escalated')) ||
      (activeTab === 'resolved' && (status === 'resolved' || status === 'complied'));

    const matchesSearch =
      !searchQuery ||
      entry.loan.loanNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${entry.customer.firstName} ${entry.customer.lastName}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      entry.customer.phone.includes(searchQuery);

    return matchesTab && matchesSearch;
  });

  const stats = {
    total: calls.length,
    pending: calls.filter((e) => e.marginCall.status.toLowerCase() === 'pending').length,
    escalated: calls.filter((e) => e.marginCall.status.toLowerCase() === 'escalated').length,
    resolved: calls.filter((e) => ['resolved', 'complied'].includes(e.marginCall.status.toLowerCase())).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Margin Calls</h1>
          <p className="text-gray-500 mt-1">Monitor and manage LTV breach notifications</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchMarginCalls}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleCheckAll} disabled={checking}>
            {checking ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4 mr-2" />
            )}
            Check All Loans
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </Card>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Calls</p>
              <p className="text-2xl font-bold mt-1">{stats.total}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
        <Card className="p-6 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold mt-1 text-red-600">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-red-600" />
          </div>
        </Card>
        <Card className="p-6 border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Escalated</p>
              <p className="text-2xl font-bold mt-1 text-amber-600">{stats.escalated}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-amber-600" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Resolved</p>
              <p className="text-2xl font-bold mt-1 text-green-600">{stats.resolved}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
        </Card>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'pending', 'resolved'] as FilterTab[]).map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'pending' && stats.pending > 0 && (
                <Badge className="ml-2 bg-red-500 text-white">{stats.pending}</Badge>
              )}
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by loan number, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Margin Calls Table */}
      {filteredCalls.length === 0 ? (
        <Card className="p-12 text-center">
          <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {activeTab === 'pending' ? 'No pending margin calls' : 'No margin calls found'}
          </p>
        </Card>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Loan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    LTV at Call
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Required Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deadline
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCalls.map((entry) => {
                  const ltvAtCall = toNum(entry.marginCall.ltvAtCall);
                  const additionalCollateral = toNum(entry.marginCall.additionalCollateralNeeded);
                  const partialRepayment = toNum(entry.marginCall.partialRepaymentNeeded);
                  const isOverdue =
                    new Date(entry.marginCall.deadline) < new Date() &&
                    entry.marginCall.status.toLowerCase() === 'pending';

                  return (
                    <tr key={entry.marginCall.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {entry.loan.loanNumber}
                        </div>
                        <div className="text-xs text-gray-500">
                          Outstanding: {formatCurrency(entry.loan.outstandingBalance)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {entry.customer.firstName} {entry.customer.lastName}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {entry.customer.phone}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`text-sm font-bold ${getLtvColor(ltvAtCall)}`}>
                          {ltvAtCall.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs">
                          {entry.marginCall.requiredAction || 'Additional collateral or partial repayment'}
                        </div>
                        {additionalCollateral > 0 && (
                          <div className="text-xs text-blue-600 mt-1">
                            Collateral needed: {formatCurrency(additionalCollateral)}
                          </div>
                        )}
                        {partialRepayment > 0 && (
                          <div className="text-xs text-purple-600 mt-1">
                            Repayment needed: {formatCurrency(partialRepayment)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(entry.marginCall.deadline)}
                        </div>
                        {isOverdue && (
                          <span className="text-xs text-red-600 font-semibold">Overdue</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {getStatusBadge(entry.marginCall.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link href={`/loans/${entry.loan.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
