'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Scale,
  TrendingUp,
  TrendingDown,
  Package,
  Hammer,
  Truck,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  FileText,
  Calculator,
  DollarSign,
} from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';

// Backend response structure
interface MetalPositionResponse {
  stores: Array<{
    storeId: string;
    storeName: string;
    storeCode: string;
    inventoryGold: {
      totalGrossWeight: number;
      totalNetWeight: number;
      totalFineGold: number;
      byPurity: Record<string, { weight: number; fineGold: number; count: number }>;
      totalValue: number;
    };
    karigarGold: {
      totalWeight: number;
      totalFineGold: number;
      karigarCount: number;
    };
    supplierGoldOwed: {
      totalWeight: number;
      totalFineGold: number;
      supplierCount: number;
    };
    netPosition: {
      totalFineGold: number;
      estimatedValue: number;
    };
  }>;
  totals: {
    inventoryFineGold: number;
    karigarFineGold: number;
    supplierOwedFineGold: number;
    netFineGold: number;
    totalEstimatedValue: number;
  };
  goldRate: number;
  calculatedAt: string;
}

interface ValuationSummary {
  totalItems: number;
  totalCost: number;
  totalMarketValue: number;
  unrealizedGainLoss: number;
  lastValuationDate: string | null;
}

interface StockAging {
  current: { count: number; value: number };
  thirtyDays: { count: number; value: number };
  sixtyDays: { count: number; value: number };
  ninetyDays: { count: number; value: number };
  overNinety: { count: number; value: number };
}

