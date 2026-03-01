'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import apiClient from '@/lib/api-client';
import { ArrowLeft, Heart, Loader2, Search } from 'lucide-react';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  customerCode: string;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  metalType: string;
  purity: string;
  grossWeight: string;
  rate: string;
}

interface Category {
  id: string;
  name: string;
}

export default function AddToWishlistPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.customerId as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [wishlistType, setWishlistType] = useState<'inventory' | 'custom'>('custom');

  // For inventory item selection
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // For custom description
  const [categories, setCategories] = useState<Category[]>([]);
  const [customData, setCustomData] = useState({
    description: '',
    categoryId: '',
    metalType: '',
    purity: '',
    estimatedWeight: '',
    budgetMin: '',
    budgetMax: '',
    notes: '',
    priority: 'normal',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch customer details
        const customerRes = await apiClient.get(`/customers/${customerId}`);
        if (customerRes.data.success) {
          setCustomer(customerRes.data.data);
        }

        // Fetch inventory items
        const inventoryRes = await apiClient.get('/inventory/items');
        if (inventoryRes.data.success) {
          setInventoryItems(inventoryRes.data.data || []);
        }

        // Fetch categories
        const categoriesRes = await apiClient.get('/inventory/categories');
        if (categoriesRes.data.success) {
          setCategories(categoriesRes.data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [customerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);

      const payload = wishlistType === 'inventory'
        ? {
            wishlistType: 'inventory_item',
            inventoryItemId: selectedItemId,
            priority: customData.priority,
          }
        : {
            wishlistType: 'custom',
            itemDescription: customData.description,
            categoryId: customData.categoryId || undefined,
            preferredMetalType: customData.metalType || undefined,
            preferredPurity: customData.purity || undefined,
            estimatedWeight: customData.estimatedWeight ? parseFloat(customData.estimatedWeight) : undefined,
            budgetMin: customData.budgetMin ? parseFloat(customData.budgetMin) : undefined,
            budgetMax: customData.budgetMax ? parseFloat(customData.budgetMax) : undefined,
            notes: customData.notes || undefined,
            priority: customData.priority,
          };

      const response = await apiClient.post(`/customers/${customerId}/wishlist`, payload);

      if (response.data.success) {
        alert('Item added to wishlist successfully!');
        router.back();
      } else {
        alert('Failed to add item to wishlist');
      }
    } catch (error: any) {
      console.error('Failed to add to wishlist:', error);
      alert(error.response?.data?.error?.message || 'Failed to add item to wishlist');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = inventoryItems.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add to Wishlist</h1>
          <p className="text-gray-500">
            {customer && `${customer.firstName} ${customer.lastName} (${customer.customerCode})`}
          </p>
        </div>
      </div>

      {/* Wishlist Type Selection */}
      <Card className="p-6">
        <div className="space-y-4">
          <Label>Wishlist Type</Label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setWishlistType('inventory')}
              className={`p-4 border-2 rounded-lg text-left transition ${
                wishlistType === 'inventory'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <h3 className="font-semibold mb-1">Specific Item</h3>
              <p className="text-sm text-gray-500">Select from current inventory</p>
            </button>
            <button
              type="button"
              onClick={() => setWishlistType('custom')}
              className={`p-4 border-2 rounded-lg text-left transition ${
                wishlistType === 'custom'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <h3 className="font-semibold mb-1">Custom Description</h3>
              <p className="text-sm text-gray-500">Describe desired item</p>
            </button>
          </div>
        </div>
      </Card>

      {/* Form */}
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {wishlistType === 'inventory' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="search">Search Inventory</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Search by name or SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="item">Select Item *</Label>
                <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an inventory item" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredItems.length > 0 ? (
                      filteredItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({item.sku}) - {item.metalType} {item.purity}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-sm text-gray-500">No items found</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="description">Item Description *</Label>
                <Input
                  id="description"
                  placeholder="e.g., Gold necklace with pendant, 22K, 15-20g"
                  value={customData.description}
                  onChange={(e) => setCustomData({ ...customData, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={customData.categoryId}
                    onValueChange={(value) => setCustomData({ ...customData, categoryId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="metalType">Metal Type</Label>
                  <Select
                    value={customData.metalType}
                    onValueChange={(value) => setCustomData({ ...customData, metalType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select metal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gold">Gold</SelectItem>
                      <SelectItem value="silver">Silver</SelectItem>
                      <SelectItem value="platinum">Platinum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purity">Purity</Label>
                  <Select
                    value={customData.purity}
                    onValueChange={(value) => setCustomData({ ...customData, purity: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select purity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24K">24K</SelectItem>
                      <SelectItem value="22K">22K</SelectItem>
                      <SelectItem value="18K">18K</SelectItem>
                      <SelectItem value="14K">14K</SelectItem>
                      <SelectItem value="925">925 Silver</SelectItem>
                      <SelectItem value="950">950 Platinum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weight">Estimated Weight (g)</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.001"
                    placeholder="e.g., 15.5"
                    value={customData.estimatedWeight}
                    onChange={(e) => setCustomData({ ...customData, estimatedWeight: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="budgetMin">Budget Min (Rs)</Label>
                  <Input
                    id="budgetMin"
                    type="number"
                    step="100"
                    placeholder="e.g., 50000"
                    value={customData.budgetMin}
                    onChange={(e) => setCustomData({ ...customData, budgetMin: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budgetMax">Budget Max (Rs)</Label>
                  <Input
                    id="budgetMax"
                    type="number"
                    step="100"
                    placeholder="e.g., 100000"
                    value={customData.budgetMax}
                    onChange={(e) => setCustomData({ ...customData, budgetMax: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Input
                  id="notes"
                  placeholder="Any special requirements or preferences"
                  value={customData.notes}
                  onChange={(e) => setCustomData({ ...customData, notes: e.target.value })}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={customData.priority}
              onValueChange={(value) => setCustomData({ ...customData, priority: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-1">Wishlist Notifications</h4>
            <p className="text-sm text-blue-800">
              {wishlistType === 'inventory'
                ? 'Customer will be notified if this specific item becomes available.'
                : 'Customer will be notified when matching items arrive in inventory based on the criteria specified.'}
            </p>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={submitting || (wishlistType === 'inventory' && !selectedItemId)}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Heart className="h-4 w-4 mr-2" />
                  Add to Wishlist
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
