'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, AlertCircle, Printer } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { FieldEditor } from '@/components/labels/field-editor';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';

interface LabelTemplate {
  id: string;
  name: string;
  description?: string;
  pageSize: string;
  pageOrientation: string;
  labelWidth: number;
  labelHeight: number;
  labelsPerRow: number;
  labelsPerColumn: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  horizontalSpacing: number;
  verticalSpacing: number;
  companyName: string;
  showCompanyHeader: boolean;
  headerFontSize: number;
  showBorder: boolean;
  borderWidth: number;
  borderColor: string;
  borderRadius: number;
  backgroundColor: string;
  isDefault: boolean;
  isActive: boolean;
  fields: any[];
}

import { LabelPreview } from '@/components/labels/label-preview';
import { SAMPLE_ITEM, getFieldValue } from '@/lib/label-utils';

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.templateId as string;
  const { user } = useAuthStore();

  const [template, setTemplate] = useState<LabelTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'design' | 'config'>('design');
  const [showDieCutGuide, setShowDieCutGuide] = useState(false);

  const isNewTemplate = templateId === 'new';

  useEffect(() => {
    // Allow any authenticated user to access template editor
    if (!user) {
      router.push('/login');
      return;
    }

    if (isNewTemplate) {
      // Set default values for new template
      setTemplate({
        id: '',
        name: '',
        description: '',
        pageSize: 'custom', // Default to custom for 63x22
        pageOrientation: 'portrait',
        labelWidth: 63,
        labelHeight: 22,
        labelsPerRow: 1,
        labelsPerColumn: 1,
        marginTop: 0,
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 0,
        horizontalSpacing: 2,
        verticalSpacing: 2,
        companyName: 'MARI Jewellers',
        showCompanyHeader: true,
        headerFontSize: 16,
        showBorder: true,
        borderWidth: 1,
        borderColor: '#000000',
        borderRadius: 0,
        backgroundColor: '#FFFFFF',
        isDefault: false,
        isActive: true,
        fields: [],
      });
      setIsLoading(false);
    } else {
      fetchTemplate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]); // Only re-fetch when templateId changes

  const fetchTemplate = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get(`/labels/${templateId}`);
      if (response.data.success) {
        setTemplate(response.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch template:', err);
      setError('Failed to load template');
    } finally {
      setIsLoading(false);
    }
  };

  // Conversion factor: 1mm = 2.8346 pt (points, 1/72 inch)
  const MM_TO_PT = 2.8346;

  const handleTestPDF = () => {
    if (!template) return;

    const labelW_mm = Number(template.labelWidth) || 63;
    const labelH_mm = Number(template.labelHeight) || 22;

    // Use points for higher internal resolution (same as batch labels page)
    const labelW = labelW_mm * MM_TO_PT;
    const labelH = labelH_mm * MM_TO_PT;
    const orientation = labelW > labelH ? 'l' : 'p';

    const doc = new jsPDF({
      orientation,
      unit: 'pt',
      format: [labelW, labelH],
      compress: true,
    });

    const item = SAMPLE_ITEM;

    // Draw border if enabled
    if (template.showBorder) {
      const bw = (template.borderWidth || 1) * 0.75; // px → pt approx
      doc.setLineWidth(bw);
      doc.setDrawColor(template.borderColor || '#000000');
      doc.rect(bw / 2, bw / 2, labelW - bw, labelH - bw);
    }

    // Draw fields
    (template.fields || []).forEach((field: any) => {
      const value = String(field.customText || getFieldValue(item, field.field));

      if (!value && field.type !== 'line' && field.type !== 'rectangle') return;

      if (field.type === 'text') {
        const fontSizePt = field.fontSize || 10;
        doc.setFontSize(fontSizePt);
        doc.setTextColor(field.color || '#000000');

        const isBold = field.fontWeight === 'bold';
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');

        const x = Number(field.x) * MM_TO_PT;
        const y = Number(field.y) * MM_TO_PT + fontSizePt * 0.8;

        doc.text(value, x, y, {
          align: (field.textAlign as 'left' | 'center' | 'right') || 'left',
        });
      } else if (field.type === 'barcode') {
        const x = Number(field.x) * MM_TO_PT;
        const y = Number(field.y) * MM_TO_PT;
        const w = (Number(field.width) || 30) * MM_TO_PT;
        const h = (Number(field.height) || 10) * MM_TO_PT;

        // Generate a real scannable barcode
        try {
          const canvas = document.createElement('canvas');
          JsBarcode(canvas, value, {
            format: 'CODE128',
            width: 4,
            height: Math.max((Number(field.height) || 10) * 12, 80),
            displayValue: true,
            fontSize: 36,
            font: 'monospace',
            textMargin: 4,
            margin: 2,
          });
          const barcodeDataURL = canvas.toDataURL('image/png', 1.0);
          doc.addImage(barcodeDataURL, 'PNG', x, y, w, h);
        } catch {
          // Fallback: text
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.text(value, x + w / 2, y + h / 2, { align: 'center' });
        }
      } else if (field.type === 'line') {
        doc.setDrawColor(field.borderColor || field.color || '#000000');
        doc.setLineWidth((field.borderWidth || 1) * 0.75);
        const fw = (Number(field.width) || labelW_mm) * MM_TO_PT;
        doc.line(field.x * MM_TO_PT, field.y * MM_TO_PT, field.x * MM_TO_PT + fw, field.y * MM_TO_PT);
      } else if (field.type === 'rectangle') {
        doc.setDrawColor(field.borderColor || '#000000');
        doc.setLineWidth((field.borderWidth || 1) * 0.75);
        const rw = (Number(field.width) || 10) * MM_TO_PT;
        const rh = (Number(field.height) || 10) * MM_TO_PT;
        if (field.backgroundColor && field.backgroundColor !== 'transparent') {
          doc.setFillColor(field.backgroundColor);
          doc.rect(field.x * MM_TO_PT, field.y * MM_TO_PT, rw, rh, 'FD');
        } else {
          doc.rect(field.x * MM_TO_PT, field.y * MM_TO_PT, rw, rh);
        }
      }
    });

    doc.save(`Test_Label_${template.name.replace(/\s+/g, '_')}.pdf`);
  };

  const handleSave = async () => {
    if (!template) return;

    // Validate required fields before sending to backend
    if (!template.name || template.name.trim() === '') {
      setError('Template name is required');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // Clean and validate fields before sending to backend
      const cleanedFields = (template.fields || []).map(f => {
        // Ensure required fields are present
        const id = f.id || `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const type = f.type || 'text'; // Default to 'text' if not provided

        return {
          ...f,
          id, // Ensure ID is present
          type, // Ensure type is present
          // Ensure numeric values are numbers with proper fallback defaults
          x: Number(f.x) >= 0 ? Number(f.x) : 0,
          y: Number(f.y) >= 0 ? Number(f.y) : 0,
          width: Number(f.width) >= 1 ? Number(f.width) : 20,
          height: Number(f.height) >= 1 ? Number(f.height) : 8,
          fontSize: f.fontSize !== undefined && f.fontSize !== null ? Number(f.fontSize) : undefined,
          borderWidth: f.borderWidth !== undefined && f.borderWidth !== null ? Number(f.borderWidth) : undefined,
        };
      });

      const templateData = {
        name: template.name.trim(), // Ensure no leading/trailing spaces
        description: template.description,
        // Page = label size (one label per page)
        pageSize: 'custom' as const,
        pageWidth: Number(template.labelWidth),
        pageHeight: Number(template.labelHeight),
        pageOrientation: 'portrait' as const,
        labelWidth: Number(template.labelWidth),
        labelHeight: Number(template.labelHeight),
        labelsPerRow: 1,
        labelsPerColumn: 1,
        marginTop: 0,
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 0,
        horizontalSpacing: 0,
        verticalSpacing: 0,
        companyName: template.companyName,
        showCompanyHeader: template.showCompanyHeader,
        headerFontSize: Number(template.headerFontSize),
        showBorder: template.showBorder,
        borderWidth: Number(template.borderWidth),
        borderColor: template.borderColor,
        borderRadius: Number(template.borderRadius),
        backgroundColor: template.backgroundColor,
        isDefault: template.isDefault,
        isActive: template.isActive,
        fields: cleanedFields,
      };

      let response;
      if (isNewTemplate) {
        // Create new template
        response = await apiClient.post('/labels', templateData);
      } else {
        // Update existing template
        response = await apiClient.put(`/labels/${templateId}`, templateData);
      }

      if (response.data.success) {
        router.push('/settings/label-designer');
      }
    } catch (err: any) {
      console.error('Failed to save template:', err);
      setError(err.response?.data?.error?.message || 'Failed to save template');

      // If it's a validation error, show more specific details
      if (err.response?.data?.error?.details) {
        const validationErrors = err.response.data.error.details.map((e: any) => e.message).join(', ');
        setError(`Validation error: ${validationErrors}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !template) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push('/settings/label-designer')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isNewTemplate ? 'Create Template' : 'Edit Template'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isNewTemplate ? 'Configure your new label template' : template.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('design')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'design'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
                }`}
            >
              Designer
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'config'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
                }`}
            >
              Configuration
            </button>
          </div>
          <Button variant="outline" onClick={handleTestPDF} className="mr-2">
            <Printer className="h-4 w-4 mr-2" />
            Test PDF
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !template.name || template.name.trim() === ''}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : (isNewTemplate ? 'Create Template' : 'Save Changes')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex-shrink-0">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'design' ? (
          <div className="grid grid-cols-12 gap-6 h-full">
            {/* Left: Preview */}
            <div className="col-span-5 h-full flex flex-col">
              <div className="flex items-center space-x-2 py-2 px-1">
                <input
                  type="checkbox"
                  id="showDieCut"
                  checked={showDieCutGuide}
                  onChange={(e) => setShowDieCutGuide(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="showDieCut" className="text-sm cursor-pointer select-none text-gray-700">Show Printable Area (25.7mm x 21.5mm)</Label>
              </div>
              <LabelPreview
                template={template as any}
                sampleItem={SAMPLE_ITEM}
                showDieCutGuide={showDieCutGuide}
              />
            </div>

            {/* Right: Field Editor */}
            <div className="col-span-7 h-full overflow-y-auto pr-2">
              <FieldEditor
                fields={template.fields || []}
                onChange={(fields) => setTemplate({ ...template, fields })}
                labelWidth={template.labelWidth}
                labelHeight={template.labelHeight}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6 overflow-y-auto h-full pr-4 pb-8">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    value={template.name}
                    onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                    placeholder="My Custom Template"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input
                    id="description"
                    value={template.description || ''}
                    onChange={(e) => setTemplate({ ...template, description: e.target.value })}
                    placeholder="Brief description of this template"
                  />
                </div>
                <div>
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={template.companyName}
                    onChange={(e) => setTemplate({ ...template, companyName: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Label Size */}
            <Card>
              <CardHeader>
                <CardTitle>Label Size</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="labelWidth">Width (mm)</Label>
                    <Input
                      id="labelWidth"
                      type="number"
                      value={template.labelWidth}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 10;
                        setTemplate({ ...template, labelWidth: val });
                      }}
                      min="10"
                      max="500"
                    />
                  </div>
                  <div>
                    <Label htmlFor="labelHeight">Height (mm)</Label>
                    <Input
                      id="labelHeight"
                      type="number"
                      value={template.labelHeight}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 10;
                        setTemplate({ ...template, labelHeight: val });
                      }}
                      min="10"
                      max="500"
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Set the physical dimensions of the label sticker.
                </p>
              </CardContent>
            </Card>

            {/* Style Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Style Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showCompanyHeader"
                    checked={template.showCompanyHeader}
                    onChange={(e) =>
                      setTemplate({ ...template, showCompanyHeader: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <Label htmlFor="showCompanyHeader">Show Company Header</Label>
                </div>
                {template.showCompanyHeader && (
                  <div>
                    <Label htmlFor="headerFontSize">Header Font Size</Label>
                    <Input
                      id="headerFontSize"
                      type="number"
                      value={template.headerFontSize}
                      onChange={(e) =>
                        setTemplate({ ...template, headerFontSize: parseInt(e.target.value) })
                      }
                      min="8"
                      max="48"
                    />
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showBorder"
                    checked={template.showBorder}
                    onChange={(e) => setTemplate({ ...template, showBorder: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="showBorder">Show Border</Label>
                </div>
                {template.showBorder && (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="borderWidth">Border Width</Label>
                      <Input
                        id="borderWidth"
                        type="number"
                        value={template.borderWidth}
                        onChange={(e) =>
                          setTemplate({ ...template, borderWidth: parseInt(e.target.value) })
                        }
                        min="0"
                        max="10"
                      />
                    </div>
                    <div>
                      <Label htmlFor="borderColor">Border Color</Label>
                      <Input
                        id="borderColor"
                        type="color"
                        value={template.borderColor}
                        onChange={(e) =>
                          setTemplate({ ...template, borderColor: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="borderRadius">Border Radius</Label>
                      <Input
                        id="borderRadius"
                        type="number"
                        value={template.borderRadius}
                        onChange={(e) =>
                          setTemplate({ ...template, borderRadius: parseInt(e.target.value) })
                        }
                        min="0"
                        max="50"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <Label htmlFor="backgroundColor">Background Color</Label>
                  <Input
                    id="backgroundColor"
                    type="color"
                    value={template.backgroundColor}
                    onChange={(e) =>
                      setTemplate({ ...template, backgroundColor: e.target.value })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Template Status */}
            <Card>
              <CardHeader>
                <CardTitle>Template Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={template.isActive}
                    onChange={(e) => setTemplate({ ...template, isActive: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="isActive">Template is Active</Label>
                </div>
                {template.isDefault && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-900">
                      This is the default template used for printing labels.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
