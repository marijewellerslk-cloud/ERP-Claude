'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import apiClient from '@/lib/api-client';
import { CategorySelector } from '@/components/inventory/CategorySelector';
import { ImageUpload } from '@/components/common/ImageUpload';

const itemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  itemType: z.enum(['finished_goods', 'raw_material', 'semi_finished']),
  categoryId: z.string().optional(),
  metalType: z.enum(['gold', 'silver', 'platinum', 'diamond', 'other']).optional(),
  purity: z.string().optional(),
  grossWeight: z.string().min(1, 'Gross weight is required'),
  netWeight: z.string().min(1, 'Net weight is required'),
  stoneWeight: z.string().optional(),
  makingCharges: z.string().optional(),
  location: z.string().optional(),
  dimensions: z.object({
    length: z.string().optional(),
    width: z.string().optional(),
    height: z.string().optional(),
    internalSize: z.string().optional(),
    ringSize: z.string().optional(),
  }).optional(),
  // Cost calculation fields
  costCalculationMethod: z.enum(['rate_based', 'making_charges']).optional(),
  costRatePercentage: z.string().optional(),
  wastagePercentage: z.string().optional(),
  // Hallmark and certification fields
  isHallmarked: z.boolean().optional(),
  hallmarkNumber: z.string().optional(),
  huidNumber: z.string().optional(),
  certificationNumber: z.string().optional(),
  certificationAgency: z.string().optional(),
  certificationDate: z.string().optional(),
  // New label fields
  countryOfOrigin: z.string().optional(),
  // Image URLs
  imageUrls: z.string().optional(), // Comma-separated URLs
});

type ItemForm = z.infer<typeof itemSchema>;

interface BatchSummary {
  expectedItems: number;
  actualItems: number;
  itemsMatch: boolean;
  itemsRemaining: number;
  expectedWeight: number;
  actualWeight: number;
  weightDifference: number;
  weightMatch: boolean;
  canComplete: boolean;
}

