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
import { ArrowLeft, Users, Loader2 } from 'lucide-react';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  customerCode: string;
}

interface CustomerOption {
  id: string;
  name: string;
  customerCode: string;
}

export default function AddReferralPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.customerId as string;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [referrer, setReferrer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedReferredId, setSelectedReferredId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch referrer details
        const referrerRes = await apiClient.get(`/customers/${customerId}`);
        if (referrerRes.data.success) {
          setReferrer(referrerRes.data.data);
        }

        // Fetch all customers for selection
        const customersRes = await apiClient.get('/customers');
        if (customersRes.data.success) {
          const allCustomers = customersRes.data.data;
          const customerOptions = allCustomers
            .filter((c: any) => c.id !== customerId) // Exclude the referrer
            .map((c: any) => ({
              id: c.id,
              name: `${c.firstName} ${c.lastName}`,
              customerCode: c.customerCode,
            }));
          setCustomers(customerOptions);
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

    if (!selectedReferredId) {
      alert('Please select a referred customer');
      return;
    }

    try {
      setSubmitting(true);

      const response = await apiClient.post(`/customers/${customerId}/referrals`, {
        referredCustomerId: selectedReferredId,
      });

      if (response.data.success) {
        alert('Referral recorded successfully!');
        router.back();
      } else {
        alert('Failed to record referral');
      }
    } catch (error: any) {
      console.error('Failed to record referral:', error);
      alert(error.response?.data?.error?.message || 'Failed to record referral');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.customerCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Record Referral</h1>
          <p className="text-gray-500">
            {referrer && `${referrer.firstName} ${referrer.lastName} (${referrer.customerCode})`}
          </p>
        </div>
      </div>

      {/* Form */}
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="referrer">Referrer (Current Customer)</Label>
            <Input
              id="referrer"
              value={referrer ? `${referrer.firstName} ${referrer.lastName}` : ''}
              disabled
              className="bg-gray-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="search">Search Referred Customer</Label>
            <Input
              id="search"
              placeholder="Search by name or customer code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="referred">Referred Customer *</Label>
            <Select value={selectedReferredId} onValueChange={setSelectedReferredId}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer who was referred" />
              </SelectTrigger>
              <SelectContent>
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} ({customer.customerCode})
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-sm text-gray-500">No customers found</div>
                )}
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500">
              Select the customer who was referred by {referrer?.firstName}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Referral Rewards</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Referrer earns 500 bonus points when the referred customer makes their first purchase ≥ Rs 5,000</li>
              <li>• Both customers receive a 5% discount coupon valid for 30 days</li>
              <li>• Referral must qualify within 90 days</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={submitting || !selectedReferredId}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 mr-2" />
                  Record Referral
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
