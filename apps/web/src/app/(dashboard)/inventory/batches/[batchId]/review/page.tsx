'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Check, AlertTriangle, Edit2, Save, X, Trash2 } from 'lucide-react';
import { EditBatchDialog } from '@/components/inventory/batches/edit-batch-dialog';

interface BatchItem {
  id: string;
  sku: string;
  name: string;
  grossWeight: string;
  netWeight: string;
  stoneWeight: string;
  itemType: string;
}

interface BatchSummary {
  expectedItems: number;
  actualItems: number;
  itemsMatch: boolean;
  itemsRemaining: number;
  expectedWeight: number;
  actualWeight: number;
  weightDifference: number;
  weightMatch: boolean;
  canComplete: boolean;
  status: string;
}

interface Batch {
  id: string;
  batchNumber: string;
  expectedTotalItems: number;
  actualTotalItems: number;
  expectedTotalWeight: string;
  actualTotalWeight: string;
  status: string;
  notes?: string;
  batchItems?: Array<{
    inventoryItem: BatchItem;
  }>;
}

export default function BatchReviewPage() {
  const router = useRouter();
  const params = useParams();
  const batchId = params.batchId as string;

  const [batch, setBatch] = useState<Batch | null>(null);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    grossWeight: string;
    netWeight: string;
    stoneWeight: string;
  }>({ grossWeight: '', netWeight: '', stoneWeight: '' });
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchBatchData();
  }, [batchId]);

  const fetchBatchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [batchResponse, summaryResponse] = await Promise.all([
        apiClient.get(`/inventory/batches/${batchId}`),
        apiClient.get(`/inventory/batches/${batchId}/summary`),
      ]);

      if (batchResponse.data.success && summaryResponse.data.success) {
        setBatch(batchResponse.data.data);
        setSummary(summaryResponse.data.data);
      } else {
        throw new Error('Failed to fetch batch data');
      }
    } catch (error: any) {
      console.error('Error fetching batch:', error);
      setError(error.response?.data?.error?.message || 'Failed to load batch data');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (item: BatchItem) => {
    setEditingItemId(item.id);
    setEditValues({
      grossWeight: item.grossWeight,
      netWeight: item.netWeight,
      stoneWeight: item.stoneWeight || '0',
    });
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setEditValues({ grossWeight: '', netWeight: '', stoneWeight: '' });
  };

  const saveEdit = async () => {
    if (!editingItemId) return;

    try {
      setSaving(true);
      setError(null);

      const response = await apiClient.put(
        `/inventory/batches/${batchId}/items/${editingItemId}`,
        {
          grossWeight: parseFloat(editValues.grossWeight),
          netWeight: parseFloat(editValues.netWeight),
          stoneWeight: parseFloat(editValues.stoneWeight),
        }
      );

      if (response.data.success) {
        setEditingItemId(null);
        setEditValues({ grossWeight: '', netWeight: '', stoneWeight: '' });
        await fetchBatchData(); // Refresh to get updated totals
      } else {
        throw new Error('Failed to update item');
      }
    } catch (error: any) {
      console.error('Error updating item:', error);
      setError(error.response?.data?.error?.message || 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (itemId: string) => {
    setDeletingItemId(itemId);
    setDeleteReason('');
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setDeletingItemId(null);
    setDeleteReason('');
  };

  const confirmDelete = async () => {
    if (!deletingItemId || deleteReason.trim().length < 10) {
      setError('Deletion reason must be at least 10 characters');
      return;
    }

    try {
      setDeleting(true);
      setError(null);

      const response = await apiClient.delete(
        `/inventory/batches/${batchId}/items/${deletingItemId}`,
        {
          data: { reason: deleteReason },
        }
      );

      if (response.data.success) {
        closeDeleteModal();
        await fetchBatchData(); // Refresh to get updated data
      } else {
        throw new Error('Failed to delete item');
      }
    } catch (error: any) {
      console.error('Error deleting item:', error);
      setError(error.response?.data?.error?.message || 'Failed to delete item');
    } finally {
      setDeleting(false);
    }
  };

  const handleCompleteBatch = async () => {
    if (!summary?.canComplete) return;

    try {
      setCompleting(true);
      setError(null);

      const response = await apiClient.post(`/inventory/batches/${batchId}/complete`, {});

      if (response.data.success) {
        router.push(`/inventory/batches/${batchId}/labels`);
      } else {
        throw new Error('Failed to complete batch');
      }
    } catch (error: any) {
      console.error('Error completing batch:', error);
      setError(error.response?.data?.error?.message || 'Failed to complete batch');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!batch || !summary) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          {error || 'Failed to load batch data'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => router.push(`/inventory/batches/${batchId}/add-items`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Add Items
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Review Batch - {batch.batchNumber}</h1>
            <p className="text-gray-500 mt-1">Verify all items and resolve any discrepancies before completing</p>
          </div>
          <EditBatchDialog
            batchId={batchId}
            initialValues={{
              expectedTotalWeight: batch.expectedTotalWeight,
              expectedTotalItems: batch.expectedTotalItems,
              notes: batch.notes,
            }}
            onSuccess={fetchBatchData}
            trigger={
              <Button variant="outline">
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Targets
              </Button>
            }
          />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded flex items-start">
          <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <div className="whitespace-pre-wrap">{error}</div>
        </div>
      )}

      {/* Validation Summary Card */}
      <Card
        className={`mb-6 p-6 ${summary.canComplete
          ? 'bg-green-50 border-green-200'
          : 'bg-orange-50 border-orange-200'
          }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center">
            {summary.canComplete ? (
              <>
                <Check className="h-5 w-5 mr-2 text-green-600" />
                <span className="text-green-700">Ready to Complete</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 mr-2 text-orange-600" />
                <span className="text-orange-700">Discrepancies Found</span>
              </>
            )}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Item Count */}
          <div>
            <div className="text-sm text-gray-600 mb-1">Item Count</div>
            <div className="flex items-center">
              <span className="text-2xl font-bold">
                {summary.actualItems} / {summary.expectedItems}
              </span>
              {summary.itemsMatch ? (
                <Check className="h-5 w-5 ml-2 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 ml-2 text-orange-600" />
              )}
            </div>
            {!summary.itemsMatch && (
              <div className="text-sm text-orange-600 mt-1">
                {summary.itemsRemaining > 0
                  ? `Add ${summary.itemsRemaining} more item${summary.itemsRemaining > 1 ? 's' : ''}`
                  : `Remove ${Math.abs(summary.itemsRemaining)} item${Math.abs(summary.itemsRemaining) > 1 ? 's' : ''}`}
              </div>
            )}
          </div>

          {/* Weight */}
          <div>
            <div className="text-sm text-gray-600 mb-1">Total Weight</div>
            <div className="flex items-center">
              <span className="text-2xl font-bold">
                {summary.actualWeight.toFixed(3)}g / {summary.expectedWeight.toFixed(3)}g
              </span>
              {summary.weightMatch ? (
                <Check className="h-5 w-5 ml-2 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 ml-2 text-orange-600" />
              )}
            </div>
            {!summary.weightMatch && (
              <div className="text-sm text-orange-600 mt-1">
                {summary.weightDifference > 0 ? '+' : ''}
                {summary.weightDifference.toFixed(3)}g (tolerance: ±0.1g)
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Items Table */}
      <Card className="mb-6">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Items in Batch</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-sm text-gray-600">#</th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-gray-600">SKU</th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-gray-600">Name</th>
                  <th className="text-right py-3 px-4 font-medium text-sm text-gray-600">Gross Wt (g)</th>
                  <th className="text-right py-3 px-4 font-medium text-sm text-gray-600">Net Wt (g)</th>
                  <th className="text-right py-3 px-4 font-medium text-sm text-gray-600">Stone Wt (g)</th>
                  <th className="text-right py-3 px-4 font-medium text-sm text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {batch.batchItems && batch.batchItems.length > 0 ? (
                  batch.batchItems.map((batchItem, index) => {
                    const item = batchItem.inventoryItem;
                    return (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">{index + 1}</td>
                        <td className="py-3 px-4 font-mono text-sm">{item.sku}</td>
                        <td className="py-3 px-4">{item.name}</td>

                        {/* Editable Fields */}
                        {editingItemId === item.id ? (
                          <>
                            <td className="py-3 px-4">
                              <Input
                                type="number"
                                step="0.001"
                                value={editValues.grossWeight}
                                onChange={(e) =>
                                  setEditValues({ ...editValues, grossWeight: e.target.value })
                                }
                                className="w-24 text-right"
                                disabled={saving}
                              />
                            </td>
                            <td className="py-3 px-4">
                              <Input
                                type="number"
                                step="0.001"
                                value={editValues.netWeight}
                                onChange={(e) =>
                                  setEditValues({ ...editValues, netWeight: e.target.value })
                                }
                                className="w-24 text-right"
                                disabled={saving}
                              />
                            </td>
                            <td className="py-3 px-4">
                              <Input
                                type="number"
                                step="0.001"
                                value={editValues.stoneWeight}
                                onChange={(e) =>
                                  setEditValues({ ...editValues, stoneWeight: e.target.value })
                                }
                                className="w-24 text-right"
                                disabled={saving}
                              />
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={saveEdit}
                                  disabled={saving}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Save className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEdit}
                                  disabled={saving}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 px-4 text-right font-mono">
                              {parseFloat(item.grossWeight).toFixed(3)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              {parseFloat(item.netWeight).toFixed(3)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              {parseFloat(item.stoneWeight || '0').toFixed(3)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEdit(item)}
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openDeleteModal(item.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No items in this batch
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={() => router.push(`/inventory/batches/${batchId}/add-items`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Add Items
        </Button>

        <Button
          onClick={handleCompleteBatch}
          disabled={!summary.canComplete || completing}
          className={summary.canComplete ? 'bg-green-600 hover:bg-green-700' : ''}
        >
          {completing ? 'Completing...' : 'Complete Batch'}
        </Button>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md w-full m-4">
            <h3 className="text-lg font-semibold mb-4">Delete Item from Batch</h3>

            <p className="text-gray-600 mb-4">
              Please provide a reason for deleting this item. This action cannot be undone.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Reason for deletion (minimum 10 characters)
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full border rounded p-2 min-h-[100px]"
                placeholder="Enter reason for deletion..."
                disabled={deleting}
              />
              {deleteReason.length > 0 && deleteReason.length < 10 && (
                <p className="text-sm text-orange-600 mt-1">
                  {10 - deleteReason.length} more characters required
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={closeDeleteModal} disabled={deleting}>
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                disabled={deleteReason.trim().length < 10 || deleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleting ? 'Deleting...' : 'Delete Item'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