export default function MetalPositionPage() {
  const [position, setPosition] = useState<MetalPositionResponse | null>(null);
  const [valuation, setValuation] = useState<ValuationSummary | null>(null);
  const [aging, setAging] = useState<StockAging | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [positionRes, valuationRes, agingRes] = await Promise.all([
        apiClient.get('/metal/position'),
        apiClient.get('/inventory/valuation').catch(() => null),
        apiClient.get('/inventory/aging').catch(() => null),
      ]);

      if (positionRes.data.success) {
        setPosition(positionRes.data.data);
      }
      if (valuationRes?.data?.success) {
        setValuation(valuationRes.data.data);
      }
      if (agingRes?.data?.success) {
        setAging(agingRes.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load metal position');
    } finally {
      setLoading(false);
    }
  };

  const handleRevalue = async () => {
    try {
      setRefreshing(true);
      await apiClient.post('/inventory/revalue');
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to revalue inventory');
    } finally {
      setRefreshing(false);
    }
  };

  const handleBackfillFineGold = async () => {
    try {
      setBackfilling(true);
      const res = await apiClient.post('/metal/backfill-fine-gold');
      if (res.data.success) {
        await fetchData();
        alert(`Backfill complete: ${res.data.data.updated} items updated`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to backfill fine gold');
    } finally {
      setBackfilling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const totals = position?.totals;
  const goldRate = position?.goldRate || 0;
  const stores = position?.stores || [];

  // Transform byPurity object to array for display
  const purityData = stores[0]?.inventoryGold.byPurity
    ? Object.entries(stores[0].inventoryGold.byPurity).map(([purity, data]) => ({
        purity,
        ...data,
        currentValue: data.fineGold * goldRate,
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Metal Position</h1>
          <p className="text-gray-500 mt-1">
            Complete overview of gold holdings across all locations
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleBackfillFineGold} disabled={backfilling} variant="outline" size="sm">
            <Calculator className={`h-4 w-4 mr-2 ${backfilling ? 'animate-spin' : ''}`} />
            {backfilling ? 'Calculating...' : 'Backfill Fine Gold'}
          </Button>
          <Button onClick={handleRevalue} disabled={refreshing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Revaluing...' : 'Revalue Inventory'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Gold Rate Banner */}
      {goldRate > 0 && (
        <Card className="p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="h-6 w-6 text-amber-600" />
              <div>
                <p className="text-sm text-amber-700">Current Gold Rate (22K)</p>
                <p className="text-2xl font-bold text-amber-800">{formatCurrency(goldRate)}/gram</p>
              </div>
            </div>
            {position?.calculatedAt && (
              <p className="text-xs text-amber-600">
                Calculated: {new Date(position.calculatedAt).toLocaleString()}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Net Position Summary */}
      {totals && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-5 border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-700 font-medium">Net Fine Gold</p>
                <p className="text-3xl font-bold text-amber-700">
                  {totals.netFineGold.toFixed(4)}g
                </p>
                <p className="text-xs text-amber-600 mt-1">24K Equivalent</p>
              </div>
              <Scale className="h-10 w-10 text-amber-500" />
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">In Inventory</p>
                <p className="text-2xl font-bold text-blue-600">
                  {totals.inventoryFineGold.toFixed(4)}g
                </p>
                <p className="text-xs text-gray-400">
                  {formatCurrency(totals.totalEstimatedValue)}
                </p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">With Karigars</p>
                <p className="text-2xl font-bold text-purple-600">
                  {totals.karigarFineGold.toFixed(4)}g
                </p>
                <p className="text-xs text-gray-400">Fine gold with artisans</p>
              </div>
              <Hammer className="h-8 w-8 text-purple-500" />
            </div>
          </Card>

          <Card className="p-5 border-red-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Owed to Suppliers</p>
                <p className="text-2xl font-bold text-red-600">
                  -{totals.supplierOwedFineGold.toFixed(4)}g
                </p>
                <p className="text-xs text-gray-400">Gold liability</p>
              </div>
              <Truck className="h-8 w-8 text-red-500" />
            </div>
          </Card>

          <Card className="p-5 bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Estimated Value</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(totals.totalEstimatedValue)}
                </p>
                <p className="text-xs text-green-600">@ {formatCurrency(goldRate)}/g</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Valuation Summary */}
      {valuation && (
        <Card className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-medium text-lg">Mark-to-Market Valuation</h3>
            {valuation.lastValuationDate && (
              <p className="text-xs text-gray-400">
                Last updated: {new Date(valuation.lastValuationDate).toLocaleString()}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500">Total Cost Basis</p>
              <p className="text-xl font-bold">{formatCurrency(valuation.totalCost)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Current Market Value</p>
              <p className="text-xl font-bold text-blue-600">
                {formatCurrency(valuation.totalMarketValue)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Unrealized Gain/Loss</p>
              <div className="flex items-center gap-2">
                {valuation.unrealizedGainLoss >= 0 ? (
                  <>
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <p className="text-xl font-bold text-green-600">
                      +{formatCurrency(valuation.unrealizedGainLoss)}
                    </p>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-5 w-5 text-red-500" />
                    <p className="text-xl font-bold text-red-600">
                      {formatCurrency(valuation.unrealizedGainLoss)}
                    </p>
                  </>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Items</p>
              <p className="text-xl font-bold">{valuation.totalItems}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Stock Aging */}
      {aging && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-lg">Stock Aging Analysis</h3>
            <Link href="/reports/stock-aging">
              <Button variant="outline" size="sm">
                View Full Report
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-700">0-30 Days</p>
              <p className="text-xl font-bold text-green-700">{aging.current.count}</p>
              <p className="text-xs text-green-600">{formatCurrency(aging.current.value)}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">31-60 Days</p>
              <p className="text-xl font-bold text-blue-700">{aging.thirtyDays.count}</p>
              <p className="text-xs text-blue-600">{formatCurrency(aging.thirtyDays.value)}</p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-700">61-90 Days</p>
              <p className="text-xl font-bold text-yellow-700">{aging.sixtyDays.count}</p>
              <p className="text-xs text-yellow-600">{formatCurrency(aging.sixtyDays.value)}</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-700">91-180 Days</p>
              <p className="text-xl font-bold text-orange-700">{aging.ninetyDays.count}</p>
              <p className="text-xs text-orange-600">{formatCurrency(aging.ninetyDays.value)}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <p className="text-sm text-red-700">180+ Days</p>
              </div>
              <p className="text-xl font-bold text-red-700">{aging.overNinety.count}</p>
              <p className="text-xs text-red-600">{formatCurrency(aging.overNinety.value)}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Store-wise Breakdown */}
      {stores.length > 0 && (
        <Card className="p-6">
          <h3 className="font-medium text-lg mb-4">Store-wise Metal Position</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Inventory (Fine Gold)</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">With Karigars</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Owed to Suppliers</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Position</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Est. Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stores.map((store) => (
                  <tr key={store.storeId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{store.storeName}</p>
                        <p className="text-xs text-gray-400">{store.storeCode}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-medium text-blue-600">{store.inventoryGold.totalFineGold.toFixed(4)}g</p>
                      <p className="text-xs text-gray-400">Gross: {store.inventoryGold.totalGrossWeight.toFixed(3)}g</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-medium text-purple-600">{store.karigarGold.totalFineGold.toFixed(4)}g</p>
                      <p className="text-xs text-gray-400">{store.karigarGold.karigarCount} karigars</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-medium text-red-600">-{store.supplierGoldOwed.totalFineGold.toFixed(4)}g</p>
                      <p className="text-xs text-gray-400">{store.supplierGoldOwed.supplierCount} suppliers</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-bold text-amber-600">{store.netPosition.totalFineGold.toFixed(4)}g</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-medium text-green-600">{formatCurrency(store.netPosition.estimatedValue)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Inventory by Purity */}
      {purityData.length > 0 && (
        <Card className="p-6">
          <h3 className="font-medium text-lg mb-4">Inventory by Purity</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purity</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Items</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Weight</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Fine Gold (24K)</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Est. Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {purityData.map((row) => (
                  <tr key={row.purity} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Badge variant="outline">{row.purity || 'Unknown'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">{row.count}</td>
                    <td className="px-4 py-3 text-right font-medium">{row.weight.toFixed(3)}g</td>
                    <td className="px-4 py-3 text-right font-medium text-amber-600">{row.fineGold.toFixed(4)}g</td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">{formatCurrency(row.currentValue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t font-medium">
                <tr>
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right">{purityData.reduce((sum, r) => sum + r.count, 0)}</td>
                  <td className="px-4 py-3 text-right">{stores[0]?.inventoryGold.totalNetWeight.toFixed(3)}g</td>
                  <td className="px-4 py-3 text-right text-amber-600">{stores[0]?.inventoryGold.totalFineGold.toFixed(4)}g</td>
                  <td className="px-4 py-3 text-right text-green-600">{formatCurrency(stores[0]?.inventoryGold.totalValue || 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/karigars">
          <Card className="p-4 hover:bg-gray-50 cursor-pointer transition-colors">
            <div className="flex items-center gap-3">
              <Hammer className="h-6 w-6 text-purple-500" />
              <div>
                <p className="font-medium">Karigars</p>
                <p className="text-xs text-gray-500">Manage artisans</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/job-cards">
          <Card className="p-4 hover:bg-gray-50 cursor-pointer transition-colors">
            <div className="flex items-center gap-3">
              <Package className="h-6 w-6 text-blue-500" />
              <div>
                <p className="font-medium">Job Cards</p>
                <p className="text-xs text-gray-500">Track manufacturing</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/suppliers">
          <Card className="p-4 hover:bg-gray-50 cursor-pointer transition-colors">
            <div className="flex items-center gap-3">
              <Truck className="h-6 w-6 text-orange-500" />
              <div>
                <p className="font-medium">Suppliers</p>
                <p className="text-xs text-gray-500">Gold liabilities</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/reports">
          <Card className="p-4 hover:bg-gray-50 cursor-pointer transition-colors">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-green-500" />
              <div>
                <p className="font-medium">Reports</p>
                <p className="text-xs text-gray-500">Analytics & insights</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Formula Reference */}
      <Card className="p-6 bg-gray-50">
        <h3 className="font-medium text-lg mb-4">Metal Position Formula</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600 mb-2"><strong>Net Position Calculation:</strong></p>
            <code className="text-xs bg-white p-2 rounded block">
              Net Fine Gold = Inventory + Karigar Holdings - Supplier Liabilities
            </code>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2"><strong>Fine Gold Conversion:</strong></p>
            <code className="text-xs bg-white p-2 rounded block">
              Fine Gold (24K) = Net Weight × (Purity% ÷ 99.9%)
            </code>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-gray-500">
            <strong>Standard Purities:</strong> 24K = 99.9% | 22K = 91.67% | 18K = 75.0% | 14K = 58.5%
          </p>
        </div>
      </Card>
    </div>
  );
}
