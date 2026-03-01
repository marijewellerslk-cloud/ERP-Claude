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
  Gavel,
  RefreshCw,
  AlertCircle,
  Search,
  CheckCircle2,
  Clock,
  IndianRupee,
  Eye,
} from 'lucide-react';

interface AuctionEntry {
  auction: {
    id: string;
    auctionStatus: string;
    initiationDate: string;
    releaseDeadline: string;
    reservePrice: number | string;
    finalSalePrice: number | string | null;
    buyerName: string | null;
    surplusAmount: number | string | null;
    deficitAmount: number | string | null;
  };
  loan: {
    id: string;
    loanNumber: string;
    loanAmount: number | string;
    outstandingBalance: number | string;
  };
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
  };
}

type FilterTab = 'all' | 'initiated' | 'completed';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function getStatusBadge(status: string) {
  switch (status.toLowerCase()) {
    case 'initiated':
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Initiated</Badge>;
    case 'completed':
      return <Badge className="bg-green-100 text-green-800 border-green-200">Completed</Badge>;
    case 'cancelled':
      return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Cancelled</Badge>;
    case 'pending':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Pending</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function AuctionsPage() {
  const [auctions, setAuctions] = useState<AuctionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAuctions();
  }, []);

  const fetchAuctions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/pawning/auctions');
      if (response.data.success) {
        setAuctions(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch auctions:', err);
      setError('Failed to load auctions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredAuctions = auctions.filter((entry) => {
    const matchesTab =
      activeTab === 'all' ||
      entry.auction.auctionStatus.toLowerCase() === activeTab;

    const matchesSearch =
      !searchQuery ||
      entry.loan.loanNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${entry.customer.firstName} ${entry.customer.lastName}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      entry.customer.phone.includes(searchQuery);

    return matchesTab && matchesSearch;
  });

  const stats = {
    total: auctions.length,
    active: auctions.filter((e) => e.auction.auctionStatus.toLowerCase() === 'initiated').length,
    completed: auctions.filter((e) => e.auction.auctionStatus.toLowerCase() === 'completed').length,
    totalRecovered: auctions
      .filter((e) => e.auction.finalSalePrice)
      .reduce((sum, e) => sum + parseFloat(String(e.auction.finalSalePrice || 0)), 0),
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
        <Button onClick={fetchAuctions}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Auction Management</h1>
          <p className="text-gray-500 mt-1">Manage defaulted loan auctions and recovery</p>
        </div>
        <Button variant="outline" onClick={fetchAuctions}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'initiated', 'completed'] as FilterTab[]).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Button>
        ))}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Auctions</p>
              <p className="text-2xl font-bold mt-1">{stats.total}</p>
            </div>
            <Gavel className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-2xl font-bold mt-1 text-amber-600">{stats.active}</p>
            </div>
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-2xl font-bold mt-1 text-green-600">{stats.completed}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Recovered</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(stats.totalRecovered)}</p>
            </div>
            <IndianRupee className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by loan number, customer, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Auctions Table */}
      {filteredAuctions.length === 0 ? (
        <Card className="p-12 text-center">
          <Gavel className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No auctions found</p>
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
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reserve Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Release Deadline
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sale Price
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAuctions.map((entry) => (
                  <tr key={entry.auction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {entry.loan.loanNumber}
                      </div>
                      <div className="text-xs text-gray-500">
                        Loan: {formatCurrency(entry.loan.loanAmount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {entry.customer.firstName} {entry.customer.lastName}
                      </div>
                      <div className="text-xs text-gray-500">{entry.customer.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(entry.auction.auctionStatus)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(entry.auction.reservePrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDate(entry.auction.releaseDeadline)}
                      </div>
                      {new Date(entry.auction.releaseDeadline) < new Date() &&
                        entry.auction.auctionStatus.toLowerCase() === 'initiated' && (
                          <span className="text-xs text-red-600 font-medium">Overdue</span>
                        )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.auction.finalSalePrice
                        ? formatCurrency(entry.auction.finalSalePrice)
                        : '-'}
                      {entry.auction.surplusAmount &&
                        parseFloat(String(entry.auction.surplusAmount)) > 0 && (
                          <div className="text-xs text-green-600">
                            Surplus: {formatCurrency(entry.auction.surplusAmount)}
                          </div>
                        )}
                      {entry.auction.deficitAmount &&
                        parseFloat(String(entry.auction.deficitAmount)) > 0 && (
                          <div className="text-xs text-red-600">
                            Deficit: {formatCurrency(entry.auction.deficitAmount)}
                          </div>
                        )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link href={`/loans/${entry.loan.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View Loan
                        </Button>
                      </Link>
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
