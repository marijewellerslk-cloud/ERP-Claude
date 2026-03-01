'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Edit,
  Copy,
  Trash2,
  Star,
  StarOff,
  Ruler,
  ArrowLeft,
  Eye,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';

interface LabelTemplate {
  id: string;
  name: string;
  description?: string;
  labelWidth: number;
  labelHeight: number;
  labelsPerRow: number;
  labelsPerColumn: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function LabelDesignerPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Allow any authenticated user to access label designer
    if (!user) {
      router.push('/login');
      return;
    }
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount - user check is handled by middleware

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/labels');
      if (response.data.success) {
        setTemplates(response.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch templates:', err);
      setError('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDefault = async (templateId: string) => {
    try {
      const response = await apiClient.post(`/labels/${templateId}/set-default`);
      if (response.data.success) {
        fetchTemplates();
      }
    } catch (err: any) {
      console.error('Failed to set default:', err);
      alert('Failed to set template as default');
    }
  };

  const handleDuplicate = async (templateId: string, name: string) => {
    try {
      const newName = prompt('Enter name for duplicated template:', `${name} (Copy)`);
      if (!newName) return;

      const response = await apiClient.post(`/labels/${templateId}/duplicate`, {
        name: newName,
      });

      if (response.data.success) {
        fetchTemplates();
      }
    } catch (err: any) {
      console.error('Failed to duplicate:', err);
      alert('Failed to duplicate template');
    }
  };

  const handleDelete = async (templateId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      await apiClient.delete(`/labels/${templateId}`);
      fetchTemplates();
    } catch (err: any) {
      console.error('Failed to delete:', err);
      alert(err.response?.data?.error?.message || 'Failed to delete template');
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Label Designer</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage and customize label templates
            </p>
          </div>
        </div>
        <Button onClick={() => router.push('/settings/label-designer/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Super Admin Notice */}
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Ruler className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900">Super Admin Access</h3>
              <p className="text-sm text-blue-700 mt-1">
                You have access to the label designer. Create custom templates to control
                how inventory labels are printed. The default template is used when printing
                batch labels.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Ruler className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Templates Found
            </h3>
            <p className="text-gray-600 mb-4">
              Create your first label template to get started
            </p>
            <Button onClick={() => router.push('/settings/label-designer/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Card
              key={template.id}
              className={`relative ${
                template.isDefault ? 'border-2 border-blue-500' : ''
              }`}
            >
              {template.isDefault && (
                <div className="absolute -top-3 left-4 bg-blue-500 text-white px-3 py-1 rounded text-xs font-semibold flex items-center gap-1">
                  <Star className="h-3 w-3 fill-white" />
                  Default Template
                </div>
              )}

              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-start justify-between">
                  <span className="line-clamp-1">{template.name}</span>
                  {!template.isActive && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      Inactive
                    </span>
                  )}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Description */}
                {template.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {template.description}
                  </p>
                )}

                {/* Specifications */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Label Size:</span>
                    <span className="font-medium">
                      {template.labelWidth}mm × {template.labelHeight}mm
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Layout:</span>
                    <span className="font-medium">
                      {template.labelsPerRow} × {template.labelsPerColumn}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Per Page:</span>
                    <span className="font-medium">
                      {template.labelsPerRow * template.labelsPerColumn} labels
                    </span>
                  </div>
                </div>

                {/* Metadata */}
                <div className="text-xs text-gray-500">
                  <p>Updated {new Date(template.updatedAt).toLocaleDateString()}</p>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      router.push(`/settings/label-designer/${template.id}`)
                    }
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      router.push(`/settings/label-designer/${template.id}/preview`)
                    }
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Preview
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {!template.isDefault ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefault(template.id)}
                      title="Set as default"
                    >
                      <StarOff className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled title="Already default">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDuplicate(template.id, template.name)}
                    title="Duplicate"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(template.id, template.name)}
                    disabled={template.isDefault}
                    title={template.isDefault ? 'Cannot delete default template' : 'Delete'}
                    className={template.isDefault ? '' : 'hover:bg-red-50 hover:text-red-600'}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Help Section */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Quick Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-700">
          <p>
            <strong>Default Template:</strong> The template marked as default will be used
            when printing labels from batch completion.
          </p>
          <p>
            <strong>Edit Template:</strong> Customize field positions, fonts, colors, and
            layout to match your requirements.
          </p>
          <p>
            <strong>Duplicate:</strong> Create variations of existing templates quickly by
            duplicating and modifying them.
          </p>
          <p>
            <strong>Label Size:</strong> Standard A4 paper fits 8 labels (2×4) at 90mm ×
            60mm each with proper margins.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
