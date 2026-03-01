'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Scale,
  Trash2,
  Flame,
  Package,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';

interface ScrapItem {
  id: string;
  scrapCode: string;
  scrapType: string;
  metalType: string;
  grossWeight: string;
  estimatedPurity: string | null;
  estimatedFineWeight: string | null;
  estimatedValue: string | null;
  sourceDescription: string | null;
  status: string;
  collectedAt: string;
}

interface ScrapStats {
  accumulated: {
    totalWeight: number;
    totalFineWeight: number;
    totalValue: number;
    count: number;
  };
  melted: {
    totalWeight: number;
    count: number;
  };
  byType: Array<{ type: string; weight: number; count: number }>;
}

export default function ScrapInventoryPage() {
  const [scrapItems, setScrapItems] = useState<ScrapItem[]>([]);
  const [stats, setStats] = useState<ScrapStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('accumulated');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Add scrap modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    scrapType: 'filings',
    grossWeight: '',
    estimatedPurity: '91.67',
    sourceDescription: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchScrap();
    fetchStats();
  }, [statusFilter]);

  const fetchScrap = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/scrap', {
        params: { status: statusFilter !== 'all' ? statusFilter : undefined },
      });
      if (response.data.success) {
        setScrapItems(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load scrap');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/scrap/statistics');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      // Stats are optional
    }
  };

  const handleAddScrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await apiClient.post('/scrap', {
        scrapType: addForm.scrapType,
        grossWeight: parseFloat(addForm.grossWeight),
        estimatedPurity: parseFloat(addForm.estimatedPurity),
        sourceDescription: addForm.sourceDescription || undefined,
        notes: addForm.notes || undefined,
      });

      if (response.data.success) {
        setShowAddModal(false);
        setAddForm({
          scrapType: 'filings',
          grossWeight: '',
          estimatedPurity: '91.67',
          sourceDescription: '',
          notes: '',
        });
        fetchScrap();
        fetchStats();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to add scrap');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === scrapItems.filter((s) => s.status === 'accumulated').length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(scrapItems.filter((s) => s.status === 'accumulated').map((s) => s.id));
    }
  };

  const handleCreateMelting = async () => {
    if (selectedItems.length === 0) return;

    try {
      const response = await apiClient.post('/scrap/melting', {
        scrapIds: selectedItems,
      });

      if (response.data.success) {
        setSelectedItems([]);
        fetchScrap();
        fetchStats();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create melting record');
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      accumulated: 'bg-yellow-100 text-yellow-800',
      in_process: 'bg-blue-100 text-blue-800',
      melted: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const scrapTypes = [
    { value: 'filings', label: 'Filings' },
    { value: 'dust', label: 'Gold Dust' },
    { value: 'sweepings', label: 'Sweepings' },
    { value: 'rejected', label: 'Rejected Pieces' },
    { value: 'old_jewelry', label: 'Old Jewelry' },
    { value: 'trimmings', label: 'Trimmings' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Scrap Inventory</h1>
          <p className="text-gray-500 mt-1">Track and manage gold scrap for melting</p>
        </div>
        <div className="flex gap-2">
          {selectedItems.length > 0 && (
            <Button onClick={handleCreateMelting} variant="outline">
              <Flame className="h-4 w-4 mr-2" />
              Send to Melting ({selectedItems.length})
            </Button>
          )}
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Scrap
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 border-yellow-200 bg-yellow-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700">Accumulated</p>
                <p className="text-2xl font-bold text-yellow-700">
                  {stats.accumulated.totalWeight.toFixed(3)}g
                </p>
                <p className="text-xs text-yellow-600">
                  {stats.accumulated.count} items
                </p>
              </div>
              <Package className="h-8 w-8 text-yellow-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Fine Gold Equiv.</p>
                <p className="text-2xl font-bold text-amber-600">
                  {stats.accumulated.totalFineWeight.toFixed(4)}g
                </p>
              </div>
              <Scale className="h-8 w-8 text-amber-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Est. Value</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats.accumulated.totalValue)}
                </p>
              </div>
              <Scale className="h-8 w-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-4 border-green-200 bg-green-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Already Melted</p>
                <p className="text-2xl font-bold text-green-700">
                  {stats.melted.totalWeight.toFixed(3)}g
                </p>
                <p className="text-xs text-green-600">
                  {stats.melted.count} batches
                </p>
              </div>
              <Flame className="h-8 w-8 text-green-500" />
            </div>
          </Card>
        </div>
      )}

      {/* By Type Breakdown */}
      {stats && stats.byType.length > 0 && (
        <Card className="p-4">
          <h3 className="font-medium mb-3">Accumulated by Type</h3>
          <div className="flex flex-wrap gap-3">
            {stats.byType.map((item) => (
              <div
                key={item.type}
                className="px-3 py-2 bg-gray-100 rounded-lg text-sm"
              >
                <span className="capitalize font-medium">{item.type}</span>
                <span className="text-gray-500 ml-2">
                  {item.weight.toFixed(3)}g ({item.count})
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filter */}
      <Card className="p-4">
        <div className="flex gap-4">
          <select
            className="px-3 py-2 border rounded-md"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="accumulated">Accumulated</option>
            <option value="in_process">In Process</option>
            <option value="melted">Melted</option>
          </select>
          <Link href="/karigars/melting">
            <Button variant="outline">
              <Flame className="h-4 w-4 mr-2" />
              View Melting Records
            </Button>
          </Link>
        </div>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Scrap Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {statusFilter === 'accumulated' && (
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={
                        selectedItems.length ===
                        scrapItems.filter((s) => s.status === 'accumulated').length &&
                        scrapItems.filter((s) => s.status === 'accumulated').length > 0
                      }
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Weight
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Purity
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Fine Gold
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Source
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    Loading scrap inventory...
                  </td>
                </tr>
              ) : scrapItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    No scrap items found. Click "Add Scrap" to get started.
                  </td>
                </tr>
              ) : (
                scrapItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    {statusFilter === 'accumulated' && (
                      <td className="px-4 py-4">
                        {item.status === 'accumulated' && (
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(item.id)}
                            onChange={() => handleSelectItem(item.id)}
                            className="rounded"
                          />
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4 text-sm font-medium">{item.scrapCode}</td>
                    <td className="px-6 py-4 text-sm capitalize">{item.scrapType}</td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-amber-600">
                      {parseFloat(item.grossWeight).toFixed(3)}g
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      {item.estimatedPurity
                        ? `${parseFloat(item.estimatedPurity).toFixed(2)}%`
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      {item.estimatedFineWeight
                        ? `${parseFloat(item.estimatedFineWeight).toFixed(4)}g`
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.sourceDescription || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge className={getStatusBadge(item.status)}>
                        {item.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(item.collectedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Scrap Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Add Scrap</h2>
            <form onSubmit={handleAddScrap} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scrapType">Scrap Type *</Label>
                <select
                  id="scrapType"
                  value={addForm.scrapType}
                  onChange={(e) =>
                    setAddForm({ ...addForm, scrapType: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  {scrapTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="grossWeight">Weight (g) *</Label>
                  <Input
                    id="grossWeight"
                    type="number"
                    step="0.001"
                    value={addForm.grossWeight}
                    onChange={(e) =>
                      setAddForm({ ...addForm, grossWeight: e.target.value })
                    }
                    required
                    placeholder="0.000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimatedPurity">Est. Purity (%)</Label>
                  <Input
                    id="estimatedPurity"
                    type="number"
                    step="0.01"
                    value={addForm.estimatedPurity}
                    onChange={(e) =>
                      setAddForm({ ...addForm, estimatedPurity: e.target.value })
                    }
                    placeholder="91.67"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sourceDescription">Source Description</Label>
                <Input
                  id="sourceDescription"
                  value={addForm.sourceDescription}
                  onChange={(e) =>
                    setAddForm({ ...addForm, sourceDescription: e.target.value })
                  }
                  placeholder="e.g., Karigar X - Ring making"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={addForm.notes}
                  onChange={(e) =>
                    setAddForm({ ...addForm, notes: e.target.value })
                  }
                  rows={2}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Any additional notes..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Adding...' : 'Add Scrap'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
