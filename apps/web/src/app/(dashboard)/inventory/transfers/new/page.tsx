'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "../../../../../components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    Search,
    Plus,
    Trash2,
    AlertCircle,
    Box,
    CheckCircle2,
    Truck,
    MapPin
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';

interface Store {
    id: string;
    name: string;
}

interface InventoryItem {
    id: string;
    name: string;
    sku: string;
    grossWeight: string;
    netWeight: string;
    stockLevels: { quantity: number }[];
}

interface TransferItem {
    inventoryItemId: string;
    name: string;
    sku: string;
    weight: number;
    quantity: number;
}

export default function NewTransferPage() {
    const router = useRouter();
    const { user, store } = useAuthStore();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    // Form Data
    const [destinationStoreId, setDestinationStoreId] = useState('');
    const [notes, setNotes] = useState('');
    const [selectedItems, setSelectedItems] = useState<TransferItem[]>([]);

    // Data
    const [stores, setStores] = useState<Store[]>([]);
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchStores();
    }, []);

    useEffect(() => {
        if (searchQuery.length > 2) {
            const timer = setTimeout(() => {
                searchInventory();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [searchQuery]);

    const fetchStores = async () => {
        try {
            const response = await apiClient.get('/stores/accessible');
            if (response.data.success) {
                // Filter out current store
                setStores(response.data.data.filter((s: Store) => s.id !== store?.id));
            }
        } catch (error) {
            console.error('Failed to fetch stores:', error);
        }
    };

    const searchInventory = async () => {
        try {
            const response = await apiClient.get('/inventory/items', {
                params: { q: searchQuery, limit: 10 }
            });
            if (response.data.success) {
                setItems(response.data.data);
            }
        } catch (error) {
            console.error('Failed to search inventory:', error);
        }
    };

    const addItemToTransfer = (item: InventoryItem) => {
        if (selectedItems.find(i => i.inventoryItemId === item.id)) {
            toast.error('Item already added to transfer');
            return;
        }

        const availableQty = item.stockLevels[0]?.quantity || 0;
        if (availableQty < 1) {
            toast.error('Item out of stock');
            return;
        }

        setSelectedItems([
            ...selectedItems,
            {
                inventoryItemId: item.id,
                name: item.name,
                sku: item.sku,
                weight: parseFloat(item.grossWeight),
                quantity: 1
            }
        ]);
        setSearchQuery(''); // Clear search after adding
    };

    const removeItem = (id: string) => {
        setSelectedItems(selectedItems.filter(i => i.inventoryItemId !== id));
    };

    const updateQuantity = (id: string, qty: number) => {
        if (qty < 1) return;
        setSelectedItems(selectedItems.map(i =>
            i.inventoryItemId === id ? { ...i, quantity: qty } : i
        ));
    };

    const calculateTotals = () => {
        const totalItems = selectedItems.reduce((acc, item) => acc + item.quantity, 0);
        const totalWeight = selectedItems.reduce((acc, item) => acc + (item.weight * item.quantity), 0);
        return { totalItems, totalWeight };
    };

    const handleSubmit = async () => {
        if (!destinationStoreId) {
            toast.error('Please select a destination store');
            return;
        }
        if (selectedItems.length === 0) {
            toast.error('Please add items to transfer');
            return;
        }

        setIsLoading(true);
        try {
            const payload = {
                destinationStoreId,
                notes,
                items: selectedItems.map(i => ({
                    inventoryItemId: i.inventoryItemId,
                    quantity: i.quantity
                }))
            };

            const response = await apiClient.post('/inventory/transfers', payload);

            if (response.data.success) {
                toast.success('Transfer created successfully');
                router.push('/inventory/transfers');
            }
        } catch (error: any) {
            console.error('Failed to create transfer:', error);
            toast.error(error.response?.data?.error?.message || 'Failed to create transfer');
        } finally {
            setIsLoading(false);
        }
    };

    const renderStepIndicator = () => (
        <div className="flex items-center justify-center mb-8">
            <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
                    <MapPin className="h-4 w-4" />
                </div>
                <span className="ml-2 font-medium">Destination</span>
            </div>
            <div className={`w-16 h-1 mx-4 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 2 ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
                    <Box className="h-4 w-4" />
                </div>
                <span className="ml-2 font-medium">Add Items</span>
            </div>
            <div className={`w-16 h-1 mx-4 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`flex items-center ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 3 ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
                    <CheckCircle2 className="h-4 w-4" />
                </div>
                <span className="ml-2 font-medium">Review</span>
            </div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" className="p-2" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">New Stock Transfer</h1>
                    <p className="text-gray-600">Move inventory between branches</p>
                </div>
            </div>

            {renderStepIndicator()}

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 min-h-[400px]">
                {/* Step 1: Destination Selection */}
                {step === 1 && (
                    <div className="space-y-6 max-w-md mx-auto py-8">
                        <div className="space-y-2">
                            <Label>Destination Store</Label>
                            <Select value={destinationStoreId} onValueChange={setDestinationStoreId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a store" />
                                </SelectTrigger>
                                <SelectContent>
                                    {stores.map(store => (
                                        <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Transfer Notes (Optional)</Label>
                            <Textarea
                                placeholder="Reason for transfer, special instructions..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={4}
                            />
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button onClick={() => setStep(2)} disabled={!destinationStoreId}>
                                Next: Add Items
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 2: Add Items */}
                {step === 2 && (
                    <div className="space-y-6">
                        <div className="flex gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Scan barcode or search by name/SKU..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                    autoFocus
                                />

                                {/* Search Results Dropdown */}
                                {searchQuery.length > 2 && items.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                        {items.map(item => (
                                            <div
                                                key={item.id}
                                                className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-0 flex justify-between items-center"
                                                onClick={() => addItemToTransfer(item)}
                                            >
                                                <div>
                                                    <div className="font-medium">{item.name}</div>
                                                    <div className="text-xs text-gray-500">{item.sku}</div>
                                                </div>
                                                <div className="text-right text-sm">
                                                    <div>{parseFloat(item.grossWeight).toFixed(3)}g</div>
                                                    <div className={item.stockLevels[0]?.quantity > 0 ? "text-green-600" : "text-red-600"}>
                                                        {item.stockLevels[0]?.quantity || 0} in stock
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Selected Items Table */}
                        <div className="border rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight/Unit</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {selectedItems.length > 0 ? (
                                        selectedItems.map((item) => (
                                            <tr key={item.inventoryItemId}>
                                                <td className="px-6 py-4 text-sm text-gray-900">{item.name}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{item.sku}</td>
                                                <td className="px-6 py-4 text-sm text-gray-900">{item.weight.toFixed(3)}g</td>
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        className="w-16 border rounded px-2 py-1 text-sm"
                                                        value={item.quantity}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateQuantity(item.inventoryItemId, parseInt(e.target.value))}
                                                    />
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-800" onClick={() => removeItem(item.inventoryItemId)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                                No items added to transfer yet. Search above to add items.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between pt-4">
                            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                            <Button onClick={() => setStep(3)} disabled={selectedItems.length === 0}>
                                Next: Review Transfer
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Review */}
                {step === 3 && (
                    <div className="space-y-6 max-w-2xl mx-auto">
                        <div className="bg-gray-50 p-6 rounded-lg space-y-4">
                            <div className="flex justify-between items-center pb-4 border-b">
                                <h3 className="font-semibold text-lg">Transfer Summary</h3>
                                <Badge>Reviewing</Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-500 block">From Store</span>
                                    <span className="font-medium">{user?.permissions?.includes('*:*') ? 'Current Store' : 'Main Branch'} {/* Replace with actual logic */}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 block">To Destination</span>
                                    <span className="font-medium">{stores.find(s => s.id === destinationStoreId)?.name}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 block">Total Items</span>
                                    <span className="font-medium">{calculateTotals().totalItems} pcs</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 block">Total Weight</span>
                                    <span className="font-medium">{calculateTotals().totalWeight.toFixed(3)} g</span>
                                </div>
                            </div>

                            {notes && (
                                <div className="pt-2">
                                    <span className="text-gray-500 block text-sm">Notes</span>
                                    <p className="text-sm italic text-gray-700">{notes}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-blue-50 text-blue-800 rounded-lg text-sm">
                            <AlertCircle className="h-5 w-5 flex-shrink-0" />
                            <p>Confirming this transfer will reserve the selected stock. An invoice will be automatically generated with the current gold rate.</p>
                        </div>

                        <div className="flex justify-between pt-4">
                            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                            <Button onClick={handleSubmit} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
                                {isLoading ? 'Creating...' : 'Confirm & Create Transfer'}
                                {!isLoading && <Truck className="h-4 w-4 ml-2" />}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
