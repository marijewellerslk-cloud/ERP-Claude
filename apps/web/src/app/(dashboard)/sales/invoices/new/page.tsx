'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { formatCurrency } from '@/lib/currency';
import { ShoppingCart, ArrowLeft, Plus, Trash2, Search, Calculator, Gem, Package, Info, Check, AlertTriangle, RefreshCw, User, Scale, Tag, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { calculateItemCost, calculateEstimatedPrice } from '@/lib/sales-calculations';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  customerCode: string;
  loyaltyPoints: number;
  tier: string;
}

interface Stone {
  stoneType: string;
  count: number;
  totalWeight: string;
  pricePerCarat: string;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  metalType: string;
  purity: string;
  grossWeight: string;
  netWeight: string;
  stoneWeight?: string;
  rate: string;
  makingCharges: string;
  hallmarkCharges: string;
  wastagePercentage?: string;
  costRatePercentage?: string;
  costCalculationMethod?: string;
  calculatedCost?: string;
  imageUrl?: string;
  imageUrls?: string[];
  stones?: Stone[];
  category?: { name: string }; // Added for ExpandedItemDetails
  description?: string; // Added for ExpandedItemDetails
}

interface InvoiceItem {
  id: number; // Placeholder for client-side unique key
  inventoryItemId?: string;
  description: string; // Renamed from itemDescription
  sku?: string; // Added
  purity?: string; // Added
  netWeight: number; // Added, converted from string
  stoneWeight: number; // Added, converted from string
  itemType: 'sale' | 'return'; // Added
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  makingCharges: number;
  wastageCharges: number; // This is a number, not percentage
  stoneCharges: number; // Added
  total: number; // Added, calculated total for the item line

  // Additional fields for expanded details
  costCalculationMethod?: string;
  costRatePercentage?: string; // Kept as string for consistency with InventoryItem
  wastagePercentage?: string; // Kept as string for consistency with InventoryItem
  hallmarkCharges?: string; // Kept as string for consistency with InventoryItem
  stones?: Stone[];

  // Store the calculated cost and estimate for reference
  cost: number;
  estimatedPrice: number;
}

interface GoldRate {
  id: string;
  goldType: string;
  purity: string;
  ratePerGram: string;
  date: string;
}

