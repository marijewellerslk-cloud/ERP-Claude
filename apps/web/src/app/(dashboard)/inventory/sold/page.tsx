'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import {
  Package,
  Search,
  Loader2,
  Calendar,
  TrendingUp,
  DollarSign,
  ArrowLeft,
  FileText,
  Filter,
} from 'lucide-react';

interface SoldItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  metalType: string;
  purity: string;
  grossWeight: string;
  netWeight: string;
  calculatedCost: string;
  soldAt: string;
  soldPrice: string;
  soldInvoiceId: string;
  profit: string;
  dailyGoldRate: string;
  imageUrls?: string[];
  categoryId?: string;
}

interface Summary {
  totalItems: number;
  totalRevenue: number;
  totalProfit: number;
  totalCost: number;
  profitMargin: string;
}

export default function SoldItemsPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SoldItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [metalType, setMetalType] = useState('all');

  useEffect(() => {
    fetchSoldItems();
  }, []);

  const fetchSoldItems = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (metalType && metalType !== 'all') params.append('metalType', metalType);

      const response = await apiClient.get(`/inventory/items/sold?${params.toString()}`);
      if (response.data.success) {
        setItems(response.data.data || []);
        setSummary(response.data.summary || null);
      }
    } catch (error) {
      console.error('Failed to fetch sold items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    fetchSoldItems();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/inventory">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Sold Items</h1>
            <p className="text-gray-500 mt-1">Track sold inventory with profit analysis</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Items Sold</p>
                <p className="text-2xl font-bold">{summary.totalItems}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Cost</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalCost)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Profit</p>
                <p className={`text-2xl font-bold ${summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(summary.totalProfit)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Profit Margin</p>
                <p className={`text-2xl font-bold ${parseFloat(summary.profitMargin) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.profitMargin}%
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">End Date</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Metal Type</label>
            <Select value={metalType} onValueChange={setMetalType}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="gold">Gold</SelectItem>
                <SelectItem value="silver">Silver</SelectItem>
                <SelectItem value="platinum">Platinum</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleFilter} className="w-full">
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Sold Items Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-4 font-semibold">Item</th>
                  <th className="text-left p-4 font-semibold">Details</th>
                  <th className="text-right p-4 font-semibold">Cost</th>
                  <th className="text-right p-4 font-semibold">Sold Price</th>
                  <th className="text-right p-4 font-semibold">Profit</th>
                  <th className="text-center p-4 font-semibold">Sold Date</th>
                  <th className="text-center p-4 font-semibold">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const profit = parseFloat(item.profit || '0');
                  const profitPercent = item.calculatedCost && parseFloat(item.calculatedCost) > 0
                    ? ((profit / parseFloat(item.calculatedCost)) * 100).toFixed(1)
                    : '0';

                  return (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {item.imageUrls && item.imageUrls.length > 0 ? (
                            <img
                              src={item.imageUrls[0]}
                              alt={item.name}
                              className="w-12 h-12 object-cover rounded-lg border"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-lg border flex items-center justify-center">
                              <Package className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-sm">
                          {item.metalType} {item.purity}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.netWeight}g net
                        </p>
                      </td>
                      <td className="p-4 text-right">
                        <p className="font-medium">
                          {formatCurrency(parseFloat(item.calculatedCost || '0'))}
                        </p>
                      </td>
                      <td className="p-4 text-right">
                        <p className="font-semibold text-blue-600">
                          {formatCurrency(parseFloat(item.soldPrice || '0'))}
                        </p>
                      </td>
                      <td className="p-4 text-right">
                        <p className={`font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(profit)}
                        </p>
                        <p className={`text-xs ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {profit >= 0 ? '+' : ''}{profitPercent}%
                        </p>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                          <Calendar className="h-3 w-3" />
                          {new Date(item.soldAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {item.soldInvoiceId && (
                          <Link href={`/sales/invoices/${item.soldInvoiceId}`}>
                            <Button variant="ghost" size="sm">
                              <FileText className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No sold items found</p>
            <p className="text-sm text-gray-400">Items will appear here once they are sold through invoices</p>
          </div>
        )}
      </Card>
    </div>
  );
}
