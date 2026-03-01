'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/api-client';
import { Plus, Users, Award, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';

interface CustomerStats {
  totalCustomers: string;
  activeCustomers: string;
  bronzeTier: string;
  silverTier: string;
  goldTier: string;
  platinumTier: string;
}

export default function CustomersPage() {
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await apiClient.get('/customers/stats');

        if (response.data.success) {
          setStats(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch customer stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Management"
        description="Manage customer profiles and loyalty programs"
      >
        <Link href="/customers/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </Link>
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Customers</p>
              <p className="text-2xl font-bold mt-1">{loading ? '...' : stats?.totalCustomers || 0}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Customers</p>
              <p className="text-2xl font-bold mt-1">{loading ? '...' : stats?.activeCustomers || 0}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Gold Tier</p>
              <p className="text-2xl font-bold mt-1">{loading ? '...' : stats?.goldTier || 0}</p>
            </div>
            <Award className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Platinum Tier</p>
              <p className="text-2xl font-bold mt-1">{loading ? '...' : stats?.platinumTier || 0}</p>
            </div>
            <Award className="h-8 w-8 text-purple-600" />
          </div>
        </Card>
      </div>

      {/* Tier Distribution */}
      {stats && (
        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4">Customer Tiers</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                <Award className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Bronze</p>
                <p className="text-xl font-bold">{stats.bronzeTier}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Award className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Silver</p>
                <p className="text-xl font-bold">{stats.silverTier}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <Award className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Gold</p>
                <p className="text-xl font-bold">{stats.goldTier}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Award className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Platinum</p>
                <p className="text-xl font-bold">{stats.platinumTier}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/customers/list">
          <Card className="p-6 hover:bg-gray-50 cursor-pointer transition">
            <Users className="h-8 w-8 text-blue-600 mb-3" />
            <h3 className="font-semibold text-lg">View All Customers</h3>
            <p className="text-sm text-gray-500 mt-1">Browse customer database</p>
          </Card>
        </Link>

        <Link href="/customers/new">
          <Card className="p-6 hover:bg-gray-50 cursor-pointer transition">
            <Plus className="h-8 w-8 text-green-600 mb-3" />
            <h3 className="font-semibold text-lg">Add New Customer</h3>
            <p className="text-sm text-gray-500 mt-1">Register a new customer</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
