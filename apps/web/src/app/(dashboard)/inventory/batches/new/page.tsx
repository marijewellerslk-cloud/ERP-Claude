'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';

const createBatchSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  purchaseDate: z.string(),
  purchaseType: z.enum(['monetary', 'gold_exchange']),
  expectedTotalItems: z.string().min(1),
  expectedTotalWeight: z.string().min(1),
  // Monetary purchase fields
  totalCost: z.string().optional(),
  goldRatePerGram: z.string().optional(),
  initialPaymentAmount: z.string().optional(),
  paymentMethod: z.string().optional(),
  transactionReference: z.string().optional(),
  creditDays: z.string().optional(),
  // Gold exchange fields
  goldGivenWeight: z.string().optional(),
  goldGivenPurity: z.string().optional(),
  goldGivenValue: z.string().optional(),
  goldBalancePaid: z.string().optional(),
  goldBalanceReceived: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.purchaseType === 'monetary') {
    return data.totalCost && data.goldRatePerGram;
  }
  if (data.purchaseType === 'gold_exchange') {
    return data.goldGivenWeight && parseFloat(data.goldGivenWeight) > 0;
  }
  return true;
}, {
  message: 'Missing required fields for selected purchase type',
  path: ['purchaseType'],
});

type CreateBatchForm = z.infer<typeof createBatchSchema>;

interface Supplier {
  id: string;
  supplierCode: string;
  businessName: string;
  phone: string;
  defaultCreditDays: number;
}

