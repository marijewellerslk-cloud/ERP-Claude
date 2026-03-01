'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    Plus,
    ArrowRightLeft,
    Calendar,
    MapPin,
    Package,
    ArrowUpRight,
    ArrowDownLeft
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { format } from 'date-fns';

interface Transfer {
    id: string;
    transferNumber: string;
    sourceStore: { id: string; name: string };
    destinationStore: { id: string; name: string };
    status: 'requested' | 'in_transit' | 'completed' | 'cancelled';
    totalWeight: string;
    totalValue: string;
    itemCount: number;
    createdAt: string;
}

export default function StockTransfersPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState('inbound');
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchTransfers();
    }, [activeTab]);

    const fetchTransfers = async () => {
        setIsLoading(true);
        try {
            // Map the frontend tab value to the expected API value
            const apiType = activeTab === 'inbound' ? 'incoming' : activeTab;

            const response = await apiClient.get('/inventory/transfers', {
                params: { type: apiType }
            });

            if (response.data.success) {
                setTransfers(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch transfers:', error);
            setTransfers([]);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'in_transit':
                return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">In Transit</Badge>;
            case 'completed':
                return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Received</Badge>;
            case 'cancelled':
                return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Cancelled</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const filteredTransfers = transfers.filter(t =>
        t.transferNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.sourceStore.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.destinationStore.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Stock Transfers</h1>
                    <p className="text-gray-600 mt-1">Manage inter-branch inventory movements</p>
                </div>
                <Button onClick={() => router.push('/inventory/transfers/new')}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Transfer
                </Button>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <Tabs defaultValue="inbound" onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="inbound" className="flex items-center gap-2">
                            <ArrowDownLeft className="h-4 w-4" />
                            Incoming (To Receive)
                        </TabsTrigger>
                        <TabsTrigger value="outbound" className="flex items-center gap-2">
                            <ArrowUpRight className="h-4 w-4" />
                            Outgoing (Sent)
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex gap-4 mb-6">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search transfers..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Button variant="outline">
                            <Calendar className="h-4 w-4 mr-2" />
                            Filter Date
                        </Button>
                    </div>

                    <TabsContent value="inbound" className="space-y-4">
                        {isLoading ? (
                            <div className="text-center py-8 text-gray-500">Loading transfers...</div>
                        ) : filteredTransfers.length > 0 ? (
                            <div className="grid gap-4">
                                {filteredTransfers.map((transfer) => (
                                    <Card
                                        key={transfer.id}
                                        className="cursor-pointer hover:shadow-md transition-shadow"
                                        onClick={() => router.push(`/inventory/transfers/${transfer.id}`)}
                                    >
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div className="flex items-start gap-4">
                                                <div className="bg-blue-50 p-3 rounded-lg">
                                                    <ArrowDownLeft className="h-6 w-6 text-blue-600" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-semibold text-gray-900">{transfer.transferNumber}</span>
                                                        {getStatusBadge(transfer.status)}
                                                    </div>
                                                    <div className="flex items-center text-sm text-gray-500 gap-4">
                                                        <span className="flex items-center gap-1">
                                                            <MapPin className="h-3 w-3" />
                                                            From: {transfer.sourceStore.name}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="h-3 w-3" />
                                                            {format(new Date(transfer.createdAt), 'MMM dd, yyyy')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <div className="font-medium text-gray-900">
                                                    {transfer.itemCount} items ({transfer.totalWeight}g)
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    Rs {parseFloat(transfer.totalValue).toLocaleString()}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                <Package className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                                <h3 className="text-sm font-medium text-gray-900">No incoming transfers</h3>
                                <p className="text-sm text-gray-500 mt-1">You have no transfers waiting to be received.</p>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="outbound" className="space-y-4">
                        {isLoading ? (
                            <div className="text-center py-8 text-gray-500">Loading transfers...</div>
                        ) : filteredTransfers.length > 0 ? (
                            <div className="grid gap-4">
                                {filteredTransfers.map((transfer) => (
                                    <Card
                                        key={transfer.id}
                                        className="cursor-pointer hover:shadow-md transition-shadow"
                                        onClick={() => router.push(`/inventory/transfers/${transfer.id}`)}
                                    >
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div className="flex items-start gap-4">
                                                <div className="bg-orange-50 p-3 rounded-lg">
                                                    <ArrowUpRight className="h-6 w-6 text-orange-600" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-semibold text-gray-900">{transfer.transferNumber}</span>
                                                        {getStatusBadge(transfer.status)}
                                                    </div>
                                                    <div className="flex items-center text-sm text-gray-500 gap-4">
                                                        <span className="flex items-center gap-1">
                                                            <MapPin className="h-3 w-3" />
                                                            To: {transfer.destinationStore.name}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="h-3 w-3" />
                                                            {format(new Date(transfer.createdAt), 'MMM dd, yyyy')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <div className="font-medium text-gray-900">
                                                    {transfer.itemCount} items ({transfer.totalWeight}g)
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    Rs {parseFloat(transfer.totalValue).toLocaleString()}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                <Package className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                                <h3 className="text-sm font-medium text-gray-900">No outgoing transfers</h3>
                                <p className="text-sm text-gray-500 mt-1">Start a new transfer to move stock to another branch.</p>
                                <Button variant="outline" className="mt-4" onClick={() => router.push('/inventory/transfers/new')}>
                                    Create Transfer
                                </Button>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
