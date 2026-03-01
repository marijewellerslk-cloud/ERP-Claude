'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Package,
  ShoppingCart,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  CheckCircle,
  ArrowRight,
  RefreshCcw,
  Sparkles,
  Wrench,
  Coins,
  Receipt,
  CalendarDays,
  Target,
  Wallet,
  CreditCard,
  UserPlus,
  Bell,
  Download,
  BarChart3,
  PieChart,
} from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import { exportDashboardPDF } from '@/lib/pdf-export';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface DashboardStats {
  inventory: {
    totalItems: number;
    totalValue: number;
    lowStockCount: number;
    recentBatches: number;
  };
  sales: {
    todaySales: number;
    todayTransactions: number;
    monthSales: number;
    monthTransactions: number;
  };
  customers: {
    totalCustomers: number;
    newThisMonth: number;
    activeCustomers: number;
  };
  financial: {
    cashInHand: number;
    bankBalance: number;
    receivables: number;
    payables: number;
    todayIncome: number;
    todayExpenses: number;
    monthIncome: number;
    monthExpenses: number;
  };
  orders: {
    pendingCustomOrders: number;
    pendingRepairs: number;
    activeLoans: number;
  };
}

interface DashboardMetrics {
  today: {
    salesCount: number;
    revenue: number;
    profit: number;
    avgMargin: number;
  };
  thisWeek: {
    salesCount: number;
    revenue: number;
    profit: number;
    avgMargin: number;
  };
  thisMonth: {
    salesCount: number;
    revenue: number;
    profit: number;
    avgMargin: number;
  };
  comparison: {
    revenueChange: number;
    profitChange: number;
    salesCountChange: number;
  };
}

interface CategoryPerformance {
  categoryName: string;
  itemsSold: number;
  totalRevenue: number;
  totalProfit: number;
  avgMargin: number;
}

interface AgingSummary {
  totalItems: number;
  totalValue: number;
  averageAge: number;
  deadStockCount: number;
  buckets: Array<{
    label: string;
    itemCount: number;
    percentageOfInventory: number;
  }>;
}

interface RecentActivity {
  id: string;
  type: 'sale' | 'repair' | 'custom_order' | 'expense' | 'customer';
  title: string;
  description: string;
  amount?: number;
  time: string;
  status?: string;
}

const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00C49F', '#FFBB28'];

