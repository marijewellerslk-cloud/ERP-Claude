'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: string;
  reason: string | null;
  status: string;
  approvedAt: string | null;
  createdAt: string;
}

export default function LeavePage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaveRequests();
  }, [statusFilter]);

  async function fetchLeaveRequests() {
    try {
      setLoading(true);
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const response = await apiClient.get(`/hrm/leave-requests${params}`);
      setRequests(response.data?.data || []);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(requestId: string) {
    try {
      setProcessingId(requestId);
      await apiClient.put(`/hrm/leave-requests/${requestId}/approve`);
      await fetchLeaveRequests();
    } catch (error: any) {
      console.error('Error approving leave:', error);
      alert(error.response?.data?.error || 'Failed to approve leave request');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(requestId: string) {
    const reason = prompt('Please enter the reason for rejection:');
    if (!reason) return;

    try {
      setProcessingId(requestId);
      await apiClient.put(`/hrm/leave-requests/${requestId}/reject`, { reason });
      await fetchLeaveRequests();
    } catch (error: any) {
      console.error('Error rejecting leave:', error);
      alert(error.response?.data?.error || 'Failed to reject leave request');
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
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-700">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
    const endDate = new Date(end).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `${startDate} - ${endDate}`;
  };

  // Stats
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leave Management</h1>
          <p className="text-muted-foreground">
            Review and manage employee leave requests
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/hrm/leave/types">
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Leave Types
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Requests</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            {pendingCount > 0 && statusFilter !== 'pending' && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                {pendingCount} pending approval
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Leave Requests List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No leave requests</h3>
            <p className="text-muted-foreground">
              {statusFilter === 'pending'
                ? 'No pending leave requests to review'
                : 'No leave requests found with this filter'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{request.employeeName}</h3>
                        <span className="text-sm text-muted-foreground">
                          ({request.employeeCode})
                        </span>
                        {getStatusBadge(request.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <Badge variant="outline">{request.leaveTypeName}</Badge>
                        <span className="text-muted-foreground">
                          {formatDateRange(request.startDate, request.endDate)}
                        </span>
                        <span className="font-medium">
                          {parseFloat(request.totalDays)} day(s)
                        </span>
                      </div>
                      {request.reason && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Reason: {request.reason}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Requested on {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {request.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(request.id)}
                        disabled={processingId === request.id}
                      >
                        {processingId === request.id ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="mr-1 h-4 w-4" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(request.id)}
                        disabled={processingId === request.id}
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {request.status === 'approved' && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-sm">
                        Approved on {new Date(request.approvedAt!).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {request.status === 'rejected' && (
                    <div className="flex items-center gap-2 text-red-600">
                      <XCircle className="h-5 w-5" />
                      <span className="text-sm">Rejected</span>
                    </div>
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
