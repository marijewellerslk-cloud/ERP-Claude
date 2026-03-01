'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Edit, Building2, Mail, Phone, MapPin, Receipt } from 'lucide-react';
import apiClient from '@/lib/api-client';
import DualLedgerView from '@/components/suppliers/DualLedgerView';
import { formatCurrency } from '@/lib/currency';

interface Supplier {
  id: string;
  supplierCode: string;
  businessName: string;
  contactPersonName?: string;
  email?: string;
  phone: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNumber?: string;
  panNumber?: string;
  supplierType: string;
  specialization?: string[];
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
  defaultCreditDays?: number;
  creditLimit?: string;
  rating?: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  contacts?: {
    id: string;
    name: string;
    designation?: string;
    phone: string;
    email?: string;
    isPrimary: boolean;
  }[];
}

export default function SupplierDetailPage() {
  const router = useRouter();
  const params = useParams();
  const supplierId = params.id as string;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'ledger'>('details');

  useEffect(() => {
    fetchSupplier();
  }, [supplierId]);

  const fetchSupplier = async () => {
    try {
      const response = await apiClient.get(`/suppliers/${supplierId}`);
      if (response.data.success) {
        setSupplier(response.data.data);
      }
    } catch (error: any) {
      setError(error.response?.data?.error?.message || 'Failed to load supplier');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Supplier not found'}</p>
          <Button onClick={() => router.back()} className="mt-4" variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{supplier.businessName}</h1>
            <p className="text-sm text-gray-500 mt-1">Supplier Code: {supplier.supplierCode}</p>
          </div>
        </div>
        <Button onClick={() => router.push(`/suppliers/${supplierId}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'details'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <Building2 className="h-4 w-4" />
            Supplier Details
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'ledger'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <Receipt className="h-4 w-4" />
            Account Ledger
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'ledger' ? (
        <DualLedgerView supplierId={supplierId} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Business Name</p>
                <p className="font-medium">{supplier.businessName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Contact Person</p>
                <p className="font-medium">{supplier.contactPersonName || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Supplier Type</p>
                <p className="font-medium capitalize">{supplier.supplierType}</p>
              </div>
              {supplier.specialization && supplier.specialization.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600">Specialization</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {supplier.specialization.map((spec, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {supplier.rating && (
                <div>
                  <p className="text-sm text-gray-600">Rating</p>
                  <div className="flex items-center gap-1 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <span
                        key={i}
                        className={`text-lg ${i < supplier.rating! ? 'text-yellow-400' : 'text-gray-300'
                          }`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <span
                  className={`inline-flex px-2 py-1 rounded text-xs font-medium ${supplier.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}
                >
                  {supplier.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-medium">{supplier.phone}</p>
              </div>
              {supplier.whatsapp && (
                <div>
                  <p className="text-sm text-gray-600">WhatsApp</p>
                  <p className="font-medium">{supplier.whatsapp}</p>
                </div>
              )}
              {supplier.email && (
                <div>
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </p>
                  <p className="font-medium">{supplier.email}</p>
                </div>
              )}
              {supplier.address && (
                <div>
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Address
                  </p>
                  <p className="font-medium">{supplier.address}</p>
                  {(supplier.city || supplier.state || supplier.pincode) && (
                    <p className="text-sm text-gray-500">
                      {[supplier.city, supplier.state, supplier.pincode].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              )}

              {/* Additional Contacts */}
              {supplier.contacts && supplier.contacts.length > 0 && (
                <div className="pt-4 border-t mt-4">
                  <p className="text-sm font-medium text-gray-900 mb-3">Other Contacts</p>
                  <div className="grid gap-3">
                    {supplier.contacts.map((contact) => (
                      <div key={contact.id} className="bg-gray-50 p-3 rounded-md text-sm">
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <p className="font-medium text-gray-900">{contact.name}</p>
                            {contact.designation && (
                              <p className="text-gray-500 text-xs">{contact.designation}</p>
                            )}
                          </div>
                          {contact.isPrimary && (
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="text-gray-600 space-y-1">
                          <p className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            {contact.phone}
                          </p>
                          {contact.email && (
                            <p className="flex items-center gap-2">
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tax Information */}
          {(supplier.gstNumber || supplier.panNumber) && (
            <Card>
              <CardHeader>
                <CardTitle>Tax Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {supplier.gstNumber && (
                  <div>
                    <p className="text-sm text-gray-600">GST Number</p>
                    <p className="font-medium font-mono">{supplier.gstNumber}</p>
                  </div>
                )}
                {supplier.panNumber && (
                  <div>
                    <p className="text-sm text-gray-600">PAN Number</p>
                    <p className="font-medium font-mono">{supplier.panNumber}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Banking Information */}
          {(supplier.bankName || supplier.accountNumber || supplier.upiId) && (
            <Card>
              <CardHeader>
                <CardTitle>Banking Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {supplier.bankName && (
                  <div>
                    <p className="text-sm text-gray-600">Bank Name</p>
                    <p className="font-medium">{supplier.bankName}</p>
                  </div>
                )}
                {supplier.accountNumber && (
                  <div>
                    <p className="text-sm text-gray-600">Account Number</p>
                    <p className="font-medium font-mono">{supplier.accountNumber}</p>
                  </div>
                )}
                {supplier.ifscCode && (
                  <div>
                    <p className="text-sm text-gray-600">IFSC Code</p>
                    <p className="font-medium font-mono">{supplier.ifscCode}</p>
                  </div>
                )}
                {supplier.upiId && (
                  <div>
                    <p className="text-sm text-gray-600">UPI ID</p>
                    <p className="font-medium font-mono">{supplier.upiId}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Credit Terms */}
          <Card>
            <CardHeader>
              <CardTitle>Credit Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Default Credit Days</p>
                <p className="font-medium">{supplier.defaultCreditDays || 0} days</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Credit Limit</p>
                <p className="font-medium">
                  {supplier.creditLimit
                    ? formatCurrency(supplier.creditLimit)
                    : 'Not set'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {supplier.notes && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{supplier.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Created At</p>
                <p className="font-medium">{new Date(supplier.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Last Updated</p>
                <p className="font-medium">{new Date(supplier.updatedAt).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
