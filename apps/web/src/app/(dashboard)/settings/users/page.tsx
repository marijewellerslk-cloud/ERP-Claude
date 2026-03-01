'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Plus,
  Key,
  Shield,
  UserCheck,
  UserX,
  Search,
  Loader2,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface UserWithRoles {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  roles: { id: string; name: string }[];
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

function formatRoleName(name: string) {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function UserManagementPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create user modal state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    roleId: '',
  });
  const [createLoading, setCreateLoading] = useState(false);

  // Reset password modal state
  const [resetPasswordUser, setResetPasswordUser] = useState<UserWithRoles | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Change role modal state
  const [changeRoleUser, setChangeRoleUser] = useState<UserWithRoles | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [usersRes, rolesRes] = await Promise.all([
        apiClient.get('/auth/users/with-roles'),
        apiClient.get('/auth/roles'),
      ]);
      setUsers(usersRes.data.data || []);
      setRoles(rolesRes.data.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setMessage({ type: 'error', text: 'Failed to load user data' });
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.roles.some((r) => r.name.toLowerCase().includes(search.toLowerCase()))
  );

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.email || !createForm.fullName || !createForm.password || !createForm.roleId) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    try {
      setCreateLoading(true);
      await apiClient.post('/auth/users/create', createForm);
      setMessage({ type: 'success', text: 'User created successfully' });
      setShowCreateForm(false);
      setCreateForm({ fullName: '', email: '', phone: '', password: '', roleId: '' });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error?.message || 'Failed to create user' });
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!resetPasswordUser || !newPassword) return;

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    try {
      setActionLoading(resetPasswordUser.id);
      await apiClient.post(`/auth/users/${resetPasswordUser.id}/reset-password`, { newPassword });
      setMessage({ type: 'success', text: `Password reset for ${resetPasswordUser.fullName}` });
      setResetPasswordUser(null);
      setNewPassword('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error?.message || 'Failed to reset password' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleChangeRole() {
    if (!changeRoleUser || !selectedRoleId) return;

    try {
      setActionLoading(changeRoleUser.id);
      await apiClient.put(`/auth/users/${changeRoleUser.id}/role`, { roleId: selectedRoleId });
      setMessage({ type: 'success', text: `Role updated for ${changeRoleUser.fullName}` });
      setChangeRoleUser(null);
      setSelectedRoleId('');
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error?.message || 'Failed to update role' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleActive(user: UserWithRoles) {
    try {
      setActionLoading(user.id);
      await apiClient.put(`/auth/users/${user.id}/toggle-active`);
      setMessage({
        type: 'success',
        text: `${user.fullName} ${user.isActive ? 'deactivated' : 'activated'}`,
      });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error?.message || 'Failed to toggle status' });
    } finally {
      setActionLoading(null);
    }
  }

  const PROTECTED_ROLES = ['super_admin', 'superadmin', 'owner'];

  function isProtectedUser(user: UserWithRoles) {
    return user.roles.some((r) => PROTECTED_ROLES.includes(r.name));
  }

  const getRoleBadgeColor = (roleName: string) => {
    switch (roleName) {
      case 'super_admin':
      case 'superadmin':
        return 'bg-red-100 text-red-700';
      case 'owner':
        return 'bg-purple-100 text-purple-700';
      case 'store_manager':
        return 'bg-blue-100 text-blue-700';
      case 'accountant':
        return 'bg-green-100 text-green-700';
      case 'salesperson':
        return 'bg-orange-100 text-orange-700';
      case 'cashier':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground">
              Manage system users, assign roles, and reset passwords
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Create User Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Create New User</CardTitle>
                <CardDescription>Add a new system user with login access</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowCreateForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-fullName">Full Name *</Label>
                <Input
                  id="create-fullName"
                  placeholder="Enter full name"
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm((p) => ({ ...p, fullName: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-email">Email *</Label>
                <Input
                  id="create-email"
                  type="email"
                  placeholder="user@marijewellers.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-phone">Phone</Label>
                <Input
                  id="create-phone"
                  placeholder="+94 XXXXX XXXXX"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-password">Password *</Label>
                <Input
                  id="create-password"
                  type="password"
                  placeholder="Min 8 characters"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-role">System Role *</Label>
                <Select
                  value={createForm.roleId}
                  onValueChange={(v) => setCreateForm((p) => ({ ...p, roleId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {formatRoleName(role.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={createLoading} className="w-full">
                  {createLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Create User
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Reset Password Dialog */}
      {resetPasswordUser && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Reset Password</CardTitle>
                <CardDescription>
                  Set a new password for {resetPasswordUser.fullName} ({resetPasswordUser.email})
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setResetPasswordUser(null);
                  setNewPassword('');
                  setShowPassword(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="new-password">New Password *</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button
                onClick={handleResetPassword}
                disabled={actionLoading === resetPasswordUser.id || !newPassword}
              >
                {actionLoading === resetPasswordUser.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Key className="mr-2 h-4 w-4" />
                )}
                Reset Password
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Change Role Dialog */}
      {changeRoleUser && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Change Role</CardTitle>
                <CardDescription>
                  Update role for {changeRoleUser.fullName} ({changeRoleUser.email})
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setChangeRoleUser(null);
                  setSelectedRoleId('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label>Current Role</Label>
                <div className="flex gap-2">
                  {changeRoleUser.roles.length > 0 ? (
                    changeRoleUser.roles.map((r) => (
                      <Badge key={r.id} className={getRoleBadgeColor(r.name)}>
                        {formatRoleName(r.name)}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="secondary">No role assigned</Badge>
                  )}
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <Label>New Role</Label>
                <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select new role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {formatRoleName(role.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleChangeRole}
                disabled={actionLoading === changeRoleUser.id || !selectedRoleId}
              >
                {actionLoading === changeRoleUser.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="mr-2 h-4 w-4" />
                )}
                Update Role
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No users found
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map((user) => (
            <Card key={user.id} className={!user.isActive ? 'opacity-60' : ''}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium ${
                        user.isActive ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {user.fullName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{user.fullName}</h3>
                        {!user.isActive && (
                          <Badge variant="secondary" className="bg-red-100 text-red-600 text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Roles */}
                    <div className="flex gap-1">
                      {user.roles.length > 0 ? (
                        user.roles.map((r) => (
                          <Badge key={r.id} className={getRoleBadgeColor(r.name)}>
                            {formatRoleName(r.name)}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="secondary">No Role</Badge>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Reset Password"
                        onClick={() => {
                          setResetPasswordUser(user);
                          setChangeRoleUser(null);
                          setNewPassword('');
                          setShowPassword(false);
                        }}
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      {!isProtectedUser(user) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Change Role"
                          onClick={() => {
                            setChangeRoleUser(user);
                            setResetPasswordUser(null);
                            setSelectedRoleId(user.roles[0]?.id || '');
                          }}
                        >
                          <Shield className="h-4 w-4" />
                        </Button>
                      )}
                      {!isProtectedUser(user) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          title={user.isActive ? 'Deactivate' : 'Activate'}
                          onClick={() => handleToggleActive(user)}
                          disabled={actionLoading === user.id}
                        >
                          {actionLoading === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : user.isActive ? (
                            <UserX className="h-4 w-4 text-red-500" />
                          ) : (
                            <UserCheck className="h-4 w-4 text-green-500" />
                          )}
                        </Button>
                      ) : (
                        <span className="inline-flex items-center px-2 text-xs text-muted-foreground" title="Protected account">
                          Protected
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Summary */}
      <div className="text-sm text-muted-foreground text-center">
        {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} total
        {' | '}
        {filteredUsers.filter((u) => u.isActive).length} active
        {' | '}
        {filteredUsers.filter((u) => !u.isActive).length} inactive
      </div>
    </div>
  );
}
