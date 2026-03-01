'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Wrench,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Calendar,
  FileText,
  Play,
  Pause,
  Check,
  X,
  Package,
  Truck,
  RefreshCcw,
  MessageSquare,
  Edit,
  Save,
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
  estimatedWeight?: string;
  problemDescription: string;
  customerInstructions?: string;
  assessmentNotes?: string;
  assessmentDate?: string;
  estimatedCost?: string;
  laborCharges?: string;
  materialCost?: string;
  additionalCharges?: string;
  discountAmount?: string;
  finalCost?: string;
  quotationApproved?: boolean;
  approvedAt?: string;
  approvalMethod?: string;
  advanceAmount?: string;
  paymentStatus?: string;
  balanceAmount?: string;
  expectedCompletionDate?: string;
  actualCompletionDate?: string;
  deliveredAt?: string;
  warrantyDays?: number;
  warrantyExpiresAt?: string;
  notes?: string;
  internalNotes?: string;
  createdAt: string;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    customerCode: string;
  };
  stages?: Array<{
    id: string;
    stageName: string;
    status: string;
    stageOrder: number;
    startedAt?: string;
    completedAt?: string;
    customerNotified?: boolean;
  }>;
  receivedByUser?: { fullName: string };
  assignedToUser?: { fullName: string };
  assessedByUser?: { fullName: string };
}

