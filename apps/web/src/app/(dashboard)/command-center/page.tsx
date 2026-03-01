'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Building2,
  TrendingUp,
  Package,
  Users,
  AlertTriangle,
  DollarSign,
  ShoppingCart,
  Clock,
  Wrench,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';

interface StoreMetrics {
  storeId: string;
  storeName: string;
  storeCode: string;
  todaySales: { count: number; total: number };
  monthSales: { count: number; total: number };
  inventory: { count: number; value: number };
  employees: { total: number; presentToday: number; absentToday: number };
  pending: { repairs: number; customOrders: number };
  loans: { active: number; value: number };
}

interface Alert {
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  storeId: string;
  storeName: string;
  count?: number;
}

interface Overview {
  stores: StoreMetrics[];
  totals: {
    todaySalesCount: number;
    todaySalesTotal: number;
    monthSalesCount: number;
    monthSalesTotal: number;
    inventoryCount: number;
    inventoryValue: number;
    totalEmployees: number;
    presentToday: number;
    pendingRepairs: number;
    pendingOrders: number;
    activeLoans: number;
    loanValue: number;
  };
}

export default function CommandCenterPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommandCenterData();
  }, []);

  async function fetchCommandCenterData() {
    try {
      setLoading(true);
      const [overviewRes, alertsRes] = await Promise.all([
        apiClient.get('/command-center/overview'),
        apiClient.get('/command-center/alerts'),
      ]);

      setOverview(overviewRes.data?.data || null);
      setAlerts(alertsRes.data?.data || []);
    } catch (error) {
      console.error('Error fetching command center data:', error);
    } finally {
      setLoading(false);
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!overview || overview.stores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No stores accessible</h3>
        <p className="text-muted-foreground">
          You don't have access to any stores in the command center
        </p>
      </div>
    );
  }

  const totals = overview.totals;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Command Center</h1>
          <p className="text-muted-foreground">
            Multi-branch overview - {overview.stores.length} store(s)
          </p>
        </div>
        <Button onClick={fetchCommandCenterData} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-yellow-800">Alerts ({alerts.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.slice(0, 5).map((alert, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-normal">
                      {alert.storeName}
                    </Badge>
                    <span>{alert.message}</span>
                  </div>
                  <Badge
                    variant={alert.severity === 'high' ? 'destructive' : 'secondary'}
                  >
                    {alert.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aggregated Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totals.todaySalesTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totals.todaySalesCount} transactions across all stores
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totals.monthSalesTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totals.monthSalesCount} transactions this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inventory</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totals.inventoryValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totals.inventoryCount} items in stock
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff Present</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals.presentToday}/{totals.totalEmployees}
            </div>
            <p className="text-xs text-muted-foreground">
              Employees present today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.activeLoans}</div>
            <p className="text-xs text-muted-foreground">
              Value: {formatCurrency(totals.loanValue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Repairs</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.pendingRepairs}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting completion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custom Orders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.pendingOrders}</div>
            <p className="text-xs text-muted-foreground">
              In progress
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Store-wise Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Store Performance</CardTitle>
          <CardDescription>
            Compare metrics across all branches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {overview.stores.map((store) => {
              const salesPercent = totals.monthSalesTotal > 0
                ? (store.monthSales.total / totals.monthSalesTotal) * 100
                : 0;
              const inventoryPercent = totals.inventoryValue > 0
                ? (store.inventory.value / totals.inventoryValue) * 100
                : 0;

              return (
                <div key={store.storeId} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <h4 className="font-semibold">{store.storeName}</h4>
                        <p className="text-sm text-muted-foreground">
                          {store.storeCode}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <p className="font-medium">Today's Sales</p>
                        <p className="text-muted-foreground">
                          {formatCurrency(store.todaySales.total)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">Month Sales</p>
                        <p className="text-muted-foreground">
                          {formatCurrency(store.monthSales.total)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">Inventory</p>
                        <p className="text-muted-foreground">
                          {store.inventory.count} items
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">Staff</p>
                        <p className="text-muted-foreground">
                          {store.employees.presentToday}/{store.employees.total}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Sales Contribution</span>
                        <span>{salesPercent.toFixed(1)}%</span>
                      </div>
                      <Progress value={salesPercent} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Inventory Share</span>
                        <span>{inventoryPercent.toFixed(1)}%</span>
                      </div>
                      <Progress value={inventoryPercent} className="h-2" />
                    </div>
                  </div>

                  {/* Quick stats for this store */}
                  <div className="flex gap-4 text-sm">
                    {store.pending.repairs > 0 && (
                      <Badge variant="outline" className="text-orange-600">
                        <Wrench className="mr-1 h-3 w-3" />
                        {store.pending.repairs} repairs
                      </Badge>
                    )}
                    {store.pending.customOrders > 0 && (
                      <Badge variant="outline" className="text-blue-600">
                        <Clock className="mr-1 h-3 w-3" />
                        {store.pending.customOrders} orders
                      </Badge>
                    )}
                    {store.loans.active > 0 && (
                      <Badge variant="outline" className="text-purple-600">
                        <DollarSign className="mr-1 h-3 w-3" />
                        {store.loans.active} loans
                      </Badge>
                    )}
                    {store.employees.absentToday > 0 && (
                      <Badge variant="outline" className="text-red-600">
                        <Users className="mr-1 h-3 w-3" />
                        {store.employees.absentToday} absent
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
