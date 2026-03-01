'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface LabelTemplate {
  id: string;
  name: string;
  description?: string;
  labelWidth: number;
  labelHeight: number;
  companyName: string;
  showCompanyHeader: boolean;
  headerFontSize: number;
  showBorder: boolean;
  borderWidth: number;
  borderColor: string;
  borderRadius: number;
  backgroundColor: string;
  fields: Array<{
    id: string;
    type: string;
    field?: string;
    label?: string;
    customText?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    fontSize?: number;
    fontWeight?: string;
    textAlign?: string;
    color?: string;
  }>;
}

export default function TemplatePreviewPage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.templateId as string;

  const [template, setTemplate] = useState<LabelTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplate();
  }, [templateId]);

  const fetchTemplate = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get(`/labels/${templateId}`);
      if (response.data.success) {
        setTemplate(response.data.data);
      } else {
        throw new Error('Failed to fetch template');
      }
    } catch (err: any) {
      console.error('Error fetching template:', err);
      setError(err.response?.data?.error?.message || 'Failed to load template');
    } finally {
      setIsLoading(false);
    }
  };

  // Sample data for preview
  const getSampleValue = (fieldName?: string): string => {
    if (!fieldName) return '';

    switch (fieldName) {
      case 'sku':
        return 'MJ-GR-001';
      case 'name':
        return 'Gold Ring';
      case 'grossWeight':
        return '10.500g';
      case 'netWeight':
        return '10.000g';
      case 'stoneWeight':
        return '0.500g';
      case 'metalType':
        return 'Gold';
      case 'purity':
        return '22K';
      case 'barcode':
        return 'MJ-GR-001';
      case 'category':
        return 'Rings';
      case 'companyName':
        return template?.companyName || 'MARI Jewellers';
      default:
        return '';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="p-6">
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          {error || 'Template not found'}
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
            <h1 className="text-2xl font-bold">Preview: {template.name}</h1>
            <p className="text-gray-500 mt-1">This is how your label will look when printed</p>
          </div>
        </div>
        <Button onClick={() => router.push(`/settings/label-designer/${templateId}`)}>
          Edit Template
        </Button>
      </div>

      {/* Template Info */}
      <Card className="mb-6 p-4 bg-blue-50 border-blue-200">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Label Size:</span>
            <span className="ml-2 font-medium">{template.labelWidth}mm × {template.labelHeight}mm</span>
          </div>
          <div>
            <span className="text-gray-600">Fields:</span>
            <span className="ml-2 font-medium">{template.fields.length} fields</span>
          </div>
          <div>
            <span className="text-gray-600">Border:</span>
            <span className="ml-2 font-medium">{template.showBorder ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </Card>

      {/* Preview Area */}
      <div className="bg-gray-100 p-8 rounded-lg flex items-center justify-center min-h-[500px]">
        <div className="bg-white p-8 rounded shadow-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 text-center">
            Label Preview (with sample data)
          </h3>

          {/* Label — matches actual print output: no padding, absolute positioning only */}
          <div
            style={{
              width: `${template.labelWidth}mm`,
              height: `${template.labelHeight}mm`,
              position: 'relative',
              backgroundColor: template.backgroundColor,
              border: template.showBorder
                ? `${template.borderWidth}px solid ${template.borderColor}`
                : '1px dashed #ccc',
              borderRadius: `${template.borderRadius}px`,
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >

            {/* Dynamic Fields */}
            {template.fields.map((field) => {
              const value = field.customText || getSampleValue(field.field);

              if (field.type === 'text') {
                return (
                  <div
                    key={field.id}
                    style={{
                      position: 'absolute',
                      left: `${field.x}mm`,
                      top: `${field.y}mm`,
                      fontSize: `${field.fontSize || 12}px`,
                      fontWeight: field.fontWeight || 'normal',
                      textAlign: (field.textAlign as any) || 'left',
                      color: field.color || '#000000',
                    }}
                  >
                    {field.label && <span style={{ fontWeight: 'bold' }}>{field.label}: </span>}
                    {value}
                  </div>
                );
              }

              if (field.type === 'barcode') {
                return (
                  <div
                    key={field.id}
                    style={{
                      position: 'absolute',
                      left: `${field.x}mm`,
                      top: `${field.y}mm`,
                      width: `${field.width || 30}mm`,
                      height: `${field.height || 10}mm`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px dashed #ccc',
                      fontSize: '8px',
                      color: '#666',
                    }}
                  >
                    <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '2px' }}>
                      |||||||||||
                    </div>
                    <div>{value}</div>
                  </div>
                );
              }

              if (field.type === 'line') {
                return (
                  <div
                    key={field.id}
                    style={{
                      position: 'absolute',
                      left: `${field.x}mm`,
                      top: `${field.y}mm`,
                      width: `${field.width || 20}mm`,
                      height: '1px',
                      backgroundColor: field.color || '#000000',
                    }}
                  />
                );
              }

              if (field.type === 'rectangle') {
                return (
                  <div
                    key={field.id}
                    style={{
                      position: 'absolute',
                      left: `${field.x}mm`,
                      top: `${field.y}mm`,
                      width: `${field.width || 20}mm`,
                      height: `${field.height || 10}mm`,
                      border: `1px solid ${field.color || '#000000'}`,
                    }}
                  />
                );
              }

              return null;
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 p-4 bg-gray-50 rounded text-xs text-gray-600">
            <p className="font-semibold mb-2">Note:</p>
            <p>• This preview uses sample data</p>
            <p>• Actual labels will display real item data when printed</p>
            <p>• Barcodes shown as placeholder (will be proper barcodes when printed)</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex justify-center gap-4">
        <Button variant="outline" onClick={() => router.back()}>
          Back to Templates
        </Button>
        <Button onClick={() => router.push(`/settings/label-designer/${templateId}`)}>
          Edit This Template
        </Button>
      </div>
    </div>
  );
}
