'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  FileText,
  Search,
  Filter,
  RefreshCcw,
  Palette,
  Package,
  Truck,
  User,
  Phone,
  Eye,
  DollarSign,
  Calendar,
  Wrench,
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
  metalType?: string;
  purity?: string;
  estimatedWeight?: string;
  estimatedTotal?: string;
  finalTotal?: string;
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
  }>;
}

interface Statistics {
  total: number;
  consultation: number;
  design: number;
  quoted: number;
  approved: number;
  production: number;
  qualityCheck: number;
  ready: number;
  delivered: number;
  cancelled: number;
  pending: number;
  inProgress: number;
  overdue: number;
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

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const orderTypeIcons: Record<string, any> = {
  ring: Sparkles,
  necklace: Sparkles,
  earrings: Sparkles,
  bangle: Sparkles,
  pendant: Sparkles,
  bracelet: Sparkles,
  chain: Sparkles,
  set: Sparkles,
  other: Sparkles,
};

export default function CustomOrdersPage() {
  const [orders, setOrders] = useState<CustomOrder[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, [statusFilter, typeFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, statsRes] = await Promise.all([
        apiClient.get('/custom-orders', {
          params: {
            status: statusFilter || undefined,
            orderType: typeFilter || undefined,
            search: searchQuery || undefined,
            limit: 50,
          },
        }),
        apiClient.get('/custom-orders/statistics'),
      ]);

      if (ordersRes.data.success) {
        setOrders(ordersRes.data.data);
      }
      if (statsRes.data.success) {
        setStatistics(statsRes.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch custom orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchData();
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
    });
  };

  const getCurrentStage = (order: CustomOrder) => {
    if (!order.stages) return null;
    return order.stages.find((s) => s.status === 'current');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Custom Orders</h1>
          <p className="text-gray-500 mt-1">Manage custom jewelry design orders and production</p>
        </div>
        <Link href="/custom-orders/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Custom Order
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="text-2xl font-bold mt-1">{statistics?.total || 0}</p>
            </div>
            <Sparkles className="h-8 w-8 text-purple-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Approval</p>
              <p className="text-2xl font-bold mt-1">{statistics?.pending || 0}</p>
            </div>
            <Clock className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">In Production</p>
              <p className="text-2xl font-bold mt-1">{statistics?.inProgress || 0}</p>
            </div>
            <Wrench className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Ready for Pickup</p>
              <p className="text-2xl font-bold mt-1">{statistics?.ready || 0}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Overdue</p>
              <p className="text-2xl font-bold mt-1 text-red-600">{statistics?.overdue || 0}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by order number or design title..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>
          <select
            className="px-3 py-2 border rounded-md"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="consultation">Consultation</option>
            <option value="design">Design</option>
            <option value="quoted">Quoted</option>
            <option value="approved">Approved</option>
            <option value="production">Production</option>
            <option value="quality_check">Quality Check</option>
            <option value="ready">Ready</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            className="px-3 py-2 border rounded-md"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="ring">Ring</option>
            <option value="necklace">Necklace</option>
            <option value="earrings">Earrings</option>
            <option value="bangle">Bangle</option>
            <option value="pendant">Pendant</option>
            <option value="bracelet">Bracelet</option>
            <option value="chain">Chain</option>
            <option value="set">Set</option>
            <option value="other">Other</option>
          </select>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Orders List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCcw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : orders.length === 0 ? (
        <Card className="p-12 text-center">
          <Sparkles className="h-12 w-12 mx-auto text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No custom orders found</h3>
          <p className="mt-2 text-gray-500">Get started by creating a new custom order.</p>
          <Link href="/custom-orders/new">
            <Button className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              New Custom Order
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-mono font-semibold text-lg">{order.orderNumber}</h3>
                    <Badge className={`${statusColors[order.status]} border`}>
                      {order.status.replace('_', ' ')}
                    </Badge>
                    <Badge className={priorityColors[order.priority || 'normal']}>
                      {order.priority}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {order.orderType}
                    </Badge>
                  </div>

                  <h4 className="font-medium text-gray-900">{order.designTitle}</h4>
                  {order.designDescription && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                      {order.designDescription}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                    {order.customer && (
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span>
                          {order.customer.firstName} {order.customer.lastName}
                        </span>
                      </div>
                    )}
                    {order.customer?.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        <span>{order.customer.phone}</span>
                      </div>
                    )}
                    {order.metalType && (
                      <div className="flex items-center gap-1">
                        <Sparkles className="h-4 w-4" />
                        <span className="capitalize">
                          {order.metalType} {order.purity}
                        </span>
                      </div>
                    )}
                    {order.estimatedWeight && (
                      <span>{parseFloat(order.estimatedWeight).toFixed(2)}g est.</span>
                    )}
                    {(order.finalTotal || order.estimatedTotal) && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        <span>{formatCurrency(order.finalTotal || order.estimatedTotal)}</span>
                      </div>
                    )}
                    {order.expectedCompletionDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Due: {formatDate(order.expectedCompletionDate)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Link href={`/custom-orders/${order.id}`}>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Progress indicator */}
              {order.stages && order.stages.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    {order.stages.map((stage, idx) => {
                      const isCompleted = stage.status === 'completed';
                      const isCurrent = stage.status === 'current';
                      return (
                        <div key={idx} className="flex items-center">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              isCompleted
                                ? 'bg-green-500'
                                : isCurrent
                                ? 'bg-blue-500'
                                : 'bg-gray-300'
                            }`}
                          />
                          {idx < order.stages!.length - 1 && (
                            <div
                              className={`w-8 h-0.5 ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}`}
                            />
                          )}
                        </div>
                      );
                    })}
                    <span className="text-xs text-gray-500 ml-2">
                      {getCurrentStage(order)?.stageName.replace('_', ' ') || order.status}
                    </span>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Workflow Reference */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Custom Order Workflow</h3>
        <div className="flex items-center justify-between overflow-x-auto pb-4">
          {[
            { name: 'Consultation', icon: FileText, color: 'bg-blue-500' },
            { name: 'Design', icon: Palette, color: 'bg-purple-500' },
            { name: 'Quoted', icon: DollarSign, color: 'bg-indigo-500' },
            { name: 'Approved', icon: CheckCircle, color: 'bg-cyan-500' },
            { name: 'Production', icon: Wrench, color: 'bg-yellow-500' },
            { name: 'Quality Check', icon: AlertCircle, color: 'bg-orange-500' },
            { name: 'Ready', icon: Package, color: 'bg-green-500' },
            { name: 'Delivered', icon: Truck, color: 'bg-gray-500' },
          ].map((stage, idx) => (
            <div key={idx} className="flex items-center">
              <div className="flex flex-col items-center min-w-[80px]">
                <div
                  className={`w-10 h-10 rounded-full ${stage.color} text-white flex items-center justify-center`}
                >
                  <stage.icon className="h-5 w-5" />
                </div>
                <span className="text-xs text-gray-600 mt-2 text-center">{stage.name}</span>
              </div>
              {idx < 7 && <div className="w-8 h-0.5 bg-gray-300 mx-1" />}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
