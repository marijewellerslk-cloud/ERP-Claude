'use client';

import { useEffect, useState } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';

interface Store {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  hasAccess: boolean;
  isAssigned: boolean;
  canRequest: boolean;
}

interface StoreSelectorProps {
  onStoreChange?: (storeId: string | null) => void;
  className?: string;
}

export function StoreSelector({ onStoreChange, className = '' }: StoreSelectorProps) {
  const { user } = useAuthStore();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Only show store selector for users with wildcard permission (Super Admin/Owner)
  const canViewMultipleStores = user?.permissions?.includes('*:*');

  // Fetch stores only when dropdown is opened for the first time
  useEffect(() => {
    if (isOpen && !hasFetched && canViewMultipleStores) {
      fetchAccessibleStores();
    }
  }, [isOpen, hasFetched, canViewMultipleStores]);

  const fetchAccessibleStores = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/stores/accessible');

      if (response.data.success) {
        const accessibleStores = response.data.data.filter((s: Store) => s.hasAccess);
        setStores(accessibleStores);

        // Set default to assigned store
        const assignedStore = accessibleStores.find((s: Store) => s.isAssigned);
        if (assignedStore) {
          setSelectedStoreId(assignedStore.id);
        }
        
        setHasFetched(true);
      }
    } catch (error) {
      console.error('Failed to fetch accessible stores:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStoreSelect = (storeId: string | null) => {
    setSelectedStoreId(storeId);
    setIsOpen(false);
    onStoreChange?.(storeId);
  };

  // Don't render for roles that can't view multiple stores
  if (!canViewMultipleStores) {
    return null;
  }

  const selectedStore = stores.find((s) => s.id === selectedStoreId);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-2 text-left border rounded-lg bg-white hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-gray-600" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">
              {isLoading ? 'Loading...' : selectedStoreId === null ? 'All Stores' : selectedStore?.name || 'Select Store'}
            </span>
            {selectedStore && (
              <span className="text-xs text-gray-500">{selectedStore.code}</span>
            )}
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-gray-400 transition-transform ${
            isOpen ? 'transform rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg z-20 max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-gray-500">
                Loading stores...
              </div>
            ) : (
              <>
                {/* All Stores Option */}
                <button
                  onClick={() => handleStoreSelect(null)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b ${
                    selectedStoreId === null ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">All Stores</div>
                        <div className="text-xs text-gray-500">View inventory from all stores</div>
                      </div>
                    </div>
                    {selectedStoreId === null && (
                      <Check className="h-5 w-5 text-blue-600" />
                    )}
                  </div>
                </button>

                {/* Individual Stores */}
                {stores.map((store) => (
                  <button
                    key={store.id}
                    onClick={() => handleStoreSelect(store.id)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                      selectedStoreId === store.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-gray-600" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                            {store.name}
                            {store.isAssigned && (
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                Assigned
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{store.code}</div>
                          {store.address && (
                            <div className="text-xs text-gray-400 mt-0.5">{store.address}</div>
                          )}
                        </div>
                      </div>
                      {selectedStoreId === store.id && (
                        <Check className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
