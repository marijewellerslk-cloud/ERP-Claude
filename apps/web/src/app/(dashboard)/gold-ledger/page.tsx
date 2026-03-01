'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import {
    RefreshCw,
    Coins,
    Scale,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    Package,
    Hammer,
} from 'lucide-react';

interface GoldPosition {
    inStock: {
        count: number;
        grossWeight: number;
        netWeight: number;
        fineGoldEquivalent: number;
        currentMarketValue: number;
    };
    sold: {
        count: number;
        grossWeight: number;
        netWeight: number;
        fineGoldEquivalent: number;
        totalRevenue: number;
    };
    purityBreakdown: Array<{
        purity: string;
        count: number;
        grossWeight: number;
        netWeight: number;
        fineGoldEquivalent: number;
    }>;
}

interface GoldItem {
    id: string;
    sku: string;
    name: string;
    purity: string;
    grossWeight: string;
    netWeight: string;
    fineGoldEquivalent: string;
    currentMarketValue: string;
    calculatedCost: string;
    status: string;
    createdAt: string;
}

interface KarigarMovement {
    goldAmount: number;
    fineGoldAmount: number;
    count: number;
}

export default function GoldLedgerPage() {
    const [position, setPosition] = useState<GoldPosition | null>(null);
    const [inventory, setInventory] = useState<GoldItem[]>([]);
    const [karigarMovements, setKarigarMovements] = useState<Record<string, KarigarMovement>>({});
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'karigar'>('overview');

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [posRes, invRes, karRes] = await Promise.all([
                apiClient.get('/gold-ledger/position'),
                apiClient.get('/gold-ledger/inventory'),
                apiClient.get('/gold-ledger/karigar-movements'),
            ]);

            if (posRes.data.success) setPosition(posRes.data.data);
            if (invRes.data.success) setInventory(invRes.data.data);
            if (karRes.data.success) setKarigarMovements(karRes.data.data);
        } catch (err) {
            console.error('Failed to fetch gold ledger data:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatWeight = (grams: number) => `${grams.toFixed(3)}g`;

    const tabs = [
        { key: 'overview' as const, label: 'Gold Position', icon: Coins },
        { key: 'inventory' as const, label: 'Gold Inventory', icon: Package },
        { key: 'karigar' as const, label: 'Karigar Movements', icon: Hammer },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Coins className="h-8 w-8 text-yellow-500" />
                        Gold Ledger
                    </h1>
                    <p className="text-gray-500 mt-1">Track gold inventory position, movements, and karigar allocations</p>
                </div>
                <Button onClick={fetchAll} variant="outline" disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b overflow-x-auto">
                {tabs.map(tab => (
                    <Button
                        key={tab.key}
                        variant={activeTab === tab.key ? 'default' : 'ghost'}
                        onClick={() => setActiveTab(tab.key)}
                        className="flex items-center gap-2 whitespace-nowrap"
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                    </Button>
                ))}
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                    <p className="text-gray-500 mt-2">Loading gold data...</p>
                </div>
            ) : (
                <>
                    {/* Overview */}
                    {activeTab === 'overview' && position && (
                        <div className="space-y-6">
                            {/* In-stock summary */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <Card className="p-6 bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Scale className="h-5 w-5 text-yellow-600" />
                                        <p className="text-sm font-medium text-yellow-700">Gold in Stock</p>
                                    </div>
                                    <p className="text-2xl font-bold text-yellow-800">{formatWeight(position.inStock.grossWeight)}</p>
                                    <p className="text-xs text-yellow-600 mt-1">{position.inStock.count} items</p>
                                </Card>
                                <Card className="p-6">
                                    <p className="text-sm text-gray-500">Net Weight (Stock)</p>
                                    <p className="text-2xl font-bold mt-1">{formatWeight(position.inStock.netWeight)}</p>
                                </Card>
                                <Card className="p-6">
                                    <p className="text-sm text-gray-500">Fine Gold (24K eq.)</p>
                                    <p className="text-2xl font-bold text-amber-600 mt-1">{formatWeight(position.inStock.fineGoldEquivalent)}</p>
                                </Card>
                                <Card className="p-6">
                                    <p className="text-sm text-gray-500">Market Value</p>
                                    <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(position.inStock.currentMarketValue)}</p>
                                </Card>
                            </div>

                            {/* Sold summary */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="p-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ArrowUpRight className="h-5 w-5 text-green-600" />
                                        <p className="text-sm font-medium text-gray-600">Gold Sold</p>
                                    </div>
                                    <p className="text-2xl font-bold">{formatWeight(position.sold.grossWeight)}</p>
                                    <p className="text-xs text-gray-500 mt-1">{position.sold.count} items sold</p>
                                </Card>
                                <Card className="p-6">
                                    <p className="text-sm text-gray-500">Fine Gold Sold (24K eq.)</p>
                                    <p className="text-2xl font-bold mt-1">{formatWeight(position.sold.fineGoldEquivalent)}</p>
                                </Card>
                                <Card className="p-6">
                                    <p className="text-sm text-gray-500">Total Revenue</p>
                                    <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(position.sold.totalRevenue)}</p>
                                </Card>
                            </div>

                            {/* Purity Breakdown */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Coins className="h-5 w-5 text-yellow-500" />
                                        Breakdown by Purity (In Stock)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {position.purityBreakdown.length > 0 ? (
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="text-left p-2">Purity</th>
                                                    <th className="text-right p-2">Items</th>
                                                    <th className="text-right p-2">Gross Wt.</th>
                                                    <th className="text-right p-2">Net Wt.</th>
                                                    <th className="text-right p-2">Fine Gold (24K)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {position.purityBreakdown.map(p => (
                                                    <tr key={p.purity} className="border-t hover:bg-gray-50">
                                                        <td className="p-2">
                                                            <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700">
                                                                {p.purity}
                                                            </Badge>
                                                        </td>
                                                        <td className="p-2 text-right">{p.count}</td>
                                                        <td className="p-2 text-right font-medium">{formatWeight(p.grossWeight)}</td>
                                                        <td className="p-2 text-right">{formatWeight(p.netWeight)}</td>
                                                        <td className="p-2 text-right font-medium text-amber-600">{formatWeight(p.fineGoldEquivalent)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p className="text-gray-400 text-center py-8">No gold items in stock</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Gold Inventory */}
                    {activeTab === 'inventory' && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Package className="h-5 w-5" />
                                    Gold Inventory Items
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {inventory.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="text-left p-2">SKU</th>
                                                    <th className="text-left p-2">Name</th>
                                                    <th className="text-center p-2">Purity</th>
                                                    <th className="text-right p-2">Gross Wt.</th>
                                                    <th className="text-right p-2">Net Wt.</th>
                                                    <th className="text-right p-2">Fine Gold</th>
                                                    <th className="text-right p-2">Cost</th>
                                                    <th className="text-right p-2">Market Value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {inventory.map(item => (
                                                    <tr key={item.id} className="border-t hover:bg-gray-50">
                                                        <td className="p-2 font-mono text-xs">{item.sku}</td>
                                                        <td className="p-2">{item.name}</td>
                                                        <td className="p-2 text-center">
                                                            <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700">
                                                                {item.purity || '-'}
                                                            </Badge>
                                                        </td>
                                                        <td className="p-2 text-right">{formatWeight(parseFloat(item.grossWeight || '0'))}</td>
                                                        <td className="p-2 text-right">{formatWeight(parseFloat(item.netWeight || '0'))}</td>
                                                        <td className="p-2 text-right text-amber-600 font-medium">
                                                            {formatWeight(parseFloat(item.fineGoldEquivalent || '0'))}
                                                        </td>
                                                        <td className="p-2 text-right">{formatCurrency(parseFloat(item.calculatedCost || '0'))}</td>
                                                        <td className="p-2 text-right font-medium text-green-600">
                                                            {formatCurrency(parseFloat(item.currentMarketValue || '0'))}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <Coins className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500">No gold items found</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Karigar Movements */}
                    {activeTab === 'karigar' && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Hammer className="h-5 w-5" />
                                    Karigar Gold Movements
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {Object.keys(karigarMovements).length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="text-left p-3">Transaction Type</th>
                                                    <th className="text-right p-3">Transactions</th>
                                                    <th className="text-right p-3">Gold Amount</th>
                                                    <th className="text-right p-3">Fine Gold (24K)</th>
                                                    <th className="text-center p-3">Direction</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(karigarMovements).map(([type, data]) => (
                                                    <tr key={type} className="border-t hover:bg-gray-50">
                                                        <td className="p-3">
                                                            <Badge variant="secondary" className="capitalize text-xs">
                                                                {type.replace(/_/g, ' ')}
                                                            </Badge>
                                                        </td>
                                                        <td className="p-3 text-right">{data.count}</td>
                                                        <td className="p-3 text-right font-medium">{formatWeight(data.goldAmount)}</td>
                                                        <td className="p-3 text-right text-amber-600 font-medium">{formatWeight(data.fineGoldAmount)}</td>
                                                        <td className="p-3 text-center">
                                                            {type.includes('issue') || type.includes('advance') ? (
                                                                <ArrowUpRight className="h-4 w-4 text-red-500 mx-auto" />
                                                            ) : (
                                                                <ArrowDownRight className="h-4 w-4 text-green-500 mx-auto" />
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <Hammer className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500">No karigar gold movements found</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
