'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import {
    TrendingUp,
    RefreshCw,
    Coins,
    Scale,
    Calculator,
    ArrowUpRight,
    ArrowDownRight,
    AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface ValuationSummary {
    storeId: string;
    totalValue: number;
    totalItems: number;
    lastRevaluationDate: string;
    metalBreakdown: {
        metalType: string;
        totalWeight: number;
        totalValue: number;
        itemCount: number;
    }[];
    categoryBreakdown: {
        categoryName: string;
        totalValue: number;
        itemCount: number;
    }[];
}

export default function ValuationReportPage() {
    const [summary, setSummary] = useState<ValuationSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [recalculating, setRecalculating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSummary = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.get('/reports/valuation-summary');
            if (response.data.success) {
                setSummary(response.data.data);
            }
        } catch (err: any) {
            console.error('Failed to fetch valuation summary:', err);
            setError('Failed to load valuation data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSummary();
    }, []);

    const handleRevalue = async () => {
        try {
            setRecalculating(true);
            const response = await apiClient.post('/reports/trigger-revaluation');

            if (response.data.success) {
                toast.success(`Revaluation complete. ${response.data.message}`);
                await fetchSummary();
            }
        } catch (err: any) {
            console.error('Revaluation failed:', err);
            toast.error(err.response?.data?.error?.message || 'Failed to revalue inventory');
        } finally {
            setRecalculating(false);
        }
    };

    if (loading && !summary) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <Card className="border-destructive">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="h-5 w-5" />
                            <span>{error}</span>
                        </div>
                        <Button onClick={fetchSummary} className="mt-4">
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Inventory Valuation</h1>
                    <p className="text-muted-foreground">
                        Current value of inventory based on latest gold rates
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchSummary} disabled={recalculating}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button onClick={handleRevalue} disabled={recalculating}>
                        <Calculator className="h-4 w-4 mr-2" />
                        {recalculating ? 'Recalculating...' : 'Recalculate Value'}
                    </Button>
                </div>
            </div>

            {summary && (
                <>
                    {/* Main Stats */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="bg-blue-50 border-blue-200">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-blue-800">Total Inventory Value</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2">
                                    <Coins className="h-5 w-5 text-blue-600" />
                                    <span className="text-2xl font-bold text-blue-900">
                                        {formatCurrency(summary.totalValue)}
                                    </span>
                                </div>
                                <p className="text-xs text-blue-600 mt-1">
                                    Last updated: {new Date(summary.lastRevaluationDate).toLocaleString()}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{summary.totalItems.toLocaleString()}</div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Average Item Value</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {summary.totalItems > 0
                                        ? formatCurrency(summary.totalValue / summary.totalItems)
                                        : formatCurrency(0)
                                    }
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Breakdown Sections */}
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Metal Breakdown */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Scale className="h-5 w-5" />
                                    Value by Metal Type
                                </CardTitle>
                                <CardDescription>Breakdown of inventory value by metal</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {summary.metalBreakdown.map((metal) => (
                                        <div key={metal.metalType} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                            <div>
                                                <p className="font-semibold capitalize">{metal.metalType}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {metal.totalWeight.toFixed(3)}g • {metal.itemCount} items
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold">{formatCurrency(metal.totalValue)}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {((metal.totalValue / summary.totalValue) * 100).toFixed(1)}% of total
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {summary.metalBreakdown.length === 0 && (
                                        <p className="text-center text-muted-foreground py-4">No metal data available</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Category Breakdown */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5" />
                                    Value by Category
                                </CardTitle>
                                <CardDescription>Top categories by value</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                    {summary.categoryBreakdown
                                        .sort((a, b) => b.totalValue - a.totalValue)
                                        .map((cat) => (
                                            <div key={cat.categoryName} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                                                        {cat.categoryName.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">{cat.categoryName}</p>
                                                        <p className="text-xs text-muted-foreground">{cat.itemCount} items</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-medium">{formatCurrency(cat.totalValue)}</p>
                                                    <div className="w-24 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-500 rounded-full"
                                                            style={{ width: `${(cat.totalValue / summary.totalValue) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    {summary.categoryBreakdown.length === 0 && (
                                        <p className="text-center text-muted-foreground py-4">No category data available</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}
