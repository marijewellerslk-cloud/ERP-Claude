'use client';

import { AlertCircle, Lock, Eye, CheckCircle } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

interface PermissionBannerProps {
  hasManipulationPermission: boolean;
  onRequestPermission: () => void;
  className?: string;
}

export function PermissionBanner({
  hasManipulationPermission,
  onRequestPermission,
  className = '',
}: PermissionBannerProps) {
  const { user } = useAuthStore();

  // Don't show banner for users with wildcard permission (Super Admin/Owner)
  if (user?.permissions?.includes('*:*')) {
    return null;
  }

  // Full permission - show success banner
  if (hasManipulationPermission) {
    return (
      <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-green-900">Full Inventory Access</h3>
            <p className="text-sm text-green-700 mt-1">
              You have permission to create, update, and delete inventory items.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // View-only mode - show warning banner
  return (
    <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <Eye className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-yellow-900">View-Only Mode</h3>
          <p className="text-sm text-yellow-700 mt-1">
            You can view inventory but cannot create, update, or delete items. Request permission
            from your manager to make changes.
          </p>
        </div>
        <button
          onClick={onRequestPermission}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition-colors flex-shrink-0"
        >
          <Lock className="h-4 w-4" />
          Request Permission
        </button>
      </div>
    </div>
  );
}
