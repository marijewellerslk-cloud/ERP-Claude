'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiClient } from '@/lib/api-client'
import { formatCurrency } from '@/lib/currency'
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  Percent,
  RefreshCw,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  FileText
} from 'lucide-react'
import { exportMarginAnalysisPDF } from '@/lib/pdf-export'

interface MarginItem {
  itemId: string
  sku: string
  name: string
  category: string | null
  soldDate: string
  holdingDays: number
  costPrice: number
  salePrice: number
  grossProfit: number
  grossMarginPercent: number
  roi: number
  metalProfitGrams: number
}

interface CategoryReport {
  categoryId: string | null
  categoryName: string
  itemsSold: number
  totalRevenue: number
  totalCost: number
  grossProfit: number
  grossMarginPercent: number
  totalWeightSold: number
  avgHoldingDays: number
  avgRoi: number
  bestPerformer: { sku: string; name: string; roi: number } | null
  worstPerformer: { sku: string; name: string; roi: number } | null
}

interface DashboardMetrics {
  today: { sales: number; revenue: number; profit: number; marginPercent: number }
  thisWeek: { sales: number; revenue: number; profit: number; marginPercent: number }
  thisMonth: { sales: number; revenue: number; profit: number; marginPercent: number }
  topCategories: CategoryReport[]
  stockHealth: {
    totalItems: number
    totalValue: number
    deadStockCount: number
    deadStockValue: number
    avgAge: number
  }
}

