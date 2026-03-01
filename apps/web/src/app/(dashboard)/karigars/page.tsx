'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Search, Eye, Phone, Hammer, Scale, Banknote } from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';

interface Karigar {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  specialization: string | null;
  baseLabourRate: string | null;
  goldBalance: string;
  pendingLabour: string;
  status: string;
  createdAt: string;
}

interface KarigarStats {
  totalKarigars: number;
  activeKarigars: number;
  totalGoldWithKarigars: number;
  totalPendingLabour: number;
}

export default function KarigarsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [karigars, setKarigars] = useState<Karigar[]>([]);
  const [stats, setStats] = useState<KarigarStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchKarigars();
    fetchStats();
  }, [searchTerm, statusFilter]);

  const fetchKarigars = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/karigars', {
        params: {
          search: searchTerm || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          limit: 100,
        },
      });

      if (response.data.success) {
        setKarigars(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load karigars');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/karigars/statistics');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      // Stats are optional, don't show error
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Karigars (Artisans)</h1>
          <p className="text-gray-500 mt-1">Manage artisans, track gold balances, and labor payments</p>
        </div>
        <Link href="/karigars/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Karigar
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Karigars</p>
                <p className="text-2xl font-bold">{stats.totalKarigars}</p>
              </div>
              <Hammer className="h-8 w-8 text-amber-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Karigars</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeKarigars}</p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <Hammer className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Gold with Karigars</p>
                <p className="text-2xl font-bold text-amber-600">{stats.totalGoldWithKarigars.toFixed(3)}g</p>
              </div>
              <Scale className="h-8 w-8 text-amber-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending Labour</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.totalPendingLabour)}</p>
              </div>
              <Banknote className="h-8 w-8 text-blue-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Search and Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Search className="h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search karigars by name or code..."
              className="flex-1 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 border rounded-md"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </Card>

      {/* Karigars Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Specialization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gold Balance
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pending Labour
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
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    Loading karigars...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-red-500">
                    {error}
                  </td>
                </tr>
              ) : karigars.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No karigars found. Click "Add Karigar" to get started.
                  </td>
                </tr>
              ) : (
                karigars.map((karigar) => (
                  <tr key={karigar.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {karigar.code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/karigars/${karigar.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        {karigar.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                      {karigar.specialization || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {karigar.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {karigar.phone}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className={parseFloat(karigar.goldBalance) > 0 ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                        {parseFloat(karigar.goldBalance).toFixed(3)}g
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className={parseFloat(karigar.pendingLabour) > 0 ? 'text-blue-600 font-medium' : 'text-gray-500'}>
                        {formatCurrency(parseFloat(karigar.pendingLabour))}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(karigar.status)}`}
                      >
                        {karigar.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link href={`/karigars/${karigar.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
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
    </div>
  );
}
