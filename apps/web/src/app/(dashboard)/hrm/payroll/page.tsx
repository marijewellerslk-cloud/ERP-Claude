'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Wallet,
  CheckCircle,
  Clock,
  CreditCard,
  RefreshCw,
  Loader2,
  FileText,
  Calculator,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';

interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  month: number;
  year: number;
  baseSalary: string;
  workingDays: number;
  daysWorked: number;
  overtimeHours: string;
  overtimeAmount: string;
  bonus: string;
  allowances: string;
  deductions: string;
  epfEmployee: string;
  epfEmployer: string;
  etfEmployer: string;
  apit: string;
  advanceDeduction: string;
  bonusType: string;
  festiveBonusMonth: number | null;
  cycle: string;
  netSalary: string;
  status: string;
  paidAt: string | null;
  paymentMethod: string | null;
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function PayrollPage() {
  const currentDate = new Date();
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'weekly'>('monthly');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchPayroll();
  }, [selectedMonth, selectedYear, statusFilter, selectedCycle]);

  async function fetchPayroll() {
    try {
      setLoading(true);
      let url = `/hrm/payroll?month=${selectedMonth}&year=${selectedYear}&cycle=${selectedCycle}`;
      if (statusFilter !== 'all') {
        url += `&status=${statusFilter}`;
      }
      const response = await apiClient.get(url);
      setRecords(response.data?.data || []);
    } catch (error) {
      console.error('Error fetching payroll:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    try {
      setGenerating(true);
      await apiClient.post('/hrm/payroll/generate', {
        month: selectedMonth,
        year: selectedYear,
        cycle: selectedCycle,
      });
      await fetchPayroll();
    } catch (error: any) {
      console.error('Error generating payroll:', error);
      alert(error.response?.data?.error || 'Failed to generate payroll');
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove(payrollId: string) {
    try {
      setProcessingId(payrollId);
      await apiClient.put(`/hrm/payroll/${payrollId}/approve`);
      await fetchPayroll();
    } catch (error: any) {
      console.error('Error approving payroll:', error);
      alert(error.response?.data?.error || 'Failed to approve payroll');
    } finally {
      setProcessingId(null);
    }
  }

  async function handlePay(payrollId: string) {
    const paymentMethod = prompt('Enter payment method (cash/bank_transfer/cheque):');
    if (!paymentMethod || !['cash', 'bank_transfer', 'cheque'].includes(paymentMethod)) {
      alert('Invalid payment method');
      return;
    }

    const paymentReference = paymentMethod !== 'cash'
      ? prompt('Enter payment reference (transaction ID/cheque number):')
      : null;

    try {
      setProcessingId(payrollId);
      await apiClient.post(`/hrm/payroll/${payrollId}/pay`, {
        paymentMethod,
        paymentReference,
      });
      await fetchPayroll();
    } catch (error: any) {
      console.error('Error processing payment:', error);
      alert(error.response?.data?.error || 'Failed to process payment');
    } finally {
      setProcessingId(null);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'pending_approval':
        return <Badge className="bg-yellow-100 text-yellow-700">Pending Approval</Badge>;
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-700">Approved</Badge>;
      case 'paid':
        return <Badge className="bg-green-100 text-green-700">Paid</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Calculate totals
  const totalNetSalary = records.reduce(
    (sum, r) => sum + parseFloat(r.netSalary), 0
  );
  const paidCount = records.filter((r) => r.status === 'paid').length;
  const pendingCount = records.filter((r) => r.status !== 'paid').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payroll</h1>
          <p className="text-muted-foreground">
            Process monthly salaries for employees
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Calculator className="mr-2 h-4 w-4" />
          )}
          Generate Payroll
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <Select
              value={selectedMonth.toString()}
              onValueChange={(v) => setSelectedMonth(parseInt(v))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month, index) => (
                  <SelectItem key={month} value={(index + 1).toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedYear.toString()}
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedCycle}
              onValueChange={(v: 'monthly' | 'weekly') => setSelectedCycle(v)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Cycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={fetchPayroll}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payroll</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalNetSalary)}</div>
            <p className="text-xs text-muted-foreground">
              {records.length} employees
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{paidCount}</div>
            <p className="text-xs text-muted-foreground">Salaries paid</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Period</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {months[selectedMonth - 1].slice(0, 3)} {selectedYear}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Records */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No payroll records</h3>
            <p className="text-muted-foreground mb-4">
              Generate payroll for {months[selectedMonth - 1]} {selectedYear}
            </p>
            <Button onClick={handleGenerate} disabled={generating}>
              <Calculator className="mr-2 h-4 w-4" />
              Generate Payroll
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Payroll Records</CardTitle>
            <CardDescription>
              {months[selectedMonth - 1]} {selectedYear} - {records.length} employees
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium">Employee</th>
                    <th className="pb-3 font-medium text-center">Cycle</th>
                    <th className="pb-3 font-medium text-right">Base Salary</th>
                    <th className="pb-3 font-medium text-right">Bonus</th>
                    <th className="pb-3 font-medium text-right">Net Salary</th>
                    <th className="pb-3 font-medium text-center">Status</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b">
                      <td className="py-4">
                        <div>
                          <p className="font-medium">{record.employeeName}</p>
                          <p className="text-sm text-muted-foreground">
                            {record.employeeCode} - {record.department}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 text-center capitalize">
                        {record.cycle}
                      </td>
                      <td className="py-4 text-right">
                        {formatCurrency(parseFloat(record.baseSalary))}
                      </td>
                      <td className="py-4 text-right">
                        <div>{formatCurrency(parseFloat(record.bonus))}</div>
                        {record.bonusType === 'festive' && (
                          <div className="text-[10px] text-green-600 font-medium">Festive ({months[(record.festiveBonusMonth || 1) - 1]})</div>
                        )}
                      </td>
                      <td className="py-4 text-right font-semibold">
                        {formatCurrency(parseFloat(record.netSalary))}
                      </td>
                      <td className="py-4 text-center">
                        {getStatusBadge(record.status)}
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {record.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApprove(record.id)}
                              disabled={processingId === record.id}
                            >
                              {processingId === record.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {record.status === 'approved' && (
                            <Button
                              size="sm"
                              onClick={() => handlePay(record.id)}
                              disabled={processingId === record.id}
                            >
                              {processingId === record.id ? (
                                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                              ) : (
                                <CreditCard className="mr-1 h-4 w-4" />
                              )}
                              Pay
                            </Button>
                          )}
                          {record.status === 'paid' && (
                            <span className="text-sm text-muted-foreground">
                              Paid via {record.paymentMethod}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="pt-4" colSpan={5}>Total</td>
                    <td className="pt-4 text-right">{formatCurrency(totalNetSalary)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
