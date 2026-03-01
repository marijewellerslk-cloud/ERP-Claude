'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { PageHeader } from '@/components/ui/page-header';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import {
  FileText,
  Plus,
  Search,
  Eye,
  Loader2,
  Filter,
  Calendar,
} from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerId?: string;
  customerName?: string;
  totalAmount: string;
  discountAmount: string;
  taxAmount: string;
  finalAmount: string;
  paymentStatus: string;
  notes?: string;
  createdAt: string;
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-red-100 text-red-800',
};

export default function InvoicesListPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchInvoices();
  }, [paymentStatusFilter, startDate, endDate]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (paymentStatusFilter && paymentStatusFilter !== 'all') {
        params.append('paymentStatus', paymentStatusFilter);
      }
      if (startDate) {
        params.append('startDate', startDate);
      }
      if (endDate) {
        params.append('endDate', endDate);
      }

      const response = await apiClient.get(`/sales/invoices?${params.toString()}`);
      if (response.data.success) {
        setInvoices(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (invoice.customerName &&
        invoice.customerName.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Invoices"
        description="View and manage all sales invoices"
      >
        <Link href="/sales/invoices/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        </Link>
      </PageHeader>

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by invoice number or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Payment Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={fetchInvoices}>
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">End Date</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Invoices Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredInvoices.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">{invoice.invoiceNumber}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-3 w-3" />
                      {new Date(invoice.invoiceDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{invoice.customerName || 'Walk-in Customer'}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-semibold">
                      {formatCurrency(parseFloat(invoice.finalAmount))}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      className={
                        PAYMENT_STATUS_COLORS[invoice.paymentStatus] || 'bg-gray-100 text-gray-800'
                      }
                    >
                      {invoice.paymentStatus.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Link href={`/sales/invoices/${invoice.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No invoices found</p>
            <p className="text-sm text-gray-400">Create your first invoice to get started</p>
            <Link href="/sales/invoices/new">
              <Button className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </Link>
          </div>
        )}
      </Card>

      {/* Summary Stats */}
      {filteredInvoices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <p className="text-sm text-gray-500">Total Invoices</p>
            <p className="text-2xl font-bold mt-1">{filteredInvoices.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-500">Total Amount</p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(
                filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.finalAmount), 0)
              )}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-500">Paid Invoices</p>
            <p className="text-2xl font-bold mt-1">
              {filteredInvoices.filter((inv) => inv.paymentStatus === 'paid').length}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
