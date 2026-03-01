'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Edit, Package, Printer } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { formatWeight } from '@/lib/weight-utils';
import { useReactToPrint } from 'react-to-print';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  barcode?: string;
  itemType: string;
  metalType?: string;
  purity?: string;
  grossWeight: string;
  netWeight: string;
  stoneWeight?: string;
  makingCharges?: string;
  wastagePercentage?: string;
  costRatePercentage?: string;
  calculatedCost?: string;
  costCalculationMethod?: string;
  isHallmarked: boolean;
  hallmarkNumber?: string;
  huidNumber?: string;
  certificationNumber?: string;
  certificationAgency?: string;
  certificationDate?: string | null;
  imageUrls?: string[];
  dimensions?: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category?: {
    id: string;
    name: string;
  };
  stones?: Array<{
    id: string;
    stoneType: string;
    count: number;
    totalWeight?: string;
    shape?: string;
    color?: string;
    clarity?: string;
  }>;
  stockLevels: Array<{
    quantity: number;
    reservedQuantity: number;
    location?: string;
  }>;
  batchItems?: Array<{
    batch: {
      id: string;
      batchNumber: string;
      purchaseDate: string;
    };
  }>;
}

interface LabelTemplate {
  id: string;
  name: string;
  labelWidth: number;
  labelHeight: number;
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
  companyName: string;
  showCompanyHeader: boolean;
  headerFontSize?: number;
  showBorder: boolean;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  backgroundColor?: string;
}

