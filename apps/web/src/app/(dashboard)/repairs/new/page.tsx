'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Search,
  User,
  Phone,
  Wrench,
  Save,
  AlertCircle,
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

const repairTypes = [
  { value: 'repair', label: 'General Repair' },
  { value: 'resize', label: 'Resizing' },
  { value: 'repolish', label: 'Repolishing' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'stone_replacement', label: 'Stone Replacement' },
  { value: 'chain_repair', label: 'Chain Repair' },
  { value: 'clasp_repair', label: 'Clasp Repair' },
  { value: 'engraving', label: 'Engraving' },
  { value: 'other', label: 'Other' },
];

const metalTypes = [
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'platinum', label: 'Platinum' },
  { value: 'other', label: 'Other' },
];

const priorities = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function NewRepairPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Customer selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    repairType: 'repair',
    priority: 'normal',
    itemDescription: '',
    metalType: '',
    purity: '',
    estimatedWeight: '',
    problemDescription: '',
    customerInstructions: '',
    expectedCompletionDate: '',
    notes: '',
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

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

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.firstName.toLowerCase().includes(customerSearch.toLowerCase()) ||
      customer.lastName.toLowerCase().includes(customerSearch.toLowerCase()) ||
      customer.phone.includes(customerSearch) ||
      customer.customerCode.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedCustomer) {
      setError('Please select a customer');
      return;
    }

    if (!formData.itemDescription.trim()) {
      setError('Please enter an item description');
      return;
    }

    if (!formData.problemDescription.trim()) {
      setError('Please describe the problem');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        customerId: selectedCustomer.id,
        repairType: formData.repairType,
        priority: formData.priority,
        itemDescription: formData.itemDescription,
        metalType: formData.metalType || undefined,
        purity: formData.purity || undefined,
        estimatedWeight: formData.estimatedWeight
          ? parseFloat(formData.estimatedWeight)
          : undefined,
        problemDescription: formData.problemDescription,
        customerInstructions: formData.customerInstructions || undefined,
        expectedCompletionDate: formData.expectedCompletionDate || undefined,
        notes: formData.notes || undefined,
      };

      const response = await apiClient.post('/repairs', payload);

      if (response.data.success) {
        router.push(`/repairs/${response.data.data.id}`);
      } else {
        setError(response.data.error?.message || 'Failed to create repair');
      }
    } catch (error: any) {
      console.error('Failed to create repair:', error);
      setError(error.response?.data?.error?.message || 'Failed to create repair');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/repairs">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">New Repair Request</h1>
          <p className="text-gray-500 mt-1">Create a new jewelry repair order</p>
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

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer Selection */}
          <Card className="p-6 lg:col-span-1">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer
            </h2>

            {selectedCustomer ? (
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-blue-600 font-medium">
                    {selectedCustomer.customerCode}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setShowCustomerSearch(true);
                    }}
                  >
                    Change
                  </Button>
                </div>
                <p className="font-semibold text-gray-900">
                  {selectedCustomer.firstName} {selectedCustomer.lastName}
                </p>
                <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                  <Phone className="h-3 w-3" />
                  {selectedCustomer.phone}
                </p>
                {selectedCustomer.email && (
                  <p className="text-sm text-gray-600 mt-1">{selectedCustomer.email}</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, phone, or code..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerSearch(true);
                    }}
                    onFocus={() => setShowCustomerSearch(true)}
                    className="pl-10"
                  />
                </div>

                {showCustomerSearch && customerSearch && (
                  <div className="border rounded-lg max-h-60 overflow-y-auto">
                    {filteredCustomers.length === 0 ? (
                      <p className="p-3 text-sm text-gray-500 text-center">
                        No customers found
                      </p>
                    ) : (
                      filteredCustomers.slice(0, 10).map((customer) => (
                        <div
                          key={customer.id}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setShowCustomerSearch(false);
                            setCustomerSearch('');
                          }}
                        >
                          <p className="font-medium">
                            {customer.firstName} {customer.lastName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {customer.phone} • {customer.customerCode}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Repair Details */}
          <Card className="p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Repair Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Repair Type */}
              <div className="space-y-2">
                <Label htmlFor="repairType">Repair Type *</Label>
                <select
                  id="repairType"
                  name="repairType"
                  value={formData.repairType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  {repairTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  {priorities.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Item Description */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="itemDescription">Item Description *</Label>
                <Input
                  id="itemDescription"
                  name="itemDescription"
                  value={formData.itemDescription}
                  onChange={handleInputChange}
                  placeholder="e.g., 22K Gold Chain Necklace, Diamond Ring"
                  required
                />
              </div>

              {/* Metal Type */}
              <div className="space-y-2">
                <Label htmlFor="metalType">Metal Type</Label>
                <select
                  id="metalType"
                  name="metalType"
                  value={formData.metalType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select metal type</option>
                  {metalTypes.map((metal) => (
                    <option key={metal.value} value={metal.value}>
                      {metal.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Purity */}
              <div className="space-y-2">
                <Label htmlFor="purity">Purity</Label>
                <Input
                  id="purity"
                  name="purity"
                  value={formData.purity}
                  onChange={handleInputChange}
                  placeholder="e.g., 22K, 18K, 916"
                />
              </div>

              {/* Estimated Weight */}
              <div className="space-y-2">
                <Label htmlFor="estimatedWeight">Estimated Weight (g)</Label>
                <Input
                  id="estimatedWeight"
                  name="estimatedWeight"
                  type="number"
                  step="0.001"
                  value={formData.estimatedWeight}
                  onChange={handleInputChange}
                  placeholder="e.g., 5.250"
                />
              </div>

              {/* Expected Completion Date */}
              <div className="space-y-2">
                <Label htmlFor="expectedCompletionDate">Expected Completion</Label>
                <Input
                  id="expectedCompletionDate"
                  name="expectedCompletionDate"
                  type="date"
                  value={formData.expectedCompletionDate}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Problem Description */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="problemDescription">Problem Description *</Label>
                <textarea
                  id="problemDescription"
                  name="problemDescription"
                  value={formData.problemDescription}
                  onChange={handleInputChange}
                  placeholder="Describe the issue with the item..."
                  className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                  required
                />
              </div>

              {/* Customer Instructions */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customerInstructions">Customer Instructions</Label>
                <textarea
                  id="customerInstructions"
                  name="customerInstructions"
                  value={formData.customerInstructions}
                  onChange={handleInputChange}
                  placeholder="Any specific instructions from the customer..."
                  className="w-full px-3 py-2 border rounded-md min-h-[80px]"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Internal Notes</Label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Notes for staff..."
                  className="w-full px-3 py-2 border rounded-md min-h-[80px]"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4 mt-6">
          <Link href="/repairs">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading || !selectedCustomer}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Creating...' : 'Create Repair Request'}
          </Button>
        </div>
      </form>
    </div>
  );
}
