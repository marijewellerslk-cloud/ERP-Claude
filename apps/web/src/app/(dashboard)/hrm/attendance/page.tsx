'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  CheckCircle,
  XCircle,
  LogIn,
  LogOut,
  Calendar,
  Users,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface AttendanceEmployee {
  id: string;
  fullName: string;
  employeeCode: string;
  department: string;
  position: string;
  attendance: {
    id: string;
    checkIn: string | null;
    checkOut: string | null;
    status: string;
    workHours: string | null;
  } | null;
}

export default function AttendancePage() {
  const [employees, setEmployees] = useState<AttendanceEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTodayAttendance();
  }, []);

  async function fetchTodayAttendance() {
    try {
      setLoading(true);
      const response = await apiClient.get('/hrm/attendance/today');
      setEmployees(response.data?.data || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckIn(employeeId: string) {
    try {
      setProcessingId(employeeId);
      await apiClient.post('/hrm/attendance/check-in', { employeeId });
      await fetchTodayAttendance();
    } catch (error: any) {
      console.error('Error checking in:', error);
      alert(error.response?.data?.error || 'Failed to check in');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleCheckOut(attendanceId: string) {
    try {
      setProcessingId(attendanceId);
      await apiClient.post('/hrm/attendance/check-out', { attendanceId });
      await fetchTodayAttendance();
    } catch (error: any) {
      console.error('Error checking out:', error);
      alert(error.response?.data?.error || 'Failed to check out');
    } finally {
      setProcessingId(null);
    }
  }

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-green-100 text-green-700">Present</Badge>;
      case 'late':
        return <Badge className="bg-yellow-100 text-yellow-700">Late</Badge>;
      case 'absent':
        return <Badge className="bg-red-100 text-red-700">Absent</Badge>;
      case 'half_day':
        return <Badge className="bg-orange-100 text-orange-700">Half Day</Badge>;
      case 'on_leave':
        return <Badge className="bg-blue-100 text-blue-700">On Leave</Badge>;
      default:
        return <Badge variant="secondary">Not Marked</Badge>;
    }
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Stats
  const presentCount = employees.filter(
    (e) => e.attendance?.status === 'present' || e.attendance?.status === 'late'
  ).length;
  const absentCount = employees.filter(
    (e) => !e.attendance || e.attendance.status === 'absent'
  ).length;
  const onLeaveCount = employees.filter(
    (e) => e.attendance?.status === 'on_leave'
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Today's Attendance</h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <Link href="/hrm/attendance/reports">
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            View Reports
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{presentCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absent / Not Marked</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{absentCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Leave</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{onLeaveCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance List */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Attendance</CardTitle>
          <CardDescription>
            Mark check-in and check-out for employees
          </CardDescription>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No employees found</h3>
              <p className="text-muted-foreground">
                Add employees to start tracking attendance
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="font-semibold text-primary">
                        {employee.fullName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{employee.fullName}</span>
                        <span className="text-sm text-muted-foreground">
                          ({employee.employeeCode})
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {employee.position} - {employee.department}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Status */}
                    <div className="text-center">
                      {getStatusBadge(employee.attendance?.status)}
                    </div>

                    {/* Check-in Time */}
                    <div className="text-center min-w-[80px]">
                      <p className="text-xs text-muted-foreground">Check In</p>
                      <p className="font-medium">
                        {formatTime(employee.attendance?.checkIn || null)}
                      </p>
                    </div>

                    {/* Check-out Time */}
                    <div className="text-center min-w-[80px]">
                      <p className="text-xs text-muted-foreground">Check Out</p>
                      <p className="font-medium">
                        {formatTime(employee.attendance?.checkOut || null)}
                      </p>
                    </div>

                    {/* Work Hours */}
                    <div className="text-center min-w-[80px]">
                      <p className="text-xs text-muted-foreground">Hours</p>
                      <p className="font-medium">
                        {employee.attendance?.workHours
                          ? `${parseFloat(employee.attendance.workHours).toFixed(1)}h`
                          : '-'}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {!employee.attendance?.checkIn ? (
                        <Button
                          size="sm"
                          onClick={() => handleCheckIn(employee.id)}
                          disabled={processingId === employee.id}
                        >
                          <LogIn className="mr-1 h-4 w-4" />
                          Check In
                        </Button>
                      ) : !employee.attendance?.checkOut ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCheckOut(employee.attendance!.id)}
                          disabled={processingId === employee.attendance?.id}
                        >
                          <LogOut className="mr-1 h-4 w-4" />
                          Check Out
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-green-600">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Completed
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
