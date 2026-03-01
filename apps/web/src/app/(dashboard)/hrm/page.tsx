'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Clock,
  Calendar,
  Wallet,
  UserPlus,
  ClipboardList,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface HRMStats {
  employees: {
    total: number;
    active: number;
    onLeave: number;
  };
  todayAttendance: {
    present: number;
    absent: number;
    late: number;
  };
  pendingLeaves: number;
  pendingPayroll: number;
}

export default function HRMPage() {
  const [stats, setStats] = useState<HRMStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHRMData();
  }, []);

  async function fetchHRMData() {
    try {
      setLoading(true);

      // Fetch employees
      const employeesRes = await apiClient.get('/hrm/employees');
      const employees = employeesRes.data?.data || [];

      // Fetch today's attendance
      const attendanceRes = await apiClient.get('/hrm/attendance/today');
      const todayAttendance = attendanceRes.data?.data || [];

      // Fetch pending leave requests
      const leavesRes = await apiClient.get('/hrm/leave-requests?status=pending');
      const pendingLeaves = leavesRes.data?.data || [];

      // Fetch payroll
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const payrollRes = await apiClient.get(`/hrm/payroll?month=${currentMonth}&year=${currentYear}&status=draft`);
      const pendingPayroll = payrollRes.data?.data || [];

      // Calculate stats
      const activeEmployees = employees.filter((e: any) => e.status === 'active');
      const onLeaveEmployees = employees.filter((e: any) => e.status === 'on_leave');

      const presentCount = todayAttendance.filter((a: any) => a.attendance?.status === 'present').length;
      const lateCount = todayAttendance.filter((a: any) => a.attendance?.status === 'late').length;
      const absentCount = activeEmployees.length - presentCount - lateCount;

      setStats({
        employees: {
          total: employees.length,
          active: activeEmployees.length,
          onLeave: onLeaveEmployees.length,
        },
        todayAttendance: {
          present: presentCount + lateCount,
          absent: absentCount > 0 ? absentCount : 0,
          late: lateCount,
        },
        pendingLeaves: pendingLeaves.length,
        pendingPayroll: pendingPayroll.length,
      });

      // Recent activity (combine leave requests and attendance)
      const activity = [
        ...pendingLeaves.slice(0, 3).map((l: any) => ({
          type: 'leave',
          title: `Leave request from ${l.employeeName}`,
          description: `${l.totalDays} days - ${l.leaveTypeName}`,
          time: new Date(l.createdAt).toLocaleDateString(),
          status: 'pending',
        })),
      ];

      setRecentActivity(activity);
    } catch (error) {
      console.error('Error fetching HRM data:', error);
    } finally {
      setLoading(false);
    }
  }

  const quickActions = [
    {
      title: 'Add Employee',
      description: 'Register a new employee',
      icon: UserPlus,
      href: '/hrm/employees/new',
      color: 'text-blue-600',
    },
    {
      title: 'Mark Attendance',
      description: "Record today's attendance",
      icon: Clock,
      href: '/hrm/attendance',
      color: 'text-green-600',
    },
    {
      title: 'View Leave Requests',
      description: 'Review pending leave applications',
      icon: Calendar,
      href: '/hrm/leave',
      color: 'text-orange-600',
    },
    {
      title: 'Generate Payroll',
      description: 'Process monthly salaries',
      icon: Wallet,
      href: '/hrm/payroll',
      color: 'text-purple-600',
    },
  ];

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
          <h1 className="text-3xl font-bold">Human Resources</h1>
          <p className="text-muted-foreground">
            Manage employees, attendance, leaves, and payroll
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.employees.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.employees.active || 0} active, {stats?.employees.onLeave || 0} on leave
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Attendance</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todayAttendance.present || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.todayAttendance.absent || 0} absent, {stats?.todayAttendance.late || 0} late
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Leaves</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingLeaves || 0}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft Payroll</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingPayroll || 0}</div>
            <p className="text-xs text-muted-foreground">
              Ready for processing
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common HR tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <Card className="hover:bg-accent transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <action.icon className={`h-8 w-8 ${action.color}`} />
                      <div>
                        <p className="font-medium">{action.title}</p>
                        <p className="text-sm text-muted-foreground">{action.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Sections Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Employees Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Employees</CardTitle>
                <CardDescription>Manage your workforce</CardDescription>
              </div>
              <Link href="/hrm/employees">
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Link href="/hrm/employees" className="block">
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span>Employee Directory</span>
                  </div>
                  <Badge variant="secondary">{stats?.employees.total || 0}</Badge>
                </div>
              </Link>
              <Link href="/hrm/employees/new" className="block">
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <UserPlus className="h-5 w-5 text-muted-foreground" />
                    <span>Add New Employee</span>
                  </div>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Attendance</CardTitle>
                <CardDescription>Track daily attendance</CardDescription>
              </div>
              <Link href="/hrm/attendance">
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Link href="/hrm/attendance" className="block">
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span>Today's Attendance</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="default" className="bg-green-600">
                      {stats?.todayAttendance.present || 0} Present
                    </Badge>
                    {(stats?.todayAttendance.absent || 0) > 0 && (
                      <Badge variant="destructive">
                        {stats?.todayAttendance.absent} Absent
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
              <Link href="/hrm/attendance/reports" className="block">
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-5 w-5 text-muted-foreground" />
                    <span>Attendance Reports</span>
                  </div>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Leave Management Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Leave Management</CardTitle>
                <CardDescription>Handle leave requests</CardDescription>
              </div>
              <Link href="/hrm/leave">
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Link href="/hrm/leave" className="block">
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <span>Leave Requests</span>
                  </div>
                  {(stats?.pendingLeaves || 0) > 0 && (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                      {stats?.pendingLeaves} Pending
                    </Badge>
                  )}
                </div>
              </Link>
              <Link href="/hrm/leave/types" className="block">
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-5 w-5 text-muted-foreground" />
                    <span>Leave Types & Policies</span>
                  </div>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Payroll Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Payroll</CardTitle>
                <CardDescription>Salary management</CardDescription>
              </div>
              <Link href="/hrm/payroll">
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Link href="/hrm/payroll" className="block">
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                    <span>Monthly Payroll</span>
                  </div>
                  {(stats?.pendingPayroll || 0) > 0 && (
                    <Badge variant="secondary">
                      {stats?.pendingPayroll} Draft
                    </Badge>
                  )}
                </div>
              </Link>
              <Link href="/hrm/advances" className="block">
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    <span>Salary Advances</span>
                  </div>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest HR actions requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start gap-4 p-3 rounded-lg border">
                  {activity.status === 'pending' && (
                    <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                  )}
                  {activity.status === 'approved' && (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  )}
                  {activity.status === 'rejected' && (
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{activity.title}</p>
                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{activity.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
