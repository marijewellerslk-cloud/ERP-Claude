'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Package,
  Wrench,
  AlertTriangle,
  Clock,
  RefreshCw,
  CheckCircle,
  Timer,
  Calendar,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';

interface OrderStats {
  pending: number;
  inProgress: number;
  ready: number;
  delivered: number;
  totalValue: number;
}

interface StoreOrderData {
  storeId: string;
  storeName: string;
  storeCode: string;
  orders: OrderStats;
  repairs: OrderStats;
  overdueOrders: number;
  overdueRepairs: number;
}

interface OverdueItem {
  id: string;
  orderNumber?: string;
  repairNumber?: string;
  storeId: string;
  storeName: string;
  customerName: string | null;
  designTitle?: string;
  itemDescription?: string;
  status: string;
  expectedDate: string;
  daysOverdue: number;
}

interface OrdersDashboard {
  stores: StoreOrderData[];
  totals: {
    pendingOrders: number;
    inProgressOrders: number;
    readyOrders: number;
    orderValue: number;
    pendingRepairs: number;
    inProgressRepairs: number;
    readyRepairs: number;
    repairValue: number;
    overdueOrders: number;
    overdueRepairs: number;
  };
  overdueOrders: OverdueItem[];
  overdueRepairs: OverdueItem[];
}

export default function OrdersDashboardPage() {
  const [data, setData] = useState<OrdersDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const response = await apiClient.get('/command-center/orders');
      setData(response.data?.data || null);
    } catch (error) {
      console.error('Error fetching orders data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data || data.stores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No orders data available</h3>
        <p className="text-muted-foreground">No stores accessible for orders dashboard</p>
      </div>
    );
  }

  const totals = data.totals;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Orders & Repairs Dashboard</h1>
          <p className="text-muted-foreground">
            Custom orders and repairs across {data.stores.length} store(s)
          </p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Custom Orders Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            <CardTitle>Custom Orders</CardTitle>
          </div>
          <CardDescription>Total estimated value: {formatCurrency(totals.orderValue)}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <Clock className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{totals.pendingOrders}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Timer className="h-6 w-6 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{totals.inProgressOrders}</p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{totals.readyOrders}</p>
              <p className="text-sm text-muted-foreground">Ready for Pickup</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
              <AlertTriangle className="h-6 w-6 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{totals.overdueOrders}</p>
              <p className="text-sm text-muted-foreground">Overdue</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Repairs Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-orange-600" />
            <CardTitle>Repairs</CardTitle>
          </div>
          <CardDescription>Total estimated value: {formatCurrency(totals.repairValue)}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <Clock className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{totals.pendingRepairs}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Timer className="h-6 w-6 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{totals.inProgressRepairs}</p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{totals.readyRepairs}</p>
              <p className="text-sm text-muted-foreground">Ready for Pickup</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
              <AlertTriangle className="h-6 w-6 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{totals.overdueRepairs}</p>
              <p className="text-sm text-muted-foreground">Overdue</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overdue Items */}
      {(data.overdueOrders.length > 0 || data.overdueRepairs.length > 0) && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-800">
                Overdue Items ({data.overdueOrders.length + data.overdueRepairs.length})
              </CardTitle>
            </div>
            <CardDescription className="text-red-600">
              Items past their expected completion date
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Overdue Orders */}
              {data.overdueOrders.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Custom Orders
                  </h4>
                  <div className="space-y-2">
                    {data.overdueOrders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200"
                      >
                        <div>
                          <p className="font-medium">{order.orderNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.designTitle || 'Custom Order'} - {order.customerName || 'Unknown'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{order.storeName}</Badge>
                          <div className="text-right">
                            <Badge variant="destructive">{order.daysOverdue} days late</Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              <Calendar className="h-3 w-3 inline mr-1" />
                              {new Date(order.expectedDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Overdue Repairs */}
              {data.overdueRepairs.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    Repairs
                  </h4>
                  <div className="space-y-2">
                    {data.overdueRepairs.map((repair) => (
                      <div
                        key={repair.id}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200"
                      >
                        <div>
                          <p className="font-medium">{repair.repairNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            {repair.itemDescription || 'Repair'} - {repair.customerName || 'Unknown'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{repair.storeName}</Badge>
                          <div className="text-right">
                            <Badge variant="destructive">{repair.daysOverdue} days late</Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              <Calendar className="h-3 w-3 inline mr-1" />
                              {new Date(repair.expectedDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Store-wise Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Store-wise Breakdown</CardTitle>
          <CardDescription>Orders and repairs by branch</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {data.stores.map((store) => (
              <div key={store.storeId} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h4 className="font-semibold">{store.storeName}</h4>
                      <p className="text-sm text-muted-foreground">{store.storeCode}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {store.overdueOrders > 0 && (
                      <Badge variant="destructive">
                        {store.overdueOrders} orders late
                      </Badge>
                    )}
                    {store.overdueRepairs > 0 && (
                      <Badge variant="destructive">
                        {store.overdueRepairs} repairs late
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Orders */}
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-4 w-4 text-blue-600" />
                      <p className="font-medium text-blue-700">Custom Orders</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Pending</p>
                        <p className="font-semibold">{store.orders.pending}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">In Progress</p>
                        <p className="font-semibold">{store.orders.inProgress}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Ready</p>
                        <p className="font-semibold">{store.orders.ready}</p>
                      </div>
                    </div>
                  </div>

                  {/* Repairs */}
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench className="h-4 w-4 text-orange-600" />
                      <p className="font-medium text-orange-700">Repairs</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Pending</p>
                        <p className="font-semibold">{store.repairs.pending}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">In Progress</p>
                        <p className="font-semibold">{store.repairs.inProgress}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Ready</p>
                        <p className="font-semibold">{store.repairs.ready}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
