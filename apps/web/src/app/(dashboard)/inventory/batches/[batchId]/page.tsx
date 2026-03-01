'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Package, Plus, Printer, DollarSign, Trash2, FileText } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { formatWeight } from '@/lib/weight-utils';
import { generateBatchPDF } from '@/lib/batch-pdf-generator';
import { EditBatchDialog } from '@/components/inventory/batches/edit-batch-dialog';

interface BatchItem {
  id: string;
  sequenceNumber: number;
  inventoryItem: {
    id: string;
    sku: string;
    name: string;
    grossWeight: string;
    netWeight: string;
    stoneWeight?: string;
    category?: {
      name: string;
    };
  };
}

interface Batch {
  id: string;
  batchNumber: string;
  purchaseDate: string;
  purchaseType: string;
  expectedTotalItems: number;
  actualTotalItems: number;
  expectedTotalWeight: string;
  actualTotalWeight: string;
  // Monetary purchase fields
  totalCost?: string;
  goldRatePerGram?: string;
  totalPaid?: string;
  outstandingBalance?: string;
  paymentStatus: string;
  // Gold exchange fields
  goldGivenWeight?: string;
  goldGivenPurity?: string;
  goldGivenValue?: string;
  goldBalancePaid?: string;
  goldBalanceReceived?: string;
  goldExchangeStatus?: string;
  // Common fields
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  batchItems?: BatchItem[];
  supplier?: {
    businessName: string;
    contactPerson?: string;
    phone?: string;
  };
  store?: {
    name: string;
  };
  createdByUser?: {
    fullName: string;
  };
}

export default function BatchDetailPage() {
  const router = useRouter();
  const params = useParams();
  const batchId = params.batchId as string;

  const [batch, setBatch] = useState<Batch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBatch();
  }, [batchId]);

  const fetchBatch = async () => {
    try {
      const response = await apiClient.get(`/inventory/batches/${batchId}`);
      if (response.data.success) {
        setBatch(response.data.data);
      }
    } catch (error: any) {
      setError(error.response?.data?.error?.message || 'Failed to load batch');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'discrepancy':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleDeleteBatch = async () => {
    if (!batch) return;

    // Only allow deletion of in_progress batches
    if (batch.status !== 'in_progress') {
      alert('Only incomplete batches can be deleted. Completed batches cannot be removed.');
      return;
    }

    const reason = prompt(
      'Please provide a reason for deleting this batch:\n\n' +
      `Batch: ${batch.batchNumber}\n` +
      `Items: ${batch.actualTotalItems}/${batch.expectedTotalItems}\n` +
      `Weight: ${batch.actualTotalWeight}g/${batch.expectedTotalWeight}g`
    );

    if (!reason || reason.trim().length === 0) {
      alert('Deletion cancelled. A reason is required to delete a batch.');
      return;
    }

    const confirmDelete = confirm(
      `Are you sure you want to delete batch ${batch.batchNumber}?\n\n` +
      `This will permanently delete:\n` +
      `• ${batch.actualTotalItems} items in this batch\n` +
      `• All batch data and history\n\n` +
      `Reason: ${reason}\n\n` +
      `This action CANNOT be undone!`
    );

    if (!confirmDelete) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiClient.delete(`/inventory/batches/${batchId}`, {
        data: { reason },
      });

      if (response.data.success) {
        alert('Batch deleted successfully');
        router.push('/inventory/batches');
      }
    } catch (error: any) {
      alert(error.response?.data?.error?.message || 'Failed to delete batch');
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="lg:col-span-2 h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Batch not found'}</p>
          <Button onClick={() => router.back()} className="mt-4" variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{batch.batchNumber}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Created {new Date(batch.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {batch.status === 'in_progress' && (
            <>

              <Button onClick={() => router.push(`/inventory/batches/${batchId}/add-items`)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Items
              </Button>
              <EditBatchDialog
                batchId={batchId}
                initialValues={{
                  expectedTotalWeight: batch.expectedTotalWeight,
                  expectedTotalItems: batch.expectedTotalItems,
                  notes: batch.notes,
                }}
                onSuccess={fetchBatch}
              />
              <Button
                variant="outline"
                onClick={handleDeleteBatch}
                className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Batch
              </Button>
            </>
          )}
          {batch.batchItems && batch.batchItems.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => router.push(`/inventory/batches/${batchId}/labels`)}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Labels
              </Button>
              <Button
                variant="outline"
                onClick={() => generateBatchPDF(batch)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Summary */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Batch Status</p>
                <span className={`inline-flex px-2 py-1 rounded text-sm font-medium capitalize ${getStatusColor(batch.status)}`}>
                  {batch.status.replace('_', ' ')}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Status</p>
                <span className={`inline-flex px-2 py-1 rounded text-sm font-medium capitalize ${getPaymentStatusColor(batch.paymentStatus)}`}>
                  {batch.paymentStatus}
                </span>
              </div>
              {batch.completedAt && (
                <div>
                  <p className="text-sm text-gray-600">Completed At</p>
                  <p className="font-medium">{new Date(batch.completedAt).toLocaleString()}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Progress Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-600">Items</span>
                  <span className="text-sm font-medium">
                    {batch.actualTotalItems} / {batch.expectedTotalItems}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${Math.min((batch.actualTotalItems / batch.expectedTotalItems) * 100, 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-600">Weight</span>
                  <span className="text-sm font-medium">
                    {parseFloat(batch.actualTotalWeight).toFixed(3)}g /{' '}
                    {parseFloat(batch.expectedTotalWeight).toFixed(3)}g
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${Math.min((parseFloat(batch.actualTotalWeight) / parseFloat(batch.expectedTotalWeight)) * 100, 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Summary */}
          {batch.totalCost && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {batch.goldRatePerGram && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Gold Rate/gram:</span>
                    <span className="font-medium">Rs {parseFloat(batch.goldRatePerGram).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Cost:</span>
                  <span className="font-medium text-lg">Rs {parseFloat(batch.totalCost).toLocaleString()}</span>
                </div>
                {batch.totalPaid && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Paid:</span>
                    <span className="font-medium text-green-600">Rs {parseFloat(batch.totalPaid).toLocaleString()}</span>
                  </div>
                )}
                {batch.outstandingBalance && parseFloat(batch.outstandingBalance) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Outstanding:</span>
                    <span className="font-medium text-red-600">Rs {parseFloat(batch.outstandingBalance).toLocaleString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Items List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Batch Items ({batch.batchItems?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {batch.batchItems && batch.batchItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gross Wt</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Wt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {batch.batchItems.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => router.push(`/inventory/items/${item.inventoryItem.id}`)}
                        >
                          <td className="px-4 py-3 text-sm">{item.sequenceNumber}</td>
                          <td className="px-4 py-3 text-sm font-mono">{item.inventoryItem.sku}</td>
                          <td className="px-4 py-3 text-sm font-medium">{item.inventoryItem.name}</td>
                          <td className="px-4 py-3 text-sm">{item.inventoryItem.category?.name || '-'}</td>
                          <td className="px-4 py-3 text-sm">{parseFloat(item.inventoryItem.grossWeight).toFixed(3)}g</td>
                          <td className="px-4 py-3 text-sm">{parseFloat(item.inventoryItem.netWeight).toFixed(3)}g</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No items added yet</p>
                  {batch.status === 'in_progress' && (
                    <Button
                      className="mt-4"
                      onClick={() => router.push(`/inventory/batches/${batchId}/add-items`)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Items
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {batch.notes && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{batch.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
