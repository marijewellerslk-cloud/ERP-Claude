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
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Download,
  TrendingUp,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface AttendanceReportEmployee {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  halfDays: number;
  leaveDays: number;
  totalWorkHours: number | string;
  totalOvertimeHours: number | string;
}

interface AttendanceReport {
  month: number;
  year: number;
  totalWorkingDays: number;
  employees: AttendanceReportEmployee[];
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function AttendanceReportsPage() {
  const currentDate = new Date();
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  useEffect(() => {
    fetchReport();
  }, [selectedMonth, selectedYear]);

  async function fetchReport() {
    try {
      setLoading(true);
      const response = await apiClient.get(
        `/hrm/attendance/report?month=${selectedMonth}&year=${selectedYear}`
      );
      setReport(response.data?.data || null);
    } catch (error) {
      console.error('Error fetching attendance report:', error);
    } finally {
      setLoading(false);
    }
  }

  const getAttendancePercentage = (employee: AttendanceReportEmployee) => {
    if (!report || report.totalWorkingDays === 0) return 0;
    const attended = Number(employee.presentDays) + Number(employee.lateDays) + (Number(employee.halfDays) * 0.5);
    return Math.round((attended / report.totalWorkingDays) * 100);
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Calculate totals
  const totals = report?.employees.reduce(
    (acc, emp) => ({
      presentDays: acc.presentDays + (Number(emp.presentDays) || 0),
      lateDays: acc.lateDays + (Number(emp.lateDays) || 0),
      absentDays: acc.absentDays + (Number(emp.absentDays) || 0),
      leaveDays: acc.leaveDays + (Number(emp.leaveDays) || 0),
      workHours: acc.workHours + (Number(emp.totalWorkHours) || 0),
      overtimeHours: acc.overtimeHours + (Number(emp.totalOvertimeHours) || 0),
    }),
    { presentDays: 0, lateDays: 0, absentDays: 0, leaveDays: 0, workHours: 0, overtimeHours: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/hrm/attendance">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Attendance Report</h1>
            <p className="text-muted-foreground">
              Monthly attendance summary for all employees
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <Select
              value={selectedMonth.toString()}
              onValueChange={(v) => setSelectedMonth(parseInt(v))}
            >
              <SelectTrigger className="w-[150px]">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month, index) => (
                  <SelectItem key={month} value={(index + 1).toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedYear.toString()}
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1" />

            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {report && totals && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{report.employees.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Working Days</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{report.totalWorkingDays}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Attendance</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {report.employees.length > 0
                  ? Math.round(
                      report.employees.reduce((sum, e) => sum + getAttendancePercentage(e), 0) /
                        report.employees.length
                    )
                  : 0}
                %
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Work Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.workHours.toFixed(1)}h</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overtime Hours</CardTitle>
              <Clock className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {totals.overtimeHours.toFixed(1)}h
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report Table */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : !report || report.employees.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No attendance data</h3>
            <p className="text-muted-foreground">
              No attendance records found for {months[selectedMonth - 1]} {selectedYear}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {months[selectedMonth - 1]} {selectedYear} Attendance
            </CardTitle>
            <CardDescription>
              {report.employees.length} employees, {report.totalWorkingDays} working days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium">Employee</th>
                    <th className="pb-3 font-medium text-center">Present</th>
                    <th className="pb-3 font-medium text-center">Late</th>
                    <th className="pb-3 font-medium text-center">Absent</th>
                    <th className="pb-3 font-medium text-center">Leave</th>
                    <th className="pb-3 font-medium text-right">Work Hours</th>
                    <th className="pb-3 font-medium text-right">Overtime</th>
                    <th className="pb-3 font-medium text-right">Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {report.employees.map((employee) => {
                    const percentage = getAttendancePercentage(employee);
                    return (
                      <tr key={employee.employeeId} className="border-b">
                        <td className="py-4">
                          <div>
                            <p className="font-medium">{employee.employeeName}</p>
                            <p className="text-sm text-muted-foreground">
                              {employee.employeeCode} - {employee.department}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 text-center">
                          <Badge className="bg-green-100 text-green-700">
                            {employee.presentDays}
                          </Badge>
                        </td>
                        <td className="py-4 text-center">
                          {employee.lateDays > 0 ? (
                            <Badge className="bg-yellow-100 text-yellow-700">
                              {employee.lateDays}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-4 text-center">
                          {employee.absentDays > 0 ? (
                            <Badge className="bg-red-100 text-red-700">
                              {employee.absentDays}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-4 text-center">
                          {employee.leaveDays > 0 ? (
                            <Badge className="bg-blue-100 text-blue-700">
                              {employee.leaveDays}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-4 text-right">
                          {Number(employee.totalWorkHours).toFixed(1)}h
                        </td>
                        <td className="py-4 text-right">
                          {Number(employee.totalOvertimeHours) > 0 ? (
                            <span className="text-green-600">
                              +{Number(employee.totalOvertimeHours).toFixed(1)}h
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-4 text-right">
                          <span className={`font-semibold ${getPercentageColor(percentage)}`}>
                            {percentage}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
