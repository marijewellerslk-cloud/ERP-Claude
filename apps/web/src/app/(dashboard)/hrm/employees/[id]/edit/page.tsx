'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ImageUpload } from '@/components/ui/image-upload';

export default function EditEmployeePage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const sriLankanBanks = [
    'Bank of Ceylon',
    "People's Bank",
    'Commercial Bank of Ceylon',
    'Hatton National Bank (HNB)',
    'Sampath Bank',
    'Seylan Bank',
    'National Savings Bank (NSB)',
    'Nations Trust Bank (NTB)',
    'DFCC Bank',
    'Pan Asia Bank',
    'Union Bank of Colombo',
    'NDB Bank',
    'Amana Bank',
    'Cargills Bank',
    'Other',
  ];

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    department: 'sales',
    position: '',
    employmentType: 'full_time',
    salary: '',
    bankAccountNumber: '',
    bankName: '',
    ifscCode: '',
    nicNumber: '',
    nicPhotoUrl: '',
    payrollFrequency: 'monthly',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactName2: '',
    emergencyContactPhone2: '',
    address: '',
    status: 'active',
  });

  const [employeeCode, setEmployeeCode] = useState('');

  useEffect(() => {
    fetchEmployee();
  }, [employeeId]);

  async function fetchEmployee() {
    try {
      setFetching(true);
      const response = await apiClient.get(`/hrm/employees/${employeeId}`);
      const emp = response.data?.data;
      if (emp) {
        setEmployeeCode(emp.employeeCode || '');
        setFormData({
          fullName: emp.fullName || '',
          email: emp.email || '',
          phone: emp.phone || '',
          dateOfBirth: emp.dateOfBirth ? new Date(emp.dateOfBirth).toISOString().split('T')[0] : '',
          department: emp.department || 'sales',
          position: emp.position || '',
          employmentType: emp.employmentType || 'full_time',
          salary: emp.salary || '',
          bankAccountNumber: emp.bankAccountNumber || '',
          bankName: emp.bankName || '',
          ifscCode: emp.ifscCode || '',
          nicNumber: emp.nicNumber || '',
          nicPhotoUrl: emp.nicPhotoUrl || '',
          payrollFrequency: emp.payrollFrequency || 'monthly',
          emergencyContactName: emp.emergencyContactName || '',
          emergencyContactPhone: emp.emergencyContactPhone || '',
          emergencyContactName2: emp.emergencyContactName2 || '',
          emergencyContactPhone2: emp.emergencyContactPhone2 || '',
          address: emp.address || '',
          status: emp.status || 'active',
        });
      }
    } catch (err) {
      setError('Failed to load employee details');
      console.error('Error fetching employee:', err);
    } finally {
      setFetching(false);
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.fullName || !formData.position || !formData.salary) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      await apiClient.put(`/hrm/employees/${employeeId}`, {
        ...formData,
        dateOfBirth: formData.dateOfBirth || null,
        email: formData.email || null,
        phone: formData.phone || null,
      });

      setSuccess('Employee updated successfully');
      setTimeout(() => {
        router.push(`/hrm/employees/${employeeId}`);
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update employee');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/hrm/employees/${employeeId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Employee</h1>
          <p className="text-muted-foreground">
            {employeeCode} - {formData.fullName}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Employee personal details</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  placeholder="Enter full name"
                  value={formData.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="+94 XXXXX XXXXX"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nicNumber">NIC Number</Label>
                <Input
                  id="nicNumber"
                  placeholder="e.g., 199012345678 or 901234567V"
                  value={formData.nicNumber}
                  onChange={(e) => handleChange('nicNumber', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>NIC Photo</Label>
                <ImageUpload
                  value={formData.nicPhotoUrl ? formData.nicPhotoUrl : undefined}
                  onChange={(url) => handleChange('nicPhotoUrl', url)}
                  onRemove={() => handleChange('nicPhotoUrl', '')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="Full address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Employment Details */}
          <Card>
            <CardHeader>
              <CardTitle>Employment Details</CardTitle>
              <CardDescription>Job role and compensation</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) => handleChange('department', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="accounting">Accounting</SelectItem>
                    <SelectItem value="management">Management</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Position *</Label>
                <Input
                  id="position"
                  placeholder="e.g., Sales Associate"
                  value={formData.position}
                  onChange={(e) => handleChange('position', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employmentType">Employment Type</Label>
                <Select
                  value={formData.employmentType}
                  onValueChange={(value) => handleChange('employmentType', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="probationary">Probationary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payrollFrequency">Payroll Cycle</Label>
                <Select
                  value={formData.payrollFrequency}
                  onValueChange={(v) => handleChange('payrollFrequency', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="salary">Monthly Salary (Rs) *</Label>
                <Input
                  id="salary"
                  type="number"
                  placeholder="e.g., 25000"
                  value={formData.salary}
                  onChange={(e) => handleChange('salary', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                    <SelectItem value="resigned">Resigned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Bank Details */}
          <Card>
            <CardHeader>
              <CardTitle>Bank Details</CardTitle>
              <CardDescription>For salary disbursement</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Select
                  value={formData.bankName}
                  onValueChange={(v) => handleChange('bankName', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {sriLankanBanks.map((bank) => (
                      <SelectItem key={bank} value={bank}>
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankAccountNumber">Account Number</Label>
                <Input
                  id="bankAccountNumber"
                  placeholder="Account number"
                  value={formData.bankAccountNumber}
                  onChange={(e) => handleChange('bankAccountNumber', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ifscCode">Bank/Branch Code</Label>
                <Input
                  id="ifscCode"
                  placeholder="e.g., 7010-001"
                  value={formData.ifscCode}
                  onChange={(e) => handleChange('ifscCode', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card>
            <CardHeader>
              <CardTitle>Emergency Contact</CardTitle>
              <CardDescription>Person to contact in case of emergency</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="emergencyContactName">Primary Contact Name</Label>
                <Input
                  id="emergencyContactName"
                  placeholder="Full name"
                  value={formData.emergencyContactName}
                  onChange={(e) => handleChange('emergencyContactName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContactPhone">Primary Contact Phone</Label>
                <Input
                  id="emergencyContactPhone"
                  placeholder="+94 XXXXX XXXXX"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => handleChange('emergencyContactPhone', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContactName2">Secondary Contact Name</Label>
                <Input
                  id="emergencyContactName2"
                  placeholder="Full Name"
                  value={formData.emergencyContactName2}
                  onChange={(e) => handleChange('emergencyContactName2', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContactPhone2">Secondary Contact Phone</Label>
                <Input
                  id="emergencyContactPhone2"
                  placeholder="+94 XXXXX XXXXX"
                  value={formData.emergencyContactPhone2}
                  onChange={(e) => handleChange('emergencyContactPhone2', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Messages */}
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
          )}
          {success && (
            <div className="bg-green-50 text-green-600 p-4 rounded-lg">{success}</div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Link href={`/hrm/employees/${employeeId}`}>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
