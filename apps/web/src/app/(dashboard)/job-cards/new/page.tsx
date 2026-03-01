'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Scale, Search } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface Karigar {
  id: string;
  code: string;
  name: string;
  specialization: string | null;
  baseLabourRate: string | null;
  goldBalance: string;
}

interface CustomOrder {
  id: string;
  orderNumber: string;
  customerName: string | null;
  description: string | null;
  estimatedMetalWeight: string | null;
}

export default function NewJobCardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedKarigarId = searchParams.get('karigarId');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [karigars, setKarigars] = useState<Karigar[]>([]);
  const [customOrders, setCustomOrders] = useState<CustomOrder[]>([]);
  const [searchKarigar, setSearchKarigar] = useState('');
  const [selectedKarigar, setSelectedKarigar] = useState<Karigar | null>(null);

  const [formData, setFormData] = useState({
    karigarId: preselectedKarigarId || '',
    customOrderId: '',
    metalIssued: '',
    metalPurity: '22K',
    description: '',
    notes: '',
  });

  useEffect(() => {
    fetchKarigars();
    fetchCustomOrders();
  }, []);

  useEffect(() => {
    if (preselectedKarigarId && karigars.length > 0) {
      const karigar = karigars.find((k) => k.id === preselectedKarigarId);
      if (karigar) {
        setSelectedKarigar(karigar);
        setFormData((prev) => ({ ...prev, karigarId: karigar.id }));
      }
    }
  }, [preselectedKarigarId, karigars]);

  const fetchKarigars = async () => {
    try {
      const response = await apiClient.get('/karigars', {
        params: { status: 'active', limit: 100 },
      });
      if (response.data.success) {
        setKarigars(response.data.data);
      }
    } catch (err) {
      console.error('Failed to load karigars');
    }
  };

  const fetchCustomOrders = async () => {
    try {
      const response = await apiClient.get('/custom-orders', {
        params: { status: 'approved', limit: 50 },
      });
      if (response.data.success) {
        setCustomOrders(response.data.data);
      }
    } catch (err) {
      // Custom orders are optional
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'karigarId') {
      const karigar = karigars.find((k) => k.id === value);
      setSelectedKarigar(karigar || null);
    }

    if (name === 'customOrderId' && value) {
      const order = customOrders.find((o) => o.id === value);
      if (order?.estimatedMetalWeight) {
        setFormData((prev) => ({
          ...prev,
          customOrderId: value,
          metalIssued: order.estimatedMetalWeight || '',
          description: order.description || '',
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        karigarId: formData.karigarId,
        customOrderId: formData.customOrderId || undefined,
        metalIssued: parseFloat(formData.metalIssued),
        metalPurity: formData.metalPurity,
        description: formData.description || undefined,
        notes: formData.notes || undefined,
      };

      const response = await apiClient.post('/job-cards', payload);

      if (response.data.success) {
        router.push(`/job-cards/${response.data.data.id}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create job card');
    } finally {
      setLoading(false);
    }
  };

  const filteredKarigars = karigars.filter(
    (k) =>
      k.name.toLowerCase().includes(searchKarigar.toLowerCase()) ||
      k.code.toLowerCase().includes(searchKarigar.toLowerCase())
  );

  const purities = ['24K', '22K', '21K', '18K', '14K', '9K'];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Job Card</h1>
          <p className="text-gray-500 mt-1">Issue metal to a karigar for manufacturing</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-6">
          {/* Karigar Selection */}
          <div className="space-y-4">
            <h3 className="font-medium text-lg">Select Karigar</h3>

            {selectedKarigar ? (
              <div className="border rounded-lg p-4 bg-amber-50">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-lg">{selectedKarigar.name}</p>
                    <p className="text-sm text-gray-500">
                      Code: {selectedKarigar.code} | Specialization:{' '}
                      {selectedKarigar.specialization || 'General'}
                    </p>
                    <p className="text-sm text-amber-600 mt-1">
                      Current Gold Balance: {parseFloat(selectedKarigar.goldBalance).toFixed(3)}g
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedKarigar(null);
                      setFormData((prev) => ({ ...prev, karigarId: '' }));
                    }}
                  >
                    Change
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 border rounded-md px-3 py-2">
                  <Search className="h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search karigar by name or code..."
                    className="flex-1 outline-none"
                    value={searchKarigar}
                    onChange={(e) => setSearchKarigar(e.target.value)}
                  />
                </div>
                <div className="max-h-60 overflow-y-auto border rounded-md">
                  {filteredKarigars.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">No karigars found</div>
                  ) : (
                    filteredKarigars.map((karigar) => (
                      <div
                        key={karigar.id}
                        className="p-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          setSelectedKarigar(karigar);
                          setFormData((prev) => ({ ...prev, karigarId: karigar.id }));
                          setSearchKarigar('');
                        }}
                      >
                        <p className="font-medium">{karigar.name}</p>
                        <p className="text-sm text-gray-500">
                          {karigar.code} | {karigar.specialization || 'General'} | Balance:{' '}
                          {parseFloat(karigar.goldBalance).toFixed(3)}g
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Custom Order Link (Optional) */}
          {customOrders.length > 0 && (
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-medium text-lg">Link to Custom Order (Optional)</h3>
              <div className="space-y-2">
                <Label htmlFor="customOrderId">Custom Order</Label>
                <select
                  id="customOrderId"
                  name="customOrderId"
                  value={formData.customOrderId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">No custom order</option>
                  {customOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.orderNumber} - {order.customerName || 'Walk-in'} (
                      {order.estimatedMetalWeight}g)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Metal Details */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="font-medium text-lg">Metal Issue Details</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="metalIssued">Metal Weight (grams) *</Label>
                <div className="relative">
                  <Input
                    id="metalIssued"
                    name="metalIssued"
                    type="number"
                    step="0.001"
                    value={formData.metalIssued}
                    onChange={handleChange}
                    required
                    placeholder="e.g., 10.500"
                    className="pr-8"
                  />
                  <Scale className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="metalPurity">Purity *</Label>
                <select
                  id="metalPurity"
                  name="metalPurity"
                  value={formData.metalPurity}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                >
                  {purities.map((purity) => (
                    <option key={purity} value={purity}>
                      {purity}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="e.g., Gold ring with stone setting"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Special instructions, deadline, etc."
              />
            </div>
          </div>

          {/* Summary */}
          {formData.metalIssued && selectedKarigar && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Issue Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p className="text-gray-500">Karigar:</p>
                <p>{selectedKarigar.name}</p>
                <p className="text-gray-500">Metal:</p>
                <p>
                  {formData.metalIssued}g ({formData.metalPurity})
                </p>
                <p className="text-gray-500">New Karigar Balance:</p>
                <p className="font-medium text-amber-600">
                  {(
                    parseFloat(selectedKarigar.goldBalance) + parseFloat(formData.metalIssued)
                  ).toFixed(3)}
                  g
                </p>
              </div>
            </div>
          )}

          <div className="border-t pt-6 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.karigarId || !formData.metalIssued}
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Creating...' : 'Create Job Card'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
