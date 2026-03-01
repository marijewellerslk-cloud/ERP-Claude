'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/lib/api-client';
import {
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Minus,
    Package,
    BarChart3,
    Clock,
    Trophy,
    Target,
    Coins,
    Users,
    AlertTriangle,
    Star,
    ArrowUpRight,
    ArrowDownRight,
    Percent,
} from 'lucide-react';

type TabType = 'business' | 'gold' | 'people';

export default function SmartInsightsPage() {
    const [activeTab, setActiveTab] = useState<TabType>('business');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<Record<string, any>>({});

    const tabs = [
        { id: 'business' as TabType, label: 'Business Intelligence', icon: BarChart3 },
        { id: 'gold' as TabType, label: 'Gold Intelligence', icon: Coins },
        { id: 'people' as TabType, label: 'People', icon: Users },
    ];

    const fetchTabData = async (tab: TabType) => {
        setLoading(true);
        try {
            let endpoints: { key: string; url: string }[] = [];
            switch (tab) {
                case 'business':
                    endpoints = [
                        { key: 'deadStock', url: '/command-center/smart/dead-stock' },
                        { key: 'profitMargins', url: '/command-center/smart/profit-margins' },
                        { key: 'peakHours', url: '/command-center/smart/peak-hours' },
                        { key: 'storeRanking', url: '/command-center/smart/store-ranking' },
                        { key: 'salesForecast', url: '/command-center/smart/sales-forecast' },
                    ];
                    break;
                case 'gold':
                    endpoints = [
                        { key: 'goldExposure', url: '/command-center/smart/gold-exposure' },
                        { key: 'karigarEfficiency', url: '/command-center/smart/karigar-efficiency' },
                        { key: 'karigarReconciliation', url: '/command-center/smart/karigar-reconciliation' },
                    ];
                    break;
                case 'people':
                    endpoints = [
                        { key: 'leaderboard', url: '/command-center/smart/salesperson-leaderboard' },
                        { key: 'attendancePatterns', url: '/command-center/smart/attendance-patterns' },
                    ];
                    break;
            }

            const results = await Promise.allSettled(
                endpoints.map(ep => apiClient.get(ep.url))
            );

            const newData: Record<string, any> = {};
            results.forEach((result, i) => {
                if (result.status === 'fulfilled') {
                    newData[endpoints[i].key] = result.value.data?.data;
                }
            });

            setData(prev => ({ ...prev, ...newData }));
        } catch (err) {
            console.error('Failed to fetch smart data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTabData(activeTab);
    }, [activeTab]);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(val);

    const formatWeight = (g: number) => `${g.toFixed(2)}g`;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Target className="h-8 w-8 text-indigo-600" />
                        Smart Insights
                    </h1>
                    <p className="text-gray-500 mt-1">
                        AI-powered business intelligence and analytics
                    </p>
                </div>
                <Button onClick={() => fetchTabData(activeTab)} variant="outline" size="sm" disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Tabs */}
            <div className="border-b">
                <nav className="flex gap-6" aria-label="Tabs">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 py-3 border-b-2 text-sm font-medium transition ${activeTab === tab.id
                                        ? 'border-indigo-600 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {loading && (
                <div className="text-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                    <p className="text-gray-500 mt-2">Loading insights...</p>
                </div>
            )}

            {!loading && activeTab === 'business' && <BusinessTab data={data} formatCurrency={formatCurrency} />}
            {!loading && activeTab === 'gold' && <GoldTab data={data} formatCurrency={formatCurrency} formatWeight={formatWeight} />}
            {!loading && activeTab === 'people' && <PeopleTab data={data} formatCurrency={formatCurrency} />}
        </div>
    );
}

// ============================================================================
// BUSINESS INTELLIGENCE TAB
// ============================================================================

