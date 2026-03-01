'use client';

import { useState, useEffect } from 'react';
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
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Loader2,
  Plus,
  Edit,
  Save,
} from 'lucide-react';

interface GoldRate {
  id: string;
  date: string;
  goldType: string;
  purity: string;
  ratePerGram: string;
  createdBy: string;
  createdAt: string;
}

export default function GoldRatesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rates, setRates] = useState<GoldRate[]>([]);
  const [editMode, setEditMode] = useState(false);

  const [rateForm, setRateForm] = useState({
    goldType: 'gold',
    purity: '22K',
    ratePer8gSovereign: '',
  });

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/sales/gold-rates');
      if (response.data.success) {
        setRates(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch rates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRate = async (e: React.FormEvent) => {
    e.preventDefault();

    const ratePer8g = parseFloat(rateForm.ratePer8gSovereign);
    if (isNaN(ratePer8g) || ratePer8g <= 0) {
      alert('Please enter a valid rate');
      return;
    }

    // Convert 8g sovereign rate to per gram rate for backend
    const ratePerGram = ratePer8g / 8;

    try {
      setSaving(true);

      const response = await apiClient.post('/sales/gold-rates', {
        goldType: rateForm.goldType,
        purity: rateForm.purity,
        ratePerGram: ratePerGram,
      });

      if (response.data.success) {
        alert('Gold rate updated successfully!');
        setEditMode(false);
        setRateForm({ goldType: 'gold', purity: '22K', ratePer8gSovereign: '' });
        fetchRates();
      } else {
        alert('Failed to update rate');
      }
    } catch (error: any) {
      console.error('Failed to update rate:', error);
      alert(error.response?.data?.error?.message || 'Failed to update rate');
    } finally {
      setSaving(false);
    }
  };

  // Group rates by date
  const ratesByDate = rates.reduce((acc, rate) => {
    const dateKey = new Date(rate.date).toLocaleDateString('en-IN');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(rate);
    return acc;
  }, {} as Record<string, GoldRate[]>);

  // Get today's rates
  const today = new Date().toLocaleDateString('en-IN');
  const todaysRates = ratesByDate[today] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gold Rates</h1>
          <p className="text-gray-500 mt-1">Manage daily gold rates for different purities</p>
        </div>
        <Button onClick={() => setEditMode(!editMode)} variant={editMode ? 'outline' : 'default'}>
          {editMode ? (
            <>Cancel</>
          ) : (
            <>
              <Edit className="h-4 w-4 mr-2" />
              Update Rates
            </>
          )}
        </Button>
      </div>

      {/* Update Rate Form */}
      {editMode && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Update Gold Rate</h3>
          <form onSubmit={handleUpdateRate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Metal Type</Label>
                <Select
                  value={rateForm.goldType}
                  onValueChange={(value) => setRateForm({ ...rateForm, goldType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="platinum">Platinum</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Purity</Label>
                <Select
                  value={rateForm.purity}
                  onValueChange={(value) => setRateForm({ ...rateForm, purity: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24K">24K</SelectItem>
                    <SelectItem value="22K">22K</SelectItem>
                    <SelectItem value="18K">18K</SelectItem>
                    <SelectItem value="14K">14K</SelectItem>
                    <SelectItem value="10K">10K</SelectItem>
                    <SelectItem value="925">925 Silver</SelectItem>
                    <SelectItem value="950">950 Platinum</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Rate per 8g Sovereign (Rs)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={rateForm.ratePer8gSovereign}
                  onChange={(e) => setRateForm({ ...rateForm, ratePer8gSovereign: e.target.value })}
                  placeholder="0.00"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Enter rate for 8 grams (1 sovereign)</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> Updating a rate will replace the existing rate for today's date.
                Historical rates are preserved.
              </p>
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Update Rate
                </>
              )}
            </Button>
          </form>
        </Card>
      )}

      {/* Today's Rates */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold text-lg">Today's Rates</h3>
          <span className="text-sm text-gray-500">({today})</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : todaysRates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {todaysRates.map((rate) => {
              const ratePer8g = parseFloat(rate.ratePerGram) * 8;
              return (
                <Card key={rate.id} className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-600">
                        {rate.goldType.toUpperCase()} {rate.purity}
                      </p>
                      <p className="text-3xl font-bold text-yellow-700 mt-1">
                        {formatCurrency(ratePer8g)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">per 8g sovereign</p>
                      <p className="text-xs text-gray-400 mt-1">
                        ({formatCurrency(parseFloat(rate.ratePerGram))} per gram)
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-yellow-600" />
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <DollarSign className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="mb-2">No rates set for today</p>
            <p className="text-sm text-gray-400">Click "Update Rates" to set today's gold rates</p>
          </div>
        )}
      </Card>

      {/* Rate History */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-lg">Rate History</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : Object.keys(ratesByDate).length > 0 ? (
          <div className="space-y-6">
            {Object.entries(ratesByDate)
              .sort((a, b) => new Date(b[1][0].date).getTime() - new Date(a[1][0].date).getTime())
              .slice(0, 10)
              .map(([date, dayRates]) => (
                <div key={date}>
                  <h4 className="font-semibold text-gray-700 mb-3">{date}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {dayRates.map((rate) => {
                      const ratePer8g = parseFloat(rate.ratePerGram) * 8;
                      return (
                        <div
                          key={rate.id}
                          className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <p className="text-sm text-gray-600 mb-1">
                            {rate.goldType.toUpperCase()} {rate.purity}
                          </p>
                          <p className="text-xl font-bold">
                            {formatCurrency(ratePer8g)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">per 8g sovereign</p>
                          <p className="text-xs text-gray-400">
                            ({formatCurrency(parseFloat(rate.ratePerGram))} /g)
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>No rate history available</p>
          </div>
        )}
      </Card>
    </div>
  );
}
