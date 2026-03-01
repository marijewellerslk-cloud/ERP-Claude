'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { apiClient } from '@/lib/api-client'
import { formatCurrency } from '@/lib/currency'
import {
  Clock,
  AlertTriangle,
  Package,
  TrendingDown,
  RefreshCw,
  Download,
  FileText
} from 'lucide-react'
import { exportStockAgingPDF } from '@/lib/pdf-export'

interface AgingBucket {
  label: string
  minDays: number
  maxDays: number | null
  itemCount: number
  totalWeight: number
  totalValue: number
  percentageOfInventory: number
}

interface DeadStockItem {
  id: string
  sku: string
  name: string
  category: string | null
  ageInDays: number
  netWeight: number
  calculatedCost: number
  currentMarketValue: number
  unrealizedGainLoss: number
}

interface AgingReport {
  storeId: string
  storeName: string
  buckets: AgingBucket[]
  deadStockItems: DeadStockItem[]
  totalItems: number
  totalValue: number
  averageAge: number
  oldestItemDays: number
  reportDate: string
}

export default function StockAgingReportPage() {
  const [report, setReport] = useState<AgingReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [thresholdDays, setThresholdDays] = useState(180)

  const fetchReport = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.get(`/reports/stock-aging?thresholdDays=${thresholdDays}`)
      if (response.data.success) {
        setReport(response.data.data)
      } else {
        setError(response.data.error?.message || 'Failed to load report')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [thresholdDays])

  const getBucketColor = (index: number) => {
    const colors = [
      'bg-green-500',
      'bg-lime-500',
      'bg-yellow-500',
      'bg-orange-500',
      'bg-red-500'
    ]
    return colors[index] || 'bg-gray-500'
  }

  const getBadgeVariant = (ageInDays: number) => {
    if (ageInDays > 365) return 'destructive'
    if (ageInDays > 180) return 'destructive'
    if (ageInDays > 90) return 'warning'
    return 'secondary'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>{error}</span>
            </div>
            <Button onClick={fetchReport} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!report) return null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock Aging Report</h1>
          <p className="text-muted-foreground">
            Analyze inventory age and identify slow-moving items
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchReport}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (report) {
                exportStockAgingPDF({
                  storeName: report.storeName,
                  totalItems: report.totalItems,
                  totalValue: report.totalValue,
                  averageAge: report.averageAge,
                  oldestItemDays: report.oldestItemDays,
                  buckets: report.buckets,
                  deadStockItems: report.deadStockItems,
                })
              }
            }}
            disabled={!report}
          >
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{report.totalItems.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(report.totalValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Age</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(report.averageAge)} days</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dead Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {report.deadStockItems.length}
            </div>
            <p className="text-xs text-muted-foreground">
              items over {thresholdDays} days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Aging Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Aging Distribution</CardTitle>
          <CardDescription>
            Breakdown of inventory by age buckets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {report.buckets.map((bucket, index) => (
              <div key={bucket.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{bucket.label}</span>
                  <span className="text-muted-foreground">
                    {bucket.itemCount} items ({bucket.percentageOfInventory.toFixed(1)}%)
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <Progress
                    value={bucket.percentageOfInventory}
                    className={`h-3 flex-1`}
                  />
                  <span className="text-sm font-medium w-32 text-right">
                    {formatCurrency(bucket.totalValue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dead Stock Items */}
      {report.deadStockItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Dead Stock Items
            </CardTitle>
            <CardDescription>
              Items older than {thresholdDays} days with no movement
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
                    <th className="text-right py-3 px-2 text-sm font-medium">Age</th>
                    <th className="text-right py-3 px-2 text-sm font-medium">Weight</th>
                    <th className="text-right py-3 px-2 text-sm font-medium">Cost</th>
                    <th className="text-right py-3 px-2 text-sm font-medium">Market Value</th>
                    <th className="text-right py-3 px-2 text-sm font-medium">Gain/Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {report.deadStockItems.slice(0, 20).map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2 text-sm font-mono">{item.sku}</td>
                      <td className="py-3 px-2 text-sm">{item.name}</td>
                      <td className="py-3 px-2 text-sm">
                        {item.category || <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="py-3 px-2 text-sm text-right">
                        <Badge variant={getBadgeVariant(item.ageInDays) as any}>
                          {item.ageInDays} days
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-sm text-right">
                        {item.netWeight.toFixed(2)}g
                      </td>
                      <td className="py-3 px-2 text-sm text-right">
                        {formatCurrency(item.calculatedCost)}
                      </td>
                      <td className="py-3 px-2 text-sm text-right">
                        {formatCurrency(item.currentMarketValue)}
                      </td>
                      <td className={`py-3 px-2 text-sm text-right ${
                        item.unrealizedGainLoss >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {item.unrealizedGainLoss >= 0 ? '+' : ''}
                        {formatCurrency(item.unrealizedGainLoss)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.deadStockItems.length > 20 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Showing 20 of {report.deadStockItems.length} items
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
