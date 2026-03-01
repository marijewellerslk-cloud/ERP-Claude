'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Search,
  User,
  Phone,
  Hash,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Scale,
  Coins,
  FileText,
  ArrowLeft,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Customer {
  id: string;
  name: string;
  phone: string;
  customerCode: string;
  email?: string;
}

interface PledgedGoldItem {
  itemDescription: string;
  grossWeight: number | '';
  netWeight: number | '';
  purity: '24K' | '22K' | '18K' | '14K';
  goldValue: number | '';
  appraisalValue: number | '';
}

interface LtvValidation {
  ltvPercent: number;
  maxLtv: number;
  maxLoanAmount: number;
  isValid: boolean;
  message: string;
}

const STEPS = [
  { label: 'Customer', icon: User },
  { label: 'Gold Items', icon: Coins },
  { label: 'Loan Details', icon: Scale },
  { label: 'Review', icon: FileText },
];

const EMPTY_GOLD_ITEM: PledgedGoldItem = {
  itemDescription: '',
  grossWeight: '',
  netWeight: '',
  purity: '22K',
  goldValue: '',
  appraisalValue: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewLoanApplicationPage() {
  const router = useRouter();

  // Step management
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1 - Customer
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Step 2 - Gold Items
  const [goldItems, setGoldItems] = useState<PledgedGoldItem[]>([{ ...EMPTY_GOLD_ITEM }]);

  // Step 3 - Loan Details
  const [loanAmount, setLoanAmount] = useState<number | ''>('');
  const [interestRate, setInterestRate] = useState<number | ''>('');
  const [tenure, setTenure] = useState<number>(12);
  const [loanType, setLoanType] = useState<'Bullet' | 'EMI'>('Bullet');
  const [ltvValidation, setLtvValidation] = useState<LtvValidation | null>(null);
  const [ltvLoading, setLtvLoading] = useState(false);
  const [interestRateLoading, setInterestRateLoading] = useState(false);
  const ltvTimeout = useRef<NodeJS.Timeout | null>(null);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const totalItems = goldItems.length;

  const totalNetWeight = goldItems.reduce(
    (sum, item) => sum + (typeof item.netWeight === 'number' ? item.netWeight : 0),
    0
  );

  const totalGoldValue = goldItems.reduce(
    (sum, item) => sum + (typeof item.goldValue === 'number' ? item.goldValue : 0),
    0
  );

  const totalAppraisalValue = goldItems.reduce(
    (sum, item) => sum + (typeof item.appraisalValue === 'number' ? item.appraisalValue : 0),
    0
  );

  const monthlyEmi =
    loanType === 'EMI' &&
    typeof loanAmount === 'number' &&
    loanAmount > 0 &&
    typeof interestRate === 'number' &&
    interestRate > 0 &&
    tenure > 0
      ? (() => {
          const monthlyRate = interestRate / 12 / 100;
          const emi =
            (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, tenure)) /
            (Math.pow(1 + monthlyRate, tenure) - 1);
          return emi;
        })()
      : null;

  // ---------------------------------------------------------------------------
  // Customer search
  // ---------------------------------------------------------------------------

  const searchCustomers = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setCustomers([]);
      return;
    }
    setSearchLoading(true);
    try {
      const response = await apiClient.get('/customers', {
        params: { search: query },
      });
      if (response.data.success) {
        setCustomers(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to search customers:', error);
      setCustomers([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      searchCustomers(customerSearch);
    }, 400);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [customerSearch, searchCustomers]);

  // ---------------------------------------------------------------------------
  // Interest rate auto-fill
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (typeof loanAmount !== 'number' || loanAmount <= 0) return;
    const fetchRate = async () => {
      setInterestRateLoading(true);
      try {
        const response = await apiClient.get('/pawning/interest-rates/applicable', {
          params: { amount: loanAmount },
        });
        if (response.data.success && response.data.data?.rate) {
          setInterestRate(response.data.data.rate);
        }
      } catch {
        // Silently fail - user can fill manually
      } finally {
        setInterestRateLoading(false);
      }
    };
    const timeout = setTimeout(fetchRate, 600);
    return () => clearTimeout(timeout);
  }, [loanAmount]);

  // ---------------------------------------------------------------------------
  // LTV validation
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (ltvTimeout.current) clearTimeout(ltvTimeout.current);

    if (typeof loanAmount !== 'number' || loanAmount <= 0 || totalGoldValue <= 0) {
      setLtvValidation(null);
      return;
    }

    ltvTimeout.current = setTimeout(async () => {
      setLtvLoading(true);
      try {
        const response = await apiClient.post('/pawning/ltv/validate', {
          loanAmount,
          totalGoldValue,
        });
        if (response.data.success) {
          setLtvValidation(response.data.data);
        }
      } catch {
        // If the API is unavailable, compute a basic LTV locally
        const ltvPercent = (loanAmount / totalGoldValue) * 100;
        const maxLtv = 75; // Sri Lankan regulatory default
        setLtvValidation({
          ltvPercent: Math.round(ltvPercent * 100) / 100,
          maxLtv,
          maxLoanAmount: Math.round((totalGoldValue * maxLtv) / 100),
          isValid: ltvPercent <= maxLtv,
          message:
            ltvPercent <= maxLtv
              ? 'LTV is within the permissible limit.'
              : `LTV exceeds the maximum allowed limit of ${maxLtv}%.`,
        });
      } finally {
        setLtvLoading(false);
      }
    }, 500);

    return () => {
      if (ltvTimeout.current) clearTimeout(ltvTimeout.current);
    };
  }, [loanAmount, totalGoldValue]);

  // ---------------------------------------------------------------------------
  // Gold items helpers
  // ---------------------------------------------------------------------------

  const updateGoldItem = (index: number, field: keyof PledgedGoldItem, value: any) => {
    setGoldItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addGoldItem = () => {
    setGoldItems((prev) => [...prev, { ...EMPTY_GOLD_ITEM }]);
  };

  const removeGoldItem = (index: number) => {
    if (goldItems.length <= 1) return;
    setGoldItems((prev) => prev.filter((_, i) => i !== index));
  };

  // ---------------------------------------------------------------------------
  // Validation per step
  // ---------------------------------------------------------------------------

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 0:
        return selectedCustomer !== null;
      case 1:
        return goldItems.every(
          (item) =>
            item.itemDescription.trim() !== '' &&
            typeof item.grossWeight === 'number' &&
            item.grossWeight > 0 &&
            typeof item.netWeight === 'number' &&
            item.netWeight > 0 &&
            typeof item.goldValue === 'number' &&
            item.goldValue > 0 &&
            typeof item.appraisalValue === 'number' &&
            item.appraisalValue > 0
        );
      case 2:
        return (
          typeof loanAmount === 'number' &&
          loanAmount > 0 &&
          typeof interestRate === 'number' &&
          interestRate > 0 &&
          tenure > 0
        );
      default:
        return true;
    }
  };

  const canGoNext = isStepValid(currentStep);

  // ---------------------------------------------------------------------------
  // Submission
  // ---------------------------------------------------------------------------

  const handleSubmit = async () => {
    if (!selectedCustomer) return;
    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      customerId: selectedCustomer.id,
      loanAmount: loanAmount as number,
      interestRate: interestRate as number,
      tenure,
      loanType,
      pledgedGoldItems: goldItems.map((item) => ({
        itemDescription: item.itemDescription,
        grossWeight: item.grossWeight as number,
        netWeight: item.netWeight as number,
        purity: item.purity,
        goldValue: item.goldValue as number,
        appraisalValue: item.appraisalValue as number,
      })),
    };

    try {
      const response = await apiClient.post('/loans', payload);
      if (response.data.success) {
        const newLoan = response.data.data;
        router.push(`/loans/${newLoan.id}`);
      } else {
        setSubmitError(response.data.error?.message || 'Failed to create loan application.');
      }
    } catch (err: any) {
      const message =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Failed to create loan application. Please try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // LTV color helper
  // ---------------------------------------------------------------------------

  const getLtvColor = (ltv: number): string => {
    if (ltv <= 50) return 'text-green-600';
    if (ltv <= 65) return 'text-yellow-600';
    if (ltv <= 75) return 'text-orange-600';
    return 'text-red-600';
  };

  const getLtvBgColor = (ltv: number): string => {
    if (ltv <= 50) return 'bg-green-50 border-green-200';
    if (ltv <= 65) return 'bg-yellow-50 border-yellow-200';
    if (ltv <= 75) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const StepIcon = step.icon;
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          return (
            <div key={step.label} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    isCompleted
                      ? 'bg-green-600 border-green-600 text-white'
                      : isCurrent
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <StepIcon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 mt-[-1rem] ${
                    index < currentStep ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-sm text-gray-500 mt-4 text-center">
        Step {currentStep + 1} of {STEPS.length}
      </p>
    </div>
  );

  // -- Step 1: Customer Selection --
  const renderCustomerStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Select Customer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedCustomer ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100">
                  <User className="h-6 w-6 text-green-700" />
                </div>
                <div>
                  <p className="font-semibold text-green-900">{selectedCustomer.name}</p>
                  <div className="flex items-center gap-3 text-sm text-green-700">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {selectedCustomer.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {selectedCustomer.customerCode}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerSearch('');
                  setCustomers([]);
                }}
              >
                Change
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, phone, or customer code..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {searchLoading && (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Searching customers...
              </div>
            )}

            {!searchLoading && customerSearch.length >= 2 && customers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No customers found for &quot;{customerSearch}&quot;</p>
              </div>
            )}

            {!searchLoading && customers.length > 0 && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {customers.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100">
                        <User className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{customer.name}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </span>
                          <span className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {customer.customerCode}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => setSelectedCustomer(customer)}>
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {customerSearch.length < 2 && customers.length === 0 && !searchLoading && (
              <div className="text-center py-8 text-gray-400">
                <Search className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Type at least 2 characters to search</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  // -- Step 2: Gold Items --
  const renderGoldItemsStep = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Pledged Gold Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {goldItems.map((item, index) => (
            <div
              key={index}
              className="space-y-4 p-4 rounded-lg border border-gray-200 relative"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-700">Item {index + 1}</h4>
                {goldItems.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeGoldItem(index)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  Item Description <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="e.g., Gold Necklace 22K, Gold Ring, Bangles set..."
                  value={item.itemDescription}
                  onChange={(e) => updateGoldItem(index, 'itemDescription', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>
                    Gross Weight (g) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.001"
                    placeholder="0.000"
                    value={item.grossWeight}
                    onChange={(e) =>
                      updateGoldItem(
                        index,
                        'grossWeight',
                        e.target.value === '' ? '' : parseFloat(e.target.value)
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Net Weight (g) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.001"
                    placeholder="0.000"
                    value={item.netWeight}
                    onChange={(e) =>
                      updateGoldItem(
                        index,
                        'netWeight',
                        e.target.value === '' ? '' : parseFloat(e.target.value)
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Purity</Label>
                  <Select
                    value={item.purity}
                    onValueChange={(value) => updateGoldItem(index, 'purity', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24K">24K (99.9%)</SelectItem>
                      <SelectItem value="22K">22K (91.6%)</SelectItem>
                      <SelectItem value="18K">18K (75.0%)</SelectItem>
                      <SelectItem value="14K">14K (58.5%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>
                    Gold Value (Rs) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={item.goldValue}
                    onChange={(e) =>
                      updateGoldItem(
                        index,
                        'goldValue',
                        e.target.value === '' ? '' : parseFloat(e.target.value)
                      )
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2 md:col-start-4">
                  <Label>
                    Appraisal Value (Rs) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={item.appraisalValue}
                    onChange={(e) =>
                      updateGoldItem(
                        index,
                        'appraisalValue',
                        e.target.value === '' ? '' : parseFloat(e.target.value)
                      )
                    }
                  />
                </div>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addGoldItem} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Another Item
          </Button>
        </CardContent>
      </Card>

      {/* Running Totals */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <h4 className="font-semibold text-amber-900 mb-4">Running Totals</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-amber-700">Total Items</p>
              <p className="font-bold text-amber-900 text-lg">{totalItems}</p>
            </div>
            <div>
              <p className="text-amber-700">Total Net Weight</p>
              <p className="font-bold text-amber-900 text-lg">{totalNetWeight.toFixed(3)} g</p>
            </div>
            <div>
              <p className="text-amber-700">Total Gold Value</p>
              <p className="font-bold text-amber-900 text-lg">{formatCurrency(totalGoldValue)}</p>
            </div>
            <div>
              <p className="text-amber-700">Total Appraisal Value</p>
              <p className="font-bold text-amber-900 text-lg">
                {formatCurrency(totalAppraisalValue)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // -- Step 3: Loan Details & LTV --
  const renderLoanDetailsStep = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Loan Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>
                Loan Amount (Rs) <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g., 50000"
                value={loanAmount}
                onChange={(e) =>
                  setLoanAmount(e.target.value === '' ? '' : parseFloat(e.target.value))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Interest Rate (%) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g., 12"
                  value={interestRate}
                  onChange={(e) =>
                    setInterestRate(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                />
                {interestRateLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                )}
              </div>
              <p className="text-xs text-gray-500">
                Auto-filled based on loan amount when available
              </p>
            </div>

            <div className="space-y-2">
              <Label>
                Tenure (months) <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min={1}
                placeholder="12"
                value={tenure}
                onChange={(e) => setTenure(parseInt(e.target.value) || 12)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Loan Type</Label>
              <Select
                value={loanType}
                onValueChange={(value) => setLoanType(value as 'Bullet' | 'EMI')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bullet">Bullet (Lump-sum repayment)</SelectItem>
                  <SelectItem value="EMI">EMI (Monthly installments)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loanType === 'EMI' && (
              <div className="space-y-2">
                <Label>Calculated Monthly EMI</Label>
                <div className="h-9 flex items-center px-3 rounded-md border border-gray-200 bg-gray-50 text-sm font-semibold">
                  {monthlyEmi !== null ? formatCurrency(Math.round(monthlyEmi)) : 'Enter all fields'}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* LTV Calculator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            LTV Calculator
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ltvLoading ? (
            <div className="flex items-center justify-center py-6 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Validating LTV...
            </div>
          ) : ltvValidation ? (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-lg border ${getLtvBgColor(ltvValidation.ltvPercent)}`}
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Calculated LTV</p>
                    <p className={`text-2xl font-bold ${getLtvColor(ltvValidation.ltvPercent)}`}>
                      {ltvValidation.ltvPercent.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Maximum Allowed LTV</p>
                    <p className="text-2xl font-bold text-gray-800">{ltvValidation.maxLtv}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Maximum Loan Amount</p>
                    <p className="text-lg font-bold text-gray-800">
                      {formatCurrency(ltvValidation.maxLoanAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Gold Value</p>
                    <p className="text-lg font-bold text-gray-800">
                      {formatCurrency(totalGoldValue)}
                    </p>
                  </div>
                </div>
              </div>

              {/* LTV Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0%</span>
                  <span>{ltvValidation.maxLtv}% (Max)</span>
                  <span>100%</span>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden relative">
                  {/* Max LTV marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-gray-500 z-10"
                    style={{ left: `${ltvValidation.maxLtv}%` }}
                  />
                  {/* LTV fill */}
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      ltvValidation.isValid ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    style={{
                      width: `${Math.min(ltvValidation.ltvPercent, 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Validation message */}
              <div
                className={`flex items-center gap-2 p-3 rounded-md ${
                  ltvValidation.isValid
                    ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                }`}
              >
                {ltvValidation.isValid ? (
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                )}
                <p className="text-sm">{ltvValidation.message}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <Scale className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">
                Enter a loan amount to see the LTV calculation
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // -- Step 4: Review & Submit --
  const renderReviewStep = () => (
    <div className="space-y-4">
      {/* Customer Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customer Details</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedCustomer && (
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100">
                <User className="h-6 w-6 text-blue-700" />
              </div>
              <div>
                <p className="font-semibold">{selectedCustomer.name}</p>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {selectedCustomer.phone}
                  </span>
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {selectedCustomer.customerCode}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pledged Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pledged Gold Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-medium text-gray-600">#</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-600">Description</th>
                  <th className="text-right py-2 pr-4 font-medium text-gray-600">Gross Wt (g)</th>
                  <th className="text-right py-2 pr-4 font-medium text-gray-600">Net Wt (g)</th>
                  <th className="text-center py-2 pr-4 font-medium text-gray-600">Purity</th>
                  <th className="text-right py-2 pr-4 font-medium text-gray-600">Gold Value</th>
                  <th className="text-right py-2 font-medium text-gray-600">Appraisal Value</th>
                </tr>
              </thead>
              <tbody>
                {goldItems.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-2 pr-4 text-gray-500">{index + 1}</td>
                    <td className="py-2 pr-4">{item.itemDescription}</td>
                    <td className="py-2 pr-4 text-right">
                      {typeof item.grossWeight === 'number' ? item.grossWeight.toFixed(3) : '-'}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {typeof item.netWeight === 'number' ? item.netWeight.toFixed(3) : '-'}
                    </td>
                    <td className="py-2 pr-4 text-center">{item.purity}</td>
                    <td className="py-2 pr-4 text-right">
                      {typeof item.goldValue === 'number' ? formatCurrency(item.goldValue) : '-'}
                    </td>
                    <td className="py-2 text-right">
                      {typeof item.appraisalValue === 'number'
                        ? formatCurrency(item.appraisalValue)
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold border-t-2 border-gray-300">
                  <td className="py-2 pr-4" colSpan={2}>
                    Total ({totalItems} items)
                  </td>
                  <td className="py-2 pr-4 text-right">-</td>
                  <td className="py-2 pr-4 text-right">{totalNetWeight.toFixed(3)}</td>
                  <td className="py-2 pr-4 text-center">-</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(totalGoldValue)}</td>
                  <td className="py-2 text-right">{formatCurrency(totalAppraisalValue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Loan Terms Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Loan Terms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-500">Loan Amount</p>
              <p className="text-xl font-bold">
                {typeof loanAmount === 'number' ? formatCurrency(loanAmount) : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Interest Rate</p>
              <p className="text-xl font-bold">
                {typeof interestRate === 'number' ? `${interestRate}%` : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tenure</p>
              <p className="text-xl font-bold">{tenure} months</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Loan Type</p>
              <p className="text-xl font-bold">{loanType}</p>
            </div>
            {loanType === 'EMI' && monthlyEmi !== null && (
              <div>
                <p className="text-sm text-gray-500">Monthly EMI</p>
                <p className="text-xl font-bold">{formatCurrency(Math.round(monthlyEmi))}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* LTV Summary */}
      {ltvValidation && (
        <Card
          className={`border ${ltvValidation.isValid ? 'border-green-200' : 'border-red-200'}`}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              {ltvValidation.isValid ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-red-600" />
              )}
              <h4
                className={`font-semibold text-lg ${
                  ltvValidation.isValid ? 'text-green-900' : 'text-red-900'
                }`}
              >
                LTV: {ltvValidation.ltvPercent.toFixed(2)}% (Max: {ltvValidation.maxLtv}%)
              </h4>
            </div>
            <p
              className={`text-sm ${
                ltvValidation.isValid ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {ltvValidation.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Submit Error */}
      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-sm">{submitError}</p>
          </div>
        </div>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/loans')}
          className="mb-4 text-gray-500"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Loans
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">New Gold Loan Application</h1>
        <p className="text-gray-600 mt-2">
          Complete all steps to submit a new gold loan application
        </p>
      </div>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Step Content */}
      {currentStep === 0 && renderCustomerStep()}
      {currentStep === 1 && renderGoldItemsStep()}
      {currentStep === 2 && renderLoanDetailsStep()}
      {currentStep === 3 && renderReviewStep()}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-8">
        <Button
          type="button"
          variant="outline"
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={currentStep === 0 || submitting}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        {currentStep < STEPS.length - 1 ? (
          <Button
            type="button"
            onClick={() => setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={!canGoNext}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !isStepValid(0) || !isStepValid(1) || !isStepValid(2)}
            className="min-w-[180px]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Submit Application
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
