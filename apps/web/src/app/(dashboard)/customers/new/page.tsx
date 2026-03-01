'use client';

import { useState } from 'react';
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
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

interface CustomerForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  dateOfBirth: string;
  anniversary: string;
  notes: string;
  whatsappOptIn: boolean;
  emailOptIn: boolean;
}

export default function NewCustomerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    whatsapp: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    dateOfBirth: '',
    anniversary: '',
    notes: '',
    whatsappOptIn: false,
    emailOptIn: true,
  });

  const handleChange = (field: keyof CustomerForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.firstName.trim()) {
      setError('First name is required');
      return;
    }

    if (!form.phone.trim()) {
      setError('Phone number is required');
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.post('/customers', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim() || form.phone.trim(),
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        pincode: form.pincode.trim() || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        anniversary: form.anniversary || undefined,
        notes: form.notes.trim() || undefined,
        whatsappOptIn: form.whatsappOptIn,
        emailOptIn: form.emailOptIn,
      });

      if (response.data.success) {
        router.push(`/customers/${response.data.data.id}`);
      } else {
        setError(response.data.error?.message || 'Failed to create customer');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add New Customer</h1>
          <p className="text-gray-500">Register a new customer in the system</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div>
            <h3 className="font-semibold mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  placeholder="Enter first name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  placeholder="Enter last name"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="font-semibold mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+94 XX XXX XXXX"
                  required
                />
              </div>
              <div>
                <Label htmlFor="whatsapp">WhatsApp Number</Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  value={form.whatsapp}
                  onChange={(e) => handleChange('whatsapp', e.target.value)}
                  placeholder="Same as phone if blank"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="customer@example.com"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="font-semibold mb-4">Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Enter street address"
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="Enter city"
                />
              </div>
              <div>
                <Label htmlFor="state">State/Province</Label>
                <Input
                  id="state"
                  value={form.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  placeholder="Enter state"
                />
              </div>
              <div>
                <Label htmlFor="pincode">Postal Code</Label>
                <Input
                  id="pincode"
                  value={form.pincode}
                  onChange={(e) => handleChange('pincode', e.target.value)}
                  placeholder="Enter postal code"
                />
              </div>
            </div>
          </div>

          {/* Important Dates */}
          <div>
            <h3 className="font-semibold mb-4">Important Dates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="anniversary">Anniversary</Label>
                <Input
                  id="anniversary"
                  type="date"
                  value={form.anniversary}
                  onChange={(e) => handleChange('anniversary', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Communication Preferences */}
          <div>
            <h3 className="font-semibold mb-4">Communication Preferences</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.whatsappOptIn}
                  onChange={(e) => handleChange('whatsappOptIn', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm">
                  Customer agrees to receive WhatsApp notifications (promotions, receipts, updates)
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.emailOptIn}
                  onChange={(e) => handleChange('emailOptIn', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm">
                  Customer agrees to receive email notifications
                </span>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Any additional notes about this customer..."
              className="w-full mt-1 p-3 border rounded-md resize-none h-24 text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Customer
                </>
              )}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
