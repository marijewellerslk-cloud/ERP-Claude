'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Printer, Download, RefreshCw, QrCode } from 'lucide-react';
import apiClient from '@/lib/api-client';
import {
  generateZPL,
  downloadZPL,
  printToZebraUSB,
  previewZPL,
} from '@/lib/zebra-zpl';
import type { BarcodeData } from '@/lib/zebra-zpl';

interface InventoryItem {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  grossWeight: string;
  netWeight: string;
  stoneWeight: string;
  costRatePercentage: string;
  wastagePercentage: string;
  category?: {
    name: string;
  };
  metalType?: string;
  purity?: string;
}

export default function BarcodeReprintPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError('Please enter a search term');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get('/inventory/items', {
        params: {
          q: searchTerm, // Changed from 'search' to 'q' to match API
          limit: 50,
        },
      });

      if (response.data.success) {
        setItems(response.data.data);
        if (response.data.data.length === 0) {
          setError('No items found matching your search');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to search items');
    } finally {
      setLoading(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const selectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map((item) => item.id)));
    }
  };

  const getSelectedItemsData = (): BarcodeData[] => {
    return items
      .filter((item) => selectedItems.has(item.id))
      .map((item) => {
        const costRate = parseFloat(item.costRatePercentage || '0');
        const wastage = parseFloat(item.wastagePercentage || '0');
        // Calculate min selling rate as cost rate + wastage + 10% minimum profit margin
        const minSellingRate = costRate + wastage + 10;

        return {
          itemNumber: item.sku,
          barcode: item.barcode || item.sku,
          weight: parseFloat(item.grossWeight || '0'),
          costRatePercentage: costRate,
          minSellingRatePercentage: minSellingRate,
          stoneWeight: parseFloat(item.stoneWeight || '0'),
          netWeight: parseFloat(item.netWeight || '0'),
        };
      });
  };

  const handleDownloadZPL = () => {
    const selectedData = getSelectedItemsData();
    if (selectedData.length === 0) {
      alert('Please select at least one item');
      return;
    }

    const zpl = selectedData.map((data) => generateZPL(data)).join('\n\n');
    const filename = `barcodes_${new Date().getTime()}.zpl`;
    downloadZPL(zpl, filename);

    // Record reprint history
    recordReprintHistory(selectedData.map((d) => d.itemNumber));
  };

  const handlePrintUSB = async () => {
    const selectedData = getSelectedItemsData();
    if (selectedData.length === 0) {
      alert('Please select at least one item');
      return;
    }

    try {
      const zpl = selectedData.map((data) => generateZPL(data)).join('\n\n');
      await printToZebraUSB(zpl);
      alert('Print sent successfully!');

      // Record reprint history
      recordReprintHistory(selectedData.map((d) => d.itemNumber));
    } catch (error: any) {
      alert(error.message || 'Failed to print via USB');
    }
  };

  const handlePreview = async (item: InventoryItem) => {
    setPreviewLoading(true);
    setPreviewUrl(null);

    try {
      const costRate = parseFloat(item.costRatePercentage || '0');
      const wastage = parseFloat(item.wastagePercentage || '0');
      const minSellingRate = costRate + wastage + 10;

      const data: BarcodeData = {
        itemNumber: item.sku,
        barcode: item.barcode || item.sku,
        weight: parseFloat(item.grossWeight || '0'),
        costRatePercentage: costRate,
        minSellingRatePercentage: minSellingRate,
        stoneWeight: parseFloat(item.stoneWeight || '0'),
        netWeight: parseFloat(item.netWeight || '0'),
      };

      const zpl = generateZPL(data);
      const url = await previewZPL(zpl);
      setPreviewUrl(url);
    } catch (error) {
      alert('Failed to generate preview. Preview service may be unavailable.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const recordReprintHistory = async (itemNumbers: string[]) => {
    try {
      // This would be a backend endpoint to track reprint history
      await apiClient.post('/inventory/barcode-reprints', {
        itemNumbers,
        reprintedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to record reprint history:', error);
      // Don't show error to user as this is non-critical
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Barcode Reprint</h1>
        <p className="text-gray-500 mt-1">
          Search and reprint jewelry price tag labels (100mm x 15mm) for damaged or lost tags
        </p>
      </div>

      {/* Search Section */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by item number, barcode, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>

          <div className="text-sm text-gray-600">
            <p className="font-medium mb-1">Search tips:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Enter full or partial item number (e.g., "ITM-00123")</li>
              <li>Scan existing barcode to find the item</li>
              <li>Search by category or metal type</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Results Section */}
      {items.length > 0 && (
        <>
          {/* Action Buttons */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {selectedItems.size} of {items.length} item(s) selected
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={selectAll}>
                {selectedItems.size === items.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadZPL}
                disabled={selectedItems.size === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Download ZPL
              </Button>
              <Button
                size="sm"
                onClick={handlePrintUSB}
                disabled={selectedItems.size === 0}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print via USB
              </Button>
            </div>
          </div>

          {/* Items Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={selectedItems.size === items.length && items.length > 0}
                        onChange={selectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Item Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Barcode
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Weight (g)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Net Wt (g)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50 ${
                        selectedItems.has(item.id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.id)}
                          onChange={() => toggleItemSelection(item.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.sku}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {item.barcode || item.sku}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.category?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {parseFloat(item.grossWeight || '0').toFixed(3)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {parseFloat(item.netWeight || '0').toFixed(3)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreview(item)}
                        >
                          <QrCode className="h-4 w-4 mr-1" />
                          Preview
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Preview Modal */}
      {(previewUrl || previewLoading) && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => {
            setPreviewUrl(null);
            setPreviewLoading(false);
          }}
        >
          <Card className="p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Barcode Preview</h3>
            {previewLoading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : previewUrl ? (
              <div className="space-y-4">
                <img
                  src={previewUrl}
                  alt="Barcode Preview"
                  className="w-full border border-gray-300 rounded"
                />
                <div className="text-xs text-gray-500 text-center">
                  Actual size: 100mm x 15mm (jewelry label)
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setPreviewUrl(null);
                    setPreviewLoading(false);
                  }}
                >
                  Close
                </Button>
              </div>
            ) : null}
          </Card>
        </div>
      )}

      {/* Instructions */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-3">Printing Instructions</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <div>
            <span className="font-medium">USB Printing:</span> Connect your Zebra thermal printer
            via USB and click "Print via USB". Your browser will request permission to access the
            printer.
          </div>
          <div>
            <span className="font-medium">Mobile/Manual Printing:</span> Click "Download ZPL" to
            save the print file. Transfer it to a device connected to the printer and send to the
            printer using Zebra utilities.
          </div>
          <div>
            <span className="font-medium">Label Setup:</span> Ensure you're using 100mm x 15mm
            jewelry price tag labels (thermal/tearable) and the printer is set to 203 DPI (8 dots/mm).
          </div>
          <div>
            <span className="font-medium">Label Type:</span> Compatible with jewelry label stickers
            with tearable/perforated sections for price tags.
          </div>
        </div>
      </Card>
    </div>
  );
}
