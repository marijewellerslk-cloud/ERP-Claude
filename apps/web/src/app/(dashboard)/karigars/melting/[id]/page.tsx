'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Flame,
  Scale,
  CheckCircle,
  AlertTriangle,
  Package,
} from 'lucide-react';
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
  refinerInvoice: string | null;
  status: string;
  completedAt: string | null;
  notes: string | null;
  scrapItemDetails: Array<{
    id: string;
    scrapCode: string;
    scrapType: string;
    grossWeight: string;
    estimatedPurity: string | null;
  }>;
}

export default function MeltingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [record, setRecord] = useState<MeltingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Complete form
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [completeForm, setCompleteForm] = useState({
    outputWeight: '',
    outputPurity: '99.5',
    refiningCost: '',
    refinerInvoice: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRecord();
  }, [params.id]);

  const fetchRecord = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/scrap/melting/${params.id}`);
      if (response.data.success) {
        setRecord(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load record');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await apiClient.put(`/scrap/melting/${params.id}/complete`, {
        outputWeight: parseFloat(completeForm.outputWeight),
        outputPurity: parseFloat(completeForm.outputPurity),
        refiningCost: completeForm.refiningCost ? parseFloat(completeForm.refiningCost) : undefined,
        refinerInvoice: completeForm.refinerInvoice || undefined,
        notes: completeForm.notes || undefined,
      });

      if (response.data.success) {
        setShowCompleteForm(false);
        fetchRecord();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to complete record');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading melting record...</div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-red-500">{error || 'Record not found'}</div>
        <Button variant="outline" onClick={() => router.push('/karigars/melting')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Records
        </Button>
      </div>
    );
  }

  const inputWeight = parseFloat(record.inputWeight);
  const outputWeight = record.outputWeight ? parseFloat(record.outputWeight) : 0;
  const loss = inputWeight - outputWeight;
  const recoveryPercent = outputWeight > 0 ? (outputWeight / inputWeight) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/karigars/melting')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{record.meltingNumber}</h1>
              <Badge className={getStatusBadge(record.status)}>{record.status}</Badge>
            </div>
            <p className="text-gray-500 mt-1">
              Date: {new Date(record.meltingDate).toLocaleDateString()}
              {record.refinerName && ` | Refiner: ${record.refinerName}`}
            </p>
          </div>
        </div>
        {record.status === 'pending' && (
          <Button onClick={() => setShowCompleteForm(true)}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Record Output
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Input Weight</p>
              <p className="text-2xl font-bold text-amber-600">{inputWeight.toFixed(3)}g</p>
              {record.inputFineGold && (
                <p className="text-xs text-gray-400">
                  Fine: {parseFloat(record.inputFineGold).toFixed(4)}g
                </p>
              )}
            </div>
            <Package className="h-8 w-8 text-amber-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Output Weight</p>
              <p className="text-2xl font-bold text-green-600">
                {outputWeight > 0 ? `${outputWeight.toFixed(3)}g` : '-'}
              </p>
              {record.outputPurity && (
                <p className="text-xs text-gray-400">
                  Purity: {parseFloat(record.outputPurity).toFixed(2)}%
                </p>
              )}
            </div>
            <Scale className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className={`p-4 ${record.status === 'completed' && recoveryPercent < 95 ? 'border-red-200 bg-red-50' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Recovery</p>
              <p className={`text-2xl font-bold ${
                record.status === 'pending'
                  ? 'text-gray-400'
                  : recoveryPercent >= 95
                  ? 'text-green-600'
                  : recoveryPercent >= 90
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}>
                {record.status === 'completed' ? `${recoveryPercent.toFixed(1)}%` : '-'}
              </p>
              {record.meltingLoss && (
                <p className="text-xs text-red-500">
                  Loss: {parseFloat(record.meltingLoss).toFixed(4)}g
                </p>
              )}
            </div>
            {record.status === 'completed' && recoveryPercent < 95 ? (
              <AlertTriangle className="h-8 w-8 text-red-500" />
            ) : (
              <Flame className="h-8 w-8 text-orange-500" />
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Refining Cost</p>
              <p className="text-2xl font-bold">
                {record.refiningCost ? formatCurrency(parseFloat(record.refiningCost)) : '-'}
              </p>
              {record.refinerInvoice && (
                <p className="text-xs text-gray-400">Inv: {record.refinerInvoice}</p>
              )}
            </div>
            <Scale className="h-8 w-8 text-gray-400" />
          </div>
        </Card>
      </div>

      {/* Scrap Items */}
      <Card className="p-6">
        <h3 className="font-medium text-lg mb-4">Scrap Items in this Batch</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Code
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Weight
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Est. Purity
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {record.scrapItemDetails && record.scrapItemDetails.length > 0 ? (
                record.scrapItemDetails.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm font-medium">{item.scrapCode}</td>
                    <td className="px-4 py-3 text-sm capitalize">{item.scrapType}</td>
                    <td className="px-4 py-3 text-sm text-right text-amber-600 font-medium">
                      {parseFloat(item.grossWeight).toFixed(3)}g
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {item.estimatedPurity
                        ? `${parseFloat(item.estimatedPurity).toFixed(2)}%`
                        : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                    No scrap items recorded
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-gray-50 border-t">
              <tr>
                <td colSpan={2} className="px-4 py-2 text-sm font-medium">Total</td>
                <td className="px-4 py-2 text-sm text-right font-bold text-amber-600">
                  {inputWeight.toFixed(3)}g
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Notes */}
      {record.notes && (
        <Card className="p-4">
          <h3 className="font-medium mb-2">Notes</h3>
          <p className="text-sm text-gray-600">{record.notes}</p>
        </Card>
      )}

      {/* Complete Form Modal */}
      {showCompleteForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Record Melting Output</h2>
            <form onSubmit={handleComplete} className="space-y-4">
              <div className="bg-amber-50 p-3 rounded mb-4">
                <p className="text-sm">
                  <strong>Input Weight:</strong> {inputWeight.toFixed(3)}g
                </p>
                {record.inputFineGold && (
                  <p className="text-sm text-gray-600">
                    Est. Fine Gold: {parseFloat(record.inputFineGold).toFixed(4)}g
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="outputWeight">Output Weight (g) *</Label>
                  <Input
                    id="outputWeight"
                    type="number"
                    step="0.001"
                    value={completeForm.outputWeight}
                    onChange={(e) =>
                      setCompleteForm({ ...completeForm, outputWeight: e.target.value })
                    }
                    required
                    placeholder="0.000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outputPurity">Output Purity (%) *</Label>
                  <Input
                    id="outputPurity"
                    type="number"
                    step="0.01"
                    value={completeForm.outputPurity}
                    onChange={(e) =>
                      setCompleteForm({ ...completeForm, outputPurity: e.target.value })
                    }
                    required
                    placeholder="99.50"
                  />
                </div>
              </div>

              {/* Preview */}
              {completeForm.outputWeight && (
                <div className="bg-gray-50 p-3 rounded text-sm">
                  <p>
                    <strong>Recovery:</strong>{' '}
                    {((parseFloat(completeForm.outputWeight) / inputWeight) * 100).toFixed(1)}%
                  </p>
                  <p>
                    <strong>Loss:</strong>{' '}
                    {(inputWeight - parseFloat(completeForm.outputWeight)).toFixed(4)}g
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="refiningCost">Refining Cost</Label>
                  <Input
                    id="refiningCost"
                    type="number"
                    step="0.01"
                    value={completeForm.refiningCost}
                    onChange={(e) =>
                      setCompleteForm({ ...completeForm, refiningCost: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="refinerInvoice">Refiner Invoice #</Label>
                  <Input
                    id="refinerInvoice"
                    value={completeForm.refinerInvoice}
                    onChange={(e) =>
                      setCompleteForm({ ...completeForm, refinerInvoice: e.target.value })
                    }
                    placeholder="INV-123"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={completeForm.notes}
                  onChange={(e) =>
                    setCompleteForm({ ...completeForm, notes: e.target.value })
                  }
                  rows={2}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Any observations..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCompleteForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Complete Melting'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
