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
  Sparkles,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Calendar,
  FileText,
  Palette,
  Wrench,
  Package,
  Truck,
  Play,
  Check,
  X,
  RefreshCcw,
  MessageSquare,
  Image,
  Save,
} from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface CustomOrder {
  id: string;
  orderNumber: string;
  orderType: string;
  status: string;
  priority: string;
  designTitle: string;
  designDescription?: string;
  customerRequirements?: string;
  metalType?: string;
  purity?: string;
  estimatedWeight?: string;
  actualWeight?: string;
  ringSize?: string;
  bangleSize?: string;
  chainLength?: string;
  hasStones?: boolean;
  stoneDetails?: any;
  goldRateAtQuote?: string;
  estimatedGoldCost?: string;
  estimatedStoneCost?: string;
  makingCharges?: string;
  designCharges?: string;
  wastagePercentage?: string;
  wastageAmount?: string;
  additionalCharges?: string;
  discountAmount?: string;
  estimatedTotal?: string;
  finalTotal?: string;
  quotedAt?: string;
  quoteValidUntil?: string;
  revisionCount?: number;
  designApproved?: boolean;
  approvedAt?: string;
  approvalMethod?: string;
  advanceAmount?: string;
  advancePercentage?: string;
  paymentStatus?: string;
  balanceAmount?: string;
  productionStartedAt?: string;
  expectedCompletionDate?: string;
  actualCompletionDate?: string;
  craftsman?: string;
  workshopNotes?: string;
  qualityCheckDate?: string;
  qualityCheckPassed?: boolean;
  qualityCheckNotes?: string;
  readyForPickupAt?: string;
  deliveredAt?: string;
  warrantyMonths?: number;
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
  designVersions?: Array<{
    id: string;
    versionNumber: number;
    versionName?: string;
    status: string;
    designNotes?: string;
    estimatedCost?: string;
    customerFeedback?: string;
    createdAt: string;
  }>;
  consultedByUser?: { fullName: string };
  designedByUser?: { fullName: string };
  assignedToUser?: { fullName: string };
}

