'use client';

import { useState } from 'react';
import { X, Lock, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface RequestInventoryPermissionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RequestInventoryPermissionDialog({
  isOpen,
  onClose,
  onSuccess,
}: RequestInventoryPermissionDialogProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!reason.trim()) {
      setError('Please provide a reason for requesting permission');
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await apiClient.post('/stores/inventory-permissions/request', {
        reason: reason.trim(),
      });

      if (response.data.success) {
        onSuccess?.();
        handleClose();
      }
    } catch (error: any) {
      console.error('Failed to submit permission request:', error);
      const errorMessage = error.response?.data?.error?.message;

      if (errorMessage?.includes('already have a pending')) {
        setError('You already have a pending permission request. Please wait for approval.');
      } else {
        setError(errorMessage || 'Failed to submit request. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Lock className="h-6 w-6 text-orange-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Request Inventory Permission
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">What is this permission for?</p>
                <p>
                  This permission will allow you to create, update, and delete inventory items,
                  batches, and categories. Your manager must approve this request.
                </p>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Permission Request <span className="text-red-500">*</span>
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you need permission to manipulate inventory..."
              rows={5}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Be specific about your responsibilities and why you need this access level.
            </p>
          </div>

          {/* Examples */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Example reasons:</p>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>Managing daily inventory intake and batch creation</li>
              <li>Handling supplier purchases and item registration</li>
              <li>Managing stock adjustments and corrections</li>
              <li>Overseeing store operations and inventory control</li>
            </ul>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
