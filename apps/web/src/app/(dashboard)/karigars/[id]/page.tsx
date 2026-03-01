'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Phone,
  Scale,
  Banknote,
  ArrowUpCircle,
  ArrowDownCircle,
  ClipboardList,
  Edit,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';

interface Karigar {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  specialization: string | null;
  baseLabourRate: string | null;
  goldBalance: string;
  pendingLabour: string;
  wastageAllowance: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
}

interface Transaction {
  id: string;
  transactionType: string;
  goldAmount: string | null;
  cashAmount: string | null;
  runningGoldBalance: string;
  runningCashBalance: string;
  notes: string | null;
  createdAt: string;
  jobCard?: {
    id: string;
    jobNumber: string;
  } | null;
}

interface JobCard {
  id: string;
  jobNumber: string;
  status: string;
  metalIssued: string;
  finishedWeight: string | null;
  labourCharge: string | null;
  issueDate: string;
  createdAt: string;
}

export default function KarigarDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [karigar, setKarigar] = useState<Karigar | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ledger' | 'jobs'>('ledger');

  useEffect(() => {
    fetchKarigar();
    fetchJobCards();
  }, [params.id]);

  const fetchKarigar = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/karigars/${params.id}`);
      if (response.data.success) {
        setKarigar(response.data.data.karigar);
        setTransactions(response.data.data.transactions || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load karigar details');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobCards = async () => {
    try {
      const response = await apiClient.get('/job-cards', {
        params: { karigarId: params.id, limit: 50 },
      });
      if (response.data.success) {
        setJobCards(response.data.data);
      }
    } catch (err) {
      // Job cards are optional
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800',
      issued: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      returned: 'bg-purple-100 text-purple-800',
      settled: 'bg-green-100 text-green-800',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'metal_issue':
        return <ArrowUpCircle className="h-5 w-5 text-amber-500" />;
      case 'metal_return':
        return <ArrowDownCircle className="h-5 w-5 text-green-500" />;
      case 'labour_credit':
        return <Banknote className="h-5 w-5 text-blue-500" />;
      case 'payment':
        return <Banknote className="h-5 w-5 text-green-500" />;
      case 'wastage_debit':
        return <Scale className="h-5 w-5 text-red-500" />;
      default:
        return <ClipboardList className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatTransactionType = (type: string) => {
    const typeLabels: Record<string, string> = {
      metal_issue: 'Metal Issued',
      metal_return: 'Metal Returned',
      labour_credit: 'Labour Credited',
      payment: 'Payment Made',
      wastage_debit: 'Wastage Deducted',
      adjustment: 'Adjustment',
    };
    return typeLabels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading karigar details...</div>
      </div>
    );
  }

  if (error || !karigar) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-red-500">{error || 'Karigar not found'}</div>
        <Button variant="outline" onClick={() => router.push('/karigars')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Karigars
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/karigars')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{karigar.name}</h1>
              <Badge className={getStatusBadge(karigar.status)}>{karigar.status}</Badge>
            </div>
            <p className="text-gray-500 mt-1">
              Code: {karigar.code} | Specialization: {karigar.specialization || 'General'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/karigars/${karigar.id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Link href={`/job-cards/new?karigarId=${karigar.id}`}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Job Card
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Gold Balance</p>
              <p className="text-2xl font-bold text-amber-600">
                {parseFloat(karigar.goldBalance).toFixed(3)}g
              </p>
            </div>
            <Scale className="h-8 w-8 text-amber-500" />
          </div>
          <p className="text-xs text-gray-400 mt-2">Gold currently with karigar</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Labour</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(parseFloat(karigar.pendingLabour))}
              </p>
            </div>
            <Banknote className="h-8 w-8 text-blue-500" />
          </div>
          <p className="text-xs text-gray-400 mt-2">Amount owed to karigar</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Base Labour Rate</p>
              <p className="text-2xl font-bold">
                {karigar.baseLabourRate
                  ? formatCurrency(parseFloat(karigar.baseLabourRate))
                  : '-'}
              </p>
            </div>
            <Banknote className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-xs text-gray-400 mt-2">Per gram rate</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Wastage Allowance</p>
              <p className="text-2xl font-bold">
                {karigar.wastageAllowance ? `${karigar.wastageAllowance}%` : '-'}
              </p>
            </div>
            <Scale className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-xs text-gray-400 mt-2">Acceptable loss percentage</p>
        </Card>
      </div>

      {/* Contact Info */}
      {(karigar.phone || karigar.address) && (
        <Card className="p-4">
          <h3 className="font-medium mb-2">Contact Information</h3>
          <div className="flex flex-wrap gap-6 text-sm text-gray-600">
            {karigar.phone && (
              <span className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {karigar.phone}
              </span>
            )}
            {karigar.address && (
              <span>{karigar.address}</span>
            )}
          </div>
          {karigar.notes && (
            <p className="mt-3 text-sm text-gray-500 italic">{karigar.notes}</p>
          )}
        </Card>
      )}

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          <button
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'ledger'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('ledger')}
          >
            Transaction Ledger
          </button>
          <button
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'jobs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('jobs')}
          >
            Job Cards ({jobCards.length})
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'ledger' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reference
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gold (g)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cash
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gold Balance
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cash Balance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No transactions yet. Create a job card to start tracking.
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(txn.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(txn.transactionType)}
                          <span className="text-sm">{formatTransactionType(txn.transactionType)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {txn.jobCard ? (
                          <Link
                            href={`/job-cards/${txn.jobCard.id}`}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {txn.jobCard.jobNumber}
                          </Link>
                        ) : (
                          <span className="text-gray-400">{txn.notes || '-'}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {txn.goldAmount ? (
                          <span
                            className={
                              parseFloat(txn.goldAmount) > 0
                                ? 'text-amber-600'
                                : 'text-green-600'
                            }
                          >
                            {parseFloat(txn.goldAmount) > 0 ? '+' : ''}
                            {parseFloat(txn.goldAmount).toFixed(3)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {txn.cashAmount ? (
                          <span
                            className={
                              parseFloat(txn.cashAmount) > 0
                                ? 'text-blue-600'
                                : 'text-green-600'
                            }
                          >
                            {parseFloat(txn.cashAmount) > 0 ? '+' : ''}
                            {formatCurrency(parseFloat(txn.cashAmount))}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                        {parseFloat(txn.runningGoldBalance).toFixed(3)}g
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                        {formatCurrency(parseFloat(txn.runningCashBalance))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'jobs' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Issue Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Metal Issued
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Finished Weight
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Labour Charge
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
                {jobCards.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No job cards yet. Create one to issue metal to this karigar.
                    </td>
                  </tr>
                ) : (
                  jobCards.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/job-cards/${job.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          {job.jobNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(job.issueDate || job.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-amber-600 font-medium">
                        {parseFloat(job.metalIssued).toFixed(3)}g
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {job.finishedWeight
                          ? `${parseFloat(job.finishedWeight).toFixed(3)}g`
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {job.labourCharge
                          ? formatCurrency(parseFloat(job.labourCharge))
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <Badge className={getStatusBadge(job.status)}>
                          {job.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link href={`/job-cards/${job.id}`}>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
