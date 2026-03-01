'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { PageHeader } from '@/components/ui/page-header';
import {
  Search,
  Grid3x3,
  List,
  Image as ImageIcon,
  Filter,
  Download,
  RefreshCw,
  ChevronDown,
  X,
  Edit,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatWeight, WEIGHT_CLASSES, convertToTraditionalWeight } from '@/lib/weight-utils';
import { useAuthStore } from '@/store/auth-store';
import { StoreSelector } from '@/components/stores/StoreSelector';
import { RequestStoreAccessDialog } from '@/components/stores/RequestStoreAccessDialog';
import { RequestInventoryPermissionDialog } from '@/components/stores/RequestInventoryPermissionDialog';
import { PermissionBanner } from '@/components/stores/PermissionBanner';
import { CategorySelector } from '@/components/inventory/CategorySelector';

type ViewMode = 'list' | 'card' | 'gallery';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  barcode?: string;
  itemType: string;
  metalType?: string;
  purity?: string;
  grossWeight: string;
  netWeight: string;
  stoneWeight?: string;
  isHallmarked: boolean;
  calculatedCost?: string;
  costRatePercentage?: string;
  imageUrls?: string[];
  category?: {
    id: string;
    name: string;
  };
  stockLevels: Array<{
    quantity: number;
    location?: string;
  }>;
  createdAt: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface Filters {
  categoryId?: string;
  weightClass?: { min: number; max: number };
  dateFrom?: string;
  dateTo?: string;
  supplierId?: string;
  priceMin?: number;
  priceMax?: number;
  showSlowMovers?: boolean;
  metalType?: string;
  purity?: string;
}

