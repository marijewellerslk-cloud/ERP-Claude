'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    Calendar,
    MapPin,
    Package,
    CheckCircle2,
    Printer,
    FileCheck2,
    AlertTriangle,
    Receipt
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { format } from 'date-fns';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';

interface TransferItem {
    id: string;
    name: string;
    sku: string;
    weight: string;
    quantity: number;
}

interface Transfer {
    id: string;
    transferNumber: string;
    invoiceNumber: string;
    sourceStoreId: string;
    sourceStore: { id: string; name: string };
    destinationStoreId: string;
    destinationStore: { id: string; name: string };
    status: 'requested' | 'in_transit' | 'completed' | 'cancelled';
    totalWeight: string;
    totalValue: string;
    goldRate: string;
    createdAt: string;
    notes?: string;
    items: TransferItem[];
}

export default function TransferDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const { user, store } = useAuthStore();
    const [transfer, setTransfer] = useState<Transfer | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isReceiving, setIsReceiving] = useState(false);

    useEffect(() => {
        fetchTransferDetails();
    }, [params.id]);

    const fetchTransferDetails = async () => {
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/inventory/transfers/${params.id}`);
            if (response.data.success) {
                setTransfer(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch transfer details:', error);
            toast.error('Failed to load transfer details');
        } finally {
            setIsLoading(false);
        }
    };

    const handleReceiveTransfer = async () => {
        if (!confirm('Are you sure you want to receive this stock? This will update your inventory.')) return;

        setIsReceiving(true);
        try {
            const response = await apiClient.post('/inventory/transfers/receive', {
                transferId: transfer?.id
            });

            if (response.data.success) {
                toast.success('Stock received successfully');
                fetchTransferDetails(); // Refresh to show updated status
            }
        } catch (error: any) {
            console.error('Failed to receive transfer:', error);
            toast.error(error.response?.data?.error?.message || 'Failed to receive transfer');
        } finally {
            setIsReceiving(false);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Loading transfer details...</div>;
    }

    if (!transfer) {
        return <div className="p-8 text-center text-red-500">Transfer not found</div>;
    }

    const isDestinationStore = store?.id === transfer.destinationStoreId;
    const canReceive = isDestinationStore && transfer.status === 'in_transit';

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" className="p-2" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Transfer {transfer.transferNumber}</h1>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                            <Calendar className="h-4 w-4" />
                            Created on {format(new Date(transfer.createdAt), 'MMMM dd, yyyy')}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        <Printer className="h-4 w-4 mr-2" />
                        Print Invoice
                    </Button>
                    {canReceive && (
                        <Button onClick={handleReceiveTransfer} disabled={isReceiving} className="bg-green-600 hover:bg-green-700 text-white">
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            {isReceiving ? 'Receiving...' : 'Receive Stock'}
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Content - Items List */}
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Transferred Items</CardTitle>
                            <CardDescription>
                                {transfer.items.length} items included in this transfer
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-medium">
                                        <tr>
                                            <th className="px-4 py-3">Item Name</th>
                                            <th className="px-4 py-3">SKU</th>
                                            <th className="px-4 py-3 text-right">Weight</th>
                                            <th className="px-4 py-3 text-right">Qty</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {transfer.items.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                                                <td className="px-4 py-3 text-gray-500">{item.sku}</td>
                                                <td className="px-4 py-3 text-right font-mono">{parseFloat(item.weight).toFixed(3)}g</td>
                                                <td className="px-4 py-3 text-right">{item.quantity}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50 font-semibold text-gray-900 border-t">
                                        <tr>
                                            <td colSpan={2} className="px-4 py-3 text-right">Total:</td>
                                            <td className="px-4 py-3 text-right font-mono">{parseFloat(transfer.totalWeight).toFixed(3)}g</td>
                                            <td className="px-4 py-3 text-right">{transfer.items.reduce((acc, i) => acc + i.quantity, 0)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Activity Log / Timeline could go here */}
                </div>

                {/* Sidebar - Details */}
                <div className="space-y-6">
                    {/* Status Card */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex flex-col items-center justify-center text-center space-y-2">
                                {transfer.status === 'in_transit' && (
                                    <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-2">
                                        <Package className="h-6 w-6" />
                                    </div>
                                )}
                                {transfer.status === 'completed' && (
                                    <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2">
                                        <CheckCircle2 className="h-6 w-6" />
                                    </div>
                                )}

                                <h3 className="font-semibold text-lg capitalize">{transfer.status.replace('_', ' ')}</h3>
                                <p className="text-sm text-gray-500">
                                    {transfer.status === 'in_transit'
                                        ? `On its way to ${transfer.destinationStore.name}`
                                        : `Successfully received at ${transfer.destinationStore.name}`
                                    }
                                </p>
                            </div>

                            <div className="mt-6 pt-6 border-t space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="mt-1"><MapPin className="h-4 w-4 text-gray-400" /></div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-medium">From Source</p>
                                        <p className="text-sm font-medium text-gray-900">{transfer.sourceStore.name}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="mt-1"><MapPin className="h-4 w-4 text-gray-400" /></div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-medium">To Destination</p>
                                        <p className="text-sm font-medium text-gray-900">{transfer.destinationStore.name}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Financials Card */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Receipt className="h-4 w-4 text-gray-500" />
                                Transfer Invoice
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Invoice #</span>
                                <span className="font-mono text-gray-900">{transfer.invoiceNumber}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Gold Rate</span>
                                <span className="font-mono text-gray-900">Rs {parseFloat(transfer.goldRate).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm border-t pt-3 font-semibold">
                                <span className="text-gray-900">Total Value</span>
                                <span className="text-gray-900">Rs {parseFloat(transfer.totalValue).toLocaleString()}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {transfer.notes && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Notes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-600 italic">{transfer.notes}</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
