'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Edit,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Building2,
  Wallet,
  Clock,
  AlertCircle,
  User,
  CreditCard,
  Users,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';

interface EmployeeSummary {
  employee: {
    id: string;
    employeeCode: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    dateOfBirth: string | null;
    dateOfJoining: string;
    department: string;
    position: string;
    employmentType: string;
    salary: string;
    bankAccountNumber: string | null;
    bankName: string | null;
    ifscCode: string | null;
    nicNumber: string | null;
    nicPhotoUrl: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    emergencyContactName2: string | null;
    emergencyContactPhone2: string | null;
    payrollFrequency: string;
    address: string | null;
    status: string;
  };
  attendance: {
    month: number;
    year: number;
    summary: { status: string; count: number }[];
  };
  leaveBalances: {
    leaveTypeName: string;
    allocated: string;
    used: string;
    carriedForward: string;
  }[];
  pendingLeaveRequests: number;
  latestPayroll: {
    month: number;
    year: number;
    netSalary: string;
    status: string;
  } | null;
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [summary, setSummary] = useState<EmployeeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const employeeId = params.id as string;

  useEffect(() => {
    fetchEmployeeSummary();
  }, [employeeId]);

  async function fetchEmployeeSummary() {
    try {
      setLoading(true);
      const response = await apiClient.get(`/hrm/employees/${employeeId}/summary`);
      setSummary(response.data?.data || null);
    } catch (error) {
      console.error('Error fetching employee:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700">Active</Badge>;
      case 'on_leave':
        return <Badge className="bg-yellow-100 text-yellow-700">On Leave</Badge>;
      case 'terminated':
        return <Badge className="bg-red-100 text-red-700">Terminated</Badge>;
      case 'resigned':
        return <Badge className="bg-gray-100 text-gray-700">Resigned</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getDepartmentBadge = (department: string) => {
    const colors: Record<string, string> = {
      sales: 'bg-blue-100 text-blue-700',
      accounting: 'bg-purple-100 text-purple-700',
      management: 'bg-indigo-100 text-indigo-700',
      operations: 'bg-orange-100 text-orange-700',
    };
    return (
      <Badge className={colors[department] || 'bg-gray-100 text-gray-700'}>
        {department.charAt(0).toUpperCase() + department.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Employee not found</h3>
        <p className="text-muted-foreground mb-4">
          The employee you're looking for doesn't exist
        </p>
        <Link href="/hrm/employees">
          <Button>Back to Employees</Button>
        </Link>
      </div>
    );
  }

  const { employee, attendance, leaveBalances, pendingLeaveRequests, latestPayroll } = summary;

  // Calculate attendance stats
  const presentDays = attendance.summary.find(s => s.status === 'present')?.count || 0;
  const lateDays = attendance.summary.find(s => s.status === 'late')?.count || 0;
  const absentDays = attendance.summary.find(s => s.status === 'absent')?.count || 0;
  const leaveDays = attendance.summary.find(s => s.status === 'on_leave')?.count || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/hrm/employees">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{employee.fullName}</h1>
            <p className="text-muted-foreground">
              {employee.employeeCode} - {employee.position}
            </p>
          </div>
        </div>
        <Link href={`/hrm/employees/${employeeId}/edit`}>
          <Button>
            <Edit className="mr-2 h-4 w-4" />
            Edit Employee
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Info */}
        <div className="md:col-span-2 space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6">
                <div className="h-32 w-32 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden border-2 border-dashed">
                  {employee.nicPhotoUrl ? (
                    <img src={employee.nicPhotoUrl} alt="NIC" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-12 w-12 text-primary/40" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{employee.fullName}</h3>
                  <div className="flex gap-2 mt-1">
                    {getStatusBadge(employee.status)}
                    {getDepartmentBadge(employee.department)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    NIC Photo {employee.nicPhotoUrl ? '(Uploaded)' : '(Not available)'}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                {employee.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{employee.email}</p>
                    </div>
                  </div>
                )}
                {employee.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{employee.phone}</p>
                    </div>
                  </div>
                )}
                {employee.nicNumber && (
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">NIC Number</p>
                      <p className="font-medium">{employee.nicNumber}</p>
                    </div>
                  </div>
                )}
                {employee.dateOfBirth && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Date of Birth</p>
                      <p className="font-medium">
                        {new Date(employee.dateOfBirth).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
                {employee.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="font-medium">{employee.address}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Employment Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Employment Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Position</p>
                  <p className="font-medium">{employee.position}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-medium capitalize">{employee.department}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Employment Type</p>
                  <p className="font-medium capitalize">
                    {employee.employmentType.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payroll Cycle</p>
                  <p className="font-medium capitalize">
                    {employee.payrollFrequency}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date of Joining</p>
                  <p className="font-medium">
                    {new Date(employee.dateOfJoining).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Salary</p>
                  <p className="font-medium text-lg">
                    {formatCurrency(parseFloat(employee.salary))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bank Details */}
          {(employee.bankName || employee.bankAccountNumber) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Bank Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {employee.bankName && (
                    <div>
                      <p className="text-sm text-muted-foreground">Bank Name</p>
                      <p className="font-medium">{employee.bankName}</p>
                    </div>
                  )}
                  {employee.bankAccountNumber && (
                    <div>
                      <p className="text-sm text-muted-foreground">Account Number</p>
                      <p className="font-medium">
                        ****{employee.bankAccountNumber.slice(-4)}
                      </p>
                    </div>
                  )}
                  {employee.ifscCode && (
                    <div>
                      <p className="text-sm text-muted-foreground">Bank/Branch Code</p>
                      <p className="font-medium">{employee.ifscCode}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Emergency Contact */}
          {(employee.emergencyContactName || employee.emergencyContactPhone) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Emergency Contact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <p className="font-medium text-sm border-b pb-1">Primary Contact</p>
                    <div className="grid gap-2">
                      {employee.emergencyContactName && (
                        <div>
                          <p className="text-xs text-muted-foreground">Contact Name</p>
                          <p className="font-medium">{employee.emergencyContactName}</p>
                        </div>
                      )}
                      {employee.emergencyContactPhone && (
                        <div>
                          <p className="text-xs text-muted-foreground">Contact Phone</p>
                          <p className="font-medium">{employee.emergencyContactPhone}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {(employee.emergencyContactName2 || employee.emergencyContactPhone2) && (
                    <div className="space-y-4">
                      <p className="font-medium text-sm border-b pb-1">Secondary Contact</p>
                      <div className="grid gap-2">
                        {employee.emergencyContactName2 && (
                          <div>
                            <p className="text-xs text-muted-foreground">Contact Name</p>
                            <p className="font-medium">{employee.emergencyContactName2}</p>
                          </div>
                        )}
                        {employee.emergencyContactPhone2 && (
                          <div>
                            <p className="text-xs text-muted-foreground">Contact Phone</p>
                            <p className="font-medium">{employee.emergencyContactPhone2}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-6">
          {/* Attendance This Month */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                Attendance This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Present</span>
                  <Badge className="bg-green-100 text-green-700">{presentDays + lateDays}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Late</span>
                  <Badge className="bg-yellow-100 text-yellow-700">{lateDays}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Absent</span>
                  <Badge className="bg-red-100 text-red-700">{absentDays}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">On Leave</span>
                  <Badge className="bg-blue-100 text-blue-700">{leaveDays}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leave Balances */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" />
                Leave Balances
              </CardTitle>
              {pendingLeaveRequests > 0 && (
                <CardDescription>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                    {pendingLeaveRequests} pending request(s)
                  </Badge>
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {leaveBalances.length === 0 ? (
                <p className="text-sm text-muted-foreground">No leave balances set</p>
              ) : (
                <div className="space-y-3">
                  {leaveBalances.map((balance, index) => {
                    const remaining =
                      parseFloat(balance.allocated) +
                      parseFloat(balance.carriedForward) -
                      parseFloat(balance.used);
                    return (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm">{balance.leaveTypeName}</span>
                        <span className="font-medium">
                          {remaining}/{parseFloat(balance.allocated)} days
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Latest Payroll */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4" />
                Latest Payroll
              </CardTitle>
            </CardHeader>
            <CardContent>
              {latestPayroll ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Period</span>
                    <span className="font-medium">
                      {latestPayroll.month}/{latestPayroll.year}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Net Salary</span>
                    <span className="font-medium">
                      {formatCurrency(parseFloat(latestPayroll.netSalary))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge
                      className={
                        latestPayroll.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }
                    >
                      {latestPayroll.status}
                    </Badge>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No payroll records</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
