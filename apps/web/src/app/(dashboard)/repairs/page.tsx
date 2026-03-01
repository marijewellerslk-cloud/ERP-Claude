'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Wrench,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  Search,
  Filter,
  ChevronRight,
  Phone,
  User,
  Calendar,
  DollarSign,
  Package,
  RefreshCcw,
} from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface Repair {
  id: string;
  repairNumber: string;
  repairType: string;
  status: string;
  priority: string;
  itemDescription: string;
  metalType?: string;
  purity?: string;
  problemDescription: string;
  estimatedCost?: string;
  finalCost?: string;
  expectedCompletionDate?: string;
  createdAt: string;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  stages?: Array<{
    stageName: string;
    status: string;
    stageOrder: number;
  }>;
}

interface Statistics {
  total: number;
  pending: number;
  inProgress: number;
  ready: number;
  completed: number;
  overdue: number;
  byStatus: Record<string, number>;
}

const statusColors: Record<string, string> = {
  received: 'bg-blue-100 text-blue-800',
  assessment: 'bg-purple-100 text-purple-800',
  quoted: 'bg-indigo-100 text-indigo-800',
  approved: 'bg-cyan-100 text-cyan-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  quality_check: 'bg-orange-100 text-orange-800',
  ready: 'bg-green-100 text-green-800',
  delivered: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const repairTypeLabels: Record<string, string> = {
  repair: 'General Repair',
  resize: 'Resizing',
  repolish: 'Repolishing',
  cleaning: 'Cleaning',
  stone_replacement: 'Stone Replacement',
  chain_repair: 'Chain Repair',
  clasp_repair: 'Clasp Repair',
  engraving: 'Engraving',
  other: 'Other',
};

export default function RepairsPage() {
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    fetchRepairs();
    fetchStatistics();
  }, [statusFilter]);

  const fetchRepairs = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await apiClient.get(`/repairs?${params.toString()}`);
      if (response.data.success) {
        setRepairs(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch repairs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await apiClient.get('/repairs/statistics');
      if (response.data.success) {
        setStatistics(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    }
  };

  const handleSearch = () => {
    setLoading(true);
    fetchRepairs();
  };

  const formatCurrency = (amount: string | number | undefined) => {
    if (!amount) return 'N/A';
    return `Rs. ${parseFloat(amount.toString()).toLocaleString('en-LK')}`;
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-LK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getCurrentStage = (stages: Repair['stages']) => {
    if (!stages || stages.length === 0) return null;
    return stages.find((s) => s.status === 'current') || stages[stages.length - 1];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Repairs & Exchange</h1>
          <p className="text-gray-500 mt-1">Manage jewelry repairs, resizing, and exchange requests</p>
        </div>
        <Link href="/repairs/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Repair Request
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold mt-1">{statistics?.total || 0}</p>
            </div>
            <Wrench className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold mt-1">{statistics?.pending || 0}</p>
            </div>
            <Clock className="h-8 w-8 text-purple-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">In Progress</p>
              <p className="text-2xl font-bold mt-1">{statistics?.inProgress || 0}</p>
            </div>
            <RefreshCcw className="h-8 w-8 text-orange-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Ready</p>
              <p className="text-2xl font-bold mt-1">{statistics?.ready || 0}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-2xl font-bold mt-1">{statistics?.completed || 0}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </Card>
      </div>

      {/* Overdue Alert */}
      {statistics && statistics.overdue > 0 && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <div>
              <p className="font-semibold text-red-900">
                {statistics.overdue} repair(s) are overdue!
              </p>
              <p className="text-sm text-red-700">
                Please check and update customers about delays.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto border-red-300 text-red-700 hover:bg-red-100"
              onClick={() => setStatusFilter('in_progress')}
            >
              View Overdue
            </Button>
          </div>
        </Card>
      )}

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by repair number or item description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-md bg-white"
            >
              <option value="">All Status</option>
              <option value="received">Received</option>
              <option value="assessment">Assessment</option>
              <option value="quoted">Quoted</option>
              <option value="approved">Approved</option>
              <option value="in_progress">In Progress</option>
              <option value="quality_check">Quality Check</option>
              <option value="ready">Ready for Pickup</option>
              <option value="delivered">Delivered</option>
            </select>
            <Button onClick={handleSearch}>
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>
      </Card>

      {/* Repairs List */}
      <div className="space-y-4">
        {loading ? (
          <Card className="p-8 text-center">
            <RefreshCcw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-gray-500">Loading repairs...</p>
          </Card>
        ) : repairs.length === 0 ? (
          <Card className="p-8 text-center">
            <Wrench className="h-12 w-12 mx-auto text-gray-300" />
            <p className="mt-2 text-gray-500">No repairs found</p>
            <p className="text-sm text-gray-400">Create a new repair request to get started</p>
            <Link href="/repairs/new">
              <Button className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                New Repair Request
              </Button>
            </Link>
          </Card>
        ) : (
          repairs.map((repair) => (
            <Link key={repair.id} href={`/repairs/${repair.id}`}>
              <Card className="p-4 hover:bg-gray-50 transition cursor-pointer">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left - Main Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono font-semibold text-blue-600">
                        {repair.repairNumber}
                      </span>
                      <Badge className={statusColors[repair.status] || 'bg-gray-100'}>
                        {repair.status.replace('_', ' ')}
                      </Badge>
                      <Badge className={priorityColors[repair.priority] || 'bg-gray-100'}>
                        {repair.priority}
                      </Badge>
                    </div>
                    <p className="font-medium text-gray-900">{repair.itemDescription}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {repairTypeLabels[repair.repairType] || repair.repairType}
                      {repair.metalType && ` • ${repair.metalType}`}
                      {repair.purity && ` ${repair.purity}`}
                    </p>
                  </div>

                  {/* Middle - Customer & Cost */}
                  <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                    {repair.customer && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">
                            {repair.customer.firstName} {repair.customer.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{repair.customer.phone}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium">
                          {formatCurrency(repair.finalCost || repair.estimatedCost)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {repair.finalCost ? 'Final' : 'Estimated'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium">
                          {formatDate(repair.expectedCompletionDate)}
                        </p>
                        <p className="text-xs text-gray-500">Expected</p>
                      </div>
                    </div>
                  </div>

                  {/* Right - Arrow */}
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>

                {/* Progress Bar */}
                {repair.stages && repair.stages.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-1">
                      {repair.stages.map((stage, idx) => (
                        <div
                          key={stage.stageName}
                          className={`flex-1 h-2 rounded ${
                            stage.status === 'completed'
                              ? 'bg-green-500'
                              : stage.status === 'current'
                              ? 'bg-blue-500'
                              : 'bg-gray-200'
                          }`}
                          title={stage.stageName.replace('_', ' ')}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Current: {getCurrentStage(repair.stages)?.stageName.replace('_', ' ')}
                    </p>
                  </div>
                )}
              </Card>
            </Link>
          ))
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="p-4 hover:bg-blue-50 cursor-pointer transition border-blue-200"
          onClick={() => setStatusFilter('received')}
        >
          <Package className="h-6 w-6 text-blue-600 mb-2" />
          <h3 className="font-semibold">New Arrivals</h3>
          <p className="text-sm text-gray-500">Items received, pending assessment</p>
        </Card>

        <Card
          className="p-4 hover:bg-yellow-50 cursor-pointer transition border-yellow-200"
          onClick={() => setStatusFilter('ready')}
        >
          <AlertCircle className="h-6 w-6 text-yellow-600 mb-2" />
          <h3 className="font-semibold">Ready for Pickup</h3>
          <p className="text-sm text-gray-500">Items awaiting customer collection</p>
        </Card>

        <Link href="/repairs/exchange">
          <Card className="p-4 hover:bg-green-50 cursor-pointer transition border-green-200">
            <DollarSign className="h-6 w-6 text-green-600 mb-2" />
            <h3 className="font-semibold">Exchange Valuation</h3>
            <p className="text-sm text-gray-500">Process old gold exchanges</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