const statusColors: Record<string, string> = {
  received: 'bg-blue-100 text-blue-800 border-blue-300',
  assessment: 'bg-purple-100 text-purple-800 border-purple-300',
  quoted: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  approved: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  quality_check: 'bg-orange-100 text-orange-800 border-orange-300',
  ready: 'bg-green-100 text-green-800 border-green-300',
  delivered: 'bg-gray-100 text-gray-800 border-gray-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

const stageIcons: Record<string, any> = {
  received: Package,
  assessment: FileText,
  quoted: DollarSign,
  approved: CheckCircle,
  in_progress: Wrench,
  quality_check: AlertCircle,
  ready: Clock,
  delivered: Truck,
};

export default function RepairDetailPage() {
  const params = useParams();
  const router = useRouter();
  const repairId = params.repairId as string;

  const [repair, setRepair] = useState<Repair | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Assessment form
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);
  const [assessmentData, setAssessmentData] = useState({
    assessmentNotes: '',
    laborCharges: '',
    materialCost: '',
    additionalCharges: '',
    estimatedCost: '',
    expectedCompletionDate: '',
  });

  // Approval form
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [approvalData, setApprovalData] = useState({
    approvalMethod: 'in_person',
    advanceAmount: '',
  });

  useEffect(() => {
    fetchRepair();
  }, [repairId]);

  const fetchRepair = async () => {
    try {
      const response = await apiClient.get(`/repairs/${repairId}`);
      if (response.data.success) {
        setRepair(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch repair:', error);
      setError('Failed to load repair details');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: string | number | undefined) => {
    if (!amount) return 'N/A';
    return `Rs. ${parseFloat(amount.toString()).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-LK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleAction = async (action: string, data?: any) => {
    setActionLoading(true);
    setError(null);
    try {
      const response = await apiClient.post(`/repairs/${repairId}/${action}`, data || {});
      if (response.data.success) {
        setRepair(response.data.data);
        setShowAssessmentForm(false);
        setShowApprovalForm(false);
      } else {
        setError(response.data.error?.message || `Failed to ${action}`);
      }
    } catch (error: any) {
      setError(error.response?.data?.error?.message || `Failed to ${action}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssess = () => {
    const totalCost =
      parseFloat(assessmentData.laborCharges || '0') +
      parseFloat(assessmentData.materialCost || '0') +
      parseFloat(assessmentData.additionalCharges || '0');

    handleAction('assess', {
      assessmentNotes: assessmentData.assessmentNotes,
      laborCharges: parseFloat(assessmentData.laborCharges) || 0,
      materialCost: parseFloat(assessmentData.materialCost) || 0,
      additionalCharges: parseFloat(assessmentData.additionalCharges) || 0,
      estimatedCost: totalCost,
      expectedCompletionDate: assessmentData.expectedCompletionDate || undefined,
    });
  };

  const handleApprove = () => {
    handleAction('approve', {
      approvalMethod: approvalData.approvalMethod,
      advanceAmount: parseFloat(approvalData.advanceAmount) || 0,
    });
  };

  const getCurrentStage = () => {
    if (!repair?.stages) return null;
    return repair.stages.find((s) => s.status === 'current');
  };

  const getNextAction = () => {
    if (!repair) return null;
    switch (repair.status) {
      case 'received':
        return { label: 'Start Assessment', action: () => setShowAssessmentForm(true), icon: FileText };
      case 'quoted':
        return { label: 'Approve Quotation', action: () => setShowApprovalForm(true), icon: CheckCircle };
      case 'approved':
        return { label: 'Start Repair Work', action: () => handleAction('start'), icon: Play };
      case 'in_progress':
        return { label: 'Complete Repair', action: () => handleAction('complete'), icon: Check };
      case 'quality_check':
        return { label: 'Mark Ready for Pickup', action: () => handleAction('ready'), icon: Package };
      case 'ready':
        return { label: 'Deliver to Customer', action: () => handleAction('deliver'), icon: Truck };
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!repair) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-red-400" />
        <p className="mt-2 text-gray-600">Repair not found</p>
        <Link href="/repairs">
          <Button className="mt-4">Back to Repairs</Button>
        </Link>
      </div>
    );
  }

  const nextAction = getNextAction();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/repairs">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono">{repair.repairNumber}</h1>
              <Badge className={`${statusColors[repair.status]} border`}>
                {repair.status.replace('_', ' ')}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {repair.priority}
              </Badge>
            </div>
            <p className="text-gray-500 mt-1">{repair.itemDescription}</p>
          </div>
        </div>
        {nextAction && repair.status !== 'delivered' && repair.status !== 'cancelled' && (
          <Button onClick={nextAction.action} disabled={actionLoading}>
            <nextAction.icon className="h-4 w-4 mr-2" />
            {nextAction.label}
          </Button>
        )}
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        </Card>
      )}

      {/* Progress Timeline */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Repair Progress</h2>
        <div className="flex items-center justify-between">
          {repair.stages?.map((stage, idx) => {
            const Icon = stageIcons[stage.stageName] || Clock;
            const isCompleted = stage.status === 'completed';
            const isCurrent = stage.status === 'current';
            return (
              <div key={stage.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isCurrent
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <p className={`text-xs mt-2 text-center capitalize ${isCurrent ? 'font-semibold text-blue-600' : 'text-gray-500'}`}>
                    {stage.stageName.replace('_', ' ')}
                  </p>
                  {stage.completedAt && (
                    <p className="text-xs text-gray-400">
                      {new Date(stage.completedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {idx < (repair.stages?.length || 0) - 1 && (
                  <div className={`flex-1 h-1 mx-2 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Info */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="h-5 w-5" />
            Customer
          </h2>
          {repair.customer && (
            <div className="space-y-3">
              <p className="font-medium text-lg">
                {repair.customer.firstName} {repair.customer.lastName}
              </p>
              <p className="text-sm text-gray-500">{repair.customer.customerCode}</p>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-gray-400" />
                <a href={`tel:${repair.customer.phone}`} className="text-blue-600 hover:underline">
                  {repair.customer.phone}
                </a>
              </div>
              {repair.customer.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <a href={`mailto:${repair.customer.email}`} className="text-blue-600 hover:underline">
                    {repair.customer.email}
                  </a>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Item Details */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Item Details
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Type:</span>
              <span className="font-medium capitalize">{repair.repairType.replace('_', ' ')}</span>
            </div>
            {repair.metalType && (
              <div className="flex justify-between">
                <span className="text-gray-500">Metal:</span>
                <span className="font-medium capitalize">{repair.metalType}</span>
              </div>
            )}
            {repair.purity && (
              <div className="flex justify-between">
                <span className="text-gray-500">Purity:</span>
                <span className="font-medium">{repair.purity}</span>
              </div>
            )}
            {repair.estimatedWeight && (
              <div className="flex justify-between">
                <span className="text-gray-500">Weight:</span>
                <span className="font-medium">{repair.estimatedWeight}g</span>
              </div>
            )}
            <div className="pt-3 border-t">
              <p className="text-gray-500 mb-1">Problem:</p>
              <p className="text-gray-800">{repair.problemDescription}</p>
            </div>
            {repair.customerInstructions && (
              <div className="pt-3 border-t">
                <p className="text-gray-500 mb-1">Customer Instructions:</p>
                <p className="text-gray-800">{repair.customerInstructions}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Cost & Payment */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Cost & Payment
          </h2>
          <div className="space-y-3 text-sm">
            {repair.laborCharges && (
              <div className="flex justify-between">
                <span className="text-gray-500">Labor:</span>
                <span>{formatCurrency(repair.laborCharges)}</span>
              </div>
            )}
            {repair.materialCost && (
              <div className="flex justify-between">
                <span className="text-gray-500">Materials:</span>
                <span>{formatCurrency(repair.materialCost)}</span>
              </div>
            )}
            {repair.additionalCharges && (
              <div className="flex justify-between">
                <span className="text-gray-500">Additional:</span>
                <span>{formatCurrency(repair.additionalCharges)}</span>
              </div>
            )}
            {repair.discountAmount && parseFloat(repair.discountAmount) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount:</span>
                <span>-{formatCurrency(repair.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-lg pt-3 border-t">
              <span>Total:</span>
              <span>{formatCurrency(repair.finalCost || repair.estimatedCost)}</span>
            </div>
            {repair.advanceAmount && parseFloat(repair.advanceAmount) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Advance Paid:</span>
                <span>{formatCurrency(repair.advanceAmount)}</span>
              </div>
            )}
            {repair.balanceAmount && (
              <div className="flex justify-between font-medium">
                <span>Balance:</span>
                <span className={parseFloat(repair.balanceAmount) > 0 ? 'text-red-600' : 'text-green-600'}>
                  {formatCurrency(repair.balanceAmount)}
                </span>
              </div>
            )}
            <div className="pt-3">
              <Badge className={repair.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                {repair.paymentStatus || 'pending'}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Timeline & Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timeline
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Received:</span>
              <span>{formatDate(repair.createdAt)}</span>
            </div>
            {repair.assessmentDate && (
              <div className="flex justify-between">
                <span className="text-gray-500">Assessed:</span>
                <span>{formatDate(repair.assessmentDate)}</span>
              </div>
            )}
            {repair.approvedAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Approved:</span>
                <span>{formatDate(repair.approvedAt)}</span>
              </div>
            )}
            {repair.expectedCompletionDate && (
              <div className="flex justify-between">
                <span className="text-gray-500">Expected:</span>
                <span className="font-medium">{formatDate(repair.expectedCompletionDate)}</span>
              </div>
            )}
            {repair.actualCompletionDate && (
              <div className="flex justify-between">
                <span className="text-gray-500">Completed:</span>
                <span>{formatDate(repair.actualCompletionDate)}</span>
              </div>
            )}
            {repair.deliveredAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Delivered:</span>
                <span>{formatDate(repair.deliveredAt)}</span>
              </div>
            )}
            {repair.warrantyExpiresAt && (
              <div className="flex justify-between pt-3 border-t">
                <span className="text-gray-500">Warranty Until:</span>
                <span className="font-medium">{formatDate(repair.warrantyExpiresAt)}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Notes */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Notes
          </h2>
          <div className="space-y-4">
            {repair.assessmentNotes && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Assessment Notes:</p>
                <p className="text-sm bg-gray-50 p-3 rounded">{repair.assessmentNotes}</p>
              </div>
            )}
            {repair.notes && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Notes:</p>
                <p className="text-sm bg-gray-50 p-3 rounded">{repair.notes}</p>
              </div>
            )}
            {repair.internalNotes && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Internal Notes:</p>
                <p className="text-sm bg-yellow-50 p-3 rounded">{repair.internalNotes}</p>
              </div>
            )}
            {!repair.assessmentNotes && !repair.notes && !repair.internalNotes && (
              <p className="text-gray-400 text-sm">No notes available</p>
            )}
          </div>
        </Card>
      </div>

      {/* Assessment Form Modal */}
      {showAssessmentForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 w-full max-w-lg m-4">
            <h2 className="text-xl font-semibold mb-4">Assessment & Quotation</h2>
            <div className="space-y-4">
              <div>
                <Label>Assessment Notes *</Label>
                <textarea
                  value={assessmentData.assessmentNotes}
                  onChange={(e) => setAssessmentData({ ...assessmentData, assessmentNotes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                  placeholder="Describe the assessment findings..."
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Labor (Rs)</Label>
                  <Input
                    type="number"
                    value={assessmentData.laborCharges}
                    onChange={(e) => setAssessmentData({ ...assessmentData, laborCharges: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Materials (Rs)</Label>
                  <Input
                    type="number"
                    value={assessmentData.materialCost}
                    onChange={(e) => setAssessmentData({ ...assessmentData, materialCost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Additional (Rs)</Label>
                  <Input
                    type="number"
                    value={assessmentData.additionalCharges}
                    onChange={(e) => setAssessmentData({ ...assessmentData, additionalCharges: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded text-center">
                <p className="text-sm text-gray-500">Estimated Total</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    parseFloat(assessmentData.laborCharges || '0') +
                    parseFloat(assessmentData.materialCost || '0') +
                    parseFloat(assessmentData.additionalCharges || '0')
                  )}
                </p>
              </div>
              <div>
                <Label>Expected Completion Date</Label>
                <Input
                  type="date"
                  value={assessmentData.expectedCompletionDate}
                  onChange={(e) => setAssessmentData({ ...assessmentData, expectedCompletionDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowAssessmentForm(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleAssess} disabled={actionLoading || !assessmentData.assessmentNotes}>
                  {actionLoading ? 'Saving...' : 'Save & Send Quotation'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Approval Form Modal */}
      {showApprovalForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 w-full max-w-md m-4">
            <h2 className="text-xl font-semibold mb-4">Approve Quotation</h2>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded text-center">
                <p className="text-sm text-gray-500">Total Cost</p>
                <p className="text-3xl font-bold">{formatCurrency(repair.finalCost)}</p>
              </div>
              <div>
                <Label>Approval Method</Label>
                <select
                  value={approvalData.approvalMethod}
                  onChange={(e) => setApprovalData({ ...approvalData, approvalMethod: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="in_person">In Person</option>
                  <option value="phone">Phone</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div>
                <Label>Advance Payment (Rs)</Label>
                <Input
                  type="number"
                  value={approvalData.advanceAmount}
                  onChange={(e) => setApprovalData({ ...approvalData, advanceAmount: e.target.value })}
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500 mt-1">Optional - Enter amount if customer pays advance</p>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowApprovalForm(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleApprove} disabled={actionLoading}>
                  {actionLoading ? 'Processing...' : 'Confirm Approval'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Cancel Button */}
      {repair.status !== 'delivered' && repair.status !== 'cancelled' && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            className="text-red-600 border-red-300 hover:bg-red-50"
            onClick={() => {
              if (confirm('Are you sure you want to cancel this repair?')) {
                handleAction('cancel', { reason: 'Cancelled by staff' });
              }
            }}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel Repair
          </Button>
        </div>
      )}
    </div>
  );
}
