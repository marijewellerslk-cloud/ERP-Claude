'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save } from 'lucide-react';
import apiClient from '@/lib/api-client';

export default function NewKarigarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    specialization: '',
    baseLabourRate: '',
    wastageAllowance: '2.00',
    notes: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: formData.name,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        specialization: formData.specialization || undefined,
        baseLabourRate: formData.baseLabourRate ? parseFloat(formData.baseLabourRate) : undefined,
        wastageAllowance: formData.wastageAllowance ? parseFloat(formData.wastageAllowance) : undefined,
        notes: formData.notes || undefined,
      };

      const response = await apiClient.post('/karigars', payload);

      if (response.data.success) {
        router.push(`/karigars/${response.data.data.id}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create karigar');
    } finally {
      setLoading(false);
    }
  };

  const specializations = [
    'Rings',
    'Chains',
    'Bangles',
    'Necklaces',
    'Earrings',
    'Pendants',
    'Bracelets',
    'Custom Work',
    'Stone Setting',
    'Polishing',
    'General',
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push('/karigars')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Add New Karigar</h1>
          <p className="text-gray-500 mt-1">Register a new artisan in the system</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="font-medium text-lg">Basic Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Karigar name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Contact number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Workshop address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialization">Specialization</Label>
              <select
                id="specialization"
                name="specialization"
                value={formData.specialization}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Select specialization</option>
                {specializations.map((spec) => (
                  <option key={spec} value={spec.toLowerCase()}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t pt-6 space-y-4">
            <h3 className="font-medium text-lg">Rates & Allowances</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="baseLabourRate">Base Labour Rate (per gram)</Label>
                <Input
                  id="baseLabourRate"
                  name="baseLabourRate"
                  type="number"
                  step="0.01"
                  value={formData.baseLabourRate}
                  onChange={handleChange}
                  placeholder="e.g., 150.00"
                />
                <p className="text-xs text-gray-500">Default labour rate charged per gram</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wastageAllowance">Wastage Allowance (%)</Label>
                <Input
                  id="wastageAllowance"
                  name="wastageAllowance"
                  type="number"
                  step="0.01"
                  value={formData.wastageAllowance}
                  onChange={handleChange}
                  placeholder="e.g., 2.00"
                />
                <p className="text-xs text-gray-500">Acceptable metal loss percentage</p>
              </div>
            </div>
          </div>

          <div className="border-t pt-6 space-y-4">
            <h3 className="font-medium text-lg">Additional Notes</h3>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Any additional information about this karigar..."
              />
            </div>
          </div>

          <div className="border-t pt-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/karigars')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Creating...' : 'Create Karigar'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