export default function InventoryPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [showTraditionalWeight, setShowTraditionalWeight] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({});
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Multi-store access state
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [showAccessRequestDialog, setShowAccessRequestDialog] = useState(false);
  const [showPermissionRequestDialog, setShowPermissionRequestDialog] = useState(false);
  const [hasManipulationPermission, setHasManipulationPermission] = useState(false);

  // Check if user is super admin
  const isSuperAdmin = user?.permissions?.includes('*:*');

  useEffect(() => {
    fetchCategories();
    fetchSuppliers();
    checkManipulationPermission();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItems();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, filters, page, selectedStoreId]);

  const checkManipulationPermission = async () => {
    const perms = user?.permissions || [];
    // Users with wildcard or inventory create/update/delete have manipulation permission
    if (perms.includes('*:*') || perms.includes('inventory:create') || perms.includes('inventory:update')) {
      setHasManipulationPermission(true);
      return;
    }

    // For other roles, permission is not granted
    setHasManipulationPermission(false);
  };

  const fetchCategories = async () => {
    try {
      const params: any = {};
      if (selectedStoreId) {
        params.storeId = selectedStoreId;
      }

      const response = await apiClient.get('/inventory/categories', { params });
      if (response.data.success) {
        setCategories(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await apiClient.get('/suppliers');
      if (response.data.success) {
        setSuppliers(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  };

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        q: searchQuery || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };

      // Add store filter for multi-store support
      if (selectedStoreId) {
        params.storeId = selectedStoreId;
      }

      if (filters.categoryId) params.categoryId = filters.categoryId;
      if (filters.weightClass) {
        params.weightMin = filters.weightClass.min;
        params.weightMax = filters.weightClass.max;
      }
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.supplierId) params.supplierId = filters.supplierId;
      if (filters.priceMin) params.priceMin = filters.priceMin;
      if (filters.priceMax) params.priceMax = filters.priceMax;
      if (filters.showSlowMovers) params.slowMovers = true;
      if (filters.metalType) params.metalType = filters.metalType;
      if (filters.purity) params.purity = filters.purity;

      const response = await apiClient.get('/inventory/items', { params });

      if (response.data.success) {
        setItems(response.data.data);
        setTotalCount(response.data.total || response.data.data.length);
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
    setPage(1);
  };

  const hasActiveFilters = () => {
    return Object.keys(filters).length > 0 || searchQuery.length > 0;
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const exportToExcel = async () => {
    try {
      const response = await apiClient.get('/inventory/items/export', {
        params: { format: 'excel' },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export:', error);
      alert('Failed to export inventory');
    }
  };

  const getItemTypeLabel = (type: string) => {
    switch (type) {
      case 'finished_goods':
        return 'Finished Goods';
      case 'raw_material':
        return 'Raw Material';
      case 'semi_finished':
        return 'Semi-Finished';
      default:
        return type;
    }
  };

  const renderListView = () => (
    <div className="bg-white rounded-lg shadow overflow-hidden">

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Metal/Purity</TableHead>
            <TableHead>Weight</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Cost</TableHead>
            {isSuperAdmin && (
              <TableHead className="text-right">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="cursor-pointer" onClick={() => router.push(`/inventory/items/${item.id}`)}>
              <TableCell>
                <div className="flex items-center">
                  {item.imageUrls && item.imageUrls[0] ? (
                    <img
                      src={item.imageUrls[0]}
                      alt={item.name}
                      className="h-10 w-10 rounded object-cover mr-3"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-gray-200 mr-3 flex items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900">{item.name}</div>
                    <div className="text-sm text-gray-500">{item.sku}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-gray-900">
                {item.category?.name || '-'}
              </TableCell>
              <TableCell className="text-gray-900">
                <div>{item.metalType ? item.metalType.charAt(0).toUpperCase() + item.metalType.slice(1) : '-'}</div>
                {item.purity && <div className="text-xs text-gray-500">{item.purity}</div>}
              </TableCell>
              <TableCell className="text-gray-900">
                <div className="font-medium">
                  {showTraditionalWeight
                    ? formatWeight(parseFloat(item.grossWeight), true)
                    : `${parseFloat(item.grossWeight).toFixed(3)}g`}
                </div>
                <div className="text-xs text-gray-500">Net: {parseFloat(item.netWeight).toFixed(3)}g</div>
              </TableCell>
              <TableCell>
                {item.stockLevels.length > 0 ? (
                  <span className={`px-2 py-1 text-xs rounded ${item.stockLevels[0].quantity > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                    {item.stockLevels[0].quantity} pcs
                  </span>
                ) : (
                  <span className="text-sm text-gray-500">-</span>
                )}
              </TableCell>
              <TableCell className="text-gray-900">
                {item.calculatedCost ? (
                  `Rs ${parseFloat(item.calculatedCost).toLocaleString()}`
                ) : item.costRatePercentage ? (
                  <span className="text-xs text-gray-500">{item.costRatePercentage}% rate</span>
                ) : (
                  '-'
                )}
              </TableCell>
              {isSuperAdmin && (
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/inventory/items/${item.id}/edit`);
                    }}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const renderCardView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
        <Card key={item.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push(`/inventory/items/${item.id}`)}>
          <CardContent className="pt-6">
            {item.imageUrls && item.imageUrls[0] && (
              <img
                src={item.imageUrls[0]}
                alt={item.name}
                className="w-full h-48 object-cover rounded mb-4"
              />
            )}
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
                <p className="text-xs text-gray-500">{item.sku}</p>
              </div>
              {item.isHallmarked && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  Hallmarked
                </span>
              )}
            </div>

            <div className="space-y-2 text-sm">
              {item.category && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Category:</span>
                  <span className="font-medium">{item.category.name}</span>
                </div>
              )}
              {item.metalType && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Metal:</span>
                  <span className="font-medium capitalize">{item.metalType} {item.purity}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Weight:</span>
                <span className="font-medium">
                  {showTraditionalWeight
                    ? formatWeight(parseFloat(item.grossWeight), true)
                    : `${parseFloat(item.grossWeight).toFixed(3)}g`}
                </span>
              </div>
              {item.stockLevels.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Stock:</span>
                  <span className={`font-medium ${item.stockLevels[0].quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {item.stockLevels[0].quantity} pcs
                  </span>
                </div>
              )}
              {(item.calculatedCost || item.costRatePercentage) && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Cost:</span>
                  <span className="font-medium">
                    {item.calculatedCost
                      ? `Rs ${parseFloat(item.calculatedCost).toLocaleString()}`
                      : `${item.costRatePercentage}% rate`
                    }
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderGalleryView = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {items.map((item) => (
        <Card key={item.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push(`/inventory/items/${item.id}`)}>
          <div className="aspect-square relative">
            {item.imageUrls && item.imageUrls[0] ? (
              <img
                src={item.imageUrls[0]}
                alt={item.name}
                className="w-full h-full object-cover rounded-t"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-t">
                <ImageIcon className="h-12 w-12 text-gray-400" />
              </div>
            )}
            {item.isHallmarked && (
              <span className="absolute top-2 right-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                HM
              </span>
            )}
          </div>
          <CardContent className="pt-3 pb-3">
            <h3 className="font-semibold text-sm text-gray-900 mb-1 truncate">{item.name}</h3>
            <p className="text-xs text-gray-500 mb-2">{item.sku}</p>
            <div className="text-xs space-y-1">
              <div className="font-medium text-blue-600">
                {showTraditionalWeight
                  ? convertToTraditionalWeight(parseFloat(item.grossWeight)).displayText
                  : `${parseFloat(item.grossWeight).toFixed(3)}g`}
              </div>
              {item.stockLevels.length > 0 && (
                <div className={`${item.stockLevels[0].quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {item.stockLevels[0].quantity} in stock
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  if (isLoading && items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Inventory"
        description={`${totalCount} ${totalCount === 1 ? 'item' : 'items'} in inventory`}
      >
        <Link href="/inventory/sold">
          <Button variant="outline">
            <TrendingUp className="h-4 w-4 mr-2" />
            View Sold Items
          </Button>
        </Link>
        <Button variant="outline" onClick={() => setShowTraditionalWeight(!showTraditionalWeight)}>
          {showTraditionalWeight ? 'Traditional Weight' : 'Metric Weight'}
        </Button>
        <Button variant="outline" onClick={exportToExcel}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <Button
          onClick={() => router.push('/inventory/batches/new')}
          disabled={!hasManipulationPermission}
          title={!hasManipulationPermission ? 'You need permission to add batches' : ''}
        >
          + Add Batch
        </Button>
      </PageHeader>

      {/* Store Selector (Super Admin & Owner only) */}
      <StoreSelector
        onStoreChange={(storeId) => {
          setSelectedStoreId(storeId);
          setPage(1);
        }}
        className="max-w-md"
      />

      {/* Permission Banner (Store Manager without permission) */}
      <PermissionBanner
        hasManipulationPermission={hasManipulationPermission}
        onRequestPermission={() => setShowPermissionRequestDialog(true)}
      />

      {/* Search and View Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search by name, SKU, or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={toggleFilters}
            className={hasActiveFilters() ? 'bg-blue-50 border-blue-300' : ''}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {hasActiveFilters() && (
              <span className="ml-2 bg-blue-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                {Object.keys(filters).length + (searchQuery ? 1 : 0)}
              </span>
            )}
          </Button>

          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-r-none"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'card' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('card')}
              className="rounded-none"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'gallery' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('gallery')}
              className="rounded-l-none"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Active Filter Badges */}
      {hasActiveFilters() && !showFilters && (
        <Card className="p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-gray-600 font-medium">Active Filters:</span>

            {filters.categoryId && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                Category: {categories.find(c => c.id === filters.categoryId)?.name}
                <button
                  onClick={() => {
                    const { categoryId, ...rest } = filters;
                    setFilters(rest);
                  }}
                  className="ml-1 hover:text-blue-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {filters.weightClass && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                Weight: {WEIGHT_CLASSES.find(wc => wc.min === filters.weightClass?.min && wc.max === filters.weightClass?.max)?.label}
                <button
                  onClick={() => {
                    const { weightClass, ...rest } = filters;
                    setFilters(rest);
                  }}
                  className="ml-1 hover:text-blue-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {filters.metalType && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                Metal: {filters.metalType.charAt(0).toUpperCase() + filters.metalType.slice(1)}
                <button
                  onClick={() => {
                    const { metalType, ...rest } = filters;
                    setFilters(rest);
                  }}
                  className="ml-1 hover:text-blue-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {filters.purity && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                Purity: {filters.purity}
                <button
                  onClick={() => {
                    const { purity, ...rest } = filters;
                    setFilters(rest);
                  }}
                  className="ml-1 hover:text-blue-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {filters.dateFrom && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                From: {new Date(filters.dateFrom).toLocaleDateString()}
                <button
                  onClick={() => {
                    const { dateFrom, ...rest } = filters;
                    setFilters(rest);
                  }}
                  className="ml-1 hover:text-blue-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {filters.dateTo && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                To: {new Date(filters.dateTo).toLocaleDateString()}
                <button
                  onClick={() => {
                    const { dateTo, ...rest } = filters;
                    setFilters(rest);
                  }}
                  className="ml-1 hover:text-blue-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {filters.priceMin && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                Min: Rs {filters.priceMin.toLocaleString()}
                <button
                  onClick={() => {
                    const { priceMin, ...rest } = filters;
                    setFilters(rest);
                  }}
                  className="ml-1 hover:text-blue-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {filters.priceMax && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                Max: Rs {filters.priceMax.toLocaleString()}
                <button
                  onClick={() => {
                    const { priceMax, ...rest } = filters;
                    setFilters(rest);
                  }}
                  className="ml-1 hover:text-blue-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {filters.showSlowMovers && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                Slow Movers Only
                <button
                  onClick={() => {
                    const { showSlowMovers, ...rest } = filters;
                    setFilters(rest);
                  }}
                  className="ml-1 hover:text-blue-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          </div>
        </Card>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <Card className="p-6 bg-gray-50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Advanced Filters</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(false)}>
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <CategorySelector
                categories={categories}
                value={filters.categoryId || ''}
                onChange={(value) => setFilters({ ...filters, categoryId: value || undefined })}
                placeholder="All Categories"
              />
            </div>

            {/* Weight Class Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Weight Class</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.weightClass ? `${filters.weightClass.min}-${filters.weightClass.max}` : ''}
                onChange={(e) => {
                  if (!e.target.value) {
                    const { weightClass, ...rest } = filters;
                    setFilters(rest);
                  } else {
                    const [min, max] = e.target.value.split('-').map(Number);
                    setFilters({ ...filters, weightClass: { min, max } });
                  }
                }}
              >
                <option value="">All Weights</option>
                {WEIGHT_CLASSES.map((wc, idx) => (
                  <option key={idx} value={`${wc.min}-${wc.max}`}>
                    {wc.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Metal Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Metal Type</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.metalType || ''}
                onChange={(e) => setFilters({ ...filters, metalType: e.target.value || undefined })}
              >
                <option value="">All Metals</option>
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
                <option value="platinum">Platinum</option>
                <option value="diamond">Diamond</option>
              </select>
            </div>

            {/* Purity Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Purity</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.purity || ''}
                onChange={(e) => setFilters({ ...filters, purity: e.target.value || undefined })}
              >
                <option value="">All Purities</option>
                <option value="24K">24K (999)</option>
                <option value="22K">22K (916)</option>
                <option value="18K">18K (750)</option>
                <option value="14K">14K (585)</option>
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date From</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.dateFrom || ''}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || undefined })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date To</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.dateTo || ''}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || undefined })}
              />
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Min Price (Rs)</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.priceMin || ''}
                onChange={(e) => setFilters({ ...filters, priceMin: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Price (Rs)</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.priceMax || ''}
                onChange={(e) => setFilters({ ...filters, priceMax: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Unlimited"
              />
            </div>
          </div>

          {/* Special Filters */}
          <div className="mt-4 flex items-center justify-between gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showSlowMovers || false}
                onChange={(e) => setFilters({ ...filters, showSlowMovers: e.target.checked || undefined })}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Show Slow Movers Only</span>
            </label>

            <div className="flex gap-2">
              <Button variant="outline" onClick={clearFilters}>
                Clear All
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Results */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600 mb-4">
              {searchQuery || hasActiveFilters()
                ? 'No items found matching your criteria'
                : 'No inventory items yet'}
            </p>
            {!searchQuery && !hasActiveFilters() && (
              <Button onClick={() => router.push('/inventory/batches/new')}>
                Create Your First Batch
              </Button>
            )}
            {hasActiveFilters() && (
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {viewMode === 'list' && renderListView()}
          {viewMode === 'card' && renderCardView()}
          {viewMode === 'gallery' && renderGalleryView()}

          {/* Pagination */}
          {totalCount > pageSize && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-sm text-gray-600">
                Page {page} of {Math.ceil(totalCount / pageSize)}
              </span>
              <Button
                variant="outline"
                disabled={page >= Math.ceil(totalCount / pageSize)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Request Store Access Dialog */}
      <RequestStoreAccessDialog
        isOpen={showAccessRequestDialog}
        onClose={() => setShowAccessRequestDialog(false)}
        onSuccess={() => {
          // Refresh accessible stores
          alert('Access request submitted successfully!');
        }}
      />

      {/* Request Inventory Permission Dialog */}
      <RequestInventoryPermissionDialog
        isOpen={showPermissionRequestDialog}
        onClose={() => setShowPermissionRequestDialog(false)}
        onSuccess={() => {
          alert('Permission request submitted successfully!');
        }}
      />
    </div>
  );
}