export default function DashboardPage() {
  const router = useRouter();
  const { user, store } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryPerformance[]>([]);
  const [agingData, setAgingData] = useState<AgingSummary | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [alerts, setAlerts] = useState<{ type: string; message: string; link?: string }[]>([]);
  const [weeklyData, setWeeklyData] = useState<Array<{ day: string; revenue: number; profit: number }>>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Get date ranges
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];
      const startOfWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Fetch data from multiple endpoints in parallel
      const [
        inventoryRes,
        financialRes,
        customersRes,
        customOrdersRes,
        repairsRes,
        loansRes,
        expensesRes,
        dashboardMetricsRes,
        categoryRes,
        agingRes,
      ] = await Promise.all([
        apiClient.get('/inventory', { params: { limit: 1 } }).catch(() => ({ data: { success: false } })),
        apiClient.get('/accounting/summary').catch(() => ({ data: { success: false } })),
        apiClient.get('/customers', { params: { limit: 1 } }).catch(() => ({ data: { success: false } })),
        apiClient.get('/custom-orders', { params: { status: 'pending', limit: 5 } }).catch(() => ({ data: { success: false } })),
        apiClient.get('/repairs', { params: { status: 'pending', limit: 5 } }).catch(() => ({ data: { success: false } })),
        apiClient.get('/loans', { params: { status: 'active', limit: 1 } }).catch(() => ({ data: { success: false } })),
        apiClient.get('/accounting/expenses', { params: { limit: 5 } }).catch(() => ({ data: { success: false } })),
        apiClient.get('/reports/dashboard-metrics').catch(() => ({ data: { success: false } })),
        apiClient.get(`/reports/category-performance?startDate=${startOfMonth}&endDate=${endDate}`).catch(() => ({ data: { success: false } })),
        apiClient.get('/reports/stock-aging').catch(() => ({ data: { success: false } })),
      ]);

      // Process inventory data
      const inventoryData = {
        totalItems: inventoryRes.data?.pagination?.total || 0,
        totalValue: 0,
        lowStockCount: 0,
        recentBatches: 0,
      };

      // Process financial data
      const financialData = financialRes.data?.success ? financialRes.data.data : {
        cashInHand: 0,
        bankBalance: 0,
        receivables: 0,
        payables: 0,
        todayIncome: 0,
        todayExpenses: 0,
        monthIncome: 0,
        monthExpenses: 0,
      };

      // Process customers data
      const customersData = {
        totalCustomers: customersRes.data?.pagination?.total || 0,
        newThisMonth: 0,
        activeCustomers: 0,
      };

      // Process orders data
      const ordersData = {
        pendingCustomOrders: customOrdersRes.data?.pagination?.total || 0,
        pendingRepairs: repairsRes.data?.pagination?.total || 0,
        activeLoans: loansRes.data?.pagination?.total || 0,
      };

      setStats({
        inventory: inventoryData,
        sales: {
          todaySales: financialData.todayIncome,
          todayTransactions: 0,
          monthSales: financialData.monthIncome,
          monthTransactions: 0,
        },
        customers: customersData,
        financial: financialData,
        orders: ordersData,
      });

      // Process dashboard metrics
      if (dashboardMetricsRes.data?.success) {
        setMetrics(dashboardMetricsRes.data.data);
      }

      // Process category performance
      if (categoryRes.data?.success && categoryRes.data.data) {
        setCategoryData(categoryRes.data.data.slice(0, 6));
      }

      // Process aging data
      if (agingRes.data?.success) {
        setAgingData(agingRes.data.data);
        // Update inventory total value from aging report
        if (agingRes.data.data.totalValue) {
          inventoryData.totalValue = agingRes.data.data.totalValue;
        }
        if (agingRes.data.data.totalItems) {
          inventoryData.totalItems = agingRes.data.data.totalItems;
        }
      }

      // Generate weekly chart data (mock for now - would come from daily summaries)
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const mockWeeklyData = days.map((day, i) => ({
        day,
        revenue: Math.random() * 500000 + 100000,
        profit: Math.random() * 100000 + 20000,
      }));
      setWeeklyData(mockWeeklyData);

      // Build recent activity
      const activities: RecentActivity[] = [];

      // Add recent custom orders
      if (customOrdersRes.data?.success && customOrdersRes.data.data) {
        customOrdersRes.data.data.slice(0, 3).forEach((order: any) => {
          activities.push({
            id: order.id,
            type: 'custom_order',
            title: `Custom Order #${order.orderNumber}`,
            description: order.description || 'New custom order',
            amount: parseFloat(order.estimatedTotal || 0),
            time: order.createdAt,
            status: order.status,
          });
        });
      }

      // Add recent repairs
      if (repairsRes.data?.success && repairsRes.data.data) {
        repairsRes.data.data.slice(0, 3).forEach((repair: any) => {
          activities.push({
            id: repair.id,
            type: 'repair',
            title: `Repair #${repair.repairNumber}`,
            description: repair.itemDescription || 'Repair job',
            amount: parseFloat(repair.estimatedCost || 0),
            time: repair.createdAt,
            status: repair.status,
          });
        });
      }

      // Add recent expenses
      if (expensesRes.data?.success && expensesRes.data.data) {
        expensesRes.data.data.slice(0, 3).forEach((expense: any) => {
          activities.push({
            id: expense.id,
            type: 'expense',
            title: expense.description,
            description: expense.category || 'Expense',
            amount: parseFloat(expense.totalAmount || 0),
            time: expense.createdAt,
          });
        });
      }

      // Sort by time
      activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setRecentActivity(activities.slice(0, 8));

      // Build alerts
      const newAlerts: { type: string; message: string; link?: string }[] = [];

      if (ordersData.pendingCustomOrders > 0) {
        newAlerts.push({
          type: 'warning',
          message: `${ordersData.pendingCustomOrders} pending custom orders need attention`,
          link: '/custom-orders',
        });
      }

      if (ordersData.pendingRepairs > 0) {
        newAlerts.push({
          type: 'info',
          message: `${ordersData.pendingRepairs} repairs awaiting completion`,
          link: '/repairs',
        });
      }

      if (financialData.receivables > 0) {
        newAlerts.push({
          type: 'warning',
          message: `Outstanding receivables: ${formatCurrency(financialData.receivables)}`,
          link: '/accounting',
        });
      }

      // Dead stock alert
      if (agingRes.data?.success && agingRes.data.data?.deadStockItems?.length > 5) {
        newAlerts.push({
          type: 'warning',
          message: `${agingRes.data.data.deadStockItems.length} items are dead stock (>180 days)`,
          link: '/reports/stock-aging',
        });
      }

      setAlerts(newAlerts);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!metrics || !agingData) return;

    exportDashboardPDF({
      storeName: store?.name || 'MARI Jewellers',
      metrics: {
        todaySales: metrics.today.salesCount,
        todayRevenue: metrics.today.revenue,
        todayProfit: metrics.today.profit,
        weekRevenue: metrics.thisWeek.revenue,
        weekProfit: metrics.thisWeek.profit,
        monthRevenue: metrics.thisMonth.revenue,
        monthProfit: metrics.thisMonth.profit,
        inventoryValue: agingData.totalValue,
        inventoryCount: agingData.totalItems,
        deadStockCount: agingData.deadStockCount,
        avgInventoryAge: agingData.averageAge,
      },
      topCategories: categoryData.map(c => ({
        category: c.categoryName,
        revenue: c.totalRevenue,
        profit: c.totalProfit,
      })),
      recentActivity: recentActivity.map(a => ({
        type: a.type,
        description: a.title,
        time: formatTime(a.time),
      })),
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'sale': return <ShoppingCart className="h-4 w-4" />;
      case 'repair': return <Wrench className="h-4 w-4" />;
      case 'custom_order': return <Sparkles className="h-4 w-4" />;
      case 'expense': return <Receipt className="h-4 w-4" />;
      case 'customer': return <UserPlus className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'sale': return 'bg-green-100 text-green-600';
      case 'repair': return 'bg-orange-100 text-orange-600';
      case 'custom_order': return 'bg-purple-100 text-purple-600';
      case 'expense': return 'bg-red-100 text-red-600';
      case 'customer': return 'bg-blue-100 text-blue-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const netToday = (stats?.financial.todayIncome || 0) - (stats?.financial.todayExpenses || 0);
  const netMonth = (stats?.financial.monthIncome || 0) - (stats?.financial.monthExpenses || 0);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.fullName || 'User'}!
          </h1>
          <p className="text-gray-500 mt-1">
            Here's what's happening at <span className="font-medium">{store?.name || 'your store'}</span> today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={fetchDashboardData}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <Card
              key={index}
              className={`p-3 flex items-center justify-between cursor-pointer hover:shadow-md transition ${alert.type === 'warning' ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'
                }`}
              onClick={() => alert.link && router.push(alert.link)}
            >
              <div className="flex items-center gap-3">
                <Bell className={`h-5 w-5 ${alert.type === 'warning' ? 'text-yellow-600' : 'text-blue-600'}`} />
                <span className={`text-sm ${alert.type === 'warning' ? 'text-yellow-800' : 'text-blue-800'}`}>
                  {alert.message}
                </span>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </Card>
          ))}
        </div>
      )}

      {/* Key Metrics with Margin Data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Today's Revenue</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(metrics?.today.revenue || stats?.financial.todayIncome || 0)}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-green-600">
                  Profit: {formatCurrency(metrics?.today.profit || 0)}
                </span>
              </div>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">This Month</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(metrics?.thisMonth.revenue || stats?.financial.monthIncome || 0)}</p>
              <div className="flex items-center gap-1 mt-1">
                {metrics?.comparison.revenueChange !== undefined && (
                  <>
                    {metrics.comparison.revenueChange >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className={`text-xs ${metrics.comparison.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {metrics.comparison.revenueChange >= 0 ? '+' : ''}{metrics.comparison.revenueChange.toFixed(1)}% vs last month
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Inventory Value</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(agingData?.totalValue || 0)}</p>
              <p className="text-xs text-gray-500 mt-1">{agingData?.totalItems?.toLocaleString() || 0} items</p>
            </div>
            <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Package className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg Margin</p>
              <p className="text-2xl font-bold mt-1">{(metrics?.thisMonth.avgMargin || 0).toFixed(1)}%</p>
              <p className="text-xs text-gray-500 mt-1">{metrics?.thisMonth.salesCount || 0} sales this month</p>
            </div>
            <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
              <Target className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </Card>
      </div>



      {/* Pending Work & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Work */}
        <Card className="p-5">
          <h3 className="font-semibold text-lg mb-4">Pending Work</h3>
          <div className="space-y-3">
            {(!user?.role || ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'sales_agent'].includes(user.role)) && (
              <Link href="/custom-orders">
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    <span className="text-sm font-medium">Custom Orders</span>
                  </div>
                  <Badge className="bg-purple-200 text-purple-800">
                    {stats?.orders.pendingCustomOrders || 0}
                  </Badge>
                </div>
              </Link>
            )}
            {(!user?.role || ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager'].includes(user.role)) && (
              <Link href="/repairs">
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Wrench className="h-5 w-5 text-orange-600" />
                    <span className="text-sm font-medium">Repairs</span>
                  </div>
                  <Badge className="bg-orange-200 text-orange-800">
                    {stats?.orders.pendingRepairs || 0}
                  </Badge>
                </div>
              </Link>
            )}
            {(!user?.role || ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager'].includes(user.role)) && (
              <Link href="/loans">
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Coins className="h-5 w-5 text-yellow-600" />
                    <span className="text-sm font-medium">Active Loans</span>
                  </div>
                  <Badge className="bg-yellow-200 text-yellow-800">
                    {stats?.orders.activeLoans || 0}
                  </Badge>
                </div>
              </Link>
            )}
          </div>
        </Card>



        {/* Recent Activity */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Recent Activity</h3>
            <Button variant="ghost" size="sm" onClick={() => router.push('/reports')}>
              View All
            </Button>
          </div>
          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${getActivityColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{activity.title}</p>
                    <p className="text-xs text-gray-500 truncate">{activity.description}</p>
                  </div>
                  <div className="text-right">
                    {activity.amount !== undefined && (
                      <p className={`font-medium text-sm ${activity.type === 'expense' ? 'text-red-600' : 'text-gray-900'}`}>
                        {activity.type === 'expense' ? '-' : ''}{formatCurrency(activity.amount)}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">{formatTime(activity.time)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Module Cards */}
      <div>
        <h3 className="font-semibold text-lg mb-4">Modules</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {modules.filter(module => !module.roles || (user?.role && module.roles.includes(user.role))).map((module) => (
            <Card
              key={module.name}
              className="p-4 hover:shadow-md transition cursor-pointer"
              onClick={() => router.push(module.link)}
            >
              <div className="flex flex-col items-center text-center">
                <div className={`w-12 h-12 ${module.color} rounded-lg flex items-center justify-center mb-3`}>
                  {module.icon}
                </div>
                <h4 className="font-medium text-sm">{module.name}</h4>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

const modules = [
  {
    name: 'Inventory',
    icon: <Package className="h-6 w-6 text-purple-600" />,
    color: 'bg-purple-100',
    link: '/inventory',
    roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'stock_controller'],
  },
  {
    name: 'Sales',
    icon: <ShoppingCart className="h-6 w-6 text-green-600" />,
    color: 'bg-green-100',
    link: '/sales',
    roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'sales_agent'],
  },
  {
    name: 'Customers',
    icon: <Users className="h-6 w-6 text-blue-600" />,
    color: 'bg-blue-100',
    link: '/customers',
    roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'sales_agent'],
  },
  {
    name: 'Custom Orders',
    icon: <Sparkles className="h-6 w-6 text-pink-600" />,
    color: 'bg-pink-100',
    link: '/custom-orders',
    roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'sales_agent'],
  },
  {
    name: 'Repairs',
    icon: <Wrench className="h-6 w-6 text-orange-600" />,
    color: 'bg-orange-100',
    link: '/repairs',
    roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager'],
  },
  {
    name: 'Gold Loans',
    icon: <Coins className="h-6 w-6 text-yellow-600" />,
    color: 'bg-yellow-100',
    link: '/loans',
    roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager'],
  },
  {
    name: 'Accounting',
    icon: <Receipt className="h-6 w-6 text-teal-600" />,
    color: 'bg-teal-100',
    link: '/accounting',
    roles: ['superadmin', 'super_admin', 'owner', 'accountant'],
  },
  {
    name: 'Suppliers',
    icon: <Package className="h-6 w-6 text-indigo-600" />,
    color: 'bg-indigo-100',
    link: '/suppliers',
    roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'stock_controller'],
  },
  {
    name: 'Reports',
    icon: <TrendingUp className="h-6 w-6 text-red-600" />,
    color: 'bg-red-100',
    link: '/reports',
    roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'accountant'],
  },
  {
    name: 'Settings',
    icon: <Target className="h-6 w-6 text-gray-600" />,
    color: 'bg-gray-100',
    link: '/settings',
    roles: ['superadmin', 'owner'],
  },
];
