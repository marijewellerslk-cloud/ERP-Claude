'use client';

import { useState, useEffect } from 'react';
import { X, Building2, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Store {
  id: string;
  name: string;
  code: string;
  hasAccess: boolean;
  canRequest: boolean;
}

interface RequestStoreAccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const DURATION_OPTIONS = [
  { hours: 2, label: '2 hours' },
  { hours: 8, label: '8 hours (1 work day)' },
  { hours: 24, label: '24 hours (1 day)' },
  { hours: 72, label: '72 hours (3 days)' },
];

export function RequestStoreAccessDialog({
  isOpen,
  onClose,
  onSuccess,
}: RequestStoreAccessDialogProps) {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState(8); // Default 8 hours
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchStores();
    }
  }, [isOpen]);

  const fetchStores = async () => {
    try {
      const response = await apiClient.get('/stores/accessible');
      if (response.data.success) {
        // Filter stores that can be requested
        const requestableStores = response.data.data.filter(
          (s: Store) => s.canRequest && !s.hasAccess
        );
        setStores(requestableStores);
      }
    } catch (error) {
      console.error('Failed to fetch stores:', error);
      setError('Failed to load stores');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedStoreId) {
      setError('Please select a store');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for access');
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await apiClient.post('/stores/access-requests', {
        requestedStoreId: selectedStoreId,
        reason: reason.trim(),
        requestedDurationHours: duration,
      });

      if (response.data.success) {
        onSuccess?.();
        handleClose();
      }
    } catch (error: any) {
      console.error('Failed to submit request:', error);
      setError(
        error.response?.data?.error?.message || 'Failed to submit request. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedStoreId('');
    setReason('');
    setDuration(8);
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
            <Building2 className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Request Store Access</h2>
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
          {/* Store Selection */}
          <div>
            <label htmlFor="store" className="block text-sm font-medium text-gray-700 mb-2">
              Select Store <span className="text-red-500">*</span>
            </label>
            {stores.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">
                No stores available for access request. You may already have access to all stores.
              </p>
            ) : (
              <select
                id="store"
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Choose a store...</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name} ({store.code})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Duration Selection */}
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Access Duration <span className="text-red-500">*</span>
              </div>
            </label>
            <select
              id="duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {DURATION_OPTIONS.map((option) => (
                <option key={option.hours} value={option.hours}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Access <span className="text-red-500">*</span>
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you need access to this store..."
              rows={4}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Your manager will review this request before granting access.
            </p>
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
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || stores.length === 0}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
