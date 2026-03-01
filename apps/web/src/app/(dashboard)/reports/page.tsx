'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  FileText,
  TrendingUp,
  DollarSign,
  Users,
  Package,
  Calendar,
  Mail,
  Activity,
  RefreshCw,
  Clock,
  Target,
  Award,
  ArrowRight,
  Coins,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';

interface DailySummary {
  id: string;
  summaryDate: string;
  totalSales: string;
  totalInvoices: number;
  totalCustomers: number;
  itemsAdded: number;
  batchesCreated: number;
  totalPaymentsReceived: string;
  outstandingReceivables: string;
  totalActivities: number;
  activeUsers: number;
  topSellingCategories: any[];
  topCustomers: any[];
  inventoryChanges: any[];
}

interface ActivityLog {
  id: string;
  activityDate: string;
  category: string;
  activityType: string;
  description: string;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
  quantityChange?: number;
  amountChange?: string;
}

interface SchedulerStatus {
  name: string;
  running: boolean;
}

export default function ReportsPage() {
  const { user } = useAuthStore();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringBriefing, setTriggeringBriefing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllData();
  }, [selectedDate]);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchDailySummary(),
        fetchActivityLog(),
        fetchSchedulerStatus(),
      ]);
    } catch (err: any) {
      // Individual fetchers handle their own errors
    } finally {
      setLoading(false);
    }
  };

  const fetchDailySummary = async () => {
    try {
      const response = await apiClient.get(`/reports/daily-summary?date=${selectedDate}`);
      setDailySummary(response.data.data);
    } catch (error: any) {
      console.error('Failed to fetch daily summary:', error);
      setDailySummary(null);
    }
  };

  const fetchActivityLog = async () => {
    try {
      const response = await apiClient.get(`/reports/activity-log?date=${selectedDate}&limit=50`);
      setActivityLog(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch activity log:', error);
      setActivityLog([]);
    }
  };

  const fetchSchedulerStatus = async () => {
    try {
      const response = await apiClient.get('/reports/scheduler-status');
      setSchedulerStatus(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch scheduler status', error);
      setSchedulerStatus([]);
    }
  };

  const triggerDailyBriefing = async () => {
    try {
      setTriggeringBriefing(true);
      await apiClient.post('/reports/trigger-briefing', { date: selectedDate });
      toast.success('Daily briefing email triggered successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to trigger daily briefing');
      console.error(error);
    } finally {
      setTriggeringBriefing(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      sales: 'bg-green-100 text-green-700',
      inventory: 'bg-blue-100 text-blue-700',
      customer: 'bg-purple-100 text-purple-700',
      finance: 'bg-yellow-100 text-yellow-700',
      system: 'bg-gray-100 text-gray-700',
    };
    return colors[category] || colors.system;
  };

  const isSuperAdmin = user?.permissions?.includes('*:*');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Daily Briefing & Reports</h1>
          <p className="text-gray-500 mt-1">Monitor daily business activities and performance</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button onClick={fetchAllData} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {isSuperAdmin && (
            <Button onClick={triggerDailyBriefing} disabled={triggeringBriefing}>
              <Mail className="h-4 w-4 mr-2" />
              {triggeringBriefing ? 'Sending...' : 'Send Briefing Email'}
            </Button>
          )}
        </div>
      </div>

      {/* Report Types Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/reports/margin-analysis">
          <Card className="p-5 hover:shadow-md transition cursor-pointer border-l-4 border-l-green-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Target className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold">ROI & Margin Analysis</h3>
                  <p className="text-sm text-gray-500">Profitability by item & category</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </div>
          </Card>
        </Link>

        <Link href="/reports/stock-aging">
          <Card className="p-5 hover:shadow-md transition cursor-pointer border-l-4 border-l-orange-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Stock Aging Report</h3>
                  <p className="text-sm text-gray-500">Identify dead stock & slow movers</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </div>
          </Card>
        </Link>

        <Link href="/reports/salesperson">
          <Card className="p-5 hover:shadow-md transition cursor-pointer border-l-4 border-l-purple-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Award className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Salesperson Performance</h3>
                  <p className="text-sm text-gray-500">Track sales team & commissions</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </div>
          </Card>
        </Link>

        <Link href="/reports/valuation">
          <Card className="p-5 hover:shadow-md transition cursor-pointer border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Coins className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Inventory Valuation</h3>
                  <p className="text-sm text-gray-500">Total stock value by metal</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </div>
          </Card>
        </Link>
      </div>

      {/* Scheduler Status */}
      {schedulerStatus.length > 0 && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-blue-900">Automated Jobs:</span>
            {schedulerStatus.map((job) => (
              <span
                key={job.name}
                className={`text-sm px-2 py-1 rounded ${job.running ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
              >
                {job.name}: {job.running ? 'Running' : 'Stopped'}
              </span>
            ))}
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-2">Loading daily summary...</p>
        </div>
      ) : dailySummary ? (
        <>
          {/* Sales Summary */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Sales Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Sales</p>
                    <p className="text-2xl font-bold mt-1 text-green-600">
                      {formatCurrency(parseFloat(dailySummary.totalSales))}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Invoices</p>
                    <p className="text-2xl font-bold mt-1">{dailySummary.totalInvoices}</p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Customers Served</p>
                    <p className="text-2xl font-bold mt-1">{dailySummary.totalCustomers}</p>
                  </div>
                  <Users className="h-8 w-8 text-purple-600" />
                </div>
              </Card>
            </div>

            {/* Top Customers */}
            {dailySummary.topCustomers && dailySummary.topCustomers.length > 0 && (
              <Card className="mt-4 p-6">
                <h3 className="font-semibold mb-3">Top Customers</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-2">Customer</th>
                        <th className="text-right p-2">Total Spent</th>
                        <th className="text-right p-2">Invoices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailySummary.topCustomers.map((customer: any, idx: number) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{customer.customerName}</td>
                          <td className="p-2 text-right font-medium">
                            {formatCurrency(parseFloat(customer.totalSpent))}
                          </td>
                          <td className="p-2 text-right">{customer.invoiceCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>

          {/* Inventory Summary */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              Inventory Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Items Added</p>
                    <p className="text-2xl font-bold mt-1">{dailySummary.itemsAdded}</p>
                  </div>
                  <Package className="h-8 w-8 text-blue-600" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Batches Created</p>
                    <p className="text-2xl font-bold mt-1">{dailySummary.batchesCreated}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-indigo-600" />
                </div>
              </Card>
            </div>
          </div>

          {/* Financial Summary */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-yellow-600" />
              Financial Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Payments Received</p>
                    <p className="text-2xl font-bold mt-1 text-green-600">
                      {formatCurrency(parseFloat(dailySummary.totalPaymentsReceived))}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Outstanding Receivables</p>
                    <p className="text-2xl font-bold mt-1 text-orange-600">
                      {dailySummary.outstandingReceivables
                        ? formatCurrency(parseFloat(dailySummary.outstandingReceivables))
                        : '-'}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-orange-600" />
                </div>
              </Card>
            </div>
          </div>

          {/* Team Activity Summary */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-600" />
              Team Activity
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Activities</p>
                    <p className="text-2xl font-bold mt-1">{dailySummary.totalActivities}</p>
                  </div>
                  <Activity className="h-8 w-8 text-purple-600" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Active Users</p>
                    <p className="text-2xl font-bold mt-1">{dailySummary.activeUsers}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
              </Card>
            </div>
          </div>

          {/* Recent Activity Log */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-600" />
              Recent Activity Log
            </h2>
            <Card className="p-6">
              {activityLog.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {activityLog.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-xs px-2 py-1 rounded ${getCategoryColor(
                              activity.category
                            )}`}
                          >
                            {activity.category}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(activity.activityDate).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm font-medium">{activity.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          by {activity.user.fullName}
                          {activity.quantityChange && (
                            <span className="ml-2">
                              Qty: {activity.quantityChange > 0 ? '+' : ''}
                              {activity.quantityChange}
                            </span>
                          )}
                          {activity.amountChange && (
                            <span className="ml-2">
                              Amount: {formatCurrency(parseFloat(activity.amountChange))}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No activities recorded for {selectedDate}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Activities will appear here as your team uses the system
                  </p>
                </div>
              )}
            </Card>
          </div>
        </>
      ) : (
        <Card className="p-12 text-center">
          <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-600">No daily summary for {selectedDate}</p>
          <p className="text-sm text-gray-400 mt-2">
            Daily summaries are generated automatically at end of business day.
            {isSuperAdmin && ' You can also trigger one manually using the "Send Briefing Email" button.'}
          </p>
          {activityLog.length > 0 && (
            <div className="mt-6 text-left max-w-lg mx-auto">
              <h3 className="font-medium text-gray-700 mb-3">Recent Activity</h3>
              {activityLog.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-center gap-2 py-2 border-b last:border-0">
                  <span className={`text-xs px-2 py-0.5 rounded ${getCategoryColor(activity.category)}`}>
                    {activity.category}
                  </span>
                  <span className="text-sm text-gray-600 truncate">{activity.description}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
