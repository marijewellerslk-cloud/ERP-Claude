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
  Wallet,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';

interface SalaryAdvance {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  amount: string;
  requestDate: string;
  reason: string | null;
  status: string;
  approvedAt: string | null;
  rejectionReason: string | null;
}

interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
}

export default function SalaryAdvancesPage() {
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const [formData, setFormData] = useState({
    employeeId: '',
    amount: '',
    reason: '',
  });

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  async function fetchData() {
    try {
      setLoading(true);
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const [advancesRes, employeesRes] = await Promise.all([
        apiClient.get(`/hrm/advances${params}`),
        apiClient.get('/hrm/employees?status=active'),
      ]);

      setAdvances(advancesRes.data?.data || []);
      setEmployees(employeesRes.data?.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!formData.employeeId || !formData.amount) {
      alert('Please select an employee and enter an amount');
      return;
    }

    try {
      setSaving(true);
      await apiClient.post('/hrm/advances', formData);
      await fetchData();
      setDialogOpen(false);
      setFormData({ employeeId: '', amount: '', reason: '' });
    } catch (error: any) {
      console.error('Error creating advance:', error);
      alert(error.response?.data?.error || 'Failed to create advance request');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(advanceId: string) {
    try {
      setProcessingId(advanceId);
      await apiClient.put(`/hrm/advances/${advanceId}/approve`);
      await fetchData();
    } catch (error: any) {
      console.error('Error approving advance:', error);
      alert(error.response?.data?.error || 'Failed to approve advance');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(advanceId: string) {
    const reason = prompt('Please enter the reason for rejection:');
    if (!reason) return;

    try {
      setProcessingId(advanceId);
      await apiClient.put(`/hrm/advances/${advanceId}/reject`, { reason });
      await fetchData();
    } catch (error: any) {
      console.error('Error rejecting advance:', error);
      alert(error.response?.data?.error || 'Failed to reject advance');
    } finally {
      setProcessingId(null);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-700">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700">Rejected</Badge>;
      case 'deducted':
        return <Badge className="bg-blue-100 text-blue-700">Deducted</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Calculate totals
  const pendingTotal = advances
    .filter((a) => a.status === 'pending')
    .reduce((sum, a) => sum + parseFloat(a.amount), 0);
  const approvedTotal = advances
    .filter((a) => a.status === 'approved')
    .reduce((sum, a) => sum + parseFloat(a.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/hrm">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Salary Advances</h1>
            <p className="text-muted-foreground">
              Manage employee salary advance requests
            </p>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Advance Request
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Salary Advance</DialogTitle>
              <DialogDescription>
                Create a new salary advance request for an employee
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Employee *</Label>
                <Select
                  value={formData.employeeId}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, employeeId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.employeeCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (Rs) *</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="e.g., 5000"
                  value={formData.amount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Input
                  id="reason"
                  placeholder="Optional reason for the advance"
                  value={formData.reason}
                  onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
                />
              </div>
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
                  'Create Request'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Advances</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(pendingTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {advances.filter((a) => a.status === 'pending').length} requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved (Pending Deduction)</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(approvedTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {advances.filter((a) => a.status === 'approved').length} advances
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{advances.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Requests</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="deducted">Deducted</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Advances List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : advances.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No advance requests</h3>
            <p className="text-muted-foreground mb-4">
              No salary advance requests found
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Advance Request
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {advances.map((advance) => (
            <Card key={advance.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Wallet className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{advance.employeeName}</h3>
                        <span className="text-sm text-muted-foreground">
                          ({advance.employeeCode})
                        </span>
                        {getStatusBadge(advance.status)}
                      </div>
                      <p className="text-2xl font-bold text-primary">
                        {formatCurrency(parseFloat(advance.amount))}
                      </p>
                      {advance.reason && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Reason: {advance.reason}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Requested on {new Date(advance.requestDate).toLocaleDateString()}
                      </p>
                      {advance.rejectionReason && (
                        <p className="mt-1 text-sm text-red-600">
                          Rejection: {advance.rejectionReason}
                        </p>
                      )}
                    </div>
                  </div>

                  {advance.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(advance.id)}
                        disabled={processingId === advance.id}
                      >
                        {processingId === advance.id ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="mr-1 h-4 w-4" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(advance.id)}
                        disabled={processingId === advance.id}
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {advance.status === 'approved' && (
                    <Badge variant="outline" className="text-green-600">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Will be deducted from payroll
                    </Badge>
                  )}

                  {advance.status === 'deducted' && (
                    <Badge variant="outline" className="text-blue-600">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Deducted from payroll
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