export default function MarginAnalysisPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [marginData, setMarginData] = useState<MarginItem[]>([])
  const [categoryData, setCategoryData] = useState<CategoryReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'categories'>('overview')

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [metricsRes, marginRes, categoryRes] = await Promise.all([
        apiClient.get('/reports/dashboard-metrics'),
        apiClient.get(`/reports/margin-analysis?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`),
        apiClient.get(`/reports/category-performance?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`)
      ])

      if (metricsRes.data.success) setMetrics(metricsRes.data.data)
      if (marginRes.data.success) setMarginData(marginRes.data.data)
      if (categoryRes.data.success) setCategoryData(categoryRes.data.data)
    } catch (err: any) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [dateRange])

  const MetricCard = ({ title, value, subValue, trend, icon: Icon }: {
    title: string
    value: string
    subValue?: string
    trend?: 'up' | 'down' | 'neutral'
    icon: any
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subValue && (
          <p className={`text-xs ${
            trend === 'up' ? 'text-green-600' :
            trend === 'down' ? 'text-red-600' :
            'text-muted-foreground'
          }`}>
            {trend === 'up' && <ArrowUpRight className="inline h-3 w-3" />}
            {trend === 'down' && <ArrowDownRight className="inline h-3 w-3" />}
            {subValue}
          </p>
        )}
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ROI & Margin Analysis</h1>
          <p className="text-muted-foreground">
            Track profitability, margins, and return on investment
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="startDate" className="text-sm">From</Label>
            <Input
              id="startDate"
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-36"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="endDate" className="text-sm">To</Label>
            <Input
              id="endDate"
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-36"
            />
          </div>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const totalRevenue = marginData.reduce((sum, item) => sum + item.salePrice, 0)
              const totalCost = marginData.reduce((sum, item) => sum + item.costPrice, 0)
              const totalProfit = marginData.reduce((sum, item) => sum + item.grossProfit, 0)
              const avgMargin = marginData.length > 0
                ? marginData.reduce((sum, item) => sum + item.grossMarginPercent, 0) / marginData.length
                : 0

              exportMarginAnalysisPDF({
                dateRange: {
                  start: dateRange.startDate,
                  end: dateRange.endDate,
                },
                summary: {
                  totalRevenue,
                  totalCost,
                  grossProfit: totalProfit,
                  avgMargin,
                  totalItems: marginData.length,
                },
                categoryPerformance: categoryData.map(cat => ({
                  categoryName: cat.categoryName,
                  itemsSold: cat.itemsSold,
                  totalRevenue: cat.totalRevenue,
                  totalProfit: cat.grossProfit,
                  avgMargin: cat.grossMarginPercent,
                })),
                items: marginData.map(item => ({
                  sku: item.sku,
                  name: item.name,
                  salePrice: item.salePrice,
                  cost: item.costPrice,
                  margin: item.grossProfit,
                  marginPercent: item.grossMarginPercent,
                  holdingDays: item.holdingDays,
                  roi: item.roi,
                })),
              })
            }}
            disabled={marginData.length === 0}
          >
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Quick Metrics */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard
            title="Today's Revenue"
            value={formatCurrency(metrics.today.revenue)}
            subValue={`${metrics.today.sales} sales, ${metrics.today.marginPercent.toFixed(1)}% margin`}
            trend={metrics.today.profit > 0 ? 'up' : 'down'}
            icon={DollarSign}
          />
          <MetricCard
            title="This Week"
            value={formatCurrency(metrics.thisWeek.revenue)}
            subValue={`${metrics.thisWeek.sales} sales, ${formatCurrency(metrics.thisWeek.profit)} profit`}
            trend={metrics.thisWeek.profit > 0 ? 'up' : 'down'}
            icon={TrendingUp}
          />
          <MetricCard
            title="This Month"
            value={formatCurrency(metrics.thisMonth.revenue)}
            subValue={`${metrics.thisMonth.marginPercent.toFixed(1)}% avg margin`}
            trend={metrics.thisMonth.marginPercent > 15 ? 'up' : 'neutral'}
            icon={BarChart3}
          />
          <MetricCard
            title="Stock Value"
            value={formatCurrency(metrics.stockHealth.totalValue)}
            subValue={`${metrics.stockHealth.deadStockCount} dead stock items`}
            trend={metrics.stockHealth.deadStockCount > 10 ? 'down' : 'neutral'}
            icon={Percent}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <Button
          variant={activeTab === 'overview' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </Button>
        <Button
          variant={activeTab === 'items' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('items')}
        >
          Item Analysis
        </Button>
        <Button
          variant={activeTab === 'categories' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('categories')}
        >
          Category Performance
        </Button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && metrics && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Top Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Top Categories</CardTitle>
              <CardDescription>By gross profit this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.topCategories.slice(0, 5).map((cat, index) => (
                  <div key={cat.categoryId || index} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{cat.categoryName}</p>
                      <p className="text-sm text-muted-foreground">
                        {cat.itemsSold} items sold
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(cat.grossProfit)}</p>
                      <p className={`text-sm ${cat.grossMarginPercent >= 20 ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {cat.grossMarginPercent.toFixed(1)}% margin
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Stock Health */}
          <Card>
            <CardHeader>
              <CardTitle>Inventory Health</CardTitle>
              <CardDescription>Current stock metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Items</span>
                  <span className="font-medium">{metrics.stockHealth.totalItems.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Value</span>
                  <span className="font-medium">{formatCurrency(metrics.stockHealth.totalValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Age</span>
                  <span className="font-medium">{Math.round(metrics.stockHealth.avgAge)} days</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>Dead Stock</span>
                  <span className="font-medium">
                    {metrics.stockHealth.deadStockCount} items ({formatCurrency(metrics.stockHealth.deadStockValue)})
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Items Tab */}
      {activeTab === 'items' && (
        <Card>
          <CardHeader>
            <CardTitle>Sold Items Analysis</CardTitle>
            <CardDescription>
              Margin and ROI for each sold item in selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 text-sm font-medium">SKU</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Name</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Category</th>
                    <th className="text-right py-3 px-2 text-sm font-medium">Holding Days</th>
                    <th className="text-right py-3 px-2 text-sm font-medium">Cost</th>
                    <th className="text-right py-3 px-2 text-sm font-medium">Sale Price</th>
                    <th className="text-right py-3 px-2 text-sm font-medium">Profit</th>
                    <th className="text-right py-3 px-2 text-sm font-medium">Margin %</th>
                    <th className="text-right py-3 px-2 text-sm font-medium">ROI %</th>
                  </tr>
                </thead>
                <tbody>
                  {marginData.slice(0, 50).map((item) => (
                    <tr key={item.itemId} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2 text-sm font-mono">{item.sku}</td>
                      <td className="py-3 px-2 text-sm">{item.name}</td>
                      <td className="py-3 px-2 text-sm">
                        {item.category || <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="py-3 px-2 text-sm text-right">{item.holdingDays}</td>
                      <td className="py-3 px-2 text-sm text-right">{formatCurrency(item.costPrice)}</td>
                      <td className="py-3 px-2 text-sm text-right">{formatCurrency(item.salePrice)}</td>
                      <td className={`py-3 px-2 text-sm text-right ${item.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(item.grossProfit)}
                      </td>
                      <td className="py-3 px-2 text-sm text-right">
                        <Badge variant={item.grossMarginPercent >= 20 ? 'default' : 'secondary'}>
                          {item.grossMarginPercent.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className={`py-3 px-2 text-sm text-right font-medium ${item.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.roi >= 0 ? '+' : ''}{item.roi.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {marginData.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">
                  No sales data for selected period
                </p>
              )}
              {marginData.length > 50 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Showing 50 of {marginData.length} items
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <Card>
          <CardHeader>
            <CardTitle>Category Performance</CardTitle>
            <CardDescription>
              Performance metrics by product category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 text-sm font-medium">Category</th>
                    <th className="text-right py-3 px-2 text-sm font-medium">Items Sold</th>
                    <th className="text-right py-3 px-2 text-sm font-medium">Revenue</th>
                    <th className="text-right py-3 px-2 text-sm font-medium">Cost</th>
                    <th className="text-right py-3 px-2 text-sm font-medium">Profit</th>
                    <th className="text-right py-3 px-2 text-sm font-medium">Margin %</th>
                    <th className="text-right py-3 px-2 text-sm font-medium">Avg ROI</th>
                    <th className="text-right py-3 px-2 text-sm font-medium">Avg Holding</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryData.map((cat) => (
                    <tr key={cat.categoryId || 'uncategorized'} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2 text-sm font-medium">{cat.categoryName}</td>
                      <td className="py-3 px-2 text-sm text-right">{cat.itemsSold}</td>
                      <td className="py-3 px-2 text-sm text-right">{formatCurrency(cat.totalRevenue)}</td>
                      <td className="py-3 px-2 text-sm text-right">{formatCurrency(cat.totalCost)}</td>
                      <td className={`py-3 px-2 text-sm text-right ${cat.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(cat.grossProfit)}
                      </td>
                      <td className="py-3 px-2 text-sm text-right">
                        <Badge variant={cat.grossMarginPercent >= 20 ? 'default' : 'secondary'}>
                          {cat.grossMarginPercent.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className={`py-3 px-2 text-sm text-right font-medium ${cat.avgRoi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {cat.avgRoi >= 0 ? '+' : ''}{cat.avgRoi.toFixed(1)}%
                      </td>
                      <td className="py-3 px-2 text-sm text-right">{cat.avgHoldingDays} days</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {categoryData.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">
                  No category data for selected period
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