export default function InventoryItemDetailPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params.itemId as string;
  const { user } = useAuthStore();

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [template, setTemplate] = useState<LabelTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = user?.permissions?.includes('*:*');

  useEffect(() => {
    fetchItem();
    fetchTemplate();
  }, [itemId]);

  const fetchItem = async () => {
    try {
      const response = await apiClient.get(`/inventory/items/${itemId}`);
      if (response.data.success) {
        setItem(response.data.data);
      }
    } catch (error: any) {
      setError(error.response?.data?.error?.message || 'Failed to load item');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplate = async () => {
    try {
      const response = await apiClient.get('/labels/default');
      if (response.data.success) {
        setTemplate(response.data.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch template:', error);
    }
  };

  const getFieldValue = (item: InventoryItem, fieldName?: string): string => {
    if (!fieldName) return '';

    switch (fieldName) {
      case 'sku':
        return item.sku;
      case 'name':
        return item.name;
      case 'grossWeight':
        return `${parseFloat(item.grossWeight).toFixed(3)}g`;
      case 'netWeight':
        return `${parseFloat(item.netWeight).toFixed(3)}g`;
      case 'stoneWeight':
        return item.stoneWeight ? `${parseFloat(item.stoneWeight).toFixed(3)}g` : '';
      case 'metalType':
        return item.metalType || '';
      case 'purity':
        return item.purity || '';
      case 'barcode':
        return item.sku;
      case 'category':
        return item.category?.name || item.itemType || '';
      case 'companyName':
        return template?.companyName || 'MARI Jewellers';
      default:
        return '';
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Label_${item?.sku || itemId}`,
    pageStyle: `
      @page {
        size: ${template?.labelWidth || 50}mm ${template?.labelHeight || 30}mm;
        margin: 0;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `,
  });

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

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-96 bg-gray-200 rounded"></div>
            <div className="space-y-4">
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Item not found'}</p>
          <Button onClick={() => router.back()} className="mt-4" variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
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
            <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
            <p className="text-sm text-gray-500 mt-1">SKU: {item.sku}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && (
            <Button
              variant="outline"
              onClick={() => router.push(`/inventory/items/${itemId}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          <Button variant="outline" onClick={handlePrint} disabled={!template || !item}>
            <Printer className="h-4 w-4 mr-2" />
            Print Label
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Images & Stock */}
        <div className="space-y-6">
          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent>
              {item.imageUrls && item.imageUrls.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {item.imageUrls.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={`${item.name} - ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg border-2 border-dashed">
                  <Package className="h-12 w-12 text-gray-400" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stock Information */}
          <Card>
            <CardHeader>
              <CardTitle>Stock Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {item.stockLevels.map((stock, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                  <div>
                    <p className="font-medium">{stock.location || 'Main Stock'}</p>
                    {stock.reservedQuantity > 0 && (
                      <p className="text-xs text-gray-500">Reserved: {stock.reservedQuantity}</p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded text-sm font-medium ${
                    stock.quantity > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {stock.quantity} pcs
                  </span>
                </div>
              ))}
              {item.stockLevels.length === 0 && (
                <p className="text-sm text-gray-500">No stock information available</p>
              )}
            </CardContent>
          </Card>

          {/* Batch Information */}
          {item.batchItems && item.batchItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Batch Information</CardTitle>
              </CardHeader>
              <CardContent>
                {item.batchItems.map((batchItem, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Batch Number:</span>
                      <span className="font-medium">{batchItem.batch.batchNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Purchase Date:</span>
                      <span className="font-medium">
                        {new Date(batchItem.batch.purchaseDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Item Type</p>
                <p className="font-medium">{getItemTypeLabel(item.itemType)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Category</p>
                <p className="font-medium">{item.category?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Metal Type</p>
                <p className="font-medium capitalize">{item.metalType || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Purity</p>
                <p className="font-medium">{item.purity || '-'}</p>
              </div>
              {item.barcode && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Barcode</p>
                  <p className="font-medium font-mono">{item.barcode}</p>
                </div>
              )}
              {item.description && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Description</p>
                  <p className="font-medium">{item.description}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                  item.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {item.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Weight Details */}
          <Card>
            <CardHeader>
              <CardTitle>Weight Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Gross Weight</p>
                <p className="font-medium text-lg">
                  {formatWeight(parseFloat(item.grossWeight), true)}
                </p>
                <p className="text-xs text-gray-500">{parseFloat(item.grossWeight).toFixed(3)}g</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Net Weight</p>
                <p className="font-medium text-lg">
                  {formatWeight(parseFloat(item.netWeight), true)}
                </p>
                <p className="text-xs text-gray-500">{parseFloat(item.netWeight).toFixed(3)}g</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Stone Weight</p>
                <p className="font-medium text-lg">
                  {item.stoneWeight ? `${parseFloat(item.stoneWeight).toFixed(3)}g` : '-'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Cost Details */}
          <Card>
            <CardHeader>
              <CardTitle>Cost Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Cost Rate %</p>
                <p className="font-medium">{item.costRatePercentage ? `${item.costRatePercentage}%` : '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Wastage %</p>
                <p className="font-medium">{item.wastagePercentage ? `${item.wastagePercentage}%` : '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Making Charges</p>
                <p className="font-medium">
                  {item.makingCharges ? `Rs ${parseFloat(item.makingCharges).toLocaleString()}` : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Calculated Cost</p>
                <p className="font-medium text-lg">
                  {item.calculatedCost ? `Rs ${parseFloat(item.calculatedCost).toLocaleString()}` : '-'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Hallmark & Certification */}
          <Card>
            <CardHeader>
              <CardTitle>Hallmark & Certification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded text-sm font-medium ${
                  item.isHallmarked ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {item.isHallmarked ? 'Hallmarked' : 'Not Hallmarked'}
                </span>
              </div>

              {item.isHallmarked && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <p className="text-sm text-gray-600">Hallmark Number</p>
                    <p className="font-medium">{item.hallmarkNumber || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">HUID Number</p>
                    <p className="font-medium">{item.huidNumber || '-'}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-sm text-gray-600">Certification Number</p>
                  <p className="font-medium">{item.certificationNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Certification Agency</p>
                  <p className="font-medium">{item.certificationAgency || '-'}</p>
                </div>
                {item.certificationDate && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600">Certification Date</p>
                    <p className="font-medium">
                      {new Date(item.certificationDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stones Information */}
          {item.stones && item.stones.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Stones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {item.stones.map((stone, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-sm text-gray-600">Type</p>
                          <p className="font-medium capitalize">{stone.stoneType}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Count</p>
                          <p className="font-medium">{stone.count}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Weight</p>
                          <p className="font-medium">
                            {stone.totalWeight ? `${parseFloat(stone.totalWeight).toFixed(3)}ct` : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Shape</p>
                          <p className="font-medium capitalize">{stone.shape || '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Color</p>
                          <p className="font-medium">{stone.color || '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Clarity</p>
                          <p className="font-medium">{stone.clarity || '-'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Created At</p>
                <p className="font-medium">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Last Updated</p>
                <p className="font-medium">{new Date(item.updatedAt).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hidden Printable Label */}
      {template && item && (
        <div style={{ display: 'none' }}>
          <div ref={printRef}>
            <div
              style={{
                width: `${template.labelWidth}mm`,
                height: `${template.labelHeight}mm`,
                position: 'relative',
                backgroundColor: template.backgroundColor || '#FFFFFF',
                border: template.showBorder ? `${template.borderWidth || 1}px solid ${template.borderColor || '#000000'}` : 'none',
                borderRadius: `${template.borderRadius || 0}px`,
                padding: '2mm',
                boxSizing: 'border-box',
              }}
            >
              {/* Company Header */}
              {template.showCompanyHeader && (
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: `${template.headerFontSize || 12}px`,
                    fontWeight: 'bold',
                    marginBottom: '2mm',
                  }}
                >
                  {template.companyName}
                </div>
              )}

              {/* Dynamic Fields */}
              {template.fields.map((field) => {
                const value = field.customText || getFieldValue(item, field.field);

                if (field.type === 'text') {
                  return (
                    <div
                      key={field.id}
                      style={{
                        position: 'absolute',
                        left: `${field.x}mm`,
                        top: `${field.y}mm`,
                        width: field.width ? `${field.width}mm` : 'auto',
                        fontSize: `${field.fontSize || 10}px`,
                        fontWeight: field.fontWeight || 'normal',
                        textAlign: (field.textAlign as any) || 'left',
                        color: field.color || '#000000',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
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
                        width: field.width ? `${field.width}mm` : '30mm',
                        height: field.height ? `${field.height}mm` : '8mm',
                      }}
                    >
                      <svg viewBox="0 0 100 30" style={{ width: '100%', height: '100%' }}>
                        <rect x="2" y="2" width="2" height="20" fill="#000" />
                        <rect x="6" y="2" width="1" height="20" fill="#000" />
                        <rect x="9" y="2" width="2" height="20" fill="#000" />
                        <rect x="13" y="2" width="1" height="20" fill="#000" />
                        <rect x="16" y="2" width="3" height="20" fill="#000" />
                        <rect x="21" y="2" width="1" height="20" fill="#000" />
                        <rect x="24" y="2" width="2" height="20" fill="#000" />
                        <rect x="28" y="2" width="1" height="20" fill="#000" />
                        <text
                          x="50"
                          y="28"
                          textAnchor="middle"
                          fontSize="6"
                          fill="#000"
                        >
                          {value}
                        </text>
                      </svg>
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
                        width: field.width ? `${field.width}mm` : '20mm',
                        height: '0',
                        borderTop: `${field.height || 1}px solid ${field.color || '#000000'}`,
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
                        width: field.width ? `${field.width}mm` : '20mm',
                        height: field.height ? `${field.height}mm` : '10mm',
                        border: `1px solid ${field.color || '#000000'}`,
                        backgroundColor: 'transparent',
                      }}
                    />
                  );
                }

                return null;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
