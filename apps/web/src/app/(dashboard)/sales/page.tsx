'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/api-client';
import { Plus, DollarSign, FileText, Clock } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';

interface SalesStats {
  totalSales: number;
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
}

export default function SalesPage() {
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const response = await apiClient.get(
          `/sales/stats?startDate=${startOfMonth.toISOString()}&endDate=${endOfMonth.toISOString()}`
        );

        if (response.data.success) {
          setStats(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch sales stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales & POS"
        description="Manage invoices, quotations, and gold rates"
      >
        <div className="flex gap-3">
          <Link href="/sales/gold-rates">
            <Button variant="outline">
              <DollarSign className="h-4 w-4 mr-2" />
              Gold Rates
            </Button>
          </Link>
          <Link href="/sales/invoices/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Invoice
            </Button>
          </Link>
        </div>
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Sales (Month)</p>
              <p className="text-2xl font-bold mt-1">
                Rs {loading ? '...' : (stats?.totalSales || 0).toLocaleString('en-LK')}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Invoices</p>
              <p className="text-2xl font-bold mt-1">{loading ? '...' : stats?.totalInvoices || 0}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Paid Invoices</p>
              <p className="text-2xl font-bold mt-1">{loading ? '...' : stats?.paidInvoices || 0}</p>
            </div>
            <FileText className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Invoices</p>
              <p className="text-2xl font-bold mt-1">{loading ? '...' : stats?.pendingInvoices || 0}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/sales/invoices">
          <Card className="p-6 hover:bg-gray-50 cursor-pointer transition">
            <FileText className="h-8 w-8 text-blue-600 mb-3" />
            <h3 className="font-semibold text-lg">View Invoices</h3>
            <p className="text-sm text-gray-500 mt-1">Browse and manage all invoices</p>
          </Card>
        </Link>

        <Link href="/sales/invoices/new">
          <Card className="p-6 hover:bg-gray-50 cursor-pointer transition">
            <Plus className="h-8 w-8 text-green-600 mb-3" />
            <h3 className="font-semibold text-lg">Create Invoice</h3>
            <p className="text-sm text-gray-500 mt-1">Generate new sales invoice</p>
          </Card>
        </Link>

        <Link href="/sales/gold-rates">
          <Card className="p-6 hover:bg-gray-50 cursor-pointer transition">
            <DollarSign className="h-8 w-8 text-yellow-600 mb-3" />
            <h3 className="font-semibold text-lg">Gold Rates</h3>
            <p className="text-sm text-gray-500 mt-1">View and update daily rates</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
