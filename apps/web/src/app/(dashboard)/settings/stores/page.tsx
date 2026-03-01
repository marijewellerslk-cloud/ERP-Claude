'use client';

import { useEffect, useState } from 'react';
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
  Building2,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Store {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  parentStoreId: string | null;
  isActive: boolean;
  createdAt: string;
  children?: Store[];
  managerId?: string;
  manager?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

interface User {
  id: string;
  fullName: string;
  email: string;
}

export default function StoresManagementPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: '',
    gstin: '',
    parentStoreId: '',
    isActive: true,
    managerId: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetchStores();
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const response = await apiClient.get('/auth/users');
      setUsers(response.data?.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }

  async function fetchStores() {
    try {
      setLoading(true);
      const response = await apiClient.get('/stores/hierarchy');
      setStores(response.data?.data || []);
    } catch (error) {
      console.error('Error fetching stores:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingStore(null);
    setFormData({
      name: '',
      code: '',
      address: '',
      phone: '',
      email: '',
      gstin: '',
      parentStoreId: '',
      isActive: true,
      managerId: '',
    });
    setError('');
    setShowModal(true);
  }

  async function openEditModal(store: Store) {
    try {
      // Fetch details including manager
      const response = await apiClient.get(`/stores/${store.id}`);
      const detailedStore = response.data?.data || store;

      setEditingStore(detailedStore);
      setFormData({
        name: detailedStore.name,
        code: detailedStore.code,
        address: detailedStore.address || '',
        phone: detailedStore.phone || '',
        email: detailedStore.email || '',
        gstin: detailedStore.gstin || '',
        parentStoreId: detailedStore.parentStoreId || '',
        isActive: detailedStore.isActive,
        managerId: detailedStore.managerId || '',
      });
      setError('');
      setShowModal(true);
    } catch (error) {
      console.error('Error fetching store details:', error);
      // Fallback to basic info
      setEditingStore(store);
      setFormData({
        name: store.name,
        code: store.code,
        address: store.address || '',
        phone: store.phone || '',
        email: store.email || '',
        gstin: store.gstin || '',
        parentStoreId: store.parentStoreId || '',
        isActive: store.isActive,
        managerId: store.managerId || '',
      });
      setShowModal(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const payload = {
        ...formData,
        parentStoreId: formData.parentStoreId || null,
        managerId: formData.managerId || null,
      };

      if (editingStore) {
        await apiClient.put(`/stores/${editingStore.id}`, payload);
      } else {
        await apiClient.post('/stores', payload);
      }

      setShowModal(false);
      fetchStores();
    } catch (error: any) {
      setError(error.response?.data?.error?.message || 'Failed to save store');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(store: Store) {
    if (!confirm(`Are you sure you want to deactivate "${store.name}"?`)) {
      return;
    }

    try {
      await apiClient.delete(`/stores/${store.id}`);
      fetchStores();
    } catch (error: any) {
      alert(error.response?.data?.error?.message || 'Failed to delete store');
    }
  }

  function getAllStoresFlat(storeList: Store[]): Store[] {
    const result: Store[] = [];
    function traverse(stores: Store[]) {
      for (const store of stores) {
        result.push(store);
        if (store.children && store.children.length > 0) {
          traverse(store.children);
        }
      }
    }
    traverse(storeList);
    return result;
  }

  const allStoresFlat = getAllStoresFlat(stores);
  const filteredStores = searchQuery
    ? allStoresFlat.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : stores;

  function renderStoreCard(store: Store, depth: number = 0) {
    return (
      <div key={store.id} className={depth > 0 ? 'ml-8' : ''}>
        <Card className={`mb-3 ${!store.isActive ? 'opacity-60' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{store.name}</h3>
                    <Badge variant="outline">{store.code}</Badge>
                    {!store.isActive && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {store.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{store.address}</span>
                      </div>
                    )}
                    {store.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{store.phone}</span>
                      </div>
                    )}
                    {store.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>{store.email}</span>
                      </div>
                    )}
                    {store.gstin && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">GSTIN: </span>
                        <span>{store.gstin}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditModal(store)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(store)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Render children */}
        {store.children && store.children.length > 0 && (
          <div className="border-l-2 border-muted pl-4">
            {store.children.map((child) => renderStoreCard(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold">Store Management</h1>
          <p className="text-muted-foreground">
            Manage your store locations and branches
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" />
          Add Store
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search stores..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stores List */}
      {stores.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No stores yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first store to get started
            </p>
            <Button onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" />
              Add Store
            </Button>
          </CardContent>
        </Card>
      ) : searchQuery ? (
        <div className="space-y-3">
          {filteredStores.map((store) => renderStoreCard(store as Store))}
          {filteredStores.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No stores found matching "{searchQuery}"
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {stores.map((store) => renderStoreCard(store))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {editingStore ? 'Edit Store' : 'Add New Store'}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                {editingStore
                  ? 'Update store information'
                  : 'Enter the details for the new store'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Store Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Main Store"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="code">Store Code *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          code: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="MAIN-001"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="123 Main Street, City"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="+1234567890"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="store@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gstin">GSTIN</Label>
                  <Input
                    id="gstin"
                    value={formData.gstin}
                    onChange={(e) =>
                      setFormData({ ...formData, gstin: e.target.value })
                    }
                    placeholder="GSTIN123456789"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manager">Store Manager (Optional)</Label>
                  <Select
                    value={formData.managerId}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        managerId: value === 'none' ? '' : value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No manager</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parentStore">Parent Store (Optional)</Label>
                  <Select
                    value={formData.parentStoreId}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        parentStoreId: value === 'none' ? '' : value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent store (for branches)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No parent (Main store)</SelectItem>
                      {allStoresFlat
                        .filter((s) => s.id !== editingStore?.id)
                        .map((store) => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name} ({store.code})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <Label htmlFor="isActive">Store is active</Label>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving
                      ? 'Saving...'
                      : editingStore
                        ? 'Update Store'
                        : 'Create Store'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div >
      )
      }
    </div >
  );
}
