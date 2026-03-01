'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  ShoppingCart,
  UserPlus,
  LogIn,
  LogOut,
  Package,
  Wrench,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';

interface ActivityItem {
  type: string;
  timestamp: string;
  storeId: string;
  storeName: string;
  description: string;
  amount?: number;
  reference?: string;
}

export default function ActivityFeedPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  async function fetchData() {
    try {
      setLoading(true);
      const response = await apiClient.get('/command-center/activity?limit=100');
      setActivities(response.data?.data || []);
    } catch (error) {
      console.error('Error fetching activity feed:', error);
    } finally {
      setLoading(false);
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'sale':
        return <ShoppingCart className="h-4 w-4 text-green-600" />;
      case 'new_customer':
        return <UserPlus className="h-4 w-4 text-blue-600" />;
      case 'clock_in':
        return <LogIn className="h-4 w-4 text-emerald-600" />;
      case 'clock_out':
        return <LogOut className="h-4 w-4 text-orange-600" />;
      case 'custom_order':
        return <Package className="h-4 w-4 text-purple-600" />;
      case 'repair':
        return <Wrench className="h-4 w-4 text-amber-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'sale':
        return 'bg-green-50 border-green-200';
      case 'new_customer':
        return 'bg-blue-50 border-blue-200';
      case 'clock_in':
        return 'bg-emerald-50 border-emerald-200';
      case 'clock_out':
        return 'bg-orange-50 border-orange-200';
      case 'custom_order':
        return 'bg-purple-50 border-purple-200';
      case 'repair':
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getActivityTypeLabel = (type: string) => {
    switch (type) {
      case 'sale':
        return 'Sale';
      case 'new_customer':
        return 'New Customer';
      case 'clock_in':
        return 'Clock In';
      case 'clock_out':
        return 'Clock Out';
      case 'custom_order':
        return 'Custom Order';
      case 'repair':
        return 'Repair';
      default:
        return 'Activity';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Group activities by type for summary
  const activitySummary = activities.reduce((acc, activity) => {
    acc[activity.type] = (acc[activity.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading && activities.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Activity Feed</h1>
          <p className="text-muted-foreground">
            Real-time activity across all stores (last 24 hours)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? 'default' : 'outline'}
          >
            {autoRefresh ? (
              <>
                <Activity className="mr-2 h-4 w-4 animate-pulse" />
                Live
              </>
            ) : (
              <>
                <Clock className="mr-2 h-4 w-4" />
                Auto-refresh Off
              </>
            )}
          </Button>
          <Button onClick={fetchData} variant="outline" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Activity Summary */}
      <div className="grid gap-4 md:grid-cols-6">
        {Object.entries(activitySummary).map(([type, count]) => (
          <Card key={type} className={getActivityColor(type)}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                {getActivityIcon(type)}
                <div>
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{getActivityTypeLabel(type)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
          <CardDescription>
            {activities.length} activities in the last 24 hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity, index) => (
                <div
                  key={`${activity.type}-${activity.timestamp}-${index}`}
                  className={`flex items-center justify-between p-3 rounded-lg border ${getActivityColor(activity.type)}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-white">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div>
                      <p className="font-medium">{activity.description}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {activity.storeName}
                        </Badge>
                        {activity.reference && (
                          <span className="text-xs">#{activity.reference}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {activity.amount !== undefined && activity.amount > 0 && (
                      <p className="font-semibold text-green-600">
                        {formatCurrency(activity.amount)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatTimestamp(activity.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
