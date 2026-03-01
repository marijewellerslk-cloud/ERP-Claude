'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { useAuth } from '@/hooks/useAuth';


export default function NewEmployeePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [createAccount, setCreateAccount] = useState(false);
  const [formData, setFormData] = useState({
    employeeCode: '',
    fullName: '',
    email: '',
    phone: '',
    nicNumber: '',
    nicPhotoUrl: '',
    dateOfBirth: '',
    address: '',
    dateOfJoining: '',
    department: '',
    position: '',
    employmentType: 'full_time',
    payrollFrequency: 'monthly',
    salary: '',
    bankName: '',
    bankAccountNumber: '',
    ifscCode: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactName2: '',
    emergencyContactPhone2: ''
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const sriLankanBanks = [
    'Bank of Ceylon',
    'People\'s Bank',
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
    'Other'
  ];
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [password, setPassword] = useState('');

  const { user } = useAuth(); // Get current user
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rolesRes] = await Promise.all([
          apiClient.get('/auth/roles'),
        ]);
        setRoles(rolesRes.data.data);

        if (user?.role === 'superadmin' || user?.role === 'super_admin') {
          const storesRes = await apiClient.get('/stores');
          setStores(storesRes.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch initial data:', err);
      }
    };
    if (user) {
      fetchData();
    }
  }, [user]);

  // ... other hooks ...

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.employeeCode || !formData.fullName || !formData.position || !formData.salary) {
      setError('Please fill in all required fields');
      return;
    }

    if ((user?.role === 'superadmin' || user?.role === 'super_admin') && !selectedStoreId) {
      setError('Please select a store');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post('/hrm/employees', {
        ...formData,
        storeId: (user?.role === 'superadmin' || user?.role === 'super_admin') ? selectedStoreId : undefined, // Backend should handle default if undefined, but explicit is better for superadmin
        dateOfBirth: formData.dateOfBirth || null,
        email: formData.email || null,
        phone: formData.phone || null,
        roleId: createAccount ? selectedRoleId : undefined,
        password: createAccount && password ? password : undefined,
      });

      router.push('/hrm/employees');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/hrm/employees">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Add New Employee</h1>
          <p className="text-muted-foreground">
            Register a new employee in the system
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Employee's personal details</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {user?.role === 'superadmin' && (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="store">Branch / Store *</Label>
                  <Select
                    value={selectedStoreId}
                    onValueChange={setSelectedStoreId}
                    required
                  >
                    <SelectTrigger id="store">
                      <SelectValue placeholder="Select a branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="employeeCode">Employee Code *</Label>
                <Input
                  id="employeeCode"
                  placeholder="e.g., EMP001"
                  value={formData.employeeCode}
                  onChange={(e) => handleChange('employeeCode', e.target.value)}
                  required
                />
              </div>
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
                <Label htmlFor="dateOfJoining">Date of Joining *</Label>
                <Input
                  id="dateOfJoining"
                  type="date"
                  value={formData.dateOfJoining}
                  onChange={(e) => handleChange('dateOfJoining', e.target.value)}
                  required
                />
              </div>
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
            </CardContent>
          </Card>

          {/* Bank Details */}
          <Card>
            <CardHeader>
              <CardTitle>Bank Details</CardTitle>
              <CardDescription>For salary disbursement</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Select
                value={formData.bankName}
                onValueChange={(v) => handleChange('bankName', v)}
              >
                <SelectTrigger id="bankName">
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
                <Label htmlFor="emergencyContactName">Contact Name</Label>
                <Input
                  id="emergencyContactName"
                  placeholder="Full name"
                  value={formData.emergencyContactName}
                  onChange={(e) => handleChange('emergencyContactName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
                <Input
                  id="emergencyContactPhone"
                  placeholder="+94 XXXXX XXXXX"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => handleChange('emergencyContactPhone', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Secondary Emergency Contact</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="emergencyContactName2">Contact Name</Label>
                <Input
                  id="emergencyContactName2"
                  placeholder="Full Name"
                  value={formData.emergencyContactName2}
                  onChange={(e) => handleChange('emergencyContactName2', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContactPhone2">Contact Phone</Label>
                <Input
                  id="emergencyContactPhone2"
                  placeholder="+94 XXXXX XXXXX"
                  value={formData.emergencyContactPhone2}
                  onChange={(e) => handleChange('emergencyContactPhone2', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* User Account */}
          <Card>
            <CardHeader>
              <CardTitle>User Account</CardTitle>
              <CardDescription>Create a system login for this employee</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="createAccount"
                  checked={createAccount}
                  onChange={(e) => setCreateAccount(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="createAccount">Create user account for system access</Label>
              </div>

              {createAccount && (
                <div className="grid gap-4 md:grid-cols-2 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select
                      value={selectedRoleId}
                      onValueChange={setSelectedRoleId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Leave blank for default (Employee@123)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Link href="/hrm/employees">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Employee
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
