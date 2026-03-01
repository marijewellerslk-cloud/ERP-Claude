'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Factory,
  TrendingUp,
  Users,
  Package,
  FileText,
  DollarSign,
  Scale,
  AlertTriangle,
  ArrowRight,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';

interface TopSupplier {
  id: string;
  businessName: string;
  currentBalance: number;
  goldBalanceGrams: number;
  lastPurchaseDate: string | null;
}

interface RecentPurchase {
  id: string;
  batchNumber: string;
  purchaseDate: string;
  totalCost: number;
  purchaseType: string;
  paymentStatus: string;
  outstandingBalance: number;
  supplierName: string;
  supplierId: string;
}

interface OverviewStats {
  totalSuppliers: number;
  activeSuppliers: number;
  totalOutstanding: number;
  totalPurchases: number;
  purchasesThisMonth: number;
  totalGoldBalance: number;
  totalGoldExchangeBalance: number;
  topSuppliers: TopSupplier[];
  recentPurchases: RecentPurchase[];
  overduePayments: number;
  totalOverdue: number;
}

export default function SuppliersPage() {
  const [stats, setStats] = useState<OverviewStats>({
    totalSuppliers: 0,
    activeSuppliers: 0,
    totalOutstanding: 0,
    totalPurchases: 0,
    purchasesThisMonth: 0,
    totalGoldBalance: 0,
    totalGoldExchangeBalance: 0,
    topSuppliers: [],
    recentPurchases: [],
    overduePayments: 0,
    totalOverdue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await apiClient.get('/suppliers/overview');
        if (response.data.success) {
          setStats(response.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch supplier stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Paid</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Partial</Badge>;
      case 'pending':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Supplier Management</h1>
          <p className="text-gray-500 mt-1">Overview of supplier accounts, balances, and recent activity</p>
        </div>
        <div className="flex gap-2">
          <Link href="/suppliers/list">
            <Button variant="outline">
              <Users className="h-4 w-4 mr-2" />
              All Suppliers
            </Button>
          </Link>
          <Link href="/suppliers/new">
            <Button>
              <FileText className="h-4 w-4 mr-2" />
              Add Supplier
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Suppliers</p>
              <p className="text-2xl font-bold mt-1">
                {loading ? '...' : stats.totalSuppliers}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {loading ? '' : `${stats.activeSuppliers} active`}
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-50 rounded-full flex items-center justify-center">
              <Factory className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Purchases This Month</p>
              <p className="text-2xl font-bold mt-1">
                {loading ? '...' : formatCurrency(stats.purchasesThisMonth)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {loading ? '' : `${formatCurrency(stats.totalPurchases)} total`}
              </p>
            </div>
            <div className="h-12 w-12 bg-purple-50 rounded-full flex items-center justify-center">
              <Package className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Outstanding Payments</p>
              <p className="text-2xl font-bold mt-1 text-red-600">
                {loading ? '...' : formatCurrency(stats.totalOutstanding)}
              </p>
              {!loading && stats.overduePayments > 0 && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {stats.overduePayments} overdue ({formatCurrency(stats.totalOverdue)})
                </p>
              )}
            </div>
            <div className="h-12 w-12 bg-red-50 rounded-full flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Gold Balance</p>
              <p className="text-2xl font-bold mt-1 text-amber-600">
                {loading ? '...' : `${stats.totalGoldBalance.toFixed(3)}g`}
              </p>
              {!loading && stats.totalGoldExchangeBalance !== 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Exchange: {stats.totalGoldExchangeBalance.toFixed(3)}g
                </p>
              )}
            </div>
            <div className="h-12 w-12 bg-amber-50 rounded-full flex items-center justify-center">
              <Scale className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Two Column Layout: Top Suppliers + Recent Purchases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Suppliers by Outstanding Balance */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Top Suppliers by Balance</CardTitle>
              <Link href="/suppliers/list">
                <Button variant="ghost" size="sm" className="text-xs">
                  View All <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-gray-100 rounded" />
                ))}
              </div>
            ) : stats.topSuppliers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No outstanding balances</p>
            ) : (
              <div className="space-y-3">
                {stats.topSuppliers.map((supplier) => (
                  <Link key={supplier.id} href={`/suppliers/${supplier.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition cursor-pointer">
                      <div>
                        <p className="font-medium text-sm">{supplier.businessName}</p>
                        <p className="text-xs text-gray-400">
                          {supplier.lastPurchaseDate
                            ? `Last purchase: ${new Date(supplier.lastPurchaseDate).toLocaleDateString()}`
                            : 'No purchases yet'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm text-red-600">
                          {formatCurrency(supplier.currentBalance)}
                        </p>
                        {supplier.goldBalanceGrams > 0 && (
                          <p className="text-xs text-amber-600">{supplier.goldBalanceGrams.toFixed(3)}g gold</p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Purchases */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Recent Purchases</CardTitle>
              <Link href="/inventory">
                <Button variant="ghost" size="sm" className="text-xs">
                  View All <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-gray-100 rounded" />
                ))}
              </div>
            ) : stats.recentPurchases.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No purchases yet</p>
            ) : (
              <div className="space-y-3">
                {stats.recentPurchases.map((purchase) => (
                  <Link key={purchase.id} href={`/suppliers/${purchase.supplierId}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition cursor-pointer">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{purchase.batchNumber}</p>
                          {getPaymentStatusBadge(purchase.paymentStatus)}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {purchase.supplierName} • {new Date(purchase.purchaseDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">
                          {purchase.purchaseType === 'gold_exchange'
                            ? 'Gold Exchange'
                            : formatCurrency(purchase.totalCost)}
                        </p>
                        {purchase.outstandingBalance > 0 && (
                          <p className="text-xs text-red-500">
                            Due: {formatCurrency(purchase.outstandingBalance)}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/suppliers/list">
          <Card className="p-5 hover:bg-gray-50 cursor-pointer transition border-2 border-transparent hover:border-blue-200">
            <Users className="h-7 w-7 text-blue-600 mb-2" />
            <h3 className="font-semibold">View Suppliers</h3>
            <p className="text-sm text-gray-500 mt-1">Browse and manage supplier database</p>
          </Card>
        </Link>

        <Link href="/suppliers/new">
          <Card className="p-5 hover:bg-gray-50 cursor-pointer transition border-2 border-transparent hover:border-green-200">
            <FileText className="h-7 w-7 text-green-600 mb-2" />
            <h3 className="font-semibold">Add Supplier</h3>
            <p className="text-sm text-gray-500 mt-1">Register a new supplier</p>
          </Card>
        </Link>

        <Link href="/inventory/batches/new">
          <Card className="p-5 hover:bg-gray-50 cursor-pointer transition border-2 border-transparent hover:border-purple-200">
            <Package className="h-7 w-7 text-purple-600 mb-2" />
            <h3 className="font-semibold">New Purchase</h3>
            <p className="text-sm text-gray-500 mt-1">Create a new purchase batch</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
