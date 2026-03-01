'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
    Search,
    Filter,
    MapPin,
    Package,
    Loader2,
    RefreshCw,
    ShoppingBag
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { Badge } from "@/components/ui/badge";

interface InventoryItem {
    id: string;
    name: string;
    sku: string;
    storeName: string;
    metalType?: string;
    purity?: string;
    grossWeight: string;
    categoryName?: string;
}

export default function GlobalSearchPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Filters
    const [category, setCategory] = useState('');
    const [metalType, setMetalType] = useState('');
    const [storeId, setStoreId] = useState('');

    // Dynamic Data
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [stores, setStores] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        fetchCategories();
        fetchStores();
    }, []);

    const fetchCategories = async () => {
        try {
            const response = await apiClient.get('/inventory/categories');
            if (response.data.success) {
                setCategories(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch categories:', error);
        }
    };

    const fetchStores = async () => {
        try {
            const response = await apiClient.get('/stores/accessible');
            if (response.data.success) {
                setStores(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch stores:', error);
        }
    };

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsLoading(true);
        setHasSearched(true);
        try {
            const response = await apiClient.get('/inventory/global-search', {
                params: {
                    q: searchQuery,
                    category: category || undefined,
                    metalType: metalType || undefined,
                    storeId: storeId || undefined
                }
            });

            if (response.data.success) {
                setItems(response.data.data);
            }
        } catch (error) {
            console.error('Failed to search inventory:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="text-center py-8">
                <h1 className="text-3xl font-bold text-gray-900">Global Inventory Search</h1>
                <p className="text-gray-600 mt-2">Search for items across all branches</p>
            </div>

            <Card className="border-gray-200">
                <CardContent className="p-6">
                    <form onSubmit={handleSearch} className="space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <Input
                                    placeholder="Enter Item Name, SKU, or Barcode..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 h-12 text-lg"
                                    autoFocus
                                />
                            </div>
                            <Button type="submit" size="lg" disabled={isLoading} className="px-8">
                                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Search'}
                            </Button>
                        </div>

                        <div className="flex gap-4 items-center text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                                <Filter className="h-4 w-4" />
                                <span>Filters:</span>
                            </div>

                            <select
                                className="border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={storeId}
                                onChange={(e) => setStoreId(e.target.value)}
                            >
                                <option value="">All Branches</option>
                                {stores.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>

                            <select
                                className="border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={metalType}
                                onChange={(e) => setMetalType(e.target.value)}
                            >
                                <option value="">All Metals</option>
                                <option value="gold">Gold</option>
                                <option value="silver">Silver</option>
                                <option value="platinum">Platinum</option>
                            </select>

                            <select
                                className="border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                            >
                                <option value="">All Categories</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Results */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                </div>
            ) : items.length > 0 ? (
                <div className="grid gap-4">
                    <div className="text-sm text-gray-500 pb-2">Found {items.length} matching items</div>
                    {items.map((item) => (
                        <Card
                            key={item.id}
                            className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500"
                        >
                            <CardContent className="p-4 flex justify-between items-center">
                                <div className="flex items-start gap-4">
                                    <div className="bg-gray-100 p-3 rounded-lg">
                                        <ShoppingBag className="h-6 w-6 text-gray-600" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-lg text-gray-900">{item.name}</h3>
                                            <Badge variant="outline">{item.sku}</Badge>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <MapPin className="h-3 w-3" />
                                                {item.storeName}
                                            </span>
                                            <span>
                                                {item.categoryName || 'Uncategorized'}
                                            </span>
                                            {item.metalType && (
                                                <span className="capitalize">
                                                    {item.metalType} {item.purity}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="text-xl font-bold font-mono text-gray-900">
                                        {parseFloat(item.grossWeight).toFixed(3)}g
                                    </div>
                                    <div className="text-xs text-gray-500 uppercase mt-1">Gross Weight</div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : hasSearched ? (
                <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <Package className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">No items found</h3>
                    <p className="text-gray-500 mt-1">Try adjusting your search terms or filters.</p>
                </div>
            ) : (
                <div className="text-center py-20 text-gray-400">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Enter a search term to find inventory across all branches.</p>
                </div>
            )}
        </div>
    );
}
