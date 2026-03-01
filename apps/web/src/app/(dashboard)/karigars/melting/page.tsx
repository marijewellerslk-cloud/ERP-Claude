'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Flame,
  Scale,
  Eye,
  CheckCircle,
  Clock,
  TrendingUp,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';

interface MeltingRecord {
  id: string;
  meltingNumber: string;
  meltingDate: string;
  inputWeight: string;
  inputPurity: string | null;
  inputFineGold: string | null;
  outputWeight: string | null;
  outputPurity: string | null;
  outputFineGold: string | null;
  recoveryPercentage: string | null;
  meltingLoss: string | null;
  meltingLossPercentage: string | null;
  refiningCost: string | null;
  refinerName: string | null;
  status: string;
  completedAt: string | null;
}

interface MeltingStats {
  pending: number;
  completed: {
    count: number;
    totalInput: number;
    totalOutput: number;
    totalCost: number;
    avgRecovery: number;
  };
}

export default function MeltingRecordsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<MeltingRecord[]>([]);
  const [stats, setStats] = useState<MeltingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchRecords();
    fetchStats();
  }, [statusFilter]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/scrap/melting', {
        params: { status: statusFilter !== 'all' ? statusFilter : undefined },
      });
      if (response.data.success) {
        setRecords(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/scrap/melting/statistics');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      // Stats are optional
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/karigars/scrap')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Melting Records</h1>
            <p className="text-gray-500 mt-1">Track scrap melting and recovery</p>
          </div>
        </div>
        <Link href="/karigars/scrap">
          <Button variant="outline">
            <Scale className="h-4 w-4 mr-2" />
            Back to Scrap
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="p-4 border-yellow-200 bg-yellow-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700">Pending</p>
                <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </Card>
          <Card className="p-4 border-green-200 bg-green-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Completed</p>
                <p className="text-2xl font-bold text-green-700">{stats.completed.count}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Input</p>
                <p className="text-2xl font-bold text-amber-600">
                  {stats.completed.totalInput.toFixed(3)}g
                </p>
              </div>
              <Scale className="h-8 w-8 text-amber-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Output</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.completed.totalOutput.toFixed(3)}g
                </p>
              </div>
              <Scale className="h-8 w-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Avg Recovery</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.completed.avgRecovery.toFixed(1)}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Filter */}
      <Card className="p-4">
        <select
          className="px-3 py-2 border rounded-md"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Records Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Melting #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Input
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Output
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Recovery %
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Loss
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Refiner
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    Loading melting records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    No melting records found. Send scrap to melting from the Scrap Inventory page.
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">
                      <Link
                        href={`/karigars/melting/${record.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {record.meltingNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(record.meltingDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-amber-600">
                      {parseFloat(record.inputWeight).toFixed(3)}g
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      {record.outputWeight ? (
                        <span className="font-medium text-green-600">
                          {parseFloat(record.outputWeight).toFixed(3)}g
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      {record.recoveryPercentage ? (
                        <span
                          className={
                            parseFloat(record.recoveryPercentage) >= 95
                              ? 'text-green-600 font-medium'
                              : parseFloat(record.recoveryPercentage) >= 90
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }
                        >
                          {parseFloat(record.recoveryPercentage).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      {record.meltingLoss ? (
                        <span className="text-red-600">
                          {parseFloat(record.meltingLoss).toFixed(4)}g
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {record.refinerName || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge className={getStatusBadge(record.status)}>
                        {record.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/karigars/melting/${record.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          {record.status === 'pending' ? 'Complete' : 'View'}
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
    </div>
  );
}
