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
  Scale,
  Banknote,
  Package,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
} from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';

interface JobCard {
  id: string;
  jobNumber: string;
  status: string;
  metalIssued: string;
  metalPurity: string | null;
  fineGoldIssued: string | null;
  finishedWeight: string | null;
  scrapReturned: string | null;
  actualWastage: string | null;
  labourCharge: string | null;
  labourPaid: string | null;
  issueDate: string;
  returnDate: string | null;
  description: string | null;
  notes: string | null;
  createdAt: string;
  karigar?: {
    id: string;
    name: string;
    code: string;
    wastageAllowance: string | null;
  } | null;
  customOrder?: {
    id: string;
    orderNumber: string;
  } | null;
  issuedBy?: {
    id: string;
    fullName: string;
  } | null;
  receivedBy?: {
    id: string;
    fullName: string;
  } | null;
}

export default function JobCardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [jobCard, setJobCard] = useState<JobCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Return form state
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnData, setReturnData] = useState({
    finishedWeight: '',
    scrapReturned: '',
    labourCharge: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Settle form state
  const [showSettleForm, setShowSettleForm] = useState(false);
  const [settleData, setSettleData] = useState({
    amountPaid: '',
    paymentMethod: 'cash',
    notes: '',
  });

  useEffect(() => {
    fetchJobCard();
  }, [params.id]);

  const fetchJobCard = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/job-cards/${params.id}`);
      if (response.data.success) {
        setJobCard(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load job card');
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        finishedWeight: parseFloat(returnData.finishedWeight),
        scrapReturned: returnData.scrapReturned ? parseFloat(returnData.scrapReturned) : 0,
        labourCharge: returnData.labourCharge ? parseFloat(returnData.labourCharge) : undefined,
        notes: returnData.notes || undefined,
      };

      const response = await apiClient.put(`/job-cards/${params.id}/return`, payload);
      if (response.data.success) {
        setShowReturnForm(false);
        fetchJobCard();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to record return');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        amountPaid: parseFloat(settleData.amountPaid),
        paymentMethod: settleData.paymentMethod,
        notes: settleData.notes || undefined,
      };

      const response = await apiClient.put(`/job-cards/${params.id}/settle`, payload);
      if (response.data.success) {
        setShowSettleForm(false);
        fetchJobCard();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to settle job card');
    } finally {
      setSubmitting(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading job card...</div>
      </div>
    );
  }

  if (error && !jobCard) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-red-500">{error}</div>
        <Button variant="outline" onClick={() => router.push('/job-cards')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Job Cards
        </Button>
      </div>
    );
  }

  if (!jobCard) return null;

  const metalIssued = parseFloat(jobCard.metalIssued);
  const finishedWeight = jobCard.finishedWeight ? parseFloat(jobCard.finishedWeight) : 0;
  const scrapReturned = jobCard.scrapReturned ? parseFloat(jobCard.scrapReturned) : 0;
  const totalReturned = finishedWeight + scrapReturned;
  const wastage = jobCard.actualWastage ? parseFloat(jobCard.actualWastage) : metalIssued - totalReturned;
  const wastagePercent = metalIssued > 0 ? (wastage / metalIssued) * 100 : 0;
  const allowedWastage = jobCard.karigar?.wastageAllowance
    ? parseFloat(jobCard.karigar.wastageAllowance)
    : 2;
  const excessWastage = wastagePercent > allowedWastage;

  const labourCharge = jobCard.labourCharge ? parseFloat(jobCard.labourCharge) : 0;
  const labourPaid = jobCard.labourPaid ? parseFloat(jobCard.labourPaid) : 0;
  const labourPending = labourCharge - labourPaid;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/job-cards')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{jobCard.jobNumber}</h1>
              <Badge className={getStatusBadge(jobCard.status)}>
                {jobCard.status.replace('_', ' ')}
              </Badge>
            </div>
            {jobCard.description && (
              <p className="text-gray-500 mt-1">{jobCard.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {jobCard.status === 'issued' && (
            <Button onClick={() => setShowReturnForm(true)}>
              <Package className="h-4 w-4 mr-2" />
              Record Return
            </Button>
          )}
          {jobCard.status === 'returned' && labourPending > 0 && (
            <Button onClick={() => setShowSettleForm(true)}>
              <Banknote className="h-4 w-4 mr-2" />
              Settle Payment
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Karigar Info */}
      {jobCard.karigar && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <Link
                  href={`/karigars/${jobCard.karigar.id}`}
                  className="font-medium text-blue-600 hover:text-blue-800"
                >
                  {jobCard.karigar.name}
                </Link>
                <p className="text-sm text-gray-500">Code: {jobCard.karigar.code}</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              <span>Wastage Allowance: {jobCard.karigar.wastageAllowance || '2.00'}%</span>
            </div>
          </div>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Metal Issued</p>
              <p className="text-2xl font-bold text-amber-600">{metalIssued.toFixed(3)}g</p>
              {jobCard.metalPurity && (
                <p className="text-xs text-gray-400">{jobCard.metalPurity}</p>
              )}
            </div>
            <Scale className="h-8 w-8 text-amber-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Returned</p>
              <p className="text-2xl font-bold text-green-600">{totalReturned.toFixed(3)}g</p>
              <p className="text-xs text-gray-400">
                Finished: {finishedWeight.toFixed(3)}g + Scrap: {scrapReturned.toFixed(3)}g
              </p>
            </div>
            <Package className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className={`p-4 ${excessWastage && jobCard.status !== 'issued' ? 'border-red-200 bg-red-50' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Wastage</p>
              <p className={`text-2xl font-bold ${excessWastage && jobCard.status !== 'issued' ? 'text-red-600' : 'text-gray-600'}`}>
                {wastage.toFixed(3)}g
              </p>
              <p className={`text-xs ${excessWastage && jobCard.status !== 'issued' ? 'text-red-500' : 'text-gray-400'}`}>
                {wastagePercent.toFixed(2)}% {excessWastage && jobCard.status !== 'issued' && '(Excess!)'}
              </p>
            </div>
            {excessWastage && jobCard.status !== 'issued' ? (
              <AlertTriangle className="h-8 w-8 text-red-500" />
            ) : (
              <Scale className="h-8 w-8 text-gray-400" />
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Labour Charge</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(labourCharge)}</p>
              {labourPaid > 0 && (
                <p className="text-xs text-green-500">Paid: {formatCurrency(labourPaid)}</p>
              )}
              {labourPending > 0 && (
                <p className="text-xs text-orange-500">Pending: {formatCurrency(labourPending)}</p>
              )}
            </div>
            <Banknote className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
      </div>

      {/* Timeline */}
      <Card className="p-6">
        <h3 className="font-medium text-lg mb-4">Timeline</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium">Metal Issued</p>
              <p className="text-sm text-gray-500">
                {new Date(jobCard.issueDate || jobCard.createdAt).toLocaleString()}
              </p>
              {jobCard.issuedBy && (
                <p className="text-xs text-gray-400">By: {jobCard.issuedBy.fullName}</p>
              )}
            </div>
          </div>

          {jobCard.returnDate && (
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Package className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">Metal Returned</p>
                <p className="text-sm text-gray-500">
                  {new Date(jobCard.returnDate).toLocaleString()}
                </p>
                {jobCard.receivedBy && (
                  <p className="text-xs text-gray-400">By: {jobCard.receivedBy.fullName}</p>
                )}
              </div>
            </div>
          )}

          {jobCard.status === 'settled' && (
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <Banknote className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Labour Settled</p>
                <p className="text-sm text-gray-500">Payment completed</p>
              </div>
            </div>
          )}

          {jobCard.status === 'issued' && (
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="font-medium text-yellow-700">Awaiting Return</p>
                <p className="text-sm text-gray-500">Metal is with karigar</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Notes */}
      {jobCard.notes && (
        <Card className="p-4">
          <h3 className="font-medium mb-2">Notes</h3>
          <p className="text-sm text-gray-600">{jobCard.notes}</p>
        </Card>
      )}

      {/* Return Form Modal */}
      {showReturnForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Record Metal Return</h2>
            <form onSubmit={handleReturn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="finishedWeight">Finished Weight (g) *</Label>
                <Input
                  id="finishedWeight"
                  type="number"
                  step="0.001"
                  value={returnData.finishedWeight}
                  onChange={(e) =>
                    setReturnData({ ...returnData, finishedWeight: e.target.value })
                  }
                  required
                  placeholder="Weight of finished piece"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scrapReturned">Scrap Returned (g)</Label>
                <Input
                  id="scrapReturned"
                  type="number"
                  step="0.001"
                  value={returnData.scrapReturned}
                  onChange={(e) =>
                    setReturnData({ ...returnData, scrapReturned: e.target.value })
                  }
                  placeholder="Dust, filings, rejected pieces"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="labourCharge">Labour Charge</Label>
                <Input
                  id="labourCharge"
                  type="number"
                  step="0.01"
                  value={returnData.labourCharge}
                  onChange={(e) =>
                    setReturnData({ ...returnData, labourCharge: e.target.value })
                  }
                  placeholder="Total labour charge"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  rows={2}
                  className="w-full px-3 py-2 border rounded-md"
                  value={returnData.notes}
                  onChange={(e) =>
                    setReturnData({ ...returnData, notes: e.target.value })
                  }
                  placeholder="Any observations..."
                />
              </div>

              {/* Preview calculations */}
              {returnData.finishedWeight && (
                <div className="bg-gray-50 p-3 rounded text-sm">
                  <p>
                    <strong>Issued:</strong> {metalIssued.toFixed(3)}g
                  </p>
                  <p>
                    <strong>Returned:</strong>{' '}
                    {(
                      parseFloat(returnData.finishedWeight || '0') +
                      parseFloat(returnData.scrapReturned || '0')
                    ).toFixed(3)}
                    g
                  </p>
                  <p>
                    <strong>Wastage:</strong>{' '}
                    {(
                      metalIssued -
                      parseFloat(returnData.finishedWeight || '0') -
                      parseFloat(returnData.scrapReturned || '0')
                    ).toFixed(3)}
                    g (
                    {(
                      ((metalIssued -
                        parseFloat(returnData.finishedWeight || '0') -
                        parseFloat(returnData.scrapReturned || '0')) /
                        metalIssued) *
                      100
                    ).toFixed(2)}
                    %)
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowReturnForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Recording...' : 'Record Return'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Settle Form Modal */}
      {showSettleForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Settle Labour Payment</h2>
            <form onSubmit={handleSettle} className="space-y-4">
              <div className="bg-blue-50 p-3 rounded text-sm mb-4">
                <p>
                  <strong>Total Labour:</strong> {formatCurrency(labourCharge)}
                </p>
                <p>
                  <strong>Already Paid:</strong> {formatCurrency(labourPaid)}
                </p>
                <p className="font-bold text-blue-600">
                  <strong>Pending:</strong> {formatCurrency(labourPending)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amountPaid">Amount to Pay *</Label>
                <Input
                  id="amountPaid"
                  type="number"
                  step="0.01"
                  value={settleData.amountPaid}
                  onChange={(e) =>
                    setSettleData({ ...settleData, amountPaid: e.target.value })
                  }
                  required
                  placeholder={labourPending.toFixed(2)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <select
                  id="paymentMethod"
                  className="w-full px-3 py-2 border rounded-md"
                  value={settleData.paymentMethod}
                  onChange={(e) =>
                    setSettleData({ ...settleData, paymentMethod: e.target.value })
                  }
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="settleNotes">Notes</Label>
                <textarea
                  id="settleNotes"
                  rows={2}
                  className="w-full px-3 py-2 border rounded-md"
                  value={settleData.notes}
                  onChange={(e) =>
                    setSettleData({ ...settleData, notes: e.target.value })
                  }
                  placeholder="Payment reference..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSettleForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Processing...' : 'Make Payment'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