function BusinessTab({ data, formatCurrency }: { data: Record<string, any>; formatCurrency: (v: number) => string }) {
    const forecast = data.salesForecast;
    const deadStock = data.deadStock;

    return (
        <div className="space-y-6">
            {/* Sales Forecast */}
            {forecast && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="p-4">
                        <p className="text-xs text-gray-500 uppercase">Daily Average</p>
                        <p className="text-2xl font-bold mt-1">{formatCurrency(forecast.dailyAvg)}</p>
                    </Card>
                    <Card className="p-4">
                        <p className="text-xs text-gray-500 uppercase">7-Day Forecast</p>
                        <p className="text-2xl font-bold mt-1">{formatCurrency(forecast.forecast7Day)}</p>
                    </Card>
                    <Card className="p-4">
                        <p className="text-xs text-gray-500 uppercase">30-Day Forecast</p>
                        <p className="text-2xl font-bold mt-1">{formatCurrency(forecast.forecast30Day)}</p>
                    </Card>
                    <Card className="p-4">
                        <p className="text-xs text-gray-500 uppercase">Weekly Trend</p>
                        <div className="flex items-center gap-2 mt-1">
                            {forecast.trendDirection === 'up' ? (
                                <TrendingUp className="h-5 w-5 text-green-500" />
                            ) : forecast.trendDirection === 'down' ? (
                                <TrendingDown className="h-5 w-5 text-red-500" />
                            ) : (
                                <Minus className="h-5 w-5 text-gray-400" />
                            )}
                            <span className={`text-2xl font-bold ${forecast.trendPercent > 0 ? 'text-green-600' : forecast.trendPercent < 0 ? 'text-red-600' : ''
                                }`}>
                                {forecast.trendPercent > 0 ? '+' : ''}{forecast.trendPercent}%
                            </span>
                        </div>
                    </Card>
                </div>
            )}

            {/* Dead Stock */}
            {deadStock && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Package className="h-5 w-5 text-orange-500" />
                            Dead Stock Analysis
                            {deadStock.totalCostTiedUp > 0 && (
                                <Badge variant="destructive" className="ml-2">
                                    {formatCurrency(deadStock.totalCostTiedUp)} tied up
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {deadStock.buckets?.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-gray-500">
                                            <th className="py-2 pr-4">Store</th>
                                            <th className="py-2 pr-4">Aging Bucket</th>
                                            <th className="py-2 pr-4 text-right">Items</th>
                                            <th className="py-2 pr-4 text-right">Cost Tied Up</th>
                                            <th className="py-2 text-right">Avg Days</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {deadStock.buckets.map((b: any, i: number) => (
                                            <tr key={i} className="border-b last:border-0">
                                                <td className="py-2 pr-4">{b.storeName}</td>
                                                <td className="py-2 pr-4">
                                                    <Badge variant={b.bucket === '180+' ? 'destructive' : b.bucket === '90-180' ? 'default' : 'secondary'}>
                                                        {b.bucket} days
                                                    </Badge>
                                                </td>
                                                <td className="py-2 pr-4 text-right font-medium">{b.itemCount}</td>
                                                <td className="py-2 pr-4 text-right">{formatCurrency(b.totalCost)}</td>
                                                <td className="py-2 text-right">{b.avgDaysInStock}d</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center py-4">No dead stock detected — all items moving well!</p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Profit Margins + Peak Hours */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Profit Margins */}
                {data.profitMargins && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Percent className="h-5 w-5 text-blue-500" />
                                Profit Margins by Category
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {data.profitMargins.length > 0 ? (
                                <div className="space-y-3">
                                    {data.profitMargins.slice(0, 10).map((m: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">{m.categoryName}</p>
                                                <p className="text-xs text-gray-500">{m.storeName} · {m.itemsSold} items sold</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-sm font-bold ${m.avgMarginPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {m.avgMarginPercent.toFixed(1)}%
                                                </span>
                                                <p className="text-xs text-gray-500">{formatCurrency(m.totalMargin)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-center py-4">No margin data available yet</p>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Peak Hours */}
                {data.peakHours && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Clock className="h-5 w-5 text-purple-500" />
                                Peak Sales Hours
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {data.peakHours.byHour?.length > 0 ? (
                                <div className="space-y-2">
                                    {data.peakHours.byHour
                                        .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue)
                                        .slice(0, 8)
                                        .map((h: any) => {
                                            const maxRev = Math.max(...data.peakHours.byHour.map((x: any) => x.totalRevenue));
                                            const pct = maxRev > 0 ? (h.totalRevenue / maxRev) * 100 : 0;
                                            return (
                                                <div key={h.hour} className="flex items-center gap-3">
                                                    <span className="text-sm w-16 text-gray-500">
                                                        {h.hour.toString().padStart(2, '0')}:00
                                                    </span>
                                                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-purple-500 rounded-full"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-gray-600 w-24 text-right">
                                                        {h.salesCount} sales
                                                    </span>
                                                </div>
                                            );
                                        })}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-center py-4">No hourly data available yet</p>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Store Ranking */}
            {data.storeRanking && data.storeRanking.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Trophy className="h-5 w-5 text-amber-500" />
                            Store Performance Ranking (This Month)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-gray-500">
                                        <th className="py-2 pr-4">#</th>
                                        <th className="py-2 pr-4">Store</th>
                                        <th className="py-2 pr-4 text-right">Revenue</th>
                                        <th className="py-2 pr-4 text-right">Rev/Employee</th>
                                        <th className="py-2 pr-4 text-right">Invoices</th>
                                        <th className="py-2 text-right">Avg Ticket</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.storeRanking.map((s: any, i: number) => (
                                        <tr key={s.storeId} className="border-b last:border-0">
                                            <td className="py-2 pr-4 font-bold text-gray-400">
                                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                            </td>
                                            <td className="py-2 pr-4 font-medium">{s.storeName}</td>
                                            <td className="py-2 pr-4 text-right">{formatCurrency(s.monthRevenue)}</td>
                                            <td className="py-2 pr-4 text-right">{formatCurrency(s.revenuePerEmployee)}</td>
                                            <td className="py-2 pr-4 text-right">{s.invoiceCount}</td>
                                            <td className="py-2 text-right">{formatCurrency(s.avgTicketSize)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// ============================================================================
// GOLD INTELLIGENCE TAB
// ============================================================================

function GoldTab({ data, formatCurrency, formatWeight }: { data: Record<string, any>; formatCurrency: (v: number) => string; formatWeight: (g: number) => string }) {
    const exposure = data.goldExposure;

    return (
        <div className="space-y-6">
            {/* Gold Exposure Overview */}
            {exposure && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="p-4 border-l-4 border-l-amber-500">
                            <p className="text-xs text-gray-500 uppercase">Total Gold Exposure</p>
                            <p className="text-2xl font-bold mt-1">{formatWeight(exposure.totalExposure?.totalGrossGrams || 0)}</p>
                        </Card>
                        <Card className="p-4 border-l-4 border-l-green-500">
                            <p className="text-xs text-gray-500 uppercase">In Inventory</p>
                            <p className="text-2xl font-bold mt-1">{formatWeight(exposure.inventory?.grossWeight || 0)}</p>
                            <p className="text-xs text-gray-500">{exposure.inventory?.items || 0} items · {formatCurrency(exposure.inventory?.marketValue || 0)}</p>
                        </Card>
                        <Card className="p-4 border-l-4 border-l-blue-500">
                            <p className="text-xs text-gray-500 uppercase">In Loan Pledges</p>
                            <p className="text-2xl font-bold mt-1">{formatWeight(exposure.loans?.grossWeight || 0)}</p>
                            <p className="text-xs text-gray-500">{exposure.loans?.pledgeCount || 0} pledges · {formatCurrency(exposure.loans?.appraisedValue || 0)}</p>
                        </Card>
                        <Card className="p-4 border-l-4 border-l-purple-500">
                            <p className="text-xs text-gray-500 uppercase">With Karigars</p>
                            <p className="text-2xl font-bold mt-1">{formatWeight(Math.abs(exposure.karigar?.goldOutstanding || 0))}</p>
                            <p className="text-xs text-gray-500">Outstanding balance</p>
                        </Card>
                    </div>

                    {/* Exposure Breakdown Bar */}
                    {exposure.totalExposure?.totalGrossGrams > 0 && (
                        <Card className="p-4">
                            <p className="text-sm font-medium mb-2">Gold Distribution</p>
                            <div className="flex h-6 rounded-full overflow-hidden">
                                <div className="bg-green-500" style={{ width: `${exposure.totalExposure.breakdown.inventoryPercent}%` }} title="Inventory" />
                                <div className="bg-blue-500" style={{ width: `${exposure.totalExposure.breakdown.loansPercent}%` }} title="Loans" />
                                <div className="bg-purple-500" style={{ width: `${exposure.totalExposure.breakdown.karigarPercent}%` }} title="Karigar" />
                            </div>
                            <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-full inline-block" /> Inventory ({exposure.totalExposure.breakdown.inventoryPercent.toFixed(1)}%)</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded-full inline-block" /> Loans ({exposure.totalExposure.breakdown.loansPercent.toFixed(1)}%)</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-purple-500 rounded-full inline-block" /> Karigar ({exposure.totalExposure.breakdown.karigarPercent.toFixed(1)}%)</span>
                            </div>
                        </Card>
                    )}
                </>
            )}

            {/* Karigar Efficiency */}
            {data.karigarEfficiency && data.karigarEfficiency.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Star className="h-5 w-5 text-amber-500" />
                            Karigar Efficiency Scores
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-gray-500">
                                        <th className="py-2 pr-4">Karigar</th>
                                        <th className="py-2 pr-4">Store</th>
                                        <th className="py-2 pr-4 text-right">Gold Issued</th>
                                        <th className="py-2 pr-4 text-right">Returned</th>
                                        <th className="py-2 pr-4 text-right">Wastage</th>
                                        <th className="py-2 pr-4 text-right">Wastage %</th>
                                        <th className="py-2 text-right">Rating</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.karigarEfficiency.map((k: any) => (
                                        <tr key={k.karigarId} className="border-b last:border-0">
                                            <td className="py-2 pr-4 font-medium">{k.karigarName}</td>
                                            <td className="py-2 pr-4 text-gray-500">{k.storeName}</td>
                                            <td className="py-2 pr-4 text-right">{formatWeight(k.goldIssued)}</td>
                                            <td className="py-2 pr-4 text-right">{formatWeight(k.goldReturned)}</td>
                                            <td className="py-2 pr-4 text-right">{formatWeight(k.wastage)}</td>
                                            <td className="py-2 pr-4 text-right">{k.wastagePercent}%</td>
                                            <td className="py-2 text-right">
                                                <Badge variant={k.efficiencyRating === 'excellent' ? 'default' : k.efficiencyRating === 'good' ? 'secondary' : 'destructive'}>
                                                    {k.efficiencyRating}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Karigar Reconciliation */}
            {data.karigarReconciliation && data.karigarReconciliation.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <AlertTriangle className="h-5 w-5 text-orange-500" />
                            Gold Reconciliation
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-gray-500">
                                        <th className="py-2 pr-4">Karigar</th>
                                        <th className="py-2 pr-4 text-right">Issued</th>
                                        <th className="py-2 pr-4 text-right">Returned</th>
                                        <th className="py-2 pr-4 text-right">Expected Bal.</th>
                                        <th className="py-2 pr-4 text-right">Actual Bal.</th>
                                        <th className="py-2 pr-4 text-right">Discrepancy</th>
                                        <th className="py-2 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.karigarReconciliation.map((r: any) => (
                                        <tr key={r.karigarId} className="border-b last:border-0">
                                            <td className="py-2 pr-4 font-medium">{r.karigarName}</td>
                                            <td className="py-2 pr-4 text-right">{formatWeight(r.goldIssued)}</td>
                                            <td className="py-2 pr-4 text-right">{formatWeight(r.goldReturned)}</td>
                                            <td className="py-2 pr-4 text-right">{formatWeight(r.expectedBalance)}</td>
                                            <td className="py-2 pr-4 text-right">{formatWeight(r.runningBalance)}</td>
                                            <td className="py-2 pr-4 text-right font-medium">
                                                {r.discrepancy > 0 && <span className="text-red-600">{formatWeight(r.discrepancy)}</span>}
                                                {r.discrepancy === 0 && <span className="text-green-600">0g</span>}
                                            </td>
                                            <td className="py-2 text-right">
                                                <Badge variant={r.status === 'reconciled' ? 'default' : r.status === 'minor_variance' ? 'secondary' : 'destructive'}>
                                                    {r.status.replace('_', ' ')}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// ============================================================================
// PEOPLE INTELLIGENCE TAB
// ============================================================================

function PeopleTab({ data, formatCurrency }: { data: Record<string, any>; formatCurrency: (v: number) => string }) {
    return (
        <div className="space-y-6">
            {/* Salesperson Leaderboard */}
            {data.leaderboard && data.leaderboard.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Trophy className="h-5 w-5 text-amber-500" />
                            Salesperson Leaderboard — This Month
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-gray-500">
                                        <th className="py-2 pr-4">Rank</th>
                                        <th className="py-2 pr-4">Store</th>
                                        <th className="py-2 pr-4 text-right">Sales</th>
                                        <th className="py-2 pr-4 text-right">Revenue</th>
                                        <th className="py-2 pr-4 text-right">Avg Ticket</th>
                                        <th className="py-2 text-right">Best Sale</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.leaderboard.map((s: any) => (
                                        <tr key={`${s.userId}-${s.storeName}`} className="border-b last:border-0">
                                            <td className="py-2 pr-4 font-bold">
                                                {s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : `#${s.rank}`}
                                            </td>
                                            <td className="py-2 pr-4">{s.storeName}</td>
                                            <td className="py-2 pr-4 text-right font-medium">{s.salesCount}</td>
                                            <td className="py-2 pr-4 text-right">{formatCurrency(s.totalRevenue)}</td>
                                            <td className="py-2 pr-4 text-right">{formatCurrency(s.avgTicket)}</td>
                                            <td className="py-2 text-right">{formatCurrency(s.maxSale)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Attendance Alerts */}
            {data.attendancePatterns && data.attendancePatterns.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            Attendance Concerns
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {data.attendancePatterns.map((p: any) => (
                                <div key={p.employeeId} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                                    <div>
                                        <p className="font-medium">{p.employeeName}</p>
                                        <p className="text-xs text-gray-500">{p.storeName} · Attendance: {p.attendanceRate}%</p>
                                        <div className="flex gap-2 mt-1">
                                            {p.alerts.map((alert: string, i: number) => (
                                                <Badge key={i} variant="destructive" className="text-xs">{alert}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="text-right text-sm">
                                        <p>Present: {p.presentDays}</p>
                                        <p className="text-red-600">Absent: {p.absentDays}</p>
                                        <p className="text-amber-600">Late: {p.lateDays}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {!data.leaderboard?.length && !data.attendancePatterns?.length && (
                <div className="text-center py-12 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No people data available yet. Sales and attendance data will populate as the system is used.</p>
                </div>
            )}
        </div>
    );
}
