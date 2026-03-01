'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Sparkles,
  User,
  Phone,
  Search,
  Plus,
  AlertCircle,
  Save,
} from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  customerCode: string;
}

export default function NewCustomOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Customer search
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    orderType: 'ring',
    designTitle: '',
    designDescription: '',
    customerRequirements: '',
    metalType: 'gold',
    purity: '22K',
    estimatedWeight: '',
    ringSize: '',
    bangleSize: '',
    chainLength: '',
    hasStones: false,
    stoneDetails: '',
    priority: 'normal',
    notes: '',
  });

  // Search customers
  const searchCustomers = async () => {
    if (!customerSearch.trim()) return;

    setSearchingCustomers(true);
    try {
      const response = await apiClient.get('/customers', {
        params: { search: customerSearch, limit: 10 },
      });
      if (response.data.success) {
        setCustomers(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to search customers:', error);
    } finally {
      setSearchingCustomers(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (customerSearch.length >= 2) {
        searchCustomers();
      } else {
        setCustomers([]);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [customerSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomer) {
      setError('Please select a customer');
      return;
    }

    if (!formData.designTitle.trim()) {
      setError('Please enter a design title');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/custom-orders', {
        customerId: selectedCustomer.id,
        orderType: formData.orderType,
        designTitle: formData.designTitle,
        designDescription: formData.designDescription || undefined,
        customerRequirements: formData.customerRequirements || undefined,
        metalType: formData.metalType || undefined,
        purity: formData.purity || undefined,
        estimatedWeight: formData.estimatedWeight ? parseFloat(formData.estimatedWeight) : undefined,
        ringSize: formData.ringSize || undefined,
        bangleSize: formData.bangleSize || undefined,
        chainLength: formData.chainLength || undefined,
        hasStones: formData.hasStones,
        stoneDetails: formData.stoneDetails ? JSON.parse(formData.stoneDetails) : undefined,
        priority: formData.priority,
        notes: formData.notes || undefined,
      });

      if (response.data.success) {
        router.push(`/custom-orders/${response.data.data.id}`);
      } else {
        setError(response.data.error?.message || 'Failed to create custom order');
      }
    } catch (error: any) {
      console.error('Failed to create custom order:', error);
      setError(error.response?.data?.error?.message || 'Failed to create custom order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/custom-orders">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Custom Order</h1>
          <p className="text-gray-500">Create a new custom jewelry design order</p>
        </div>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Selection */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="h-5 w-5" />
            Customer Information
          </h2>

          {selectedCustomer ? (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-lg">
                    {selectedCustomer.firstName} {selectedCustomer.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{selectedCustomer.customerCode}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <div className="flex items-center gap-1">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span>{selectedCustomer.phone}</span>
                    </div>
                    {selectedCustomer.email && <span>{selectedCustomer.email}</span>}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerSearch('');
                  }}
                >
                  Change
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search customer by name or phone..."
                  className="pl-10"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
              </div>

              {searchingCustomers && (
                <p className="text-sm text-gray-500">Searching...</p>
              )}

              {customers.length > 0 && (
                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      className="p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setCustomers([]);
                        setCustomerSearch('');
                      }}
                    >
                      <p className="font-medium">
                        {customer.firstName} {customer.lastName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {customer.phone} - {customer.customerCode}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {customerSearch.length >= 2 && customers.length === 0 && !searchingCustomers && (
                <p className="text-sm text-gray-500">No customers found. Try a different search.</p>
              )}
            </div>
          )}
        </Card>

        {/* Order Details */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Order Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Order Type *</Label>
              <select
                className="w-full px-3 py-2 border rounded-md mt-1"
                value={formData.orderType}
                onChange={(e) => setFormData({ ...formData, orderType: e.target.value })}
              >
                <option value="ring">Ring</option>
                <option value="necklace">Necklace</option>
                <option value="earrings">Earrings</option>
                <option value="bangle">Bangle</option>
                <option value="pendant">Pendant</option>
                <option value="bracelet">Bracelet</option>
                <option value="chain">Chain</option>
                <option value="set">Set</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <Label>Priority</Label>
              <select
                className="w-full px-3 py-2 border rounded-md mt-1"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <Label>Design Title *</Label>
              <Input
                className="mt-1"
                placeholder="e.g., Custom Engagement Ring with Diamond"
                value={formData.designTitle}
                onChange={(e) => setFormData({ ...formData, designTitle: e.target.value })}
                required
              />
            </div>

            <div className="md:col-span-2">
              <Label>Design Description</Label>
              <textarea
                className="w-full px-3 py-2 border rounded-md mt-1 min-h-[100px]"
                placeholder="Describe the design requirements in detail..."
                value={formData.designDescription}
                onChange={(e) => setFormData({ ...formData, designDescription: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <Label>Customer Requirements / Instructions</Label>
              <textarea
                className="w-full px-3 py-2 border rounded-md mt-1 min-h-[80px]"
                placeholder="Any specific instructions from the customer..."
                value={formData.customerRequirements}
                onChange={(e) => setFormData({ ...formData, customerRequirements: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Specifications */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Specifications</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Metal Type</Label>
              <select
                className="w-full px-3 py-2 border rounded-md mt-1"
                value={formData.metalType}
                onChange={(e) => setFormData({ ...formData, metalType: e.target.value })}
              >
                <option value="gold">Gold</option>
                <option value="white_gold">White Gold</option>
                <option value="rose_gold">Rose Gold</option>
                <option value="silver">Silver</option>
                <option value="platinum">Platinum</option>
              </select>
            </div>

            <div>
              <Label>Purity</Label>
              <select
                className="w-full px-3 py-2 border rounded-md mt-1"
                value={formData.purity}
                onChange={(e) => setFormData({ ...formData, purity: e.target.value })}
              >
                <option value="24K">24K (999)</option>
                <option value="22K">22K (916)</option>
                <option value="21K">21K (875)</option>
                <option value="18K">18K (750)</option>
                <option value="14K">14K (585)</option>
                <option value="925">925 Silver</option>
                <option value="950">950 Platinum</option>
              </select>
            </div>

            <div>
              <Label>Estimated Weight (grams)</Label>
              <Input
                type="number"
                step="0.001"
                className="mt-1"
                placeholder="e.g., 5.500"
                value={formData.estimatedWeight}
                onChange={(e) => setFormData({ ...formData, estimatedWeight: e.target.value })}
              />
            </div>

            {['ring', 'other'].includes(formData.orderType) && (
              <div>
                <Label>Ring Size</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g., 16, 17, 18"
                  value={formData.ringSize}
                  onChange={(e) => setFormData({ ...formData, ringSize: e.target.value })}
                />
              </div>
            )}

            {['bangle', 'bracelet', 'other'].includes(formData.orderType) && (
              <div>
                <Label>Bangle Size</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g., 2.4, 2.6, 2.8"
                  value={formData.bangleSize}
                  onChange={(e) => setFormData({ ...formData, bangleSize: e.target.value })}
                />
              </div>
            )}

            {['necklace', 'chain', 'other'].includes(formData.orderType) && (
              <div>
                <Label>Chain Length</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g., 18 inches, 22 inches"
                  value={formData.chainLength}
                  onChange={(e) => setFormData({ ...formData, chainLength: e.target.value })}
                />
              </div>
            )}
          </div>

          {/* Stones */}
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="hasStones"
                checked={formData.hasStones}
                onChange={(e) => setFormData({ ...formData, hasStones: e.target.checked })}
                className="h-4 w-4 rounded"
              />
              <Label htmlFor="hasStones" className="cursor-pointer">
                This design includes stones/gems
              </Label>
            </div>

            {formData.hasStones && (
              <div>
                <Label>Stone Details (JSON format)</Label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md mt-1 font-mono text-sm"
                  placeholder='[{"type": "diamond", "count": 1, "carat": 0.5, "quality": "VS1"}]'
                  value={formData.stoneDetails}
                  onChange={(e) => setFormData({ ...formData, stoneDetails: e.target.value })}
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Specify stone type, count, weight/carat, and quality
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Notes */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Additional Notes</h2>
          <textarea
            className="w-full px-3 py-2 border rounded-md min-h-[80px]"
            placeholder="Any additional notes or special instructions..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Link href="/custom-orders">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading || !selectedCustomer}>
            {loading ? (
              <>
                <span className="animate-spin mr-2">...</span>
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Custom Order
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
