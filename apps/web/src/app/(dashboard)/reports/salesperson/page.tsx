'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { apiClient } from '@/lib/api-client'
import { formatCurrency } from '@/lib/currency'
import {
  Users,
  TrendingUp,
  DollarSign,
  Award,
  Target,
  RefreshCw,
  Download,
  FileText
} from 'lucide-react'
import { exportSalespersonPDF } from '@/lib/pdf-export'

interface SalespersonReport {
  salespersonId: string
  salespersonName: string
  salesCount: number
  totalRevenue: number
  totalCost: number
  grossProfit: number
  grossMarginPercent: number
  avgTransactionValue: number
  commissionEarned: number
  topCategories: Array<{ category: string; revenue: number }>
}

export default function SalespersonPerformancePage() {
  const [data, setData] = useState<SalespersonReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })
  const [selectedPerson, setSelectedPerson] = useState<SalespersonReport | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.get(
        `/reports/salesperson-performance?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      )
      if (response.data.success) {
        setData(response.data.data)
        if (response.data.data.length > 0 && !selectedPerson) {
          setSelectedPerson(response.data.data[0])
        }
      } else {
        setError(response.data.error?.message || 'Failed to load data')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [dateRange])

  const totalRevenue = data.reduce((sum, p) => sum + p.totalRevenue, 0)
  const totalProfit = data.reduce((sum, p) => sum + p.grossProfit, 0)
  const totalSales = data.reduce((sum, p) => sum + p.salesCount, 0)
  const totalCommission = data.reduce((sum, p) => sum + p.commissionEarned, 0)

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
          <h1 className="text-2xl font-bold">Salesperson Performance</h1>
          <p className="text-muted-foreground">
            Track individual sales team performance and commissions
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
              if (data.length > 0) {
                exportSalespersonPDF({
                  dateRange: {
                    start: dateRange.startDate,
                    end: dateRange.endDate,
                  },
                  totals: {
                    salespeople: data.length,
                    revenue: totalRevenue,
                    profit: totalProfit,
                    commission: totalCommission,
                    transactions: totalSales,
                  },
                  salespeople: data,
                })
              }
            }}
            disabled={data.length === 0}
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
            <CardTitle className="text-sm font-medium">Total Salespeople</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.length}</div>
            <p className="text-xs text-muted-foreground">active in period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">{totalSales} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalProfit)}</div>
            <p className="text-xs text-muted-foreground">
              {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}% margin
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commission</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCommission)}</div>
            <p className="text-xs text-muted-foreground">earned by team</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Leaderboard */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Sales Leaderboard</CardTitle>
            <CardDescription>Ranked by total revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.map((person, index) => {
                const revenuePercent = totalRevenue > 0 ? (person.totalRevenue / totalRevenue) * 100 : 0
                return (
                  <div
                    key={person.salespersonId}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedPerson?.salespersonId === person.salespersonId
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedPerson(person)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-yellow-500 text-white' :
                          index === 1 ? 'bg-gray-400 text-white' :
                          index === 2 ? 'bg-amber-600 text-white' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{person.salespersonName}</p>
                          <p className="text-sm text-muted-foreground">
                            {person.salesCount} sales
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(person.totalRevenue)}</p>
                        <p className={`text-sm ${person.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(person.grossProfit)} profit
                        </p>
                      </div>
                    </div>
                    <Progress value={revenuePercent} className="h-2" />
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      <span>{revenuePercent.toFixed(1)}% of total</span>
                      <span>{person.grossMarginPercent.toFixed(1)}% margin</span>
                    </div>
                  </div>
                )
              })}
              {data.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">
                  No sales data for selected period
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Selected Person Details */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedPerson ? selectedPerson.salespersonName : 'Select a Salesperson'}
            </CardTitle>
            <CardDescription>Detailed performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedPerson ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Sales Count</p>
                    <p className="text-2xl font-bold">{selectedPerson.salesCount}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Avg Transaction</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(selectedPerson.avgTransactionValue)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Revenue</span>
                    <span className="font-medium">{formatCurrency(selectedPerson.totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Cost</span>
                    <span className="font-medium">{formatCurrency(selectedPerson.totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Gross Profit</span>
                    <span className={`font-medium ${selectedPerson.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(selectedPerson.grossProfit)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Margin</span>
                    <Badge variant={selectedPerson.grossMarginPercent >= 20 ? 'default' : 'secondary'}>
                      {selectedPerson.grossMarginPercent.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2 mt-2">
                    <span className="font-medium">Commission Earned</span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(selectedPerson.commissionEarned)}
                    </span>
                  </div>
                </div>

                {selectedPerson.topCategories.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Top Categories</p>
                    {selectedPerson.topCategories.slice(0, 3).map((cat, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{cat.category}</span>
                        <span>{formatCurrency(cat.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                Click on a salesperson to view details
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-medium">Salesperson</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Sales</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Revenue</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Profit</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Margin %</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Avg Transaction</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Commission</th>
                </tr>
              </thead>
              <tbody>
                {data.map((person) => (
                  <tr key={person.salespersonId} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2 text-sm font-medium">{person.salespersonName}</td>
                    <td className="py-3 px-2 text-sm text-right">{person.salesCount}</td>
                    <td className="py-3 px-2 text-sm text-right">{formatCurrency(person.totalRevenue)}</td>
                    <td className={`py-3 px-2 text-sm text-right ${person.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(person.grossProfit)}
                    </td>
                    <td className="py-3 px-2 text-sm text-right">
                      <Badge variant={person.grossMarginPercent >= 20 ? 'default' : 'secondary'}>
                        {person.grossMarginPercent.toFixed(1)}%
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-sm text-right">{formatCurrency(person.avgTransactionValue)}</td>
                    <td className="py-3 px-2 text-sm text-right font-medium text-green-600">
                      {formatCurrency(person.commissionEarned)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
