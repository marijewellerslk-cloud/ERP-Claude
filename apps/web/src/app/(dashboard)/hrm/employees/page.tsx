'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  UserPlus,
  Search,
  Mail,
  Phone,
  Building2,
  Filter,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';

interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  department: string;
  position: string;
  employmentType: string;
  status: string;
  dateOfJoining: string;
  salary: string;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchEmployees();
  }, [departmentFilter, statusFilter]);

  async function fetchEmployees() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (departmentFilter !== 'all') params.append('department', departmentFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await apiClient.get(`/hrm/employees?${params.toString()}`);
      setEmployees(response.data?.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredEmployees = employees.filter((emp) =>
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-muted-foreground">
            Manage your workforce ({employees.length} employees)
          </p>
        </div>
        <Link href="/hrm/employees/new">
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, code, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[180px]">
                <Building2 className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="accounting">Accounting</SelectItem>
                <SelectItem value="management">Management</SelectItem>
                <SelectItem value="operations">Operations</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
                <SelectItem value="resigned">Resigned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Employees List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No employees found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || departmentFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Get started by adding your first employee'}
            </p>
            <Link href="/hrm/employees/new">
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredEmployees.map((employee) => (
            <Link key={employee.id} href={`/hrm/employees/${employee.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-lg font-semibold text-primary">
                          {employee.fullName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{employee.fullName}</h3>
                          <span className="text-sm text-muted-foreground">
                            ({employee.employeeCode})
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{employee.position}</p>
                        <div className="flex items-center gap-4 mt-2">
                          {employee.email && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {employee.email}
                            </div>
                          )}
                          {employee.phone && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {employee.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex gap-2">
                        {getStatusBadge(employee.status)}
                        {getDepartmentBadge(employee.department)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Joined {new Date(employee.dateOfJoining).toLocaleDateString()}
                      </div>
                      <div className="text-sm font-medium">
                        {formatCurrency(parseFloat(employee.salary))}/month
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