export default function AddItemsPage() {
  const params = useParams();
  const batchId = params.batchId as string;
  const router = useRouter();
  const [batch, setBatch] = useState<any>(null);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('');
  const [batchGoldRate, setBatchGoldRate] = useState<number>(0);
  const [calculatedCost, setCalculatedCost] = useState<number>(0);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ItemForm>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      itemType: 'finished_goods',
      metalType: 'gold',
      purity: '22K',
      isHallmarked: false,
    },
  });

  const categoryId = watch('categoryId');
  const calculationMethod = watch('costCalculationMethod');
  const grossWeight = watch('grossWeight');
  const netWeight = watch('netWeight');
  const costRatePercentage = watch('costRatePercentage');
  const wastagePercentage = watch('wastagePercentage');
  const makingCharges = watch('makingCharges');

  // Fetch batch and summary
  const fetchBatchData = async () => {
    try {
      const [batchRes, summaryRes] = await Promise.all([
        apiClient.get(`/inventory/batches/${batchId}`),
        apiClient.get(`/inventory/batches/${batchId}/summary`),
      ]);

      if (batchRes.data.success) {
        const batchData = batchRes.data.data;
        setBatch(batchData);

        // Extract gold rate from batch (stored as per-gram, convert to sovereign for display)
        if (batchData.goldRatePerGram) {
          setBatchGoldRate(parseFloat(batchData.goldRatePerGram) * 8);
        }
      }

      if (summaryRes.data.success) {
        setSummary(summaryRes.data.data);
      }
    } catch (err) {
      setError('Failed to load batch data');
    }
  };

  useEffect(() => {
    fetchBatchData();
    fetchCategories();
  }, [batchId]);

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await apiClient.get('/inventory/categories');
      if (response.data.success) {
        setCategories(response.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  // Watch category changes to update dimension UI
  const [selectedCategory, setSelectedCategory] = useState<any>(null);

  useEffect(() => {
    if (categoryId && categories.length > 0) {
      const category = categories.find((c: any) => c.id === categoryId);
      if (category) {
        setSelectedCategory(category);
        setSelectedCategoryName(category.name.toLowerCase());
      }
    } else {
      setSelectedCategory(null);
      setSelectedCategoryName('');
    }
  }, [categoryId, categories]);

  // Render hierarchical category options for dropdown
  const renderCategoryOptions = (cats: any[], level: number = 0, parentId?: string | null): JSX.Element[] => {
    const filtered = cats.filter((cat: any) => {
      if (!parentId) {
        return !cat.parentId || cat.parentId === '';
      }
      return cat.parentId === parentId;
    });
    const result: JSX.Element[] = [];

    filtered.forEach((cat: any) => {
      const prefix = '  '.repeat(level) + (level > 0 ? '└─ ' : '');
      result.push(
        <option key={cat.id} value={cat.id}>
          {prefix}{cat.name}
        </option>
      );

      // Recursively add children
      const children = renderCategoryOptions(cats, level + 1, cat.id);
      result.push(...children);
    });

    return result;
  };

  // Cost calculation function
  const calculateItemCost = (
    method: 'rate_based' | 'making_charges',
    weight: number,
    costRate?: number,
    wastage?: number,
    making?: number
  ): number => {
    const goldRatePer8g = batchGoldRate; // Already in sovereign (8g) format

    if (method === 'rate_based') {
      if (!costRate) return 0;

      // Formula: Gold Value × (Cost Rate % / 100)
      // costRate is the percentage of gold value (e.g., 94 means 94% of gold value)
      const goldRatePerGram = goldRatePer8g / 8;
      const cost = goldRatePerGram * weight * (costRate / 100);
      return Math.round(cost * 100) / 100; // Round to 2 decimal places
    } else {
      // making_charges method
      const wastagePercent = wastage || 0;
      const makingChargesAmount = making || 0;

      // Formula: [((Gross Weight ÷ 8 × Wastage %) + Gross Weight) ÷ 8 × Gold Rate × (22÷24)] + Making Charges
      const wastageWeight = (weight / 8) * (wastagePercent / 100);
      const totalWeight = wastageWeight + weight;
      const goldCost = (totalWeight / 8) * goldRatePer8g * (22 / 24);
      const totalCost = goldCost + makingChargesAmount;

      return Math.round(totalCost * 100) / 100;
    }
  };

  // Real-time cost calculation - uses netWeight (gold weight only, excluding stones)
  useEffect(() => {
    if (netWeight && batchGoldRate > 0 && calculationMethod) {
      const cost = calculateItemCost(
        calculationMethod,
        parseFloat(netWeight),
        costRatePercentage ? parseFloat(costRatePercentage) : undefined,
        wastagePercentage ? parseFloat(wastagePercentage) : undefined,
        makingCharges ? parseFloat(makingCharges) : undefined
      );
      setCalculatedCost(cost);
    } else {
      setCalculatedCost(0);
    }
  }, [calculationMethod, netWeight, costRatePercentage, wastagePercentage, makingCharges, batchGoldRate]);

  const onSubmit = async (data: ItemForm) => {
    setIsLoading(true);
    setError(null);

    try {
      // Process dimensions - convert string values to numbers where applicable
      const dimensions = data.dimensions ? {
        length: data.dimensions.length ? parseFloat(data.dimensions.length) : undefined,
        lengthUnit: data.dimensions.length ? 'inches' : undefined,
        width: data.dimensions.width ? parseFloat(data.dimensions.width) : undefined,
        widthUnit: data.dimensions.width ? 'mm' : undefined,
        height: data.dimensions.height ? parseFloat(data.dimensions.height) : undefined,
        internalSize: data.dimensions.internalSize ? parseFloat(data.dimensions.internalSize) : undefined,
        ringSize: data.dimensions.ringSize ? parseFloat(data.dimensions.ringSize) : undefined,
      } : undefined;

      // Process image URLs - convert comma-separated string to array
      const imageUrls = data.imageUrls
        ? data.imageUrls.split(',').map((url) => url.trim()).filter((url) => url.length > 0)
        : undefined;

      const response = await apiClient.post(`/inventory/batches/${batchId}/items`, {
        batchId: batchId,
        ...data,
        grossWeight: parseFloat(data.grossWeight),
        netWeight: parseFloat(data.netWeight),
        stoneWeight: data.stoneWeight ? parseFloat(data.stoneWeight) : 0,
        makingCharges: data.makingCharges ? parseFloat(data.makingCharges) : undefined,
        dimensions,
        // Cost calculation fields
        costRatePercentage: data.costRatePercentage ? parseFloat(data.costRatePercentage) : undefined,
        wastagePercentage: data.wastagePercentage ? parseFloat(data.wastagePercentage) : undefined,
        calculatedCost: calculatedCost,
        costCalculationMethod: data.costCalculationMethod,
        // Hallmark and certification fields
        isHallmarked: data.isHallmarked || false,
        hallmarkNumber: data.hallmarkNumber,
        huidNumber: data.huidNumber,
        certificationNumber: data.certificationNumber,
        certificationAgency: data.certificationAgency,
        certificationDate: data.certificationDate ? new Date(data.certificationDate).toISOString() : undefined,
        // Image URLs
        imageUrls,
      });

      if (response.data.success) {
        // Refresh batch data
        await fetchBatchData();

        // Reset form for next item
        reset({
          name: '',
          itemType: data.itemType,
          categoryId: data.categoryId,
          metalType: data.metalType,
          purity: data.purity,
          grossWeight: '',
          netWeight: '',
          stoneWeight: '',
          makingCharges: '',
          location: data.location,
          dimensions: {
            length: '',
            width: '',
            height: '',
            internalSize: '',
            ringSize: '',
          },
          costCalculationMethod: undefined,
          costRatePercentage: '',
          wastagePercentage: '',
        });
      }
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Failed to add item';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleComplete = async () => {
    if (!summary) return;

    try {
      const response = await apiClient.post(`/inventory/batches/${batchId}/complete`, {
        acceptDiscrepancy: !summary.canComplete,
        discrepancyReason: !summary.canComplete ? 'User accepted discrepancy' : undefined,
      });

      if (response.data.success) {
        setShowSuccessModal(true);
      }
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Failed to complete batch';
      setError(message);
    }
  };

  const handlePrintLabels = () => {
    router.push(`/inventory/batches/${batchId}/labels`);
  };

  const handleClose = () => {
    router.push('/inventory/batches');
  };

  if (!batch || !summary) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-600">Loading batch...</p>
      </div>
    );
  }

  const itemsProgress = (summary.actualItems / summary.expectedItems) * 100;
  const weightProgress = (summary.actualWeight / summary.expectedWeight) * 100;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Batch {batch.batchNumber}
          </h1>
          <p className="text-gray-600 mt-1">Add items to this batch</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/inventory/batches')}>
            Save Draft
          </Button>
          <Button
            onClick={() => router.push(`/inventory/batches/${batchId}/review`)}
            disabled={summary.actualItems === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Review Batch →
          </Button>
        </div>
      </div>

      {/* Progress Card */}
      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Items Progress */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">
                Items: {summary.actualItems}/{summary.expectedItems}
              </span>
              <span className="text-sm text-gray-600">{Math.round(itemsProgress)}%</span>
            </div>
            <Progress value={itemsProgress} className="h-3" />
            {summary.itemsMatch && (
              <p className="text-sm text-green-600 mt-1">✓ Item count matches</p>
            )}
          </div>

          {/* Weight Progress */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">
                Weight: {summary.actualWeight.toFixed(3)}g / {summary.expectedWeight.toFixed(3)}g
              </span>
              <span className="text-sm text-gray-600">{Math.round(weightProgress)}%</span>
            </div>
            <Progress value={weightProgress} className="h-3" />
            {summary.weightMatch ? (
              <p className="text-sm text-green-600 mt-1">✓ Weight matches (±0.1g tolerance)</p>
            ) : (
              <p className="text-sm text-orange-600 mt-1">
                ⚠ Difference: {summary.weightDifference > 0 ? '+' : ''}
                {summary.weightDifference.toFixed(3)}g
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Item Form */}
      {summary.actualItems < summary.expectedItems ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Add Item #{summary.actualItems + 1} of {summary.expectedItems}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Item Name */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="name">Item Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Gold Ring with Diamonds"
                    {...register('name')}
                    disabled={isLoading}
                  />
                  {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
                </div>

                {/* Item Type */}
                <div className="space-y-2">
                  <Label htmlFor="itemType">Item Type *</Label>
                  <select
                    id="itemType"
                    {...register('itemType')}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    disabled={isLoading}
                  >
                    <option value="finished_goods">Finished Goods</option>
                    <option value="raw_material">Raw Material</option>
                    <option value="semi_finished">Semi-Finished</option>
                  </select>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="categoryId">Category</Label>
                  <CategorySelector
                    categories={categories}
                    value={categoryId}
                    onChange={(value) => {
                      setValue('categoryId', value, { shouldValidate: true });
                    }}
                    placeholder="Select Category (Optional)"
                  />
                  {categoryId === 'OTHER' && (
                    <p className="text-xs text-blue-600 mt-1">
                      💡 Create new categories in <a href="/inventory/categories" className="underline">Category Management</a>
                    </p>
                  )}
                </div>

                {/* Metal Type */}
                <div className="space-y-2">
                  <Label htmlFor="metalType">Metal Type</Label>
                  <select
                    id="metalType"
                    {...register('metalType')}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    disabled={isLoading}
                  >
                    <option value="gold">Gold</option>
                    <option value="silver">Silver</option>
                    <option value="platinum">Platinum</option>
                    <option value="diamond">Diamond</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Purity */}
                <div className="space-y-2">
                  <Label htmlFor="purity">Purity</Label>
                  <Input
                    id="purity"
                    placeholder="e.g., 22K, 18K, 916"
                    {...register('purity')}
                    disabled={isLoading}
                  />
                </div>

                {/* Country of Origin */}
                <div className="space-y-2">
                  <Label htmlFor="countryOfOrigin">Country of Origin</Label>
                  <Input
                    id="countryOfOrigin"
                    placeholder="e.g., Sri Lanka, India"
                    {...register('countryOfOrigin')}
                    disabled={isLoading}
                  />
                </div>

                {/* Gross Weight */}
                <div className="space-y-2">
                  <Label htmlFor="grossWeight">Gross Weight (g) *</Label>
                  <Input
                    id="grossWeight"
                    type="number"
                    step="0.001"
                    placeholder="e.g., 5.250"
                    {...register('grossWeight')}
                    disabled={isLoading}
                  />
                  {errors.grossWeight && (
                    <p className="text-sm text-red-600">{errors.grossWeight.message}</p>
                  )}
                </div>

                {/* Net Weight */}
                <div className="space-y-2">
                  <Label htmlFor="netWeight">Net Weight (g) *</Label>
                  <Input
                    id="netWeight"
                    type="number"
                    step="0.001"
                    placeholder="e.g., 4.800"
                    {...register('netWeight')}
                    disabled={isLoading}
                  />
                  {errors.netWeight && (
                    <p className="text-sm text-red-600">{errors.netWeight.message}</p>
                  )}
                </div>

                {/* Stone Weight */}
                <div className="space-y-2">
                  <Label htmlFor="stoneWeight">Stone Weight (g)</Label>
                  <Input
                    id="stoneWeight"
                    type="number"
                    step="0.001"
                    placeholder="e.g., 0.450"
                    {...register('stoneWeight')}
                    disabled={isLoading}
                  />
                </div>

                {/* Making Charges */}
                <div className="space-y-2">
                  <Label htmlFor="makingCharges">Making Charges</Label>
                  <Input
                    id="makingCharges"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 500.00"
                    {...register('makingCharges')}
                    disabled={isLoading}
                  />
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <Label htmlFor="location">Storage Location</Label>
                  <Input
                    id="location"
                    placeholder="e.g., Showcase 1, Vault"
                    {...register('location')}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Dimension Fields - Category Specific */}
              {selectedCategory && (selectedCategory.requiresLength || selectedCategory.requiresWidth ||
                selectedCategory.requiresHeight || selectedCategory.requiresInternalSize ||
                selectedCategory.requiresRingSize) && (
                  <div className="space-y-3 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <h4 className="text-sm font-semibold text-blue-900">
                      Product Dimensions
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Length Field */}
                      {selectedCategory.requiresLength && (
                        <div className="space-y-2">
                          <Label htmlFor="dimensions.length">Length (inches)</Label>
                          <Input
                            id="dimensions.length"
                            type="number"
                            step="0.5"
                            placeholder="e.g., 18"
                            {...register('dimensions.length')}
                            disabled={isLoading}
                          />
                        </div>
                      )}

                      {/* Width Field */}
                      {selectedCategory.requiresWidth && (
                        <div className="space-y-2">
                          <Label htmlFor="dimensions.width">Width (mm)</Label>
                          <Input
                            id="dimensions.width"
                            type="number"
                            step="0.1"
                            placeholder="e.g., 2.5"
                            {...register('dimensions.width')}
                            disabled={isLoading}
                          />
                        </div>
                      )}

                      {/* Height Field */}
                      {selectedCategory.requiresHeight && (
                        <div className="space-y-2">
                          <Label htmlFor="dimensions.height">Height (mm)</Label>
                          <Input
                            id="dimensions.height"
                            type="number"
                            step="0.1"
                            placeholder="e.g., 5"
                            {...register('dimensions.height')}
                            disabled={isLoading}
                          />
                        </div>
                      )}

                      {/* Internal Size Field */}
                      {selectedCategory.requiresInternalSize && (
                        <div className="space-y-2">
                          <Label htmlFor="dimensions.internalSize">Internal Size (mm)</Label>
                          <Input
                            id="dimensions.internalSize"
                            type="number"
                            step="0.1"
                            placeholder="e.g., 60"
                            {...register('dimensions.internalSize')}
                            disabled={isLoading}
                          />
                        </div>
                      )}

                      {/* Ring Size Field */}
                      {selectedCategory.requiresRingSize && (
                        <div className="space-y-2">
                          <Label htmlFor="dimensions.ringSize">Ring Size (US)</Label>
                          <Input
                            id="dimensions.ringSize"
                            type="number"
                            step="0.5"
                            placeholder="e.g., 7.5"
                            {...register('dimensions.ringSize')}
                            disabled={isLoading}
                          />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-blue-700 mt-2">
                      * Dimension fields configured for this category
                    </p>
                  </div>
                )}

              {/* Cost Calculation Section */}
              <div className="space-y-4 mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                <h4 className="text-sm font-semibold text-green-900">
                  Cost Calculation
                </h4>

                {/* Display Batch Gold Rate */}
                <div className="text-sm bg-white p-3 rounded border">
                  <span className="text-gray-600">Batch Gold Rate:</span>{' '}
                  <span className="font-bold text-lg">
                    Rs {batchGoldRate.toLocaleString('en-LK')}/8g (Sovereign)
                  </span>
                </div>

                {/* Calculation Method Selector */}
                <div className="space-y-2">
                  <Label htmlFor="costCalculationMethod">Calculation Method</Label>
                  <select
                    id="costCalculationMethod"
                    {...register('costCalculationMethod')}
                    className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm"
                    disabled={isLoading}
                  >
                    <option value="">Select Method (Optional)</option>
                    <option value="rate_based">Rate-Based (Cost Rate %)</option>
                    <option value="making_charges">Making Charges + Wastage</option>
                  </select>
                </div>

                {/* Rate-Based Fields */}
                {calculationMethod === 'rate_based' && (
                  <div className="space-y-2">
                    <Label htmlFor="costRatePercentage">Cost Rate Percentage (%)</Label>
                    <Input
                      id="costRatePercentage"
                      type="number"
                      step="0.01"
                      placeholder="e.g., 94 or 105"
                      {...register('costRatePercentage')}
                      disabled={isLoading}
                    />
                    <p className="text-xs text-green-700">
                      Formula: (Gold Rate × Rate% ÷ 8) × Gross Weight
                    </p>
                  </div>
                )}

                {/* Making Charges Method Fields */}
                {calculationMethod === 'making_charges' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="wastagePercentage">Wastage Percentage (%)</Label>
                      <Input
                        id="wastagePercentage"
                        type="number"
                        step="0.01"
                        placeholder="e.g., 5"
                        {...register('wastagePercentage')}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="makingCharges">Making Charges (Rs)</Label>
                      <Input
                        id="makingCharges"
                        type="number"
                        step="0.01"
                        placeholder="e.g., 5000"
                        {...register('makingCharges')}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-green-700">
                        Formula: [((Weight ÷ 8 × Wastage%) + Weight) ÷ 8 × Rate × (22÷24)] + Making Charges
                      </p>
                    </div>
                  </div>
                )}

                {/* Calculated Cost Display */}
                {calculatedCost > 0 && (
                  <div className="p-4 bg-white border-2 border-green-600 rounded-md">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Calculated Item Cost:</span>
                      <span className="text-2xl font-bold text-green-700">
                        Rs {calculatedCost.toLocaleString('en-LK')}
                      </span>
                    </div>
                    {calculationMethod === 'rate_based' && costRatePercentage && (
                      <p className="text-xs text-gray-600 mt-2">
                        Gold Value + {costRatePercentage}% markup = ({batchGoldRate.toLocaleString('en-LK')} ÷ 8) × {netWeight}g × 1.{costRatePercentage.replace('.', '')} = Rs {calculatedCost.toLocaleString('en-LK')}
                      </p>
                    )}
                    <p className="text-xs text-amber-600 mt-1">
                      Note: Cost is calculated using Net Weight (gold only). Stone value will be added when stones are specified.
                    </p>
                  </div>
                )}
              </div>

              {/* Hallmark & Certification Section */}
              <div className="space-y-4 mt-4 p-4 bg-purple-50 border border-purple-200 rounded-md">
                <h4 className="text-sm font-semibold text-purple-900">
                  Hallmark & Certification (Optional)
                </h4>

                {/* Hallmarked Checkbox */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isHallmarked"
                    {...register('isHallmarked')}
                    className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    disabled={isLoading}
                  />
                  <Label htmlFor="isHallmarked" className="mb-0 cursor-pointer">
                    This item is hallmarked
                  </Label>
                </div>

                {/* Hallmark Details (shown when checked) */}
                {watch('isHallmarked') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div className="space-y-2">
                      <Label htmlFor="hallmarkNumber">Hallmark Number</Label>
                      <Input
                        id="hallmarkNumber"
                        placeholder="e.g., HM123456"
                        {...register('hallmarkNumber')}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="huidNumber">HUID Number</Label>
                      <Input
                        id="huidNumber"
                        placeholder="e.g., HUID987654"
                        {...register('huidNumber')}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                )}

                {/* Certification Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="certificationNumber">Certification Number</Label>
                    <Input
                      id="certificationNumber"
                      placeholder="e.g., CERT12345"
                      {...register('certificationNumber')}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="certificationAgency">Certification Agency</Label>
                    <Input
                      id="certificationAgency"
                      placeholder="e.g., GIA, IGI, BIS"
                      {...register('certificationAgency')}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="certificationDate">Certification Date</Label>
                  <Input
                    id="certificationDate"
                    type="date"
                    {...register('certificationDate')}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Image URLs Section */}
              <div className="space-y-4 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-md">
                <h4 className="text-sm font-semibold text-amber-900">
                  Product Images (Optional)
                </h4>
                <div className="space-y-2">
                  <ImageUpload
                    value={watch('imageUrls') ? watch('imageUrls')?.split(',').filter(Boolean) : []}
                    onChange={(urls) => {
                      setValue('imageUrls', urls.join(','), { shouldValidate: true });
                    }}
                    maxFiles={5}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? 'Adding...' : 'Save & Add Next →'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-6 bg-green-50 border-green-200">
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              All {summary.expectedItems} items have been added!
            </h3>
            <p className="text-green-700 text-sm mb-4">
              Review the items below and complete the batch when ready.
            </p>
            {summary.weightMatch ? (
              <p className="text-green-600 text-sm font-medium">
                ✓ Total weight matches expected weight
              </p>
            ) : (
              <p className="text-orange-600 text-sm font-medium">
                ⚠ Weight difference: {summary.weightDifference > 0 ? '+' : ''}
                {summary.weightDifference.toFixed(3)}g - Please verify before completing
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Entered Items List */}
      {batch.batchItems && batch.batchItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Entered Items ({batch.batchItems.length}/{summary.expectedItems})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {batch.batchItems.map((batchItem: any, index: number) => (
                <div
                  key={batchItem.id}
                  className="flex justify-between items-start p-4 bg-gray-50 rounded-lg border hover:bg-gray-100 transition"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-semibold text-sm">
                        {index + 1}
                      </span>
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {batchItem.inventoryItem.name}
                        </h4>
                        <p className="text-xs text-gray-500 font-mono">
                          SKU: {batchItem.inventoryItem.sku}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm ml-11">
                      <div>
                        <span className="text-gray-600">Type:</span>{' '}
                        <span className="font-medium capitalize">
                          {batchItem.inventoryItem.itemType?.replace('_', ' ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Metal:</span>{' '}
                        <span className="font-medium capitalize">
                          {batchItem.inventoryItem.metalType || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Purity:</span>{' '}
                        <span className="font-medium">
                          {batchItem.inventoryItem.purity || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Gross Wt:</span>{' '}
                        <span className="font-medium">
                          {parseFloat(batchItem.inventoryItem.grossWeight).toFixed(3)}g
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Net Wt:</span>{' '}
                        <span className="font-medium">
                          {parseFloat(batchItem.inventoryItem.netWeight).toFixed(3)}g
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Stone Wt:</span>{' '}
                        <span className="font-medium">
                          {parseFloat(batchItem.inventoryItem.stoneWeight || '0').toFixed(3)}g
                        </span>
                      </div>
                      {batchItem.inventoryItem.location && (
                        <div>
                          <span className="text-gray-600">Location:</span>{' '}
                          <span className="font-medium">
                            {batchItem.inventoryItem.location}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary Row */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-gray-700">Total Gross Weight:</span>
                <span className="font-bold text-lg">
                  {summary.actualWeight.toFixed(3)}g
                </span>
              </div>
              <div className="flex justify-between items-center text-sm mt-1">
                <span className="text-gray-600">Expected Gross Weight:</span>
                <span className="font-medium">
                  {summary.expectedWeight.toFixed(3)}g
                </span>
              </div>
              {!summary.weightMatch && (
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-orange-600 font-medium">Weight Difference:</span>
                  <span className="font-medium text-orange-600">
                    {summary.weightDifference > 0 ? '+' : ''}
                    {summary.weightDifference.toFixed(3)}g
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold mb-4 text-center">Batch Completed!</h3>
            <p className="text-gray-600 mb-6 text-center">
              The batch has been successfully finalized. Would you like to generate and print labels for these items now?
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={handleClose}>
                Go to List
              </Button>
              <Button onClick={handlePrintLabels} className="bg-blue-600 hover:bg-blue-700">
                Print Labels
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
