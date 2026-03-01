'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import {
  Users,
  TrendingUp,
  Award,
  UserPlus,
  ShoppingBag,
  DollarSign,
  Loader2,
} from 'lucide-react';

interface AnalyticsData {
  totalCustomers: number;
  activeCustomers: number;
  newCustomersThisMonth: number;
  tierDistribution: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
  rfmSegments: Record<string, number>;
  averageLifetimeValue: string;
  averagePurchaseFrequency: number;
  topReferrers: {
    id: string;
    name: string;
    referralCount: number;
    rewardedPoints: number;
  }[];
  retentionRate: number;
  churnRate: number;
}

const TIER_COLORS: Record<string, string> = {
  bronze: 'bg-orange-100 text-orange-800',
  silver: 'bg-gray-100 text-gray-800',
  gold: 'bg-yellow-100 text-yellow-800',
  platinum: 'bg-purple-100 text-purple-800',
};

const SEGMENT_COLORS: Record<string, string> = {
  champions: 'bg-green-100 text-green-800',
  loyal: 'bg-blue-100 text-blue-800',
  potential: 'bg-cyan-100 text-cyan-800',
  new: 'bg-teal-100 text-teal-800',
  promising: 'bg-indigo-100 text-indigo-800',
  need_attention: 'bg-yellow-100 text-yellow-800',
  about_to_sleep: 'bg-orange-100 text-orange-800',
  at_risk: 'bg-red-100 text-red-800',
  cant_lose: 'bg-pink-100 text-pink-800',
  hibernating: 'bg-gray-100 text-gray-800',
  lost: 'bg-slate-100 text-slate-800',
};

export default function CustomerAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);

        // Fetch analytics data
        const response = await apiClient.get('/customers/analytics');
        if (response.data.success) {
          setAnalytics(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load analytics data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Customer Analytics</h1>
        <p className="text-gray-500 mt-1">Insights and metrics about your customer base</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Customers</p>
              <p className="text-3xl font-bold mt-1">{analytics.totalCustomers.toLocaleString()}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Customers</p>
              <p className="text-3xl font-bold mt-1">{analytics.activeCustomers.toLocaleString()}</p>
              <p className="text-xs text-green-600 mt-1">
                {((analytics.activeCustomers / analytics.totalCustomers) * 100).toFixed(1)}% active
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">New This Month</p>
              <p className="text-3xl font-bold mt-1">{analytics.newCustomersThisMonth.toLocaleString()}</p>
            </div>
            <UserPlus className="h-8 w-8 text-purple-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg. Lifetime Value</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(parseFloat(analytics.averageLifetimeValue))}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>
      </div>

      {/* Tier Distribution */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-6">Loyalty Tier Distribution</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Object.entries(analytics.tierDistribution).map(([tier, count]) => {
            const percentage = (count / analytics.totalCustomers) * 100;
            return (
              <div key={tier} className="text-center">
                <div className={`h-32 flex items-end justify-center ${TIER_COLORS[tier]} rounded-t-lg`}>
                  <div
                    className="w-full bg-current opacity-30 rounded-t-lg transition-all"
                    style={{ height: `${percentage}%` }}
                  />
                </div>
                <div className="mt-3">
                  <Badge className={TIER_COLORS[tier]}>
                    <Award className="h-3 w-3 mr-1" />
                    {tier.toUpperCase()}
                  </Badge>
                  <p className="text-2xl font-bold mt-2">{count}</p>
                  <p className="text-sm text-gray-500">{percentage.toFixed(1)}%</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RFM Segments */}
        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4">RFM Segments</h3>
          <div className="space-y-3">
            {Object.entries(analytics.rfmSegments || {})
              .sort((a, b) => b[1] - a[1])
              .map(([segment, count]) => {
                const percentage = (count / analytics.totalCustomers) * 100;
                return (
                  <div key={segment} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <Badge className={SEGMENT_COLORS[segment] || 'bg-gray-100'}>
                        {segment.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                      <div className="flex-1">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold">{count}</p>
                      <p className="text-xs text-gray-500">{percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>

        {/* Top Referrers */}
        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4">Top Referrers</h3>
          {analytics.topReferrers && analytics.topReferrers.length > 0 ? (
            <div className="space-y-3">
              {analytics.topReferrers.map((referrer, index) => (
                <div key={referrer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{referrer.name}</p>
                      <p className="text-sm text-gray-500">{referrer.referralCount} referrals</p>
                    </div>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-800">
                    {referrer.rewardedPoints} pts
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No referrals yet</p>
          )}
        </Card>
      </div>

      {/* Retention & Churn */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4">Customer Retention</h3>
          <div className="text-center">
            <div className="inline-flex items-center justify-center h-32 w-32 rounded-full bg-green-100 mb-4">
              <p className="text-4xl font-bold text-green-600">{analytics.retentionRate.toFixed(1)}%</p>
            </div>
            <p className="text-gray-600">Customers making repeat purchases</p>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4">Churn Rate</h3>
          <div className="text-center">
            <div className="inline-flex items-center justify-center h-32 w-32 rounded-full bg-red-100 mb-4">
              <p className="text-4xl font-bold text-red-600">{analytics.churnRate.toFixed(1)}%</p>
            </div>
            <p className="text-gray-600">Customers at risk of churning</p>
          </div>
        </Card>
      </div>

      {/* Purchase Metrics */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Purchase Behavior</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <ShoppingBag className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold">{analytics.averagePurchaseFrequency.toFixed(1)}</p>
            <p className="text-sm text-gray-600">Avg. Purchase Frequency</p>
            <p className="text-xs text-gray-500 mt-1">purchases per customer</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