// Component to fetch and display expanded item details
function ExpandedItemDetails({ itemId, dailyGoldRate }: { itemId: string, dailyGoldRate: number }) {
  const [details, setDetails] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const response = await apiClient.get(`/inventory/items/${itemId}`);
        if (response.data.success) {
          setDetails(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch item details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [itemId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        <span className="ml-2 text-sm text-blue-600">Loading details...</span>
      </div>
    );
  }

  if (!details) {
    return (
      <p className="text-sm text-gray-500 text-center py-2">Could not load details</p>
    );
  }

  // Calculate current cost for display
  const calculateCurrentCost = () => {
    if (!dailyGoldRate) return 0;

    const netWeight = parseFloat(details.netWeight) || 0;
    const makingCharges = parseFloat(details.makingCharges) || 0;
    const wastagePercentage = parseFloat(details.wastagePercentage || '0') || 0;
    const costRatePercentage = parseFloat(details.costRatePercentage || '0') || 0;
    const hallmarkCharges = parseFloat(details.hallmarkCharges) || 0;

    // Calculate stone value
    let stoneValue = 0;
    if (details.stones && details.stones.length > 0) {
      details.stones.forEach((stone) => {
        const weight = parseFloat(stone.totalWeight) || 0;
        const pricePerCarat = parseFloat(stone.pricePerCarat) || 0;
        stoneValue += weight * pricePerCarat;
      });
    }

    return calculateItemCost(
      netWeight,
      dailyGoldRate,
      details.costCalculationMethod,
      costRatePercentage,
      makingCharges,
      wastagePercentage,
      hallmarkCharges,
      stoneValue
    );
  };

  const currentCost = calculateCurrentCost();
  const estimatedPrice = calculateEstimatedPrice(currentCost, 15); // 15% markup

  return (
    <div className="space-y-3">
      {/* Category & Description */}
      {(details.category || details.description) && (
        <div className="bg-white p-3 rounded border border-blue-200">
          {details.category && (
            <div className="mb-2">
              <span className="text-xs text-blue-600">Category:</span>
              <span className="ml-2 text-sm font-medium">{details.category.name}</span>
            </div>
          )}
          {details.description && (
            <div>
              <span className="text-xs text-blue-600">Description:</span>
              <p className="text-sm text-gray-700 mt-1">{details.description}</p>
            </div>
          )}
        </div>
      )}

      {/* Cost Breakdown */}
      <div className="bg-white p-3 rounded border border-blue-200">
        <h6 className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1">
          <Calculator className="h-3 w-3" />
          Cost Calculation
        </h6>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-blue-600">Method:</span>
            <span className="ml-1 font-medium capitalize">
              {(details.costCalculationMethod === 'rate_based' || (parseFloat(details.costRatePercentage || '0') > 0))
                ? 'Rate Based'
                : (details.costCalculationMethod?.replace('_', ' ') || 'Making Charges')}
            </span>
          </div>
          {(details.costCalculationMethod === 'rate_based' || (parseFloat(details.costRatePercentage || '0') > 0)) ? (
            <div>
              <span className="text-blue-600">Cost Rate:</span>
              <span className="ml-1 font-medium">{details.costRatePercentage || '0'}%</span>
            </div>
          ) : (
            <>
              <div>
                <span className="text-blue-600">Making Charges:</span>
                <span className="ml-1 font-medium">{formatCurrency(parseFloat(details.makingCharges) || 0)}</span>
              </div>
              <div>
                <span className="text-blue-600">Wastage:</span>
                <span className="ml-1 font-medium">{details.wastagePercentage || '0'}%</span>
              </div>
            </>
          )}

          <div className="col-span-2 border-t border-dashed my-1"></div>

          <div>
            <span className="text-gray-600">Current Cost:</span>
            <span className="ml-1 font-bold text-gray-900">{formatCurrency(currentCost)}</span>
          </div>
          <div>
            <span className="text-blue-600">Estimate Price (+15%):</span>
            <span className="ml-1 font-bold text-blue-600">{formatCurrency(estimatedPrice)}</span>
          </div>
        </div>
      </div>

      {/* Stones Information */}
      {details.stones && details.stones.length > 0 && (
        <div className="bg-white p-3 rounded border border-blue-200">
          <h6 className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1">
            <Gem className="h-3 w-3" />
            Stones ({details.stones.length})
          </h6>
          <div className="space-y-2">
            {details.stones.map((stone, idx) => (
              <div key={idx} className="bg-blue-50 p-2 rounded text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-medium capitalize">{stone.stoneType}</span>
                  <span className="text-blue-700">{stone.count} pcs</span>
                </div>
                <div className="flex justify-between items-center mt-1 text-gray-600">
                  <span>Weight: {stone.totalWeight}ct</span>
                  <span>@ {formatCurrency(parseFloat(stone.pricePerCarat) || 0)}/ct</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Customer selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');

  // Inventory selection
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventorySearch, setInventorySearch] = useState('');

  // Invoice items
  const [items, setItems] = useState<InvoiceItem[]>([]);

  // Expanded item details
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [expandedSearchItem, setExpandedSearchItem] = useState<string | null>(null);

  // Gold rates
  const [goldRates, setGoldRates] = useState<GoldRate[]>([]);
  const [todayGoldRate, setTodayGoldRate] = useState<number>(0);
  const [updatingGoldRate, setUpdatingGoldRate] = useState(false);

  // Invoice details
  const [invoiceData, setInvoiceData] = useState({
    invoiceDate: new Date().toISOString().split('T')[0],
    purchaseOccasion: '',
    discountAmount: 0,
    taxAmount: 0,
    notes: '',
  });

  useEffect(() => {
    fetchCustomers();
    fetchInventoryItems();
    fetchGoldRates();
  }, []);

  // Fetch current gold rates
  const fetchGoldRates = async () => {
    try {
      const response = await apiClient.get('/sales/gold-rates');
      if (response.data.success) {
        const allRates = response.data.data || [];

        // Get the most recent rate for each purity (rates are sorted by date desc)
        const latestRates: GoldRate[] = [];
        const seenPurities = new Set<string>();

        for (const rate of allRates) {
          const purityKey = rate.purity || rate.goldType;
          if (!seenPurities.has(purityKey)) {
            seenPurities.add(purityKey);
            latestRates.push(rate);
          }
        }

        setGoldRates(latestRates);

        // Set today's gold rate from the latest 22K rate
        const rate22K = latestRates.find(r => r.purity === '22K' || r.goldType === '22K');
        if (rate22K) {
          // Convert per gram rate to per 8g sovereign
          setTodayGoldRate(parseFloat(rate22K.ratePerGram) * 8);
        }
      }
    } catch (error) {
      console.error('Failed to fetch gold rates:', error);
    }
  };

  // Map karat notation to purity numbers
  const purityMap: Record<string, string> = {
    '24K': '999',
    '24k': '999',
    '22K': '916',
    '22k': '916',
    '18K': '750',
    '18k': '750',
    '14K': '585',
    '14k': '585',
    '999': '999',
    '916': '916',
    '750': '750',
    '585': '585',
  };

  // Get gold rate for a specific purity
  const getGoldRateForPurity = (purity: string): number => {
    // Convert purity to standard format
    const normalizedPurity = purityMap[purity] || purity;

    // Try to find exact match first
    let rate = goldRates.find((r) => r.purity === normalizedPurity);

    // If not found, try original purity
    if (!rate) {
      rate = goldRates.find((r) => r.purity === purity);
    }

    // If still not found, try matching by goldType (22K format)
    if (!rate) {
      rate = goldRates.find((r) => r.goldType?.toLowerCase() === purity?.toLowerCase());
    }

    return rate ? parseFloat(rate.ratePerGram) : 0;
  };

  // Get display cost (calculated or stored)
  const getDisplayCost = (item: InventoryItem): number => {
    // If we have current gold rates and item has purity, calculate dynamically
    if (goldRates.length > 0 && item.purity && item.netWeight) {
      const netWeight = parseFloat(item.netWeight) || 0;
      const makingCharges = parseFloat(item.makingCharges) || 0;
      const wastagePercentage = parseFloat(item.wastagePercentage || '0') || 0;
      const costRatePercentage = parseFloat(item.costRatePercentage || '0') || 0;
      const hallmarkCharges = parseFloat(item.hallmarkCharges) || 0;
      const stoneValue = calculateStoneValue(item);

      const calculated = calculateItemCost(
        netWeight,
        goldRates.find(r => r.purity === '22K')?.ratePerGram ? parseFloat(goldRates.find(r => r.purity === '22K')!.ratePerGram) * 8 : todayGoldRate,
        item.costCalculationMethod,
        costRatePercentage,
        makingCharges,
        wastagePercentage,
        hallmarkCharges,
        stoneValue
      );
      if (calculated > 0) return calculated;
    }
    // Fall back to stored calculated cost
    return parseFloat(item.calculatedCost || item.rate || '0');
  };

  const fetchCustomers = async () => {
    try {
      const response = await apiClient.get('/customers');
      if (response.data.success) {
        setCustomers(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const response = await apiClient.get('/inventory/items');
      if (response.data.success) {
        setInventoryItems(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    }
  };

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.firstName.toLowerCase().includes(customerSearch.toLowerCase()) ||
      customer.lastName.toLowerCase().includes(customerSearch.toLowerCase()) ||
      customer.phone.includes(customerSearch) ||
      customer.customerCode.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const filteredInventory = inventoryItems.filter(
    (item) =>
      item.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      item.sku.toLowerCase().includes(inventorySearch.toLowerCase())
  );

  // Calculate stone value from inventory item
  const calculateStoneValue = (inventoryItem: InventoryItem): number => {
    let stoneValue = 0;
    if (inventoryItem.stones && inventoryItem.stones.length > 0) {
      inventoryItem.stones.forEach((stone) => {
        const weight = parseFloat(stone.totalWeight) || 0;
        const pricePerCarat = parseFloat(stone.pricePerCarat) || 0;
        stoneValue += weight * pricePerCarat;
      });
    }
    return stoneValue;
  };

  const addInventoryItem = (inventoryItem: InventoryItem) => {
    // Get gold rate for 8g sovereign
    // Use the daily gold rate we fetched (already in 8g sovereign format)
    // If not available, fallback to 0
    const goldRatePer8g = todayGoldRate;

    // Get cost calculation parameters
    // Calculate STONE VALUE explicitly
    const stoneValue = calculateStoneValue(inventoryItem);

    // Calculate current market COST
    const currentCost = calculateItemCost(
      parseFloat(inventoryItem.netWeight),
      goldRatePer8g,
      inventoryItem.costCalculationMethod,
      parseFloat(inventoryItem.costRatePercentage || '0'),
      parseFloat(inventoryItem.makingCharges) || 0,
      parseFloat(inventoryItem.wastagePercentage || '0') || 0,
      parseFloat(inventoryItem.hallmarkCharges) || 0,
      stoneValue
    );

    // Calculate Estimated Price (Cost + 15%)
    const estimatedPrice = calculateEstimatedPrice(currentCost, 15);

    // Default Unit Price is the Estimated Price
    const initialUnitPrice = Math.ceil(estimatedPrice);

    // Initial discount is 0 since we set unit price to estimated price
    const initialDiscount = 0;

    const newItem: InvoiceItem = {
      id: items.length + 1, // Placeholder for client-side unique key
      inventoryItemId: inventoryItem.id,
      description: inventoryItem.name,
      sku: inventoryItem.sku,
      purity: inventoryItem.purity,
      netWeight: parseFloat(inventoryItem.netWeight),
      stoneWeight: parseFloat(inventoryItem.stoneWeight || '0'),
      itemType: 'sale',
      quantity: 1,
      unitPrice: initialUnitPrice, // Selling Price (Estimated Price)
      discount: initialDiscount,
      taxRate: 0,
      makingCharges: parseFloat(inventoryItem.makingCharges) || 0,
      wastageCharges: 0, // This is a number, not percentage
      stoneCharges: stoneValue,
      total: initialUnitPrice, // Total is just Unit Price * Qty (inclusive)

      // Additional fields for expanded details
      costCalculationMethod: inventoryItem.costCalculationMethod,
      costRatePercentage: inventoryItem.costRatePercentage,
      wastagePercentage: inventoryItem.wastagePercentage,
      hallmarkCharges: inventoryItem.hallmarkCharges,
      stones: inventoryItem.stones,

      // Store the calculated cost and estimate for reference
      cost: currentCost, // Store the raw cost
      estimatedPrice: estimatedPrice // Store the estimate
    };

    setItems([...items, newItem]);

    // Automatically Expand details for checking
    // setExpandedItems(prev => new Set(prev).add(newItem.id)); // Can't do this easily as ID is 0
    setExpandedSearchItem(null);
    setInventorySearch('');
  };

  const addCustomItem = () => {
    const newItem: InvoiceItem = {
      id: items.length + 1,
      description: '',
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      taxRate: 0,
      makingCharges: 0,
      wastageCharges: 0,
      stoneCharges: 0,
      netWeight: 0,
      stoneWeight: 0,
      itemType: 'sale',
      total: 0,
      cost: 0,
      estimatedPrice: 0,
    };

    setItems([...items, newItem]);
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const updatedItems = [...items];
    const item = updatedItems[index];
    (item as any)[field] = value;

    // If unit price changed, recalculate discount
    if (field === 'unitPrice') {
      // Discount = Estimated Price - New Unit Price
      // Only if estimated price is set (not a custom item without info)
      if (item.estimatedPrice > 0) {
        item.discount = Math.max(0, item.estimatedPrice - value);
      }
    }

    // If discount changed, update unit price? 
    // Usually user changes Unit Price (Selling Price) and we calculate Discount, 
    // OR user enters Discount and we calculate Unit Price.
    // Let's assume user primarily changes Unit Price in this context based on negotiation.
    // But if they explicitly change discount:
    if (field === 'discount') {
      if (item.estimatedPrice > 0) {
        item.unitPrice = item.estimatedPrice - value;
      }
    }

    // If daily gold rate changed (via global update), recalculate everything
    // This logic is now handled by applyGoldRateToAllItems, but if we were to update a single item's rate:
    // if (field === 'dailyGoldRate' && item.inventoryItemId) {
    //   const newCost = calculateItemCost(
    //     item.netWeight || 0,
    //     value,
    //     item.costCalculationMethod,
    //     parseFloat(item.costRatePercentage || '0'),
    //     item.makingCharges,
    //     parseFloat(item.wastagePercentage || '0'),
    //     parseFloat(item.hallmarkCharges || '0'),
    //     item.stoneCharges || 0
    //   );
    //   item.cost = newCost;
    //   item.estimatedPrice = calculateEstimatedPrice(newCost, 15);
    //   item.unitPrice = item.estimatedPrice;
    //   item.discount = 0;
    // }

    // Recalculate total for the item line
    item.total = item.unitPrice * item.quantity;

    setItems(updatedItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Update today's gold rate and save to system
  const handleUpdateGoldRate = async () => {
    if (todayGoldRate <= 0) {
      alert('Please enter a valid gold rate');
      return;
    }

    setUpdatingGoldRate(true);
    try {
      // Save to the system
      await apiClient.post('/sales/gold-rates', {
        goldType: 'gold',
        purity: '22K',
        ratePerGram: todayGoldRate / 8, // Convert 8g rate to per gram
      });

      // Also save 24K rate (proportionally higher)
      await apiClient.post('/sales/gold-rates', {
        goldType: 'gold',
        purity: '24K',
        ratePerGram: (todayGoldRate / 8) * (24 / 22), // Convert to 24K rate
      });

      // Refresh gold rates
      await fetchGoldRates();

      // Apply to all items
      applyGoldRateToAllItems(todayGoldRate);

      alert('Gold rate updated successfully!');
    } catch (error) {
      console.error('Failed to update gold rate:', error);
      alert('Failed to update gold rate');
    } finally {
      setUpdatingGoldRate(false);
    }
  };

  // Apply gold rate to all items in the invoice
  const applyGoldRateToAllItems = (rate: number) => {
    if (items.length === 0) return;

    const updatedItems = items.map((item) => {
      if (item.inventoryItemId && item.netWeight) {
        // Calculate current market COST
        const currentCost = calculateItemCost(
          item.netWeight,
          rate,
          item.costCalculationMethod,
          parseFloat(item.costRatePercentage || '0'),
          item.makingCharges,
          parseFloat(item.wastagePercentage || '0'),
          parseFloat(item.hallmarkCharges || '0'),
          item.stoneCharges || 0
        );

        // Calculate Estimated Price (Cost + 15%)
        const estimatedPrice = calculateEstimatedPrice(currentCost, 15);

        // Apply 15% markup - Wait, calculateEstimatedPrice already does it? 
        // No, calculateEstimatedPrice in utility DOES apply markup.
        // Checked utility: export const calculateEstimatedPrice = (currentCost: number, markupPercentage: number = 15)
        // So 'estimatedPrice' HERE is indeed Cost + Markup.

        const finalEstimatedPrice = estimatedPrice;
        return {
          ...item,
          cost: currentCost,
          estimatedPrice: finalEstimatedPrice,
          unitPrice: finalEstimatedPrice, // Reset unit price to new estimate
          discount: 0, // Reset discount
          total: finalEstimatedPrice * item.quantity, // Recalculate total
        };
      }
      return item;
    });

    setItems(updatedItems);
  };

  const calculateItemTotal = (item: InvoiceItem): number => {
    // unitPrice is the negotiated selling price (initially Estimated Price)
    // It already accounts for markup, costs, and is the net figure before tax.
    const subtotal = item.unitPrice * item.quantity;
    const taxAmount = (subtotal * item.taxRate) / 100;
    return subtotal + taxAmount;
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => {
      // unitPrice is the final negotiated price per item
      return sum + (item.unitPrice * item.quantity);
    }, 0);

    const totalBeforeDiscount = subtotal;
    // invoiceData.discountAmount is invoice-level discount (additional)
    const finalTotal = totalBeforeDiscount - invoiceData.discountAmount + invoiceData.taxAmount;

    return {
      subtotal: totalBeforeDiscount,
      discount: invoiceData.discountAmount,
      tax: invoiceData.taxAmount,
      total: finalTotal,
    };
  };

  const handleSaveInvoice = async () => {
    if (!selectedCustomer) {
      alert('Please select a customer');
      return;
    }

    if (items.length === 0) {
      alert('Please add at least one item');
      return;
    }

    // Validate all items have description
    const hasEmptyDescription = items.some((item) => !item.itemDescription.trim());
    if (hasEmptyDescription) {
      alert('All items must have a description');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        customerId: selectedCustomer.id,
        invoiceDate: invoiceData.invoiceDate,
        items: items.map((item) => ({
          inventoryItemId: item.inventoryItemId || undefined,
          itemDescription: item.itemDescription,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          makingCharges: item.makingCharges,
          wastageCharges: item.wastageCharges,
          discount: item.discount,
          taxRate: item.taxRate,
          goldWeight: item.goldWeight,
          goldPurity: item.goldPurity,
        })),
        discountAmount: invoiceData.discountAmount,
        taxAmount: invoiceData.taxAmount,
        purchaseOccasion: invoiceData.purchaseOccasion || undefined,
        notes: invoiceData.notes || undefined,
      };

      const response = await apiClient.post('/sales/invoices', payload);

      if (response.data.success) {
        const invoiceId = response.data.data.id;
        alert('Invoice created successfully!');
        router.push(`/sales/invoices/${invoiceId}`);
      } else {
        alert('Failed to create invoice');
      }
    } catch (error: any) {
      console.error('Failed to create invoice:', error);
      alert(error.response?.data?.error?.message || 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Create New Invoice</h1>
          <p className="text-gray-500 mt-1">POS - Point of Sale</p>
        </div>
        <Button onClick={() => router.back()} variant="outline">
          Cancel
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Customer & Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Selection */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-lg">Customer</h3>
            </div>

            {selectedCustomer ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                    </p>
                    <p className="text-sm text-gray-600">{selectedCustomer.phone}</p>
                    <p className="text-sm text-gray-600">
                      Code: {selectedCustomer.customerCode} | Points: {selectedCustomer.loyaltyPoints} | Tier: {selectedCustomer.tier.toUpperCase()}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>
                    Change
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search customer by name, phone, or code..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {customerSearch && (
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.slice(0, 10).map((customer) => (
                        <button
                          key={customer.id}
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setCustomerSearch('');
                          }}
                          className="w-full p-3 text-left hover:bg-gray-50 border-b last:border-b-0"
                        >
                          <p className="font-medium">
                            {customer.firstName} {customer.lastName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {customer.phone} | {customer.customerCode}
                          </p>
                        </button>
                      ))
                    ) : (
                      <p className="p-3 text-gray-500 text-center">No customers found</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Today's Gold Rate Section */}
          <Card className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-full">
                  <Scale className="h-5 w-5 text-yellow-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-yellow-900">Today's Gold Rate (22K)</h3>
                  <p className="text-xs text-yellow-700">
                    {goldRates.length > 0
                      ? `Last updated: ${goldRates[0]?.date ? new Date(goldRates[0].date).toLocaleDateString() : 'N/A'}`
                      : 'No rate set for today'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <Input
                    type="number"
                    value={todayGoldRate || ''}
                    onChange={(e) => setTodayGoldRate(parseFloat(e.target.value) || 0)}
                    placeholder="Enter rate per 8g"
                    className="w-40 text-right font-bold bg-white"
                  />
                  <p className="text-xs text-yellow-700 mt-1">Rs per 8g sovereign</p>
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    onClick={handleUpdateGoldRate}
                    disabled={updatingGoldRate || todayGoldRate <= 0}
                    size="sm"
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    {updatingGoldRate ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Save Rate'
                    )}
                  </Button>
                  {items.length > 0 && todayGoldRate > 0 && (
                    <Button
                      onClick={() => applyGoldRateToAllItems(todayGoldRate)}
                      variant="outline"
                      size="sm"
                      className="text-xs border-yellow-400 text-yellow-800"
                    >
                      Apply to All
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Items Section */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-lg">Items</h3>
              </div>
              <Button onClick={addCustomItem} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Custom Item
              </Button>
            </div>

            {/* Inventory Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search inventory to add items..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {inventorySearch && (
                <div className="mt-2 max-h-[500px] overflow-y-auto border rounded-lg shadow-lg bg-white">
                  {filteredInventory.length > 0 ? (
                    filteredInventory.slice(0, 10).map((item) => (
                      <div key={item.id} className="border-b last:border-b-0">
                        <div className="p-4 hover:bg-blue-50 flex gap-4">
                          {/* Product Image */}
                          <div className="flex-shrink-0">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-20 h-20 object-cover rounded-lg border"
                              />
                            ) : (
                              <div className="w-20 h-20 bg-gray-100 rounded-lg border flex items-center justify-center">
                                <Package className="h-8 w-8 text-gray-400" />
                              </div>
                            )}
                          </div>

                          {/* Product Details */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                            <p className="text-xs text-gray-500 mt-1">SKU: {item.sku}</p>

                            <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                              <div>
                                <p className="text-gray-500 text-xs">Weight</p>
                                <p className="font-medium">{item.netWeight}g</p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-xs">Purity</p>
                                <p className="font-medium">{item.metalType} {item.purity}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-xs">Current Cost</p>
                                <p className="font-medium text-green-600">{formatCurrency(getDisplayCost(item))}</p>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 mt-3">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedSearchItem(expandedSearchItem === item.id ? null : item.id);
                                }}
                                className="text-xs text-gray-600 hover:text-blue-600 flex items-center gap-1"
                              >
                                <Info className="h-3 w-3" />
                                More Info
                                {expandedSearchItem === item.id ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Add Button */}
                          <div className="flex-shrink-0 self-center">
                            <button
                              type="button"
                              onClick={() => addInventoryItem(item)}
                              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <Plus className="h-5 w-5" />
                            </button>
                          </div>
                        </div>

                        {/* Expanded More Information Section */}
                        {expandedSearchItem === item.id && (
                          <div className="px-4 pb-4 bg-gray-50 border-t">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-3">
                              {/* Weight Details */}
                              <div className="bg-white p-2 rounded border">
                                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                                  <Scale className="h-3 w-3" />
                                  Gross Weight
                                </div>
                                <p className="font-semibold text-sm">{item.grossWeight}g</p>
                              </div>
                              <div className="bg-white p-2 rounded border">
                                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                                  <Scale className="h-3 w-3" />
                                  Net Weight
                                </div>
                                <p className="font-semibold text-sm">{item.netWeight}g</p>
                              </div>
                              {item.stoneWeight && parseFloat(item.stoneWeight) > 0 && (
                                <div className="bg-white p-2 rounded border">
                                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                                    <Gem className="h-3 w-3" />
                                    Stone Weight
                                  </div>
                                  <p className="font-semibold text-sm">{item.stoneWeight}ct</p>
                                </div>
                              )}

                              {/* Cost Calculation */}
                              <div className="bg-white p-2 rounded border">
                                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                                  <Calculator className="h-3 w-3" />
                                  Cost Method
                                </div>
                                <p className="font-semibold text-sm capitalize">
                                  {item.costCalculationMethod?.replace('_', ' ') || 'Making Charges'}
                                </p>
                              </div>
                            </div>

                            {/* Cost Breakdown */}
                            <div className="bg-white p-3 rounded border mt-2">
                              <h5 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                <Tag className="h-3 w-3" />
                                Cost Breakdown
                              </h5>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                {item.costCalculationMethod === 'rate_based' ? (
                                  <div>
                                    <span className="text-gray-500">Cost Rate:</span>
                                    <span className="ml-1 font-medium">{item.costRatePercentage || '0'}%</span>
                                  </div>
                                ) : (
                                  <>
                                    <div>
                                      <span className="text-gray-500">Making:</span>
                                      <span className="ml-1 font-medium">{formatCurrency(parseFloat(item.makingCharges) || 0)}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Wastage:</span>
                                      <span className="ml-1 font-medium">{item.wastagePercentage || '0'}%</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Hallmark:</span>
                                      <span className="ml-1 font-medium">{formatCurrency(parseFloat(item.hallmarkCharges) || 0)}</span>
                                    </div>
                                  </>
                                )}
                                <div>
                                  <span className="text-gray-500">Rate:</span>
                                  <span className="ml-1 font-medium">{formatCurrency(parseFloat(item.rate) || 0)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Stones Information */}
                            {item.stones && item.stones.length > 0 && (
                              <div className="bg-white p-3 rounded border mt-2">
                                <h5 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                  <Gem className="h-3 w-3" />
                                  Stones ({item.stones.length})
                                </h5>
                                <div className="space-y-1">
                                  {item.stones.map((stone, idx) => (
                                    <div key={idx} className="flex justify-between text-xs bg-gray-50 p-2 rounded">
                                      <span className="capitalize">{stone.stoneType}</span>
                                      <span>{stone.count} pcs - {stone.totalWeight}ct @ {formatCurrency(parseFloat(stone.pricePerCarat) || 0)}/ct</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="p-4 text-gray-500 text-center">No items found</p>
                  )}
                </div>
              )}
            </div>

            {/* Items List */}
            <div className="space-y-4">
              {items.length > 0 ? (
                items.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        {/* Product Details Display (for inventory items) */}
                        {item.inventoryItemId && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-blue-900">Product Details</h4>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-blue-700">SKU: {item.sku}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newExpanded = new Set(expandedItems);
                                    if (newExpanded.has(index)) {
                                      newExpanded.delete(index);
                                    } else {
                                      newExpanded.add(index);
                                    }
                                    setExpandedItems(newExpanded);
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1 bg-blue-100 rounded"
                                >
                                  <Info className="h-3 w-3" />
                                  More Info
                                  {expandedItems.has(index) ? (
                                    <ChevronUp className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 text-sm">
                              <div>
                                <p className="text-blue-600 font-medium">Gross Weight</p>
                                <p className="text-blue-900 font-bold">{item.grossWeight}g</p>
                              </div>
                              <div>
                                <p className="text-blue-600 font-medium">Net Weight</p>
                                <p className="text-blue-900 font-bold">{item.netWeight}g</p>
                              </div>
                              <div>
                                <p className="text-blue-600 font-medium">Current Cost</p>
                                <p className="text-blue-900 font-bold">{formatCurrency(parseFloat(item.costRate || '0'))}</p>
                              </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-blue-300">
                              <p className="text-xs text-blue-700">
                                <strong>Metal:</strong> {item.metalType} {item.goldPurity}
                              </p>
                            </div>

                            {/* Expanded More Information */}
                            {expandedItems.has(index) && (
                              <div className="mt-3 pt-3 border-t border-blue-300 space-y-3">
                                {/* Fetch and display full item details */}
                                <ExpandedItemDetails itemId={item.inventoryItemId} />
                              </div>
                            )}
                          </div>
                        )}

                        <div>
                          <Label>Item Description</Label>
                          <Input
                            value={item.itemDescription}
                            onChange={(e) => updateItem(index, 'itemDescription', e.target.value)}
                            placeholder="e.g., Gold Ring 22K"
                          />
                        </div>

                        {/* Pricing Section */}
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <h5 className="font-semibold text-yellow-900 mb-3">Pricing Details</h5>

                          {/* Gold Rate Input */}
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <Label className={`${item.dailyGoldRate > 0 ? 'text-yellow-800' : 'text-red-600 font-semibold'}`}>
                                Daily Gold Rate (Rs/8g) *
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.dailyGoldRate || ''}
                                onChange={(e) => updateItem(index, 'dailyGoldRate', parseFloat(e.target.value) || 0)}
                                placeholder="Enter rate per 8g sovereign"
                                className={`font-semibold ${item.dailyGoldRate > 0 ? 'bg-white' : 'bg-red-50 border-red-300'}`}
                              />
                              <p className={`text-xs mt-1 ${item.dailyGoldRate > 0 ? 'text-yellow-700' : 'text-red-600'}`}>
                                {item.dailyGoldRate > 0
                                  ? 'Rate per 8g sovereign - Cost will recalculate automatically'
                                  : 'Required: Enter today\'s gold rate to calculate cost'}
                              </p>
                            </div>
                            <div>
                              <Label className="text-yellow-800">Quantity</Label>
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                                min="1"
                                className="bg-white"
                              />
                            </div>
                          </div>

                          {/* Cost Calculation Breakdown */}
                          {item.inventoryItemId && (
                            <div className="bg-white border border-yellow-300 rounded p-3 mb-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-yellow-800">Cost Calculation Breakdown</span>
                                <span className="text-xs px-2 py-0.5 bg-yellow-200 rounded capitalize">
                                  {item.costCalculationMethod?.replace('_', ' ') || 'Making Charges'} Method
                                </span>
                              </div>
                              {item.dailyGoldRate > 0 ? (
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Gold Value (Net {item.goldWeight}g × Rs.{(item.dailyGoldRate / 8).toFixed(2)}/g):</span>
                                    <span className="font-medium">{formatCurrency((item.goldWeight || 0) * (item.dailyGoldRate / 8))}</span>
                                  </div>
                                  {item.costCalculationMethod === 'rate_based' ? (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Markup (+{item.costRatePercentage || 0}%):</span>
                                      <span className="font-medium">
                                        +{formatCurrency((item.goldWeight || 0) * (item.dailyGoldRate / 8) * ((item.costRatePercentage || 0) / 100))}
                                      </span>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Making Charges:</span>
                                        <span className="font-medium">{formatCurrency(item.makingCharges)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Wastage ({item.wastagePercentage || 0}%):</span>
                                        <span className="font-medium">
                                          {formatCurrency((item.goldWeight || 0) * (item.dailyGoldRate / 8) * ((item.wastagePercentage || 0) / 100))}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Hallmark Charges:</span>
                                        <span className="font-medium">{formatCurrency(item.hallmarkCharges || 0)}</span>
                                      </div>
                                    </>
                                  )}
                                  {(item.stoneValue || 0) > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Stone Value:</span>
                                      <span className="font-medium">{formatCurrency(item.stoneValue || 0)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between col-span-2 pt-2 border-t border-yellow-200 font-bold">
                                    <span className="text-yellow-800">Calculated Cost:</span>
                                    <span className="text-green-600">{formatCurrency(item.estimatedPrice)}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-3 text-yellow-700 text-sm">
                                  <p className="font-medium">Enter Daily Gold Rate above to see cost breakdown</p>
                                  <p className="text-xs mt-1">Weight: {item.goldWeight}g | Purity: {item.goldPurity}</p>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <Label className="text-yellow-800">Estimated Price (Rs)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.estimatedPrice.toFixed(2)}
                                readOnly
                                className="bg-gray-100 font-semibold"
                              />
                              <p className="text-xs text-yellow-700 mt-1">Auto-calculated based on gold rate</p>
                            </div>
                            <div>
                              <Label className="text-yellow-800">Making Charges (Rs)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.makingCharges}
                                onChange={(e) => updateItem(index, 'makingCharges', parseFloat(e.target.value) || 0)}
                                className="bg-white"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div>
                              <Label className="text-yellow-800">Wastage (Rs)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.wastageCharges}
                                onChange={(e) => updateItem(index, 'wastageCharges', parseFloat(e.target.value) || 0)}
                                className="bg-white"
                              />
                            </div>
                            <div>
                              <Label className="text-yellow-800">Discount (Rs)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.discount}
                                onChange={(e) => updateItem(index, 'discount', parseFloat(e.target.value) || 0)}
                                className="bg-white"
                              />
                            </div>
                            <div>
                              <Label className="text-yellow-800">Tax Rate (%)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.taxRate}
                                onChange={(e) => updateItem(index, 'taxRate', parseFloat(e.target.value) || 0)}
                                className="bg-white"
                              />
                            </div>
                          </div>

                          <div className="pt-3 border-t border-yellow-300">
                            <Label className="text-yellow-800">Final Price (Rs) *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.finalPrice}
                              onChange={(e) => {
                                const finalPrice = parseFloat(e.target.value) || 0;
                                updateItem(index, 'finalPrice', finalPrice);
                                updateItem(index, 'unitPrice', finalPrice);
                              }}
                              placeholder="Enter final selling price"
                              className="bg-white font-bold text-lg"
                              required
                            />
                            <p className="text-xs text-yellow-700 mt-1">
                              This is the final selling price for this item
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t">
                          <p className="text-sm text-gray-600">Line Total:</p>
                          <p className="font-semibold">{formatCurrency(calculateItemTotal(item))}</p>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        className="ml-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No items added yet</p>
                  <p className="text-sm mt-1">Search inventory or add custom items</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column - Invoice Details & Summary */}
        <div className="space-y-6">
          {/* Invoice Details */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Invoice Details</h3>
            <div className="space-y-4">
              <div>
                <Label>Invoice Date</Label>
                <Input
                  type="date"
                  value={invoiceData.invoiceDate}
                  onChange={(e) => setInvoiceData({ ...invoiceData, invoiceDate: e.target.value })}
                />
              </div>

              <div>
                <Label>Purchase Occasion</Label>
                <Select
                  value={invoiceData.purchaseOccasion}
                  onValueChange={(value) => setInvoiceData({ ...invoiceData, purchaseOccasion: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select occasion" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wedding">Wedding</SelectItem>
                    <SelectItem value="festival">Festival</SelectItem>
                    <SelectItem value="birthday">Birthday</SelectItem>
                    <SelectItem value="anniversary">Anniversary</SelectItem>
                    <SelectItem value="investment">Investment</SelectItem>
                    <SelectItem value="gift">Gift</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Notes</Label>
                <Input
                  placeholder="Additional notes..."
                  value={invoiceData.notes}
                  onChange={(e) => setInvoiceData({ ...invoiceData, notes: e.target.value })}
                />
              </div>
            </div>
          </Card>

          {/* Summary */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-lg">Summary</h3>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>

              <div>
                <Label className="text-xs">Additional Discount (Rs)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={invoiceData.discountAmount}
                  onChange={(e) => setInvoiceData({ ...invoiceData, discountAmount: parseFloat(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Additional Tax (Rs)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={invoiceData.taxAmount}
                  onChange={(e) => setInvoiceData({ ...invoiceData, taxAmount: parseFloat(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>

              <div className="pt-3 border-t">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-green-600">{formatCurrency(totals.total)}</span>
                </div>
              </div>

              <Button
                onClick={handleSaveInvoice}
                disabled={saving || !selectedCustomer || items.length === 0}
                className="w-full mt-4"
                size="lg"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Invoice...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Invoice
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
