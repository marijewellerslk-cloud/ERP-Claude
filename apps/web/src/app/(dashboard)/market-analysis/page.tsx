'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    RefreshCw,
    Save,
    TrendingUp,
    TrendingDown,
    DollarSign,
    LineChart as LineChartIcon,
    Calendar,
    Plus,
    Trash2,
    ArrowRightLeft,
    Globe,
    MapPin,
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    Area,
    AreaChart,
    ReferenceLine,
} from 'recharts';
import { apiClient } from '@/lib/api-client';

interface MarketDataRecord {
    id: string;
    date: string;
    worldGoldPriceUsd: number | null;
    seaStreetPriceLkr: number | null;
    lkrUsdtRate: number | null;
    worldGoldPriceLkrGram: number | null;
    spreadPercentage: number | null;
    notes: string | null;
    createdAt: string;
}

type DateRange = '7d' | '30d' | '90d' | '1y' | 'all';

export default function MarketAnalysisPage() {
    const [data, setData] = useState<MarketDataRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<DateRange>('30d');
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [formDate, setFormDate] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });
    const [formWorldGold, setFormWorldGold] = useState('');
    const [formSeaStreet, setFormSeaStreet] = useState('');
    const [formLkrUsdt, setFormLkrUsdt] = useState('');
    const [formNotes, setFormNotes] = useState('');

    const getDateRangeStart = useCallback((range: DateRange): string | undefined => {
        if (range === 'all') return undefined;
        const now = new Date();
        const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
        now.setDate(now.getDate() - days);
        return now.toISOString().split('T')[0];
    }, []);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const startDate = getDateRangeStart(dateRange);
            const params: Record<string, string> = {};
            if (startDate) params.startDate = startDate;

            const res = await apiClient.get('/market-data/rates', { params });

            if (res.data.success) {
                setData(res.data.data);
            }
        } catch (err: any) {
            const apiError = err.response?.data?.error;
            setError(typeof apiError === 'string' ? apiError : apiError?.message || 'Failed to load market data');
        } finally {
            setLoading(false);
        }
    }, [dateRange, getDateRangeStart]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formWorldGold && !formSeaStreet && !formLkrUsdt) {
            setError('Please enter at least one rate value');
            return;
        }

        try {
            setSaving(true);
            setError(null);

            await apiClient.post('/market-data/rates', {
                date: formDate,
                worldGoldPriceUsd: formWorldGold || undefined,
                seaStreetPriceLkr: formSeaStreet || undefined,
                lkrUsdtRate: formLkrUsdt || undefined,
                notes: formNotes || undefined,
            });

            // Reset form
            setFormWorldGold('');
            setFormSeaStreet('');
            setFormLkrUsdt('');
            setFormNotes('');
            setShowForm(false);

            // Refresh data
            await fetchData();
        } catch (err: any) {
            const apiError = err.response?.data?.error;
            setError(typeof apiError === 'string' ? apiError : apiError?.message || 'Failed to save market data');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this rate entry?')) return;
        try {
            await apiClient.delete(`/market-data/rates/${id}`);
            await fetchData();
        } catch (err: any) {
            const apiError = err.response?.data?.error;
            setError(typeof apiError === 'string' ? apiError : apiError?.message || 'Failed to delete entry');
        }
    };

    // Prepare chart data (reverse so earliest date is first)
    const chartData = [...data]
        .reverse()
        .map((d) => ({
            date: new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
            fullDate: d.date,
            worldGoldUsd: d.worldGoldPriceUsd,
            seaStreetLkr: d.seaStreetPriceLkr,
            worldGoldLkr: d.worldGoldPriceLkrGram,
            lkrUsdt: d.lkrUsdtRate,
            spread: d.spreadPercentage,
        }));

    const latestEntry = data[0];
    const previousEntry = data[1];

    const getChange = (current: number | null, previous: number | null) => {
        if (!current || !previous) return null;
        return ((current - previous) / previous) * 100;
    };

    const worldGoldChange = getChange(latestEntry?.worldGoldPriceUsd, previousEntry?.worldGoldPriceUsd);
    const seaStreetChange = getChange(latestEntry?.seaStreetPriceLkr, previousEntry?.seaStreetPriceLkr);
    const usdtChange = getChange(latestEntry?.lkrUsdtRate, previousEntry?.lkrUsdtRate);

    if (loading && data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Market Analysis</h1>
                    <p className="text-gray-500 mt-1">
                        Track and compare World Gold Price, Sea Street Rates & LKR/USDT
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'secondary' : 'default'}>
                        <Plus className="h-4 w-4 mr-2" />
                        {showForm ? 'Cancel' : 'Add Daily Rate'}
                    </Button>
                    <Button onClick={fetchData} variant="outline" disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                </div>
            )}

            {/* Rate Entry Form */}
            {showForm && (
                <Card className="p-6 border-amber-200 bg-gradient-to-r from-amber-50/50 to-yellow-50/50">
                    <h3 className="font-semibold text-lg mb-4">Enter Daily Market Rates</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                <Input
                                    type="date"
                                    value={formDate}
                                    onChange={(e) => setFormDate(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    World Gold Price <span className="text-gray-400 text-xs">(USD/oz)</span>
                                </label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="e.g. 2650.00"
                                    value={formWorldGold}
                                    onChange={(e) => setFormWorldGold(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Sea Street Price <span className="text-gray-400 text-xs">(LKR/g, 22K)</span>
                                </label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="e.g. 25500.00"
                                    value={formSeaStreet}
                                    onChange={(e) => setFormSeaStreet(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    LKR/USDT Rate <span className="text-gray-400 text-xs">(1 USDT = X LKR)</span>
                                </label>
                                <Input
                                    type="number"
                                    step="0.0001"
                                    placeholder="e.g. 325.50"
                                    value={formLkrUsdt}
                                    onChange={(e) => setFormLkrUsdt(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <Input
                                    placeholder="Notes (optional)"
                                    value={formNotes}
                                    onChange={(e) => setFormNotes(e.target.value)}
                                />
                            </div>
                            <Button type="submit" disabled={saving} className="bg-amber-600 hover:bg-amber-700">
                                <Save className="h-4 w-4 mr-2" />
                                {saving ? 'Saving...' : 'Save Rate'}
                            </Button>
                        </div>
                        {/* Live preview */}
                        {formWorldGold && formLkrUsdt && (
                            <div className="mt-4 p-3 bg-white rounded-lg border text-sm">
                                <span className="text-gray-500">Calculated: </span>
                                <span className="font-medium text-amber-700">
                                    World Gold in LKR ≈ Rs.{' '}
                                    {(
                                        (parseFloat(formWorldGold) / 31.1035) *
                                        parseFloat(formLkrUsdt) *
                                        (91.67 / 99.9)
                                    ).toFixed(2)}
                                    /g (22K)
                                </span>
                                {formSeaStreet && (
                                    <>
                                        <span className="text-gray-400 mx-2">|</span>
                                        <span className="font-medium">
                                            Spread:{' '}
                                            <span
                                                className={
                                                    parseFloat(formSeaStreet) >
                                                        (parseFloat(formWorldGold) / 31.1035) *
                                                        parseFloat(formLkrUsdt) *
                                                        (91.67 / 99.9)
                                                        ? 'text-red-600'
                                                        : 'text-green-600'
                                                }
                                            >
                                                {(
                                                    ((parseFloat(formSeaStreet) -
                                                        (parseFloat(formWorldGold) / 31.1035) *
                                                        parseFloat(formLkrUsdt) *
                                                        (91.67 / 99.9)) /
                                                        ((parseFloat(formWorldGold) / 31.1035) *
                                                            parseFloat(formLkrUsdt) *
                                                            (91.67 / 99.9))) *
                                                    100
                                                ).toFixed(2)}
                                                %
                                            </span>
                                        </span>
                                    </>
                                )}
                            </div>
                        )}
                    </form>
                </Card>
            )}

            {/* Summary Cards */}
            {latestEntry && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* World Gold Price */}
                    <Card className="p-5 border-blue-100">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Globe className="h-4 w-4 text-blue-500" />
                                    <p className="text-sm text-gray-500">World Gold (USD/oz)</p>
                                </div>
                                <p className="text-2xl font-bold text-blue-700">
                                    ${latestEntry.worldGoldPriceUsd?.toLocaleString() || '—'}
                                </p>
                                {worldGoldChange !== null && (
                                    <div className="flex items-center gap-1 mt-1">
                                        {worldGoldChange >= 0 ? (
                                            <TrendingUp className="h-3 w-3 text-green-500" />
                                        ) : (
                                            <TrendingDown className="h-3 w-3 text-red-500" />
                                        )}
                                        <span
                                            className={`text-xs ${worldGoldChange >= 0 ? 'text-green-600' : 'text-red-600'}`}
                                        >
                                            {worldGoldChange >= 0 ? '+' : ''}
                                            {worldGoldChange.toFixed(2)}%
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* Sea Street Price */}
                    <Card className="p-5 border-amber-100">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <MapPin className="h-4 w-4 text-amber-500" />
                                    <p className="text-sm text-gray-500">Sea Street (LKR/g)</p>
                                </div>
                                <p className="text-2xl font-bold text-amber-700">
                                    Rs. {latestEntry.seaStreetPriceLkr?.toLocaleString() || '—'}
                                </p>
                                {seaStreetChange !== null && (
                                    <div className="flex items-center gap-1 mt-1">
                                        {seaStreetChange >= 0 ? (
                                            <TrendingUp className="h-3 w-3 text-green-500" />
                                        ) : (
                                            <TrendingDown className="h-3 w-3 text-red-500" />
                                        )}
                                        <span
                                            className={`text-xs ${seaStreetChange >= 0 ? 'text-green-600' : 'text-red-600'}`}
                                        >
                                            {seaStreetChange >= 0 ? '+' : ''}
                                            {seaStreetChange.toFixed(2)}%
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* LKR/USDT */}
                    <Card className="p-5 border-green-100">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <ArrowRightLeft className="h-4 w-4 text-green-500" />
                                    <p className="text-sm text-gray-500">LKR/USDT</p>
                                </div>
                                <p className="text-2xl font-bold text-green-700">
                                    Rs. {latestEntry.lkrUsdtRate?.toLocaleString() || '—'}
                                </p>
                                {usdtChange !== null && (
                                    <div className="flex items-center gap-1 mt-1">
                                        {usdtChange >= 0 ? (
                                            <TrendingUp className="h-3 w-3 text-red-500" />
                                        ) : (
                                            <TrendingDown className="h-3 w-3 text-green-500" />
                                        )}
                                        <span
                                            className={`text-xs ${usdtChange >= 0 ? 'text-red-600' : 'text-green-600'}`}
                                        >
                                            {usdtChange >= 0 ? '+' : ''}
                                            {usdtChange.toFixed(2)}%
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* Spread */}
                    <Card className="p-5 border-purple-100">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <LineChartIcon className="h-4 w-4 text-purple-500" />
                                    <p className="text-sm text-gray-500">Spread %</p>
                                </div>
                                <p className={`text-2xl font-bold ${(latestEntry.spreadPercentage ?? 0) > 0 ? 'text-red-600' : 'text-green-600'
                                    }`}>
                                    {latestEntry.spreadPercentage !== null
                                        ? `${latestEntry.spreadPercentage > 0 ? '+' : ''}${latestEntry.spreadPercentage.toFixed(2)}%`
                                        : '—'}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    Sea Street vs World Gold
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Date Range Filter */}
            <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-500 mr-2">Range:</span>
                {(['7d', '30d', '90d', '1y', 'all'] as DateRange[]).map((range) => (
                    <Button
                        key={range}
                        variant={dateRange === range ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDateRange(range)}
                        className={dateRange === range ? 'bg-amber-600 hover:bg-amber-700' : ''}
                    >
                        {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '3 Months' : range === '1y' ? '1 Year' : 'All'}
                    </Button>
                ))}
            </div>

            {/* Charts */}
            {chartData.length > 1 ? (
                <div className="space-y-6">
                    {/* Gold Price Comparison Chart (LKR/gram) */}
                    <Card className="p-6">
                        <h3 className="font-semibold text-lg mb-1">Gold Price Comparison (LKR per gram, 22K)</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Sea Street local rate vs World Gold converted to LKR/gram
                        </p>
                        <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorSeaStreet" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorWorldGold" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 12, fill: '#888' }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12, fill: '#888' }}
                                        tickLine={false}
                                        tickFormatter={(v) => `Rs.${(v / 1000).toFixed(1)}k`}
                                        domain={['auto', 'auto']}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(255,255,255,0.95)',
                                            borderRadius: '8px',
                                            border: '1px solid #e5e7eb',
                                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                        }}
                                        formatter={(value: any, name: any) => [
                                            `Rs. ${(value || 0).toLocaleString()}`,
                                            name === 'seaStreetLkr' ? 'Sea Street' : 'World Gold (LKR)',
                                        ]}
                                    />
                                    <Legend
                                        formatter={(value) =>
                                            value === 'seaStreetLkr'
                                                ? 'Sea Street Price'
                                                : 'World Gold (converted to LKR/g)'
                                        }
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="worldGoldLkr"
                                        stroke="#3b82f6"
                                        strokeWidth={2}
                                        fill="url(#colorWorldGold)"
                                        dot={{ r: 3, fill: '#3b82f6' }}
                                        activeDot={{ r: 6 }}
                                        connectNulls
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="seaStreetLkr"
                                        stroke="#f59e0b"
                                        strokeWidth={2}
                                        fill="url(#colorSeaStreet)"
                                        dot={{ r: 3, fill: '#f59e0b' }}
                                        activeDot={{ r: 6 }}
                                        connectNulls
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* Spread Percentage Chart */}
                    <Card className="p-6">
                        <h3 className="font-semibold text-lg mb-1">Sea Street Premium / Discount</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Percentage difference between Sea Street and converted World Gold price
                        </p>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorSpread" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 12, fill: '#888' }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12, fill: '#888' }}
                                        tickLine={false}
                                        tickFormatter={(v) => `${v}%`}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(255,255,255,0.95)',
                                            borderRadius: '8px',
                                            border: '1px solid #e5e7eb',
                                        }}
                                        formatter={(value: any) => [`${value?.toFixed(2)}%`, 'Spread']}
                                    />
                                    <ReferenceLine y={0} stroke="#999" strokeDasharray="3 3" />
                                    <Area
                                        type="monotone"
                                        dataKey="spread"
                                        stroke="#8b5cf6"
                                        strokeWidth={2}
                                        fill="url(#colorSpread)"
                                        dot={{ r: 3, fill: '#8b5cf6' }}
                                        connectNulls
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* USDT Exchange Rate Chart */}
                    <Card className="p-6">
                        <h3 className="font-semibold text-lg mb-1">LKR/USDT Exchange Rate</h3>
                        <p className="text-sm text-gray-500 mb-4">Daily parallel market exchange rate</p>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 12, fill: '#888' }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12, fill: '#888' }}
                                        tickLine={false}
                                        tickFormatter={(v) => `${v}`}
                                        domain={['auto', 'auto']}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(255,255,255,0.95)',
                                            borderRadius: '8px',
                                            border: '1px solid #e5e7eb',
                                        }}
                                        formatter={(value: any) => [`Rs. ${value?.toLocaleString()}`, 'LKR/USDT']}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="lkrUsdt"
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        dot={{ r: 3, fill: '#10b981' }}
                                        activeDot={{ r: 6 }}
                                        connectNulls
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* World Gold in USD Chart */}
                    <Card className="p-6">
                        <h3 className="font-semibold text-lg mb-1">World Gold Price (USD/oz)</h3>
                        <p className="text-sm text-gray-500 mb-4">International gold price per troy ounce</p>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 12, fill: '#888' }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12, fill: '#888' }}
                                        tickLine={false}
                                        tickFormatter={(v) => `$${v.toLocaleString()}`}
                                        domain={['auto', 'auto']}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(255,255,255,0.95)',
                                            borderRadius: '8px',
                                            border: '1px solid #e5e7eb',
                                        }}
                                        formatter={(value: any) => [`$${value?.toLocaleString()}`, 'World Gold']}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="worldGoldUsd"
                                        stroke="#3b82f6"
                                        strokeWidth={2}
                                        dot={{ r: 3, fill: '#3b82f6' }}
                                        activeDot={{ r: 6 }}
                                        connectNulls
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>
            ) : (
                <Card className="p-12 text-center">
                    <LineChartIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-500 mb-2">No Data Yet</h3>
                    <p className="text-gray-400 mb-4">
                        Start adding daily market rates to see trends and patterns.
                    </p>
                    <Button onClick={() => setShowForm(true)} className="bg-amber-600 hover:bg-amber-700">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Entry
                    </Button>
                </Card>
            )}

            {/* Data Table */}
            {data.length > 0 && (
                <Card className="p-6">
                    <h3 className="font-semibold text-lg mb-4">Rate History</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">World Gold (USD/oz)</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sea Street (LKR/g)</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">LKR/USDT</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">World→LKR/g</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Spread</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {data.map((row) => (
                                    <tr key={row.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-sm">
                                            {new Date(row.date).toLocaleDateString('en-GB', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric',
                                            })}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm text-blue-600 font-medium">
                                            {row.worldGoldPriceUsd ? `$${row.worldGoldPriceUsd.toLocaleString()}` : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm text-amber-600 font-medium">
                                            {row.seaStreetPriceLkr ? `Rs. ${row.seaStreetPriceLkr.toLocaleString()}` : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm text-green-600 font-medium">
                                            {row.lkrUsdtRate ? `Rs. ${row.lkrUsdtRate.toLocaleString()}` : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                                            {row.worldGoldPriceLkrGram ? `Rs. ${row.worldGoldPriceLkrGram.toLocaleString()}` : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {row.spreadPercentage !== null ? (
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        row.spreadPercentage > 0
                                                            ? 'border-red-200 text-red-600'
                                                            : 'border-green-200 text-green-600'
                                                    }
                                                >
                                                    {row.spreadPercentage > 0 ? '+' : ''}
                                                    {row.spreadPercentage.toFixed(2)}%
                                                </Badge>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">
                                            {row.notes || ''}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(row.id)}
                                                className="text-red-400 hover:text-red-600"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Formula Reference */}
            <Card className="p-6 bg-gray-50">
                <h3 className="font-medium text-lg mb-4">Conversion Reference</h3>
                <div className="grid md:grid-cols-3 gap-6">
                    <div>
                        <p className="text-sm text-gray-600 mb-2"><strong>World → LKR/gram (22K):</strong></p>
                        <code className="text-xs bg-white p-2 rounded block">
                            (USD/oz ÷ 31.1035) × LKR/USDT × (91.67% ÷ 99.9%)
                        </code>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600 mb-2"><strong>Spread Calculation:</strong></p>
                        <code className="text-xs bg-white p-2 rounded block">
                            ((Sea Street - World LKR) ÷ World LKR) × 100
                        </code>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600 mb-2"><strong>Troy Ounce:</strong></p>
                        <code className="text-xs bg-white p-2 rounded block">
                            1 Troy Ounce = 31.1035 grams
                        </code>
                    </div>
                </div>
            </Card>
        </div>
    );
}
