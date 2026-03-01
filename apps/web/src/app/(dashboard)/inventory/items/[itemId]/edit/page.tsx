'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, AlertCircle, RefreshCw } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { CategorySelector } from '@/components/inventory/CategorySelector';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  metalType?: string;
  purity?: string;
  grossWeight: string;
  netWeight: string;
  stoneWeight?: string;
  makingCharges?: string;
  wastagePercentage?: string;
  costRatePercentage?: string;
  calculatedCost?: string;
  isHallmarked: boolean;
  hallmarkNumber?: string;
  huidNumber?: string;
  certificationNumber?: string;
  certificationAgency?: string;
  certificationDate?: string | null;
  imageUrls?: string[];
  isActive: boolean;
}

export default function EditInventoryItemPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params.itemId as string;
  const { user } = useAuthStore();

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Check if user is super admin
  const isSuperAdmin = user?.permissions?.includes('*:*');

  useEffect(() => {
    if (!isSuperAdmin) {
      router.push('/inventory');
      return;
    }
    fetchItem();
    fetchCategories();
  }, [itemId, isSuperAdmin]);

  const fetchItem = async () => {
    try {
      const response = await apiClient.get(`/inventory/items/${itemId}`);
      if (response.data.success) {
        setItem(response.data.data);
      }
    } catch (error: any) {
      setError(error.response?.data?.error?.message || 'Failed to load item');
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updateData: any = {
        name: item.name,
        description: item.description,
        categoryId: item.categoryId === '' ? undefined : item.categoryId,
        metalType: item.metalType === '' ? undefined : item.metalType,
        purity: item.purity,
        grossWeight: item.grossWeight && !isNaN(parseFloat(item.grossWeight)) ? parseFloat(item.grossWeight) : undefined,
        netWeight: item.netWeight && !isNaN(parseFloat(item.netWeight)) ? parseFloat(item.netWeight) : undefined,
        stoneWeight: item.stoneWeight && !isNaN(parseFloat(item.stoneWeight)) ? parseFloat(item.stoneWeight) : 0,
        wastagePercentage: item.wastagePercentage && !isNaN(parseFloat(item.wastagePercentage)) ? parseFloat(item.wastagePercentage) : undefined,
        costRatePercentage: item.costRatePercentage && !isNaN(parseFloat(item.costRatePercentage)) ? parseFloat(item.costRatePercentage) : undefined,
        calculatedCost: item.calculatedCost && !isNaN(parseFloat(item.calculatedCost)) ? parseFloat(item.calculatedCost) : undefined,
        makingCharges: item.makingCharges && !isNaN(parseFloat(item.makingCharges)) ? parseFloat(item.makingCharges) : undefined,
        isHallmarked: item.isHallmarked,
        hallmarkNumber: item.hallmarkNumber,
        huidNumber: item.huidNumber,
        certificationNumber: item.certificationNumber,
        certificationAgency: item.certificationAgency,
        certificationDate: item.certificationDate || null,
        imageUrls: item.imageUrls,
        isActive: item.isActive,
      };

      const response = await apiClient.put(`/inventory/items/${itemId}`, updateData);

      if (response.data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push(`/inventory`);
        }, 1500);
      }
    } catch (error: any) {
      setError(error.response?.data?.error?.message || 'Failed to update item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof InventoryItem, value: any) => {
    if (!item) return;
    setItem({ ...item, [field]: value });
  };

  if (!isSuperAdmin) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Item not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Inventory Item</h1>
        <p className="text-sm text-gray-500 mt-1">SKU: {item.sku}</p>
        <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium">Super Admin Access Only</p>
            <p className="mt-1">All changes will be logged in the system audit trail for compliance and tracking purposes.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">Item updated successfully! Redirecting...</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  value={item.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <CategorySelector
                  categories={categories}
                  value={item.categoryId || ''}
                  onChange={(value) => handleChange('categoryId', value || undefined)}
                  placeholder="Select Category"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
                value={item.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="metalType">Metal Type</Label>
                <select
                  id="metalType"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={item.metalType || ''}
                  onChange={(e) => handleChange('metalType', e.target.value || undefined)}
                >
                  <option value="">Select Metal</option>
                  <option value="gold">Gold</option>
                  <option value="silver">Silver</option>
                  <option value="platinum">Platinum</option>
                  <option value="diamond">Diamond</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <Label htmlFor="purity">Purity</Label>
                <Input
                  id="purity"
                  placeholder="e.g., 22K, 18K, 916"
                  value={item.purity || ''}
                  onChange={(e) => handleChange('purity', e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={item.isActive}
                onChange={(e) => handleChange('isActive', e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="isActive" className="mb-0">Item is Active</Label>
            </div>
          </CardContent>
        </Card>

        {/* Weight Details */}
        <Card>
          <CardHeader>
            <CardTitle>Weight Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="grossWeight">Gross Weight (g) *</Label>
                <Input
                  id="grossWeight"
                  type="number"
                  step="0.001"
                  value={item.grossWeight}
                  onChange={(e) => handleChange('grossWeight', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="netWeight">Net Weight (g) *</Label>
                <Input
                  id="netWeight"
                  type="number"
                  step="0.001"
                  value={item.netWeight}
                  onChange={(e) => handleChange('netWeight', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="stoneWeight">Stone Weight (g)</Label>
                <Input
                  id="stoneWeight"
                  type="number"
                  step="0.001"
                  value={item.stoneWeight || '0'}
                  onChange={(e) => handleChange('stoneWeight', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cost Details */}
        <Card>
          <CardHeader>
            <CardTitle>Cost Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="costRatePercentage">Cost Rate %</Label>
                <Input
                  id="costRatePercentage"
                  type="number"
                  step="0.01"
                  value={item.costRatePercentage || ''}
                  onChange={(e) => handleChange('costRatePercentage', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="wastagePercentage">Wastage %</Label>
                <Input
                  id="wastagePercentage"
                  type="number"
                  step="0.01"
                  value={item.wastagePercentage || ''}
                  onChange={(e) => handleChange('wastagePercentage', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="calculatedCost">Calculated Cost (Rs)</Label>
                <Input
                  id="calculatedCost"
                  type="number"
                  step="0.01"
                  value={item.calculatedCost || ''}
                  onChange={(e) => handleChange('calculatedCost', e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="makingCharges">Making Charges (Rs)</Label>
              <Input
                id="makingCharges"
                type="number"
                step="0.01"
                value={item.makingCharges || ''}
                onChange={(e) => handleChange('makingCharges', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Hallmark & Certification */}
        <Card>
          <CardHeader>
            <CardTitle>Hallmark & Certification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isHallmarked"
                checked={item.isHallmarked}
                onChange={(e) => handleChange('isHallmarked', e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="isHallmarked" className="mb-0">Item is Hallmarked</Label>
            </div>

            {item.isHallmarked && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="hallmarkNumber">Hallmark Number</Label>
                  <Input
                    id="hallmarkNumber"
                    value={item.hallmarkNumber || ''}
                    onChange={(e) => handleChange('hallmarkNumber', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="huidNumber">HUID Number</Label>
                  <Input
                    id="huidNumber"
                    value={item.huidNumber || ''}
                    onChange={(e) => handleChange('huidNumber', e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="certificationNumber">Certification Number</Label>
                <Input
                  id="certificationNumber"
                  value={item.certificationNumber || ''}
                  onChange={(e) => handleChange('certificationNumber', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="certificationAgency">Certification Agency</Label>
                <Input
                  id="certificationAgency"
                  placeholder="e.g., GIA, IGI"
                  value={item.certificationAgency || ''}
                  onChange={(e) => handleChange('certificationAgency', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="certificationDate">Certification Date</Label>
              <Input
                id="certificationDate"
                type="date"
                value={item.certificationDate ? item.certificationDate.split('T')[0] : ''}
                onChange={(e) => handleChange('certificationDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Product Images */}
        <Card>
          <CardHeader>
            <CardTitle>Product Images</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="imageUrls">Image URLs</Label>
              <textarea
                id="imageUrls"
                className="w-full px-3 py-2 border border-gray-300 rounded-md min-h-[100px]"
                placeholder="Enter image URLs, one per line"
                rows={4}
                value={item.imageUrls?.join('\n') || ''}
                onChange={(e) => {
                  const urls = e.target.value.split('\n').map(url => url.trim()).filter(url => url.length > 0);
                  handleChange('imageUrls', urls.length > 0 ? urls : undefined);
                }}
              />
              <p className="text-xs text-gray-500 mt-2">
                Enter image URLs, one per line. These images will be displayed in the product details.
              </p>
            </div>

            {/* Display current images if any */}
            {item.imageUrls && item.imageUrls.length > 0 && (
              <div>
                <Label>Current Images ({item.imageUrls.length})</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                  {item.imageUrls.map((url, index) => (
                    <div key={index} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={url}
                        alt={`Product image ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3ENo Image%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
