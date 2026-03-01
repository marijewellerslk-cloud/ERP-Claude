'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/lib/api-client';
import { Search, Plus, Phone, Mail, Award, Eye, MapPin } from 'lucide-react';
import Link from 'next/link';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { PageHeader } from '@/components/ui/page-header';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  whatsapp?: string;
  city?: string;
  tier: string;
  loyaltyPoints: number;
  totalPurchases: number;
  lifetimeValue: string;
  createdAt: string;
}

const TIER_COLORS: Record<string, string> = {
  bronze: 'bg-orange-100 text-orange-800 border-orange-200',
  silver: 'bg-gray-100 text-gray-800 border-gray-200',
  gold: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  platinum: 'bg-purple-100 text-purple-800 border-purple-200',
};

export default function CustomerListPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchCustomers();
  }, [page]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/customers', {
        params: {
          page,
          limit: 20,
          search: searchQuery || undefined,
        },
      });

      if (response.data.success) {
        setCustomers(response.data.data.customers || response.data.data);
        setTotalPages(response.data.data.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCustomers();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="All Customers"
        description="Browse and manage customer database"
      >
        <Link href="/customers/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </Link>
      </PageHeader>

      {/* Search */}
      <Card className="p-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by name, phone, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </Card>

      {/* Customer List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading customers...</p>
        </div>
      ) : customers.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">No customers found</p>
          <Link href="/customers/new">
            <Button className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Customer
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Stats</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="font-medium text-gray-900">
                        {customer.firstName} {customer.lastName}
                      </div>
                      {customer.city && (
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <MapPin className="h-3 w-3 mr-1" />
                          {customer.city}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone className="h-3 w-3 mr-2" />
                          {customer.phone}
                        </div>
                        {customer.email && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Mail className="h-3 w-3 mr-2" />
                            {customer.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={TIER_COLORS[customer.tier]}>
                        <Award className="h-3 w-3 mr-1" />
                        {customer.tier.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div>
                          <span className="text-gray-500">Points:</span>
                          <span className="font-medium ml-1">{customer.loyaltyPoints}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">LTV:</span>
                          <span className="font-medium ml-1">Rs {customer.lifetimeValue}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/customers/${customer.id}`}>
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
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-2 px-4">
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
              </div>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
