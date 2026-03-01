'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  ArrowLeft,
  FileText,
  User,
  Package,
  CreditCard,
  Loader2,
  Calendar,
  DollarSign,
  Phone,
  Mail,
  CheckCircle,
  Clock,
  XCircle,
  Plus,
  Printer,
  Download,
} from 'lucide-react';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  customerCode: string;
}

interface InvoiceItem {
  id: string;
  itemDescription: string;
  quantity: number;
  unitPrice: string;
  makingCharges: string;
  wastageCharges: string;
  discount: string;
  taxRate: string;
  lineTotal: string;
  goldWeight?: string;
  goldPurity?: string;
}

interface Payment {
  id: string;
  paymentMethod: string;
  amount: string;
  transactionReference?: string;
  notes?: string;
  paymentDate: string;
  createdAt: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerId?: string;
  totalAmount: string;
  discountAmount: string;
  taxAmount: string;
  finalAmount: string;
  paymentStatus: string;
  notes?: string;
  purchaseOccasion?: string;
  loyaltyPointsEarned?: string;
  loyaltyPointsRedeemed?: string;
  createdAt: string;
  customer?: Customer;
  items: InvoiceItem[];
  payments: Payment[];
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-red-100 text-red-800',
};

const PAYMENT_STATUS_ICONS: Record<string, any> = {
  paid: CheckCircle,
  partial: Clock,
  pending: XCircle,
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.invoiceId as string;
  const receiptRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [paymentData, setPaymentData] = useState({
    paymentMethod: 'cash',
    amount: '',
    transactionReference: '',
    notes: '',
  });

  const handlePrintReceipt = () => {
    if (!receiptRef.current) return;

    const printContent = receiptRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the receipt');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${invoice?.invoiceNumber}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 5mm;
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              line-height: 1.4;
              margin: 0;
              padding: 10px;
              max-width: 80mm;
            }
            .receipt-header {
              text-align: center;
              border-bottom: 1px dashed #000;
              padding-bottom: 10px;
              margin-bottom: 10px;
            }
            .store-name {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .store-info {
              font-size: 10px;
              color: #333;
            }
            .invoice-info {
              margin-bottom: 10px;
              border-bottom: 1px dashed #000;
              padding-bottom: 10px;
            }
            .customer-info {
              margin-bottom: 10px;
              border-bottom: 1px dashed #000;
              padding-bottom: 10px;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 10px;
            }
            .items-table th, .items-table td {
              padding: 3px 0;
              text-align: left;
            }
            .items-table th {
              border-bottom: 1px solid #000;
              font-size: 10px;
            }
            .items-table td.right, .items-table th.right {
              text-align: right;
            }
            .totals {
              border-top: 1px dashed #000;
              padding-top: 10px;
              margin-top: 10px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin: 3px 0;
            }
            .grand-total {
              font-size: 16px;
              font-weight: bold;
              border-top: 2px solid #000;
              padding-top: 5px;
              margin-top: 5px;
            }
            .payment-info {
              border-top: 1px dashed #000;
              padding-top: 10px;
              margin-top: 10px;
            }
            .footer {
              text-align: center;
              border-top: 1px dashed #000;
              padding-top: 10px;
              margin-top: 15px;
              font-size: 10px;
            }
            .thank-you {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = function() {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  };

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/sales/invoices/${invoiceId}`);
      if (response.data.success) {
        setInvoice(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invoice) return;

    const amount = parseFloat(paymentData.amount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const totalPaid = invoice.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const remaining = parseFloat(invoice.finalAmount) - totalPaid;

    if (amount > remaining) {
      alert(`Payment amount cannot exceed remaining balance of ${formatCurrency(remaining)}`);
      return;
    }

    try {
      setSubmitting(true);

      const response = await apiClient.post(`/sales/invoices/${invoiceId}/payments`, {
        paymentMethod: paymentData.paymentMethod,
        amount,
        transactionReference: paymentData.transactionReference || undefined,
        notes: paymentData.notes || undefined,
      });

      if (response.data.success) {
        alert('Payment added successfully!');
        setShowPaymentForm(false);
        setPaymentData({
          paymentMethod: 'cash',
          amount: '',
          transactionReference: '',
          notes: '',
        });
        fetchInvoice();
      } else {
        alert('Failed to add payment');
      }
    } catch (error: any) {
      console.error('Failed to add payment:', error);
      alert(error.response?.data?.error?.message || 'Failed to add payment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Invoice not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  const totalPaid = invoice.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const remaining = parseFloat(invoice.finalAmount) - totalPaid;

  const PaymentStatusIcon = PAYMENT_STATUS_ICONS[invoice.paymentStatus] || Clock;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
              <Badge className={PAYMENT_STATUS_COLORS[invoice.paymentStatus]}>
                <PaymentStatusIcon className="h-3 w-3 mr-1" />
                {invoice.paymentStatus.toUpperCase()}
              </Badge>
            </div>
            <p className="text-gray-500 mt-1">
              Invoice Date:{' '}
              {new Date(invoice.invoiceDate).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrintReceipt}>
            <Printer className="h-4 w-4 mr-2" />
            Print Receipt
          </Button>
          {invoice.paymentStatus !== 'paid' && (
            <Button onClick={() => setShowPaymentForm(!showPaymentForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Payment
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Invoice Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          {invoice.customer && (
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <User className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-lg">Customer Details</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium">
                    {invoice.customer.firstName} {invoice.customer.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Customer Code</p>
                  <p className="font-medium">{invoice.customer.customerCode}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-gray-400" />
                    <p className="font-medium">{invoice.customer.phone}</p>
                  </div>
                </div>
                {invoice.customer.email && (
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-gray-400" />
                      <p className="font-medium">{invoice.customer.email}</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Items */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-lg">Items</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold text-sm">Description</th>
                    <th className="text-center p-3 font-semibold text-sm">Qty</th>
                    <th className="text-right p-3 font-semibold text-sm">Unit Price</th>
                    <th className="text-right p-3 font-semibold text-sm">Making</th>
                    <th className="text-right p-3 font-semibold text-sm">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, index) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-3">
                        <p className="font-medium">{item.itemDescription}</p>
                        {item.goldWeight && item.goldPurity && (
                          <p className="text-xs text-gray-500 mt-1">
                            {item.goldWeight}g {item.goldPurity}
                          </p>
                        )}
                      </td>
                      <td className="p-3 text-center">{item.quantity}</td>
                      <td className="p-3 text-right">{formatCurrency(parseFloat(item.unitPrice))}</td>
                      <td className="p-3 text-right">
                        {formatCurrency(parseFloat(item.makingCharges))}
                      </td>
                      <td className="p-3 text-right font-semibold">
                        {formatCurrency(parseFloat(item.lineTotal))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-6 border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span>{formatCurrency(parseFloat(invoice.totalAmount))}</span>
              </div>
              {parseFloat(invoice.discountAmount) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount:</span>
                  <span>- {formatCurrency(parseFloat(invoice.discountAmount))}</span>
                </div>
              )}
              {parseFloat(invoice.taxAmount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax:</span>
                  <span>{formatCurrency(parseFloat(invoice.taxAmount))}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total:</span>
                <span className="text-green-600">
                  {formatCurrency(parseFloat(invoice.finalAmount))}
                </span>
              </div>
            </div>
          </Card>

          {/* Payment History */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-lg">Payment History</h3>
            </div>

            {invoice.payments.length > 0 ? (
              <div className="space-y-3">
                {invoice.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{formatCurrency(parseFloat(payment.amount))}</p>
                      <p className="text-sm text-gray-600">
                        {payment.paymentMethod.toUpperCase()}
                        {payment.transactionReference && ` - ${payment.transactionReference}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(payment.paymentDate).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-6">No payments recorded yet</p>
            )}
          </Card>
        </div>

        {/* Right Column - Summary & Actions */}
        <div className="space-y-6">
          {/* Payment Summary */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Payment Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-semibold">{formatCurrency(parseFloat(invoice.finalAmount))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Paid:</span>
                <span className="font-semibold text-green-600">{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex justify-between pt-3 border-t">
                <span className="font-semibold">Remaining:</span>
                <span className={`font-bold text-lg ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(remaining)}
                </span>
              </div>
            </div>
          </Card>

          {/* Add Payment Form */}
          {showPaymentForm && remaining > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Add Payment</h3>
              <form onSubmit={handleAddPayment} className="space-y-4">
                <div>
                  <Label>Payment Method</Label>
                  <Select
                    value={paymentData.paymentMethod}
                    onValueChange={(value) => setPaymentData({ ...paymentData, paymentMethod: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Amount (Rs)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Max: {formatCurrency(remaining)}
                  </p>
                </div>

                <div>
                  <Label>Transaction Reference</Label>
                  <Input
                    value={paymentData.transactionReference}
                    onChange={(e) => setPaymentData({ ...paymentData, transactionReference: e.target.value })}
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <Label>Notes</Label>
                  <Input
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                    placeholder="Optional notes"
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Add Payment'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPaymentForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Additional Info */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Additional Information</h3>
            <div className="space-y-3 text-sm">
              {invoice.purchaseOccasion && (
                <div>
                  <p className="text-gray-500">Purchase Occasion</p>
                  <p className="font-medium capitalize">{invoice.purchaseOccasion.replace('_', ' ')}</p>
                </div>
              )}
              {invoice.loyaltyPointsEarned && parseFloat(invoice.loyaltyPointsEarned) > 0 && (
                <div>
                  <p className="text-gray-500">Loyalty Points Earned</p>
                  <p className="font-medium text-green-600">{invoice.loyaltyPointsEarned} points</p>
                </div>
              )}
              {invoice.notes && (
                <div>
                  <p className="text-gray-500">Notes</p>
                  <p className="font-medium">{invoice.notes}</p>
                </div>
              )}
              <div>
                <p className="text-gray-500">Created At</p>
                <p className="font-medium">
                  {new Date(invoice.createdAt).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Hidden Receipt for Printing */}
      <div className="hidden">
        <div ref={receiptRef}>
          <div className="receipt-header">
            <div className="store-name">MARI JEWELLERS</div>
            <div className="store-info">
              Premium Gold & Diamond Jewellery<br />
              123 Jewellery Street, City<br />
              Phone: +94 11 234 5678<br />
              Email: info@marijewellers.com
            </div>
          </div>

          <div className="invoice-info">
            <div><strong>Invoice:</strong> {invoice.invoiceNumber}</div>
            <div><strong>Date:</strong> {new Date(invoice.invoiceDate).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}</div>
            <div><strong>Time:</strong> {new Date(invoice.createdAt).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}</div>
          </div>

          {invoice.customer && (
            <div className="customer-info">
              <div><strong>Customer:</strong></div>
              <div>{invoice.customer.firstName} {invoice.customer.lastName}</div>
              <div>Phone: {invoice.customer.phone}</div>
              <div>Code: {invoice.customer.customerCode}</div>
            </div>
          )}

          <table className="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="right">Qty</th>
                <th className="right">Price</th>
                <th className="right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={index}>
                  <td style={{ maxWidth: '120px', overflow: 'hidden' }}>
                    {item.itemDescription}
                    {item.goldWeight && item.goldPurity && (
                      <div style={{ fontSize: '9px', color: '#666' }}>
                        {item.goldWeight}g {item.goldPurity}
                      </div>
                    )}
                  </td>
                  <td className="right">{item.quantity}</td>
                  <td className="right">{parseFloat(item.unitPrice).toLocaleString('en-IN')}</td>
                  <td className="right">{parseFloat(item.lineTotal).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="totals">
            <div className="total-row">
              <span>Subtotal:</span>
              <span>Rs. {parseFloat(invoice.totalAmount).toLocaleString('en-IN')}</span>
            </div>
            {parseFloat(invoice.discountAmount) > 0 && (
              <div className="total-row">
                <span>Discount:</span>
                <span>- Rs. {parseFloat(invoice.discountAmount).toLocaleString('en-IN')}</span>
              </div>
            )}
            {parseFloat(invoice.taxAmount) > 0 && (
              <div className="total-row">
                <span>Tax:</span>
                <span>Rs. {parseFloat(invoice.taxAmount).toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="total-row grand-total">
              <span>TOTAL:</span>
              <span>Rs. {parseFloat(invoice.finalAmount).toLocaleString('en-IN')}</span>
            </div>
          </div>

          {invoice.payments.length > 0 && (
            <div className="payment-info">
              <div><strong>Payment Details:</strong></div>
              {invoice.payments.map((payment, index) => (
                <div key={index} className="total-row">
                  <span>{payment.paymentMethod.toUpperCase()}</span>
                  <span>Rs. {parseFloat(payment.amount).toLocaleString('en-IN')}</span>
                </div>
              ))}
              <div className="total-row" style={{ marginTop: '5px' }}>
                <span><strong>Total Paid:</strong></span>
                <span><strong>Rs. {totalPaid.toLocaleString('en-IN')}</strong></span>
              </div>
              {remaining > 0 && (
                <div className="total-row">
                  <span>Balance Due:</span>
                  <span>Rs. {remaining.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          )}

          <div className="footer">
            <div className="thank-you">Thank You!</div>
            <div>Please visit us again</div>
            <div style={{ marginTop: '5px' }}>
              Exchange Policy: 7 days with original receipt
            </div>
            <div style={{ marginTop: '10px', fontSize: '9px' }}>
              This is a computer generated receipt
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