export default function NewBatchPage() {
  const router = useRouter();
  const { user, store: currentStore } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [allStores, setAllStores] = useState<{ id: string; name: string; code: string }[]>([]);
  const [targetStoreId, setTargetStoreId] = useState<string>('');

  // Check if user is admin/owner
  const isAdmin = user?.permissions?.includes('*:*') ||
    ['super_admin', 'superadmin', 'owner'].includes(user?.role || '');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<CreateBatchForm>({
    resolver: zodResolver(createBatchSchema),
    defaultValues: {
      purchaseDate: new Date().toISOString().split('T')[0],
      purchaseType: 'monetary',
      initialPaymentAmount: '0',
      creditDays: '0',
      goldGivenWeight: '0',
      goldGivenPurity: '22',
      goldGivenValue: '0',
      goldBalancePaid: '0',
      goldBalanceReceived: '0',
    },
  });

  // Watch values for real-time calculations
  const purchaseType = watch('purchaseType');
  const totalCost = parseFloat(watch('totalCost') || '0');
  const initialPayment = parseFloat(watch('initialPaymentAmount') || '0');
  const outstandingBalance = totalCost - initialPayment;
  const goldGivenWeight = parseFloat(watch('goldGivenWeight') || '0');
  const goldReceivedWeight = parseFloat(watch('expectedTotalWeight') || '0');
  const goldNetBalance = goldGivenWeight - goldReceivedWeight;

  // Fetch suppliers and stores on mount
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await apiClient.get('/suppliers', {
          params: { limit: 1000, isActive: 'true' },
        });
        if (response.data.success) {
          setSuppliers(response.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch suppliers:', err);
      } finally {
        setLoadingSuppliers(false);
      }
    };
    const fetchStores = async () => {
      try {
        const response = await apiClient.get('/stores', {
          params: { isActive: 'true' },
        });
        if (response.data.success) {
          setAllStores(response.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch stores:', err);
      }
    };
    fetchSuppliers();
    if (isAdmin) {
      fetchStores();
    }
    // Set default target store to user's current store
    if (currentStore?.id) {
      setTargetStoreId(currentStore.id);
    }
  }, []);

  // When supplier is selected, auto-fill credit days
  const handleSupplierChange = (supplierId: string) => {
    setValue('supplierId', supplierId);
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (supplier) {
      setSelectedSupplier(supplier);
      setValue('creditDays', supplier.defaultCreditDays.toString());
    }
  };

  const onSubmit = async (data: CreateBatchForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const basePayload: any = {
        supplierId: data.supplierId,
        purchaseDate: new Date(data.purchaseDate).toISOString(),
        purchaseType: data.purchaseType,
        expectedTotalItems: parseInt(data.expectedTotalItems),
        expectedTotalWeight: parseFloat(data.expectedTotalWeight),
        notes: data.notes,
      };

      // Include target store for admin/owner
      if (isAdmin && targetStoreId && targetStoreId !== currentStore?.id) {
        basePayload.targetStoreId = targetStoreId;
      }

      let payload: any = basePayload;

      if (data.purchaseType === 'monetary') {
        const paymentAmount = parseFloat(data.initialPaymentAmount || '0');
        // Sri Lanka uses sovereign (8g) standard
        // UI shows sovereign price but stores per-gram (sovereign ÷ 8)
        const sovereignRate = parseFloat(data.goldRatePerGram || '0');
        const perGramRate = sovereignRate / 8;

        payload = {
          ...basePayload,
          totalCost: parseFloat(data.totalCost || '0'),
          goldRatePerGram: perGramRate,  // Store per-gram rate
          initialPaymentAmount: paymentAmount,
          paymentMethod: paymentAmount > 0 ? data.paymentMethod : undefined,
          transactionReference: data.transactionReference || undefined,
          creditDays: parseInt(data.creditDays || '0'),
        };
      } else if (data.purchaseType === 'gold_exchange') {
        payload = {
          ...basePayload,
          goldGivenWeight: parseFloat(data.goldGivenWeight || '0'),
          goldGivenPurity: parseFloat(data.goldGivenPurity || '22'),
          goldGivenValue: parseFloat(data.goldGivenValue || '0'),
          goldBalancePaid: parseFloat(data.goldBalancePaid || '0'),
          goldBalanceReceived: parseFloat(data.goldBalanceReceived || '0'),
        };
      }

      const response = await apiClient.post('/inventory/batches', payload);

      if (response.data.success) {
        const batchId = response.data.data.id;
        router.push(`/inventory/batches/${batchId}/add-items`);
      }
    } catch (err: any) {
      const message =
        err.response?.data?.error?.message || 'Failed to create batch. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Create New Purchase Batch</h1>
        <p className="text-gray-600 mt-2">
          Record supplier purchase details and create batch for item-by-item entry
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Branch Allocation */}
        <Card>
          <CardHeader>
            <CardTitle>Branch / Store Allocation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="targetStore">
                Target Branch <span className="text-red-500">*</span>
              </Label>
              {isAdmin ? (
                <Select
                  onValueChange={(value) => setTargetStoreId(value)}
                  value={targetStoreId}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {allStores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 rounded-md border">
                  <span className="text-sm font-medium text-gray-700">
                    {currentStore?.name || 'Your Store'} ({currentStore?.code})
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Auto-assigned</span>
                </div>
              )}
              <p className="text-xs text-gray-500">
                {isAdmin
                  ? 'As admin, you can allocate this batch to any branch.'
                  : 'Items in this batch will be allocated to your assigned branch.'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Supplier Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Supplier Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplierId">
                Supplier <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Select
                  onValueChange={handleSupplierChange}
                  disabled={isLoading || loadingSuppliers}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={loadingSuppliers ? 'Loading...' : 'Select supplier'} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.supplierCode} - {supplier.businessName} ({supplier.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Link href="/suppliers/new" target="_blank">
                  <Button type="button" variant="outline" size="sm">
                    + Add New
                  </Button>
                </Link>
              </div>
              {errors.supplierId && (
                <p className="text-sm text-red-600">{errors.supplierId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseDate">
                Purchase Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="purchaseDate"
                type="date"
                {...register('purchaseDate')}
                disabled={isLoading}
              />
              {errors.purchaseDate && (
                <p className="text-sm text-red-600">{errors.purchaseDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseType">
                Purchase Type <span className="text-red-500">*</span>
              </Label>
              <Select
                onValueChange={(value) => setValue('purchaseType', value as 'monetary' | 'gold_exchange')}
                defaultValue="monetary"
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monetary">Monetary Purchase (Cash/Bank)</SelectItem>
                  <SelectItem value="gold_exchange">Gold-to-Gold Exchange</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {purchaseType === 'monetary'
                  ? 'Regular purchase paid in money'
                  : 'Trading gold with supplier (no monetary transaction)'}
              </p>
              {errors.purchaseType && (
                <p className="text-sm text-red-600">{errors.purchaseType.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Batch Details */}
        <Card>
          <CardHeader>
            <CardTitle>Batch Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expectedTotalItems">
                  Expected Items <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="expectedTotalItems"
                  type="number"
                  placeholder="e.g., 15"
                  {...register('expectedTotalItems')}
                  disabled={isLoading}
                />
                {errors.expectedTotalItems && (
                  <p className="text-sm text-red-600">{errors.expectedTotalItems.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expectedTotalWeight">
                  Expected Weight (grams) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="expectedTotalWeight"
                  type="number"
                  step="0.001"
                  placeholder="e.g., 80.5"
                  {...register('expectedTotalWeight')}
                  disabled={isLoading}
                />
                {errors.expectedTotalWeight && (
                  <p className="text-sm text-red-600">{errors.expectedTotalWeight.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Details - Monetary Purchase */}
        {purchaseType === 'monetary' && (
          <Card>
            <CardHeader>
              <CardTitle>Purchase Financial Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="totalCost">
                    Total Purchase Cost (Rs) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="totalCost"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 450000"
                    {...register('totalCost')}
                    disabled={isLoading}
                  />
                  {errors.totalCost && (
                    <p className="text-sm text-red-600">{errors.totalCost.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goldRatePerGram">
                    Gold Rate (Rs/8g Sovereign) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="goldRatePerGram"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 52000"
                    {...register('goldRatePerGram')}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500">
                    Enter gold rate per sovereign (8 grams). System will automatically convert to per gram for storage.
                  </p>
                  {errors.goldRatePerGram && (
                    <p className="text-sm text-red-600">{errors.goldRatePerGram.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Gold Exchange Details */}
        {purchaseType === 'gold_exchange' && (
          <Card>
            <CardHeader>
              <CardTitle>Gold Exchange Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4">
                <h4 className="font-semibold text-amber-900 mb-2">Gold-to-Gold Exchange</h4>
                <p className="text-sm text-amber-700">
                  Recording a gold exchange where you give gold TO the supplier and receive gold FROM them.
                  Balance is tracked separately in the Gold Exchange Ledger.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="goldGivenWeight">
                    Gold Given to Supplier (grams) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="goldGivenWeight"
                    type="number"
                    step="0.001"
                    placeholder="e.g., 50.000"
                    {...register('goldGivenWeight')}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500">
                    Weight of gold you are giving TO the supplier
                  </p>
                  {errors.goldGivenWeight && (
                    <p className="text-sm text-red-600">{errors.goldGivenWeight.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goldGivenPurity">
                    Purity of Gold Given (karats)
                  </Label>
                  <Select
                    onValueChange={(value) => setValue('goldGivenPurity', value)}
                    defaultValue="22"
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24">24K (99.9%)</SelectItem>
                      <SelectItem value="22">22K (91.6%)</SelectItem>
                      <SelectItem value="18">18K (75.0%)</SelectItem>
                      <SelectItem value="14">14K (58.5%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="goldGivenValue">
                    Estimated Value of Gold Given (Rs)
                  </Label>
                  <Input
                    id="goldGivenValue"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    {...register('goldGivenValue')}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500">
                    Optional: For reference only
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expectedTotalWeight">
                    Gold Received from Supplier (grams) <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-sm font-medium text-gray-700 mt-2">
                    {goldReceivedWeight > 0 ? `${goldReceivedWeight.toFixed(3)}g` : 'Enter expected weight above'}
                  </p>
                  <p className="text-xs text-gray-500">
                    This is the Expected Weight field from Batch Details
                  </p>
                </div>
              </div>

              {/* Cash Balance Section */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium text-gray-900 mb-3">Cash Balance (Optional)</h4>
                <p className="text-sm text-gray-600 mb-4">
                  If there's a cash difference to settle the exchange
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="goldBalancePaid">
                      Cash Paid by You (Rs)
                    </Label>
                    <Input
                      id="goldBalancePaid"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      {...register('goldBalancePaid')}
                      disabled={isLoading}
                    />
                    <p className="text-xs text-gray-500">
                      Additional cash you paid to supplier
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="goldBalanceReceived">
                      Cash Received from Supplier (Rs)
                    </Label>
                    <Input
                      id="goldBalanceReceived"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      {...register('goldBalanceReceived')}
                      disabled={isLoading}
                    />
                    <p className="text-xs text-gray-500">
                      Cash supplier paid to you
                    </p>
                  </div>
                </div>
              </div>

              {/* Gold Exchange Summary */}
              <div className="bg-purple-50 border border-purple-200 rounded-md p-4 space-y-2">
                <h4 className="font-semibold text-purple-900">Gold Exchange Summary</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-purple-700">Gold Given</p>
                    <p className="font-bold text-purple-900">{goldGivenWeight.toFixed(3)}g</p>
                  </div>
                  <div>
                    <p className="text-purple-700">Gold Receiving</p>
                    <p className="font-bold text-purple-900">{goldReceivedWeight.toFixed(3)}g</p>
                  </div>
                  <div>
                    <p className="text-purple-700">Net Balance</p>
                    <p className={`font-bold ${goldNetBalance > 0 ? 'text-red-600' : goldNetBalance < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                      {goldNetBalance > 0 ? `+${goldNetBalance.toFixed(3)}g` : goldNetBalance < 0 ? `${goldNetBalance.toFixed(3)}g` : '0.000g'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-purple-700 mt-2">
                  {goldNetBalance > 0
                    ? `Supplier owes you ${goldNetBalance.toFixed(3)}g of gold`
                    : goldNetBalance < 0
                      ? `You owe supplier ${Math.abs(goldNetBalance).toFixed(3)}g of gold`
                      : 'Exchange is balanced'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Information - Only for Monetary Purchases */}
        {purchaseType === 'monetary' && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="initialPaymentAmount">Initial Payment Amount (Rs)</Label>
                <Input
                  id="initialPaymentAmount"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  {...register('initialPaymentAmount')}
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500">
                  Leave as 0 if paying later. Enter full amount to mark as paid.
                </p>
              </div>

              {initialPayment > 0 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                    <Select
                      onValueChange={(value) => setValue('paymentMethod', value)}
                      disabled={isLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="transactionReference">Transaction Reference</Label>
                    <Input
                      id="transactionReference"
                      type="text"
                      placeholder="Cheque number, UTR, etc."
                      {...register('transactionReference')}
                      disabled={isLoading}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="creditDays">Credit Period (days)</Label>
                <Input
                  id="creditDays"
                  type="number"
                  placeholder="0"
                  {...register('creditDays')}
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500">
                  {selectedSupplier
                    ? `Default for this supplier: ${selectedSupplier.defaultCreditDays} days`
                    : 'Number of days until payment is due'}
                </p>
              </div>

              {/* Real-time Payment Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 space-y-2">
                <h4 className="font-semibold text-blue-900">Payment Summary</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-blue-700">Total Cost</p>
                    <p className="font-bold text-blue-900">Rs {totalCost.toLocaleString('en-LK')}</p>
                  </div>
                  <div>
                    <p className="text-blue-700">Paying Now</p>
                    <p className="font-bold text-green-700">Rs {initialPayment.toLocaleString('en-LK')}</p>
                  </div>
                  <div>
                    <p className="text-blue-700">Outstanding</p>
                    <p className={`font-bold ${outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      Rs {outstandingBalance.toLocaleString('en-LK')}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  Status:{' '}
                  <span className="font-semibold">
                    {initialPayment >= totalCost ? 'Fully Paid' : initialPayment > 0 ? 'Partial Payment' : 'Pending Payment'}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes - Available for both purchase types */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                type="text"
                placeholder="Any additional notes about this purchase"
                {...register('notes')}
                disabled={isLoading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="flex-1">
            {isLoading ? 'Creating...' : 'Create Batch & Add Items'}
          </Button>
        </div>
      </form>
    </div>
  );
}
