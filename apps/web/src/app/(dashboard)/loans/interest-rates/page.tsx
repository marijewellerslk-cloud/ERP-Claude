'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Settings,
  Plus,
  RefreshCw,
  AlertCircle,
  Edit2,
  Save,
  X,
  Percent,
  Calendar,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface InterestRate {
  id: string;
  rateName: string;
  minAmount: string;
  maxAmount: string | null;
  annualRate: string;
  monthlyRate: string;
  dailyRate: string;
  penaltyRate: string;
  maxLtv: string;
  maxTenureMonths: number;
  effectiveFrom: string;
  isActive: boolean;
  createdAt: string;
}

interface RateForm {
  rateName: string;
  minAmount: string;
  maxAmount: string;
  annualRate: string;
  penaltyRate: string;
  maxLtv: string;
  maxTenureMonths: string;
  effectiveFrom: string;
}

const emptyForm: RateForm = {
  rateName: '',
  minAmount: '',
  maxAmount: '',
  annualRate: '',
  penaltyRate: '2',
  maxLtv: '75',
  maxTenureMonths: '12',
  effectiveFrom: new Date().toISOString().split('T')[0],
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  const day = date.getDate().toString().padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export default function InterestRatesPage() {
  const [rates, setRates] = useState<InterestRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<RateForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/pawning/interest-rates');
      if (response.data.success) {
        setRates(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch interest rates:', err);
      setError('Failed to load interest rates.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        rateName: formData.rateName,
        minAmount: parseFloat(formData.minAmount) || 0,
        maxAmount: formData.maxAmount ? parseFloat(formData.maxAmount) : undefined,
        annualRate: parseFloat(formData.annualRate) || 0,
        penaltyRate: parseFloat(formData.penaltyRate) || 2,
        maxLtv: parseFloat(formData.maxLtv) || 75,
        maxTenureMonths: parseInt(formData.maxTenureMonths) || 12,
        effectiveFrom: formData.effectiveFrom,
      };

      if (editingId) {
        await apiClient.put(`/pawning/interest-rates/${editingId}`, payload);
      } else {
        await apiClient.post('/pawning/interest-rates', payload);
      }

      setShowForm(false);
      setEditingId(null);
      setFormData(emptyForm);
      await fetchRates();
    } catch (err: any) {
      console.error('Failed to save interest rate:', err);
      setError(err.response?.data?.error?.message || 'Failed to save interest rate.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (rate: InterestRate) => {
    setEditingId(rate.id);
    setFormData({
      rateName: rate.rateName,
      minAmount: rate.minAmount,
      maxAmount: rate.maxAmount || '',
      annualRate: rate.annualRate,
      penaltyRate: rate.penaltyRate,
      maxLtv: rate.maxLtv,
      maxTenureMonths: rate.maxTenureMonths.toString(),
      effectiveFrom: rate.effectiveFrom?.split('T')[0] || '',
    });
    setShowForm(true);
  };

  const handleToggleActive = async (rate: InterestRate) => {
    try {
      await apiClient.put(`/pawning/interest-rates/${rate.id}`, {
        isActive: !rate.isActive,
      });
      await fetchRates();
    } catch (err) {
      console.error('Failed to toggle rate:', err);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
    setError(null);
  };

  const calculatedMonthly = formData.annualRate
    ? (parseFloat(formData.annualRate) / 12).toFixed(4)
    : '0.0000';
  const calculatedDaily = formData.annualRate
    ? (parseFloat(formData.annualRate) / 365).toFixed(6)
    : '0.000000';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Interest Rate Configuration</h1>
          <p className="text-gray-500 mt-1">Configure rate slabs for gold pawning loans</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRates}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {!showForm && (
            <Button onClick={() => { setShowForm(true); setEditingId(null); setFormData(emptyForm); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rate Slab
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </Card>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingId ? 'Edit Interest Rate Slab' : 'New Interest Rate Slab'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rateName">Rate Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="rateName"
                    placeholder="e.g., Standard Gold Loan"
                    value={formData.rateName}
                    onChange={(e) => setFormData({ ...formData, rateName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="annualRate">Annual Rate (%) <span className="text-red-500">*</span></Label>
                  <Input
                    id="annualRate"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 12.5"
                    value={formData.annualRate}
                    onChange={(e) => setFormData({ ...formData, annualRate: e.target.value })}
                    required
                  />
                  <p className="text-xs text-gray-500">
                    Monthly: {calculatedMonthly}% | Daily: {calculatedDaily}%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minAmount">Min Loan Amount (Rs) <span className="text-red-500">*</span></Label>
                  <Input
                    id="minAmount"
                    type="number"
                    step="1"
                    placeholder="0"
                    value={formData.minAmount}
                    onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxAmount">Max Loan Amount (Rs)</Label>
                  <Input
                    id="maxAmount"
                    type="number"
                    step="1"
                    placeholder="Leave blank for unlimited"
                    value={formData.maxAmount}
                    onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="penaltyRate">Penalty Rate (%)</Label>
                  <Input
                    id="penaltyRate"
                    type="number"
                    step="0.01"
                    placeholder="2"
                    value={formData.penaltyRate}
                    onChange={(e) => setFormData({ ...formData, penaltyRate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxLtv">Max LTV (%) <span className="text-red-500">*</span></Label>
                  <Input
                    id="maxLtv"
                    type="number"
                    step="0.1"
                    placeholder="75"
                    value={formData.maxLtv}
                    onChange={(e) => setFormData({ ...formData, maxLtv: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxTenureMonths">Max Tenure (months)</Label>
                  <Input
                    id="maxTenureMonths"
                    type="number"
                    placeholder="12"
                    value={formData.maxTenureMonths}
                    onChange={(e) => setFormData({ ...formData, maxTenureMonths: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="effectiveFrom">Effective From <span className="text-red-500">*</span></Label>
                <Input
                  id="effectiveFrom"
                  type="date"
                  value={formData.effectiveFrom}
                  onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                  required
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {editingId ? 'Update Rate' : 'Create Rate'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Rates Table */}
      {rates.length === 0 ? (
        <Card className="p-12 text-center">
          <Percent className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No interest rate slabs configured</p>
          {!showForm && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Rate Slab
            </Button>
          )}
        </Card>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rate Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Loan Range
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Annual Rate
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Penalty
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Max LTV
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tenure
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Effective From
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rates.map((rate) => (
                  <tr key={rate.id} className={`hover:bg-gray-50 ${!rate.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{rate.rateName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatCurrency(rate.minAmount)}
                        {rate.maxAmount ? ` - ${formatCurrency(rate.maxAmount)}` : '+'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-bold text-blue-600">{parseFloat(rate.annualRate).toFixed(2)}%</span>
                      <div className="text-xs text-gray-400">
                        {parseFloat(rate.monthlyRate).toFixed(2)}%/mo
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm text-red-600">{parseFloat(rate.penaltyRate).toFixed(2)}%</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-medium">{parseFloat(rate.maxLtv).toFixed(0)}%</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm">{rate.maxTenureMonths} months</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-gray-400" />
                        {formatDate(rate.effectiveFrom)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button onClick={() => handleToggleActive(rate)}>
                        {rate.isActive ? (
                          <Badge className="bg-green-100 text-green-800 cursor-pointer hover:bg-green-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600 cursor-pointer hover:bg-gray-200">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(rate)}>
                        <Edit2 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
