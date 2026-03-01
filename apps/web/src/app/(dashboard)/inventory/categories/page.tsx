'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit2, Trash2, FolderTree } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { CategorySelector } from '@/components/inventory/CategorySelector';
import { CategoryTreeItem, Category } from '@/components/inventory/CategoryTreeItem';

interface CategoryStatistics {
  itemCount: number;
  totalGrossWeight: number;
  totalNetWeight: number;
  totalStoneWeight: number;
  lastMonthSales: number;
  currentMonthSales: number;
}



export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parentId: '',
    requiresLength: false,
    requiresWidth: false,
    requiresHeight: false,
    requiresInternalSize: false,
    requiresRingSize: false,
  });
  const [isOtherCategory, setIsOtherCategory] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    fetchCategories();
    checkSuperAdminStatus();
  }, []);

  const checkSuperAdminStatus = () => {
    // Check if user has wildcard permission (superadmin)
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setIsSuperAdmin(payload.permissions?.includes('*:*') || false);
      } catch (err) {
        console.error('Failed to parse token:', err);
        setIsSuperAdmin(false);
      }
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await apiClient.get('/inventory/categories/statistics');
      if (response.data.success) {
        const cats = response.data.data || [];
        console.log('Fetched categories:', cats);
        console.log('Category count:', cats.length);
        setCategories(cats);
      }
    } catch (err: any) {
      console.error('Failed to fetch categories:', err);
      setError('Failed to load categories');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        parentId: formData.parentId || undefined,
        requiresLength: formData.requiresLength,
        requiresWidth: formData.requiresWidth,
        requiresHeight: formData.requiresHeight,
        requiresInternalSize: formData.requiresInternalSize,
        requiresRingSize: formData.requiresRingSize,
      };

      let response;
      if (editingCategoryId) {
        // Update existing category
        response = await apiClient.put(`/inventory/categories/${editingCategoryId}`, payload);
      } else {
        // Create new category
        response = await apiClient.post('/inventory/categories', payload);
      }

      if (response.data.success) {
        await fetchCategories();
        setFormData({
          name: '',
          description: '',
          parentId: '',
          requiresLength: false,
          requiresWidth: false,
          requiresHeight: false,
          requiresInternalSize: false,
          requiresRingSize: false,
        });
        setShowForm(false);
        setEditingCategoryId(null);
      }
    } catch (err: any) {
      const message = err.response?.data?.error?.message || (editingCategoryId ? 'Failed to update category' : 'Failed to create category');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategoryId(category.id);
    setFormData({
      name: category.name,
      description: category.description || '',
      parentId: category.parentId || '',
      requiresLength: category.requiresLength || false,
      requiresWidth: category.requiresWidth || false,
      requiresHeight: category.requiresHeight || false,
      requiresInternalSize: category.requiresInternalSize || false,
      requiresRingSize: category.requiresRingSize || false,
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingCategoryId(null);
    setFormData({
      name: '',
      description: '',
      parentId: '',
      requiresLength: false,
      requiresWidth: false,
      requiresHeight: false,
      requiresInternalSize: false,
      requiresRingSize: false,
    });
    setShowForm(false);
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) {
      return;
    }

    try {
      const response = await apiClient.delete(`/inventory/categories/${categoryId}`);
      if (response.data.success) {
        await fetchCategories();
      }
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Failed to delete category';
      setError(message);
    }
  };

  // Build category tree for display
  const buildCategoryTree = (cats: Category[], parentId?: string | null): Category[] => {
    return cats
      .filter((cat) => {
        // Match null, undefined, or empty string as root categories
        if (!parentId) {
          return !cat.parentId || cat.parentId === '';
        }
        return cat.parentId === parentId;
      })
      .map((cat) => ({
        ...cat,
        children: buildCategoryTree(cats, cat.id),
      }));
  };

  // Render hierarchical category options for dropdown
  const renderCategoryOptions = (cats: Category[], level: number = 0, parentId?: string | null): JSX.Element[] => {
    const filtered = cats.filter((cat) => {
      if (!parentId) {
        return !cat.parentId || cat.parentId === '';
      }
      return cat.parentId === parentId;
    });
    const result: JSX.Element[] = [];

    filtered.forEach((cat) => {
      const prefix = '  '.repeat(level) + (level > 0 ? '└─ ' : '');
      result.push(
        <option key={cat.id} value={cat.id}>
          {prefix}{cat.name}
        </option>
      );

      // Recursively add children
      const children = renderCategoryOptions(cats, level + 1, cat.id);
      result.push(...children);
    });

    return result;
  };



  const categoryTree = buildCategoryTree(categories);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Product Categories</h1>
          <p className="text-gray-600 mt-1">Organize your inventory into categories</p>
        </div>
        <Button onClick={() => {
          if (showForm) {
            handleCancelEdit();
          } else {
            setShowForm(true);
          }
        }}>
          <Plus className="h-4 w-4 mr-2" />
          {showForm ? 'Cancel' : 'Add Category'}
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Add/Edit Category Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingCategoryId ? 'Edit Category' : 'Create New Category'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Category Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Rings, Necklaces, Earrings"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parentId">Parent Category (Optional)</Label>
                  <CategorySelector
                    categories={categories}
                    value={formData.parentId}
                    onChange={(value) => setFormData({ ...formData, parentId: value })}
                    placeholder="Select parent category (optional)..."
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this category"
                  disabled={isLoading}
                />
              </div>

              {/* Dimension Requirements */}
              <div className="space-y-3 p-4 bg-blue-50 rounded-md border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-900">
                  Dimension Requirements
                </h4>
                <p className="text-xs text-blue-700">
                  Select which dimension fields should appear when adding items to this category
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requiresLength}
                      onChange={(e) => setFormData({ ...formData, requiresLength: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300"
                      disabled={isLoading}
                    />
                    <span className="text-sm text-gray-700">Length</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requiresWidth}
                      onChange={(e) => setFormData({ ...formData, requiresWidth: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300"
                      disabled={isLoading}
                    />
                    <span className="text-sm text-gray-700">Width</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requiresHeight}
                      onChange={(e) => setFormData({ ...formData, requiresHeight: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300"
                      disabled={isLoading}
                    />
                    <span className="text-sm text-gray-700">Height</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requiresInternalSize}
                      onChange={(e) => setFormData({ ...formData, requiresInternalSize: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300"
                      disabled={isLoading}
                    />
                    <span className="text-sm text-gray-700">Internal Size</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requiresRingSize}
                      onChange={(e) => setFormData({ ...formData, requiresRingSize: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300"
                      disabled={isLoading}
                    />
                    <span className="text-sm text-gray-700">Ring Size</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading
                    ? (editingCategoryId ? 'Updating...' : 'Creating...')
                    : (editingCategoryId ? 'Update Category' : 'Create Category')
                  }
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Categories List */}
      <Card>
        <CardHeader>
          <CardTitle>All Categories ({categories.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-12">
              <FolderTree className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No categories yet</p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Category
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {categoryTree.map((category) => (
                <CategoryTreeItem
                  key={category.id}
                  category={category}
                  level={0}
                  isSuperAdmin={isSuperAdmin}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
