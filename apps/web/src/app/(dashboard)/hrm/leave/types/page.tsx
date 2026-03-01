'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Plus,
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface LeaveType {
  id: string;
  name: string;
  daysAllowed: number;
  isPaid: boolean;
  carryForward: boolean;
  maxCarryForward: number;
  isActive: boolean;
}

export default function LeaveTypesPage() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    daysAllowed: 12,
    isPaid: true,
    carryForward: false,
    maxCarryForward: 0,
  });

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  async function fetchLeaveTypes() {
    try {
      setLoading(true);
      const response = await apiClient.get('/hrm/leave-types');
      setLeaveTypes(response.data?.data || []);
    } catch (error) {
      console.error('Error fetching leave types:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!formData.name || formData.daysAllowed <= 0) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      await apiClient.post('/hrm/leave-types', formData);
      await fetchLeaveTypes();
      setDialogOpen(false);
      setFormData({
        name: '',
        daysAllowed: 12,
        isPaid: true,
        carryForward: false,
        maxCarryForward: 0,
      });
    } catch (error: any) {
      console.error('Error creating leave type:', error);
      alert(error.response?.data?.error || 'Failed to create leave type');
    } finally {
      setSaving(false);
    }
  }

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/hrm/leave">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Leave Types</h1>
            <p className="text-muted-foreground">
              Configure leave policies for your organization
            </p>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Leave Type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Leave Type</DialogTitle>
              <DialogDescription>
                Add a new type of leave for employees
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Leave Type Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Annual Leave, Sick Leave"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="daysAllowed">Days Allowed Per Year *</Label>
                <Input
                  id="daysAllowed"
                  type="number"
                  min="1"
                  value={formData.daysAllowed}
                  onChange={(e) => handleChange('daysAllowed', parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label>Is Paid Leave?</Label>
                <Select
                  value={formData.isPaid ? 'yes' : 'no'}
                  onValueChange={(v) => handleChange('isPaid', v === 'yes')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes - Paid Leave</SelectItem>
                    <SelectItem value="no">No - Unpaid Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Allow Carry Forward?</Label>
                <Select
                  value={formData.carryForward ? 'yes' : 'no'}
                  onValueChange={(v) => handleChange('carryForward', v === 'yes')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes - Allow Carry Forward</SelectItem>
                    <SelectItem value="no">No - Use It or Lose It</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.carryForward && (
                <div className="space-y-2">
                  <Label htmlFor="maxCarryForward">Maximum Days to Carry Forward</Label>
                  <Input
                    id="maxCarryForward"
                    type="number"
                    min="0"
                    value={formData.maxCarryForward}
                    onChange={(e) => handleChange('maxCarryForward', parseInt(e.target.value) || 0)}
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Leave Type'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Leave Types List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : leaveTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No leave types configured</h3>
            <p className="text-muted-foreground mb-4">
              Get started by adding your first leave type
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Leave Type
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {leaveTypes.map((type) => (
            <Card key={type.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{type.name}</CardTitle>
                    <CardDescription>
                      {type.daysAllowed} days per year
                    </CardDescription>
                  </div>
                  {type.isActive ? (
                    <Badge className="bg-green-100 text-green-700">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Payment</span>
                    <div className="flex items-center gap-1">
                      {type.isPaid ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-600">Paid</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-500">Unpaid</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Carry Forward</span>
                    <div className="flex items-center gap-1">
                      {type.carryForward ? (
                        <>
                          <RefreshCw className="h-4 w-4 text-blue-600" />
                          <span className="text-sm text-blue-600">
                            Up to {type.maxCarryForward} days
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-500">No</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Default Leave Types Suggestion */}
      {leaveTypes.length === 0 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Suggested Leave Types</CardTitle>
            <CardDescription>
              Common leave types you might want to add
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
              {[
                { name: 'Annual Leave', days: 12, paid: true },
                { name: 'Sick Leave', days: 10, paid: true },
                { name: 'Casual Leave', days: 6, paid: true },
                { name: 'Unpaid Leave', days: 30, paid: false },
              ].map((suggestion) => (
                <Button
                  key={suggestion.name}
                  variant="outline"
                  className="justify-start"
                  onClick={() => {
                    setFormData({
                      name: suggestion.name,
                      daysAllowed: suggestion.days,
                      isPaid: suggestion.paid,
                      carryForward: false,
                      maxCarryForward: 0,
                    });
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {suggestion.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
