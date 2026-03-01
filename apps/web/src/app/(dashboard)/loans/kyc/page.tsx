'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import {
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Search,
  Check,
  X,
  CreditCard,
  FileText,
  UserCheck,
  Loader2,
} from 'lucide-react';

interface KycLoan {
  loanId: string;
  loanNumber: string;
  loanAmount: number | string;
  loanStatus: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  kycId: string;
  kycStatus: string;
  aadhaarVerified: boolean;
  panVerified: boolean;
  applicationDate: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function getKycStatusBadge(status: string) {
  switch (status.toLowerCase()) {
    case 'verified':
      return <Badge className="bg-green-100 text-green-800 border-green-200">Verified</Badge>;
    case 'partial':
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Partial</Badge>;
    case 'pending':
      return <Badge className="bg-red-100 text-red-800 border-red-200">Pending</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function KycVerificationPage() {
  const [loans, setLoans] = useState<KycLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [verifyingMap, setVerifyingMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    fetchPendingLoans();
  }, []);

  const fetchPendingLoans = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/pawning/kyc/pending-loans');
      if (response.data.success) {
        setLoans(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch KYC pending loans:', err);
      setError('Failed to load KYC data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (kycId: string, field: 'aadhaar' | 'pan') => {
    const mapKey = `${kycId}-${field}`;
    setVerifyingMap((prev) => ({ ...prev, [mapKey]: field }));
    try {
      const response = await apiClient.post(`/pawning/kyc/${kycId}/verify`, { field });
      if (response.data.success) {
        setLoans((prev) =>
          prev.map((loan) => {
            if (loan.kycId !== kycId) return loan;
            const updated = { ...loan };
            if (field === 'aadhaar') updated.aadhaarVerified = true;
            if (field === 'pan') updated.panVerified = true;
            if (updated.aadhaarVerified && updated.panVerified) {
              updated.kycStatus = 'verified';
            } else if (updated.aadhaarVerified || updated.panVerified) {
              updated.kycStatus = 'partial';
            }
            return updated;
          })
        );
      }
    } catch (err) {
      console.error(`Failed to verify ${field}:`, err);
      alert(`Failed to verify ${field}. Please try again.`);
    } finally {
      setVerifyingMap((prev) => {
        const next = { ...prev };
        delete next[mapKey];
        return next;
      });
    }
  };

  const filteredLoans = loans.filter((loan) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      loan.loanNumber.toLowerCase().includes(query) ||
      loan.customerName.toLowerCase().includes(query) ||
      loan.customerPhone.includes(query)
    );
  });

  const stats = {
    totalPending: loans.length,
    aadhaarPending: loans.filter((l) => !l.aadhaarVerified).length,
    panPending: loans.filter((l) => !l.panVerified).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-gray-600">{error}</p>
        <Button onClick={fetchPendingLoans}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">KYC Verification</h1>
          <p className="text-gray-500 mt-1">
            {stats.totalPending} pending verification{stats.totalPending !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" onClick={fetchPendingLoans}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Pending</p>
              <p className="text-2xl font-bold mt-1 text-red-600">{stats.totalPending}</p>
            </div>
            <ShieldCheck className="h-8 w-8 text-red-600" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Aadhaar Pending</p>
              <p className="text-2xl font-bold mt-1 text-amber-600">{stats.aadhaarPending}</p>
            </div>
            <CreditCard className="h-8 w-8 text-amber-600" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">PAN Pending</p>
              <p className="text-2xl font-bold mt-1 text-amber-600">{stats.panPending}</p>
            </div>
            <FileText className="h-8 w-8 text-amber-600" />
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by loan number, name, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* KYC Table */}
      {filteredLoans.length === 0 ? (
        <Card className="p-12 text-center">
          <UserCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchQuery ? 'No loans match your search' : 'No pending KYC verifications'}
          </p>
        </Card>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Loan Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Loan Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    KYC Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aadhaar
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PAN
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Application Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLoans.map((loan) => (
                  <tr key={loan.kycId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{loan.loanNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{loan.customerName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {loan.customerPhone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(loan.loanAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getKycStatusBadge(loan.kycStatus)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {loan.aadhaarVerified ? (
                        <Check className="h-5 w-5 text-green-600 mx-auto" />
                      ) : (
                        <X className="h-5 w-5 text-red-400 mx-auto" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {loan.panVerified ? (
                        <Check className="h-5 w-5 text-green-600 mx-auto" />
                      ) : (
                        <X className="h-5 w-5 text-red-400 mx-auto" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(loan.applicationDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!loan.aadhaarVerified && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!!verifyingMap[`${loan.kycId}-aadhaar`]}
                            onClick={() => handleVerify(loan.kycId, 'aadhaar')}
                          >
                            {verifyingMap[`${loan.kycId}-aadhaar`] ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <CreditCard className="h-4 w-4 mr-1" />
                            )}
                            Aadhaar
                          </Button>
                        )}
                        {!loan.panVerified && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!!verifyingMap[`${loan.kycId}-pan`]}
                            onClick={() => handleVerify(loan.kycId, 'pan')}
                          >
                            {verifyingMap[`${loan.kycId}-pan`] ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <FileText className="h-4 w-4 mr-1" />
                            )}
                            PAN
                          </Button>
                        )}
                        {loan.aadhaarVerified && loan.panVerified && (
                          <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                            <Check className="h-4 w-4" />
                            Complete
                          </span>
                        )}
                      </div>
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
