'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Eye, Scale, Hammer, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';

interface JobCard {
  id: string;
  jobNumber: string;
  status: string;
  metalIssued: string;
  metalPurity: string | null;
  finishedWeight: string | null;
  scrapReturned: string | null;
  actualWastage: string | null;
  labourCharge: string | null;
  labourPaid: string | null;
  issueDate: string;
  returnDate: string | null;
  createdAt: string;
  karigar?: {
    id: string;
    name: string;
    code: string;
  } | null;
  customOrder?: {
    id: string;
    orderNumber: string;
  } | null;
}

interface JobCardStats {
  totalJobCards: number;
  issuedCards: number;
  inProgressCards: number;
  returnedCards: number;
  settledCards: number;
  totalMetalIssued: number;
  totalMetalReturned: number;
}

export default function JobCardsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [stats, setStats] = useState<JobCardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchJobCards();
    fetchStats();
  }, [searchTerm, statusFilter]);

  const fetchJobCards = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/job-cards', {
        params: {
          search: searchTerm || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          limit: 100,
        },
      });

      if (response.data.success) {
        setJobCards(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load job cards');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/job-cards/statistics');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      // Stats are optional
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      issued: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      returned: 'bg-purple-100 text-purple-800',
      settled: 'bg-green-100 text-green-800',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Job Cards</h1>
          <p className="text-gray-500 mt-1">Track metal issued to karigars and returns</p>
        </div>
        <Link href="/job-cards/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Job Card
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold">{stats.totalJobCards}</p>
            </div>
          </Card>
          <Card className="p-4 border-yellow-200 bg-yellow-50">
            <div className="text-center">
              <p className="text-sm text-yellow-700">Issued</p>
              <p className="text-2xl font-bold text-yellow-700">{stats.issuedCards}</p>
            </div>
          </Card>
          <Card className="p-4 border-blue-200 bg-blue-50">
            <div className="text-center">
              <p className="text-sm text-blue-700">In Progress</p>
              <p className="text-2xl font-bold text-blue-700">{stats.inProgressCards}</p>
            </div>
          </Card>
          <Card className="p-4 border-purple-200 bg-purple-50">
            <div className="text-center">
              <p className="text-sm text-purple-700">Returned</p>
              <p className="text-2xl font-bold text-purple-700">{stats.returnedCards}</p>
            </div>
          </Card>
          <Card className="p-4 border-green-200 bg-green-50">
            <div className="text-center">
              <p className="text-sm text-green-700">Settled</p>
              <p className="text-2xl font-bold text-green-700">{stats.settledCards}</p>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">Metal Issued</p>
              <p className="text-xl font-bold text-amber-600">{stats.totalMetalIssued.toFixed(3)}g</p>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">Metal Returned</p>
              <p className="text-xl font-bold text-green-600">{stats.totalMetalReturned.toFixed(3)}g</p>
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
              placeholder="Search job cards by number or karigar..."
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
            <option value="issued">Issued</option>
            <option value="in_progress">In Progress</option>
            <option value="returned">Returned</option>
            <option value="settled">Settled</option>
          </select>
        </div>
      </Card>

      {/* Job Cards Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Karigar
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Issue Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Metal Issued
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Returned
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Wastage
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Labour
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
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    Loading job cards...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-red-500">
                    {error}
                  </td>
                </tr>
              ) : jobCards.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    No job cards found. Click "New Job Card" to create one.
                  </td>
                </tr>
              ) : (
                jobCards.map((job) => {
                  const totalReturned = (job.finishedWeight ? parseFloat(job.finishedWeight) : 0) +
                    (job.scrapReturned ? parseFloat(job.scrapReturned) : 0);

                  return (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/job-cards/${job.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          {job.jobNumber}
                        </Link>
                        {job.customOrder && (
                          <p className="text-xs text-gray-400 mt-1">
                            Order: {job.customOrder.orderNumber}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {job.karigar ? (
                          <Link
                            href={`/karigars/${job.karigar.id}`}
                            className="text-sm text-gray-900 hover:text-blue-600"
                          >
                            {job.karigar.name}
                            <span className="text-gray-400 ml-1">({job.karigar.code})</span>
                          </Link>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(job.issueDate || job.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span className="text-amber-600 font-medium">
                          {parseFloat(job.metalIssued).toFixed(3)}g
                        </span>
                        {job.metalPurity && (
                          <span className="text-gray-400 ml-1">({job.metalPurity})</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {totalReturned > 0 ? (
                          <span className="text-green-600">
                            {totalReturned.toFixed(3)}g
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {job.actualWastage ? (
                          <span className="text-red-600">
                            {parseFloat(job.actualWastage).toFixed(3)}g
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {job.labourCharge ? (
                          <div>
                            <span className="text-blue-600 font-medium">
                              {formatCurrency(parseFloat(job.labourCharge))}
                            </span>
                            {job.labourPaid && parseFloat(job.labourPaid) > 0 && (
                              <p className="text-xs text-green-600">
                                Paid: {formatCurrency(parseFloat(job.labourPaid))}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <Badge className={getStatusBadge(job.status)}>
                          {formatStatus(job.status)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link href={`/job-cards/${job.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
