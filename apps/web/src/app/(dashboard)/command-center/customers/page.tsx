'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Building2,
  Users,
  UserPlus,
  Star,
  Gift,
  RefreshCw,
  Crown,
  Phone,
  TrendingUp,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';

interface TierDistribution {
  tier: string;
  count: number;
}

interface StoreCustomerData {
  storeId: string;
  storeName: string;
  storeCode: string;
  totalCustomers: number;
  newCustomersThisMonth: number;
  totalLoyaltyPoints: number;
  pointsIssuedThisMonth: number;
  pointsRedeemedThisMonth: number;
  tierDistribution: TierDistribution[];
}

interface TopCustomer {
  id: string;
  name: string;
  phone: string | null;
  storeId: string;
  storeName: string;
  tier: string | null;
  loyaltyPoints: number;
  totalSpent: string;
  purchaseCount: number;
}

interface CustomerAnalytics {
  stores: StoreCustomerData[];
  totals: {
    totalCustomers: number;
    newCustomersThisMonth: number;
    totalLoyaltyPoints: number;
    pointsIssuedThisMonth: number;
    pointsRedeemedThisMonth: number;
  };
  topCustomers: TopCustomer[];
  tierDistribution: TierDistribution[];
}

export default function CustomerAnalyticsPage() {
  const [data, setData] = useState<CustomerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const response = await apiClient.get('/command-center/customers');
      setData(response.data?.data || null);
    } catch (error) {
      console.error('Error fetching customer data:', error);
    } finally {
      setLoading(false);
    }
  }

  const getTierColor = (tier: string | null) => {
    switch (tier?.toLowerCase()) {
      case 'platinum':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'gold':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'silver':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'bronze':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

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
        <Users className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No customer data available</h3>
        <p className="text-muted-foreground">No stores accessible for customer analytics</p>
      </div>
    );
  }

  const totals = data.totals;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Analytics</h1>
          <p className="text-muted-foreground">
            Customer insights across {data.stores.length} store(s)
          </p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalCustomers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all stores</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">New This Month</CardTitle>
            <UserPlus className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{totals.newCustomersThisMonth}</div>
            <p className="text-xs text-green-600">
              {totals.totalCustomers > 0
                ? ((totals.newCustomersThisMonth / totals.totalCustomers) * 100).toFixed(1)
                : 0}% growth
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Loyalty Points</CardTitle>
            <Star className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalLoyaltyPoints.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Active balance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Points Activity</CardTitle>
            <Gift className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+{totals.pointsIssuedThisMonth.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              -{totals.pointsRedeemedThisMonth.toLocaleString()} redeemed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tier Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Tier Distribution</CardTitle>
          <CardDescription>Breakdown by loyalty tier across all stores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.tierDistribution.map((tier) => {
              const percentage = totals.totalCustomers > 0
                ? (tier.count / totals.totalCustomers) * 100
                : 0;
              return (
                <div key={tier.tier || 'standard'} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crown className={`h-4 w-4 ${getTierColor(tier.tier).includes('purple') ? 'text-purple-600' : getTierColor(tier.tier).includes('yellow') ? 'text-yellow-600' : 'text-gray-600'}`} />
                      <span className="font-medium capitalize">{tier.tier || 'Standard'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{tier.count} customers</span>
                      <Badge variant="outline">{percentage.toFixed(1)}%</Badge>
                    </div>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Customers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Customers by Lifetime Value</CardTitle>
          <CardDescription>Your most valuable customers across all stores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.topCustomers.map((customer, index) => (
              <div
                key={customer.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {customer.phone && (
                        <>
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </>
                      )}
                      <span>|</span>
                      <span>{customer.purchaseCount} purchases</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="outline">{customer.storeName}</Badge>
                  {customer.tier && (
                    <Badge className={getTierColor(customer.tier)}>
                      {customer.tier}
                    </Badge>
                  )}
                  <div className="text-right">
                    <p className="font-bold text-lg">{formatCurrency(parseFloat(customer.totalSpent))}</p>
                    <p className="text-xs text-muted-foreground">
                      <Star className="h-3 w-3 inline text-yellow-500" /> {customer.loyaltyPoints} pts
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Store-wise Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Store-wise Customer Metrics</CardTitle>
          <CardDescription>Customer data for each branch</CardDescription>
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
                  {store.newCustomersThisMonth > 0 && (
                    <Badge className="bg-green-100 text-green-700">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +{store.newCustomersThisMonth} new
                    </Badge>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Total Customers</p>
                    <p className="font-semibold text-lg">{store.totalCustomers}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Loyalty Points</p>
                    <p className="font-semibold text-lg">{store.totalLoyaltyPoints.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Points Issued (Month)</p>
                    <p className="font-semibold text-lg text-green-600">+{store.pointsIssuedThisMonth}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Points Redeemed (Month)</p>
                    <p className="font-semibold text-lg text-purple-600">-{store.pointsRedeemedThisMonth}</p>
                  </div>
                </div>

                {/* Store tier distribution */}
                {store.tierDistribution.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Tier Distribution</p>
                    <div className="flex gap-2 flex-wrap">
                      {store.tierDistribution.map((tier) => (
                        <Badge key={tier.tier || 'standard'} variant="outline" className={getTierColor(tier.tier)}>
                          {tier.tier || 'Standard'}: {tier.count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