const statusColors: Record<string, string> = {
  consultation: 'bg-blue-100 text-blue-800 border-blue-300',
  design: 'bg-purple-100 text-purple-800 border-purple-300',
  quoted: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  approved: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  production: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  quality_check: 'bg-orange-100 text-orange-800 border-orange-300',
  ready: 'bg-green-100 text-green-800 border-green-300',
  delivered: 'bg-gray-100 text-gray-800 border-gray-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

const stageIcons: Record<string, any> = {
  consultation: FileText,
  design: Palette,
  quoted: DollarSign,
  approved: CheckCircle,
  production: Wrench,
  quality_check: AlertCircle,
  ready: Package,
  delivered: Truck,
};

export default function CustomOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<CustomOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quotation form
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteData, setQuoteData] = useState({
    goldRateAtQuote: '',
    estimatedGoldCost: '',
    estimatedStoneCost: '',
    makingCharges: '',
    designCharges: '',
    wastagePercentage: '',
    additionalCharges: '',
    discountAmount: '',
    expectedCompletionDate: '',
    quoteValidUntil: '',
  });

  // Approval form
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [approvalData, setApprovalData] = useState({
    approvalMethod: 'in_person',
    advanceAmount: '',
  });

  // Production form
  const [showProductionForm, setShowProductionForm] = useState(false);
  const [productionData, setProductionData] = useState({
    craftsman: '',
    workshopNotes: '',
  });

  // Quality check form
  const [showQualityForm, setShowQualityForm] = useState(false);
  const [qualityData, setQualityData] = useState({
    passed: true,
    notes: '',
  });

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const response = await apiClient.get(`/custom-orders/${orderId}`);
      if (response.data.success) {
        setOrder(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch order:', error);
      setError('Failed to load order details');
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
      const response = await apiClient.post(`/custom-orders/${orderId}/${action}`, data || {});
      if (response.data.success) {
        setOrder(response.data.data);
        setShowQuoteForm(false);
        setShowApprovalForm(false);
        setShowProductionForm(false);
        setShowQualityForm(false);
      } else {
        setError(response.data.error?.message || `Failed to ${action}`);
      }
    } catch (error: any) {
      setError(error.response?.data?.error?.message || `Failed to ${action}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuote = () => {
    handleAction('quote', {
      goldRateAtQuote: parseFloat(quoteData.goldRateAtQuote) || 0,
      estimatedGoldCost: parseFloat(quoteData.estimatedGoldCost) || 0,
      estimatedStoneCost: parseFloat(quoteData.estimatedStoneCost) || 0,
      makingCharges: parseFloat(quoteData.makingCharges) || 0,
      designCharges: parseFloat(quoteData.designCharges) || 0,
      wastagePercentage: parseFloat(quoteData.wastagePercentage) || 0,
      additionalCharges: parseFloat(quoteData.additionalCharges) || 0,
      discountAmount: parseFloat(quoteData.discountAmount) || 0,
      expectedCompletionDate: quoteData.expectedCompletionDate || undefined,
      quoteValidUntil: quoteData.quoteValidUntil || undefined,
    });
  };

  const handleApprove = () => {
    handleAction('approve', {
      approvalMethod: approvalData.approvalMethod,
      advanceAmount: parseFloat(approvalData.advanceAmount) || 0,
    });
  };

  const handleStartProduction = () => {
    handleAction('start-production', {
      craftsman: productionData.craftsman || undefined,
      workshopNotes: productionData.workshopNotes || undefined,
    });
  };

  const handleQualityCheck = () => {
    handleAction('quality-check', {
      passed: qualityData.passed,
      notes: qualityData.notes || undefined,
    });
  };

  const getNextAction = () => {
    if (!order) return null;
    switch (order.status) {
      case 'consultation':
      case 'design':
        return { label: 'Create Quotation', action: () => setShowQuoteForm(true), icon: DollarSign };
      case 'quoted':
        return { label: 'Approve Order', action: () => setShowApprovalForm(true), icon: CheckCircle };
      case 'approved':
        return { label: 'Start Production', action: () => setShowProductionForm(true), icon: Play };
      case 'production':
        return { label: 'Complete Production', action: () => handleAction('complete-production'), icon: Check };
      case 'quality_check':
        return { label: 'Quality Check', action: () => setShowQualityForm(true), icon: AlertCircle };
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

  if (!order) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-red-400" />
        <p className="mt-2 text-gray-600">Order not found</p>
        <Link href="/custom-orders">
          <Button className="mt-4">Back to Custom Orders</Button>
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
          <Link href="/custom-orders">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono">{order.orderNumber}</h1>
              <Badge className={`${statusColors[order.status]} border`}>
                {order.status.replace('_', ' ')}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {order.priority}
              </Badge>
            </div>
            <p className="text-gray-500 mt-1">{order.designTitle}</p>
          </div>
        </div>
        {nextAction && order.status !== 'delivered' && order.status !== 'cancelled' && (
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
        <h2 className="text-lg font-semibold mb-4">Order Progress</h2>
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {order.stages?.map((stage, idx) => {
            const Icon = stageIcons[stage.stageName] || Clock;
            const isCompleted = stage.status === 'completed';
            const isCurrent = stage.status === 'current';
            return (
              <div key={stage.id} className="flex items-center flex-1 min-w-[80px]">
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
                {idx < (order.stages?.length || 0) - 1 && (
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
          {order.customer && (
            <div className="space-y-3">
              <p className="font-medium text-lg">
                {order.customer.firstName} {order.customer.lastName}
              </p>
              <p className="text-sm text-gray-500">{order.customer.customerCode}</p>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-gray-400" />
                <a href={`tel:${order.customer.phone}`} className="text-blue-600 hover:underline">
                  {order.customer.phone}
                </a>
              </div>
              {order.customer.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <a href={`mailto:${order.customer.email}`} className="text-blue-600 hover:underline">
                    {order.customer.email}
                  </a>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Design Details */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Design Details
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Type:</span>
              <span className="font-medium capitalize">{order.orderType}</span>
            </div>
            {order.metalType && (
              <div className="flex justify-between">
                <span className="text-gray-500">Metal:</span>
                <span className="font-medium capitalize">{order.metalType}</span>
              </div>
            )}
            {order.purity && (
              <div className="flex justify-between">
                <span className="text-gray-500">Purity:</span>
                <span className="font-medium">{order.purity}</span>
              </div>
            )}
            {order.estimatedWeight && (
              <div className="flex justify-between">
                <span className="text-gray-500">Est. Weight:</span>
                <span className="font-medium">{order.estimatedWeight}g</span>
              </div>
            )}
            {order.actualWeight && (
              <div className="flex justify-between">
                <span className="text-gray-500">Actual Weight:</span>
                <span className="font-medium">{order.actualWeight}g</span>
              </div>
            )}
            {order.ringSize && (
              <div className="flex justify-between">
                <span className="text-gray-500">Ring Size:</span>
                <span className="font-medium">{order.ringSize}</span>
              </div>
            )}
            {order.designDescription && (
              <div className="pt-3 border-t">
                <p className="text-gray-500 mb-1">Description:</p>
                <p className="text-gray-800">{order.designDescription}</p>
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
            {order.estimatedGoldCost && (
              <div className="flex justify-between">
                <span className="text-gray-500">Gold Cost:</span>
                <span>{formatCurrency(order.estimatedGoldCost)}</span>
              </div>
            )}
            {order.estimatedStoneCost && parseFloat(order.estimatedStoneCost) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Stone Cost:</span>
                <span>{formatCurrency(order.estimatedStoneCost)}</span>
              </div>
            )}
            {order.makingCharges && (
              <div className="flex justify-between">
                <span className="text-gray-500">Making:</span>
                <span>{formatCurrency(order.makingCharges)}</span>
              </div>
            )}
            {order.designCharges && parseFloat(order.designCharges) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Design:</span>
                <span>{formatCurrency(order.designCharges)}</span>
              </div>
            )}
            {order.wastageAmount && parseFloat(order.wastageAmount) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Wastage ({order.wastagePercentage}%):</span>
                <span>{formatCurrency(order.wastageAmount)}</span>
              </div>
            )}
            {order.discountAmount && parseFloat(order.discountAmount) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount:</span>
                <span>-{formatCurrency(order.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-lg pt-3 border-t">
              <span>Total:</span>
              <span>{formatCurrency(order.finalTotal || order.estimatedTotal)}</span>
            </div>
            {order.advanceAmount && parseFloat(order.advanceAmount) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Advance Paid:</span>
                <span>{formatCurrency(order.advanceAmount)}</span>
              </div>
            )}
            {order.balanceAmount && (
              <div className="flex justify-between font-medium">
                <span>Balance:</span>
                <span className={parseFloat(order.balanceAmount) > 0 ? 'text-red-600' : 'text-green-600'}>
                  {formatCurrency(order.balanceAmount)}
                </span>
              </div>
            )}
            <div className="pt-3">
              <Badge className={order.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                {order.paymentStatus || 'pending'}
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
              <span className="text-gray-500">Created:</span>
              <span>{formatDate(order.createdAt)}</span>
            </div>
            {order.quotedAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Quoted:</span>
                <span>{formatDate(order.quotedAt)}</span>
              </div>
            )}
            {order.approvedAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Approved:</span>
                <span>{formatDate(order.approvedAt)}</span>
              </div>
            )}
            {order.productionStartedAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Production Started:</span>
                <span>{formatDate(order.productionStartedAt)}</span>
              </div>
            )}
            {order.expectedCompletionDate && (
              <div className="flex justify-between">
                <span className="text-gray-500">Expected:</span>
                <span className="font-medium">{formatDate(order.expectedCompletionDate)}</span>
              </div>
            )}
            {order.actualCompletionDate && (
              <div className="flex justify-between">
                <span className="text-gray-500">Completed:</span>
                <span>{formatDate(order.actualCompletionDate)}</span>
              </div>
            )}
            {order.deliveredAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Delivered:</span>
                <span>{formatDate(order.deliveredAt)}</span>
              </div>
            )}
            {order.warrantyExpiresAt && (
              <div className="flex justify-between pt-3 border-t">
                <span className="text-gray-500">Warranty Until:</span>
                <span className="font-medium">{formatDate(order.warrantyExpiresAt)}</span>
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
            {order.customerRequirements && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Customer Requirements:</p>
                <p className="text-sm bg-blue-50 p-3 rounded">{order.customerRequirements}</p>
              </div>
            )}
            {order.workshopNotes && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Workshop Notes:</p>
                <p className="text-sm bg-gray-50 p-3 rounded">{order.workshopNotes}</p>
              </div>
            )}
            {order.qualityCheckNotes && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Quality Check Notes:</p>
                <p className="text-sm bg-orange-50 p-3 rounded">{order.qualityCheckNotes}</p>
              </div>
            )}
            {order.notes && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Notes:</p>
                <p className="text-sm bg-gray-50 p-3 rounded">{order.notes}</p>
              </div>
            )}
            {!order.customerRequirements && !order.workshopNotes && !order.notes && (
              <p className="text-gray-400 text-sm">No notes available</p>
            )}
          </div>
        </Card>
      </div>

      {/* Design Versions */}
      {order.designVersions && order.designVersions.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Design Versions
          </h2>
          <div className="space-y-4">
            {order.designVersions.map((version) => (
              <div key={version.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{version.versionName || `Version ${version.versionNumber}`}</span>
                    <Badge variant="outline" className="capitalize">
                      {version.status}
                    </Badge>
                  </div>
                  <span className="text-sm text-gray-500">{formatDate(version.createdAt)}</span>
                </div>
                {version.designNotes && (
                  <p className="text-sm text-gray-600">{version.designNotes}</p>
                )}
                {version.customerFeedback && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                    <span className="text-gray-500">Customer Feedback: </span>
                    {version.customerFeedback}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Quotation Form Modal */}
      {showQuoteForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <Card className="p-6 w-full max-w-2xl m-4">
            <h2 className="text-xl font-semibold mb-4">Create Quotation</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Gold Rate per gram (Rs) *</Label>
                  <Input
                    type="number"
                    value={quoteData.goldRateAtQuote}
                    onChange={(e) => setQuoteData({ ...quoteData, goldRateAtQuote: e.target.value })}
                    placeholder="e.g., 24000"
                  />
                </div>
                <div>
                  <Label>Estimated Gold Cost (Rs) *</Label>
                  <Input
                    type="number"
                    value={quoteData.estimatedGoldCost}
                    onChange={(e) => setQuoteData({ ...quoteData, estimatedGoldCost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Stone Cost (Rs)</Label>
                  <Input
                    type="number"
                    value={quoteData.estimatedStoneCost}
                    onChange={(e) => setQuoteData({ ...quoteData, estimatedStoneCost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Making Charges (Rs) *</Label>
                  <Input
                    type="number"
                    value={quoteData.makingCharges}
                    onChange={(e) => setQuoteData({ ...quoteData, makingCharges: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Design Charges (Rs)</Label>
                  <Input
                    type="number"
                    value={quoteData.designCharges}
                    onChange={(e) => setQuoteData({ ...quoteData, designCharges: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Wastage %</Label>
                  <Input
                    type="number"
                    value={quoteData.wastagePercentage}
                    onChange={(e) => setQuoteData({ ...quoteData, wastagePercentage: e.target.value })}
                    placeholder="e.g., 5"
                  />
                </div>
                <div>
                  <Label>Additional Charges (Rs)</Label>
                  <Input
                    type="number"
                    value={quoteData.additionalCharges}
                    onChange={(e) => setQuoteData({ ...quoteData, additionalCharges: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Discount (Rs)</Label>
                  <Input
                    type="number"
                    value={quoteData.discountAmount}
                    onChange={(e) => setQuoteData({ ...quoteData, discountAmount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Expected Completion Date</Label>
                  <Input
                    type="date"
                    value={quoteData.expectedCompletionDate}
                    onChange={(e) => setQuoteData({ ...quoteData, expectedCompletionDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <Label>Quote Valid Until</Label>
                  <Input
                    type="date"
                    value={quoteData.quoteValidUntil}
                    onChange={(e) => setQuoteData({ ...quoteData, quoteValidUntil: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowQuoteForm(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleQuote} disabled={actionLoading}>
                  {actionLoading ? 'Creating...' : 'Create Quotation'}
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
            <h2 className="text-xl font-semibold mb-4">Approve Order</h2>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded text-center">
                <p className="text-sm text-gray-500">Total Cost</p>
                <p className="text-3xl font-bold">{formatCurrency(order.estimatedTotal)}</p>
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
                <p className="text-xs text-gray-500 mt-1">Recommended: 50% advance ({formatCurrency(parseFloat(order.estimatedTotal || '0') * 0.5)})</p>
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

      {/* Production Form Modal */}
      {showProductionForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 w-full max-w-md m-4">
            <h2 className="text-xl font-semibold mb-4">Start Production</h2>
            <div className="space-y-4">
              <div>
                <Label>Craftsman / Workshop</Label>
                <Input
                  value={productionData.craftsman}
                  onChange={(e) => setProductionData({ ...productionData, craftsman: e.target.value })}
                  placeholder="Enter craftsman name or workshop"
                />
              </div>
              <div>
                <Label>Workshop Notes</Label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md min-h-[80px]"
                  value={productionData.workshopNotes}
                  onChange={(e) => setProductionData({ ...productionData, workshopNotes: e.target.value })}
                  placeholder="Any special instructions for production..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowProductionForm(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleStartProduction} disabled={actionLoading}>
                  {actionLoading ? 'Starting...' : 'Start Production'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Quality Check Form Modal */}
      {showQualityForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 w-full max-w-md m-4">
            <h2 className="text-xl font-semibold mb-4">Quality Check</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="qcResult"
                    checked={qualityData.passed}
                    onChange={() => setQualityData({ ...qualityData, passed: true })}
                    className="h-4 w-4"
                  />
                  <span className="text-green-600 font-medium">Passed</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="qcResult"
                    checked={!qualityData.passed}
                    onChange={() => setQualityData({ ...qualityData, passed: false })}
                    className="h-4 w-4"
                  />
                  <span className="text-red-600 font-medium">Failed (Rework)</span>
                </label>
              </div>
              <div>
                <Label>Quality Check Notes</Label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md min-h-[80px]"
                  value={qualityData.notes}
                  onChange={(e) => setQualityData({ ...qualityData, notes: e.target.value })}
                  placeholder="Quality observations and notes..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowQualityForm(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleQualityCheck} disabled={actionLoading}>
                  {actionLoading ? 'Processing...' : 'Submit QC Result'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Cancel Button */}
      {order.status !== 'delivered' && order.status !== 'cancelled' && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            className="text-red-600 border-red-300 hover:bg-red-50"
            onClick={() => {
              if (confirm('Are you sure you want to cancel this order?')) {
                handleAction('cancel', { reason: 'Cancelled by staff' });
              }
            }}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel Order
          </Button>
        </div>
      )}
    </div>
  );
}
