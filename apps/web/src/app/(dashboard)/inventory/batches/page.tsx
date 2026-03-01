'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';

interface Batch {
  id: string;
  batchNumber: string;
  purchaseDate: string;
  expectedTotalItems: number;
  actualTotalItems: number;
  expectedTotalWeight: string;
  actualTotalWeight: string;
  status: string;
  store?: {
    id: string;
    name: string;
    code: string;
  };
  createdByUser: {
    fullName: string;
  };
  batchItems: any[];
}

interface StoreOption {
  id: string;
  name: string;
  code: string;
}

export default function BatchesPage() {
  const router = useRouter();
  const { user, store: currentStore } = useAuthStore();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [allStores, setAllStores] = useState<StoreOption[]>([]);

  const isAdmin = user?.permissions?.includes('*:*') ||
    ['super_admin', 'superadmin', 'owner'].includes(user?.role || '');

  // Fetch stores for filter (admin only)
  useEffect(() => {
    if (isAdmin) {
      const fetchStores = async () => {
        try {
          const response = await apiClient.get('/stores', {
            params: { isActive: 'true' },
          });
          if (response.data.success) {
            setAllStores(response.data.data);
          }
        } catch (err) {
          console.error('Failed to fetch stores:', err);
        }
      };
      fetchStores();
    }
  }, [isAdmin]);

  const fetchBatches = async () => {
    try {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (isAdmin) {
        params.includeChildStores = 'true';
        if (storeFilter !== 'all') params.filterStoreId = storeFilter;
      }
      const response = await apiClient.get('/inventory/batches', { params });

      if (response.data.success) {
        setBatches(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch batches:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [statusFilter, storeFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'discrepancy':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'discrepancy':
        return 'Discrepancy';
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-600">Loading batches...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Batches</h1>
          <p className="text-gray-600 mt-1">Manage batch-based inventory entry</p>
        </div>
        <Button onClick={() => router.push('/inventory/batches/new')}>
          + Create New Batch
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Status Filters */}
        <div className="flex gap-2">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            All
          </Button>
          <Button
            variant={statusFilter === 'in_progress' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('in_progress')}
          >
            In Progress
          </Button>
          <Button
            variant={statusFilter === 'completed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('completed')}
          >
            Completed
          </Button>
          <Button
            variant={statusFilter === 'discrepancy' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('discrepancy')}
          >
            Discrepancy
          </Button>
        </div>

        {/* Branch Filter (admin only) */}
        {isAdmin && allStores.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Branch:</span>
            <Select
              value={storeFilter}
              onValueChange={setStoreFilter}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {allStores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Batches Grid */}
      {batches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600 mb-4">No batches found</p>
            <Button onClick={() => router.push('/inventory/batches/new')}>
              Create Your First Batch
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {batches.map((batch) => (
            <Card
              key={batch.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/inventory/batches/${batch.id}`)}
            >
              <CardContent className="pt-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900">
                      {batch.batchNumber}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {new Date(batch.purchaseDate).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${getStatusColor(batch.status)}`}
                  >
                    {getStatusLabel(batch.status)}
                  </span>
                </div>

                {/* Branch Label */}
                {batch.store && (
                  <div className="mb-3">
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                      {batch.store.name}
                    </span>
                  </div>
                )}

                {/* Stats */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Items:</span>
                    <span className="font-medium">
                      {batch.actualTotalItems}/{batch.expectedTotalItems}
                      {batch.actualTotalItems === batch.expectedTotalItems && ' ✓'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Weight:</span>
                    <span className="font-medium">
                      {parseFloat(batch.actualTotalWeight).toFixed(3)}g /
                      {parseFloat(batch.expectedTotalWeight).toFixed(3)}g
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Created by:</span>
                    <span className="font-medium">{batch.createdByUser.fullName}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                {batch.status === 'in_progress' && (
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${(batch.actualTotalItems / batch.expectedTotalItems) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {batch.expectedTotalItems - batch.actualTotalItems} items remaining
                    </p>
                  </div>
                )}

                {/* Action Button */}
                {batch.status === 'in_progress' && (
                  <div className="mt-4">
                    <Button size="sm" className="w-full">
                      Continue Adding Items
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
