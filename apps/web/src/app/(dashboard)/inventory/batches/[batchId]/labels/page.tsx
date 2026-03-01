'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, Check, ArrowLeft, Download, Usb, FileDown } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';
import { getFieldValue } from '@/lib/label-utils';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  itemType: string;
  metalType?: string;
  purity?: string;
  grossWeight: string;
  netWeight: string;
  stoneWeight?: string;
  countryOfOrigin?: string;
  branch?: string;
  gemType?: string;
  gemWeight?: string;
  dimensions?: any;
  calculatedCost?: string | number;
  makingCharges?: string | number;
  costRatePercentage?: string | number;
}

interface BatchItem {
  id: string;
  inventoryItem: InventoryItem;
}

interface Batch {
  id: string;
  batchNumber: string;
  status: string;
  batchItems: BatchItem[];
  store?: { name: string };
}

interface LabelField {
  id: string;
  type: 'text' | 'barcode' | 'qr' | 'line' | 'rectangle' | 'image';
  field?: string;
  label?: string;
  customText?: string;
  imageUrl?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  textAlign?: string;
  color?: string;
  backgroundColor?: string;
  borderWidth?: number;
  borderColor?: string;
}

interface LabelTemplate {
  id: string;
  name: string;
  description?: string;
  pageSize: string;
  pageWidth?: number;
  pageHeight?: number;
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
  fields: LabelField[];
  companyName: string;
  showCompanyHeader: boolean;
  headerFontSize?: number;
  showBorder: boolean;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  backgroundColor?: string;
  isDefault: boolean;
  isActive: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// Barcode helpers
// ─────────────────────────────────────────────────────────────────────

/** SVG barcode for on-screen preview */
function BarcodeImage({ value, height, fontSize }: { value: string; width?: number; height?: number; fontSize?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width: 2,
          height: height ? height * 3 : 30,
          displayValue: true,
          fontSize: fontSize || 10,
          font: 'monospace',
          textMargin: 1,
          margin: 0,
        });
      } catch { /* ignore invalid values */ }
    }
  }, [value, height, fontSize]);

  if (!value) return null;
  return <svg ref={svgRef} style={{ width: '100%', height: '100%', shapeRendering: 'crispEdges' }} />;
}

/**
 * Render barcode to a canvas SVG string (for embedding in print HTML).
 * Returns an inline <svg> string instead of a canvas-rasterized PNG,
 * which means it prints at infinite resolution (vector).
 */
function generateBarcodeSVGString(value: string, heightMM: number): string {
  try {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    JsBarcode(svg, value, {
      format: 'CODE128',
      width: 2,
      height: Math.max(heightMM * 3, 30),
      displayValue: true,
      fontSize: 10,
      font: 'monospace',
      textMargin: 1,
      margin: 0,
      xmlDocument: document,
    });
    // Serialise to string
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svg);
  } catch {
    return `<span style="font-size:8pt;font-family:monospace">${value}</span>`;
  }
}

/**
 * Generate high-resolution barcode PNG data URL for jsPDF embedding.
 * Uses a very large canvas so the output stays sharp even on small labels.
 */
function generateBarcodeDataURL(value: string, heightMM: number): string | null {
  try {
    // Create a high-DPI canvas for the barcode
    const scale = 4; // 4x resolution
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, value, {
      format: 'CODE128',
      width: 3 * scale,               // thick bars for clarity
      height: Math.max(heightMM * 4 * scale, 120),
      displayValue: true,
      fontSize: 14 * scale,
      font: 'monospace',
      textMargin: 2 * scale,
      margin: 1 * scale,
    });
    return canvas.toDataURL('image/png', 1.0);
  } catch {
    return null;
  }
}

// 1 mm = 2.8346 pt
const MM_TO_PT = 2.8346;

// ─────────────────────────────────────────────────────────────────────
//  ZPL Generation for Zebra thermal printers (203 DPI = 8 dots/mm)
// ─────────────────────────────────────────────────────────────────────
const DOTS_PER_MM = 8; // Zebra ZD888 at 203 DPI

/**
 * Convert label template fields to ZPL commands for a single item.
 * Uses Zebra's native barcode rendering (^BC for Code 128) which
 * prints at the printer's native 203 DPI — always crisp.
 */
function generateItemZPL(
  item: InventoryItem,
  template: LabelTemplate,
): string {
  const w = Math.round((Number(template.labelWidth) || 63) * DOTS_PER_MM);
  const h = Math.round((Number(template.labelHeight) || 22) * DOTS_PER_MM);

  // ── Printer config (matched from working zebra-zpl.ts) ──
  let zpl = '^XA\n';
  zpl += `^PW${w}\n`;     // Print width
  zpl += `^LL${h}\n`;     // Label length
  zpl += '^LH0,0\n';      // Label home (origin)
  zpl += '^POI\n';         // Print Orientation Inverted (180° flip)
  zpl += '^MTT\n';         // Media Type: Thermal Transfer
  zpl += '^JMA\n';         // 24-dot resolution
  zpl += '~SD15\n';        // Set Darkness: 15 (matches working labels)
  zpl += '^PR6,6\n';       // Print speed: 6 ips (matches working labels)
  zpl += '^MNW\n';         // Media tracking: web sensing
  zpl += '^CI27\n';        // Character encoding

  // Border
  if (template.showBorder) {
    const bw = Math.max(Math.round((template.borderWidth || 1) * 0.75), 1);
    zpl += `^FO0,0^GB${w},${h},${bw}^FS\n`;
  }

  // Render each field
  (template.fields || []).forEach((field) => {
    const value = field.customText || getFieldValue(item, field.field, undefined, template.companyName);
    if (!value && !['line', 'rectangle'].includes(field.type)) return;

    const fx = Math.round(Number(field.x) * DOTS_PER_MM);
    const fy = Math.round(Number(field.y) * DOTS_PER_MM);

    if (field.type === 'text') {
      // Font sizing matched to working ZPL: use 1:1 height:width ratio
      // Working labels use ^A0N,20,20 and ^A0N,16,16
      const ptSize = field.fontSize || 10;
      const fontH = Math.max(Math.round(ptSize * 2.4), 16); // minimum 16 dots
      const fontW = fontH; // 1:1 ratio like working labels

      // ^FH enables hex escaping for special characters (matches working ZPL)
      zpl += `^FO${fx},${fy}^A0N,${fontH},${fontW}^FH`;

      // Build display text
      const displayText = (field.label ? `${field.label} ${value}` : value)
        .replace(/\^/g, ' ')
        .replace(/~/g, ' ');
      zpl += `^FD${displayText}^FS\n`;

    } else if (field.type === 'barcode') {
      // MATCHED from working zebra-zpl.ts: ^BCN,50,N,N,N
      // NO ^BY command — uses Zebra default module width (2 dots)
      // N = no interpretation line (no text below barcode)
      // Height: 40 dots (5mm) — compact but scannable
      const barcodeH = 40;

      zpl += `^FO${fx},${fy}^BCN,${barcodeH},N,N,N^FD${value}^FS\n`;

    } else if (field.type === 'line') {
      const lw = Math.round((Number(field.width) || Number(template.labelWidth)) * DOTS_PER_MM);
      const lh = Math.max(Math.round((field.borderWidth || 1) * 0.75), 1);
      zpl += `^FO${fx},${fy}^GB${lw},${lh},${lh}^FS\n`;

    } else if (field.type === 'rectangle') {
      const rw = Math.round((Number(field.width) || 10) * DOTS_PER_MM);
      const rh = Math.round((Number(field.height) || 10) * DOTS_PER_MM);
      const bw = Math.max(Math.round((field.borderWidth || 1) * 0.75), 1);
      zpl += `^FO${fx},${fy}^GB${rw},${rh},${bw}^FS\n`;
    }
  });

  zpl += '^PQ1,0,1,Y\n'; // Print quantity: 1 copy
  zpl += '^XZ';           // End of label
  return zpl;
}

/** Generate ZPL for all batch items */
function generateBatchZPL(
  items: BatchItem[],
  template: LabelTemplate,
): string {
  return items.map((bi) => generateItemZPL(bi.inventoryItem, template)).join('\n\n');
}

/** Send ZPL to Zebra printer via backend API (uses CUPS lp command) */
async function sendZPLViaCUPS(zpl: string): Promise<string> {
  // Use the API client from the app
  const response = await apiClient.post('/print/zpl', { zpl });
  if (!response.data.success) {
    throw new Error(response.data.error?.message || 'Print failed');
  }
  return response.data.data.printer;
}

/** Download ZPL as a file */
function downloadZPLFile(zpl: string, filename: string) {
  const blob = new Blob([zpl], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────

export default function PrintLabelsPage() {
  const router = useRouter();
  const params = useParams();
  const batchId = params.batchId as string;

  const [batch, setBatch] = useState<Batch | null>(null);
  const [template, setTemplate] = useState<LabelTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zebraStatus, setZebraStatus] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const batchResponse = await apiClient.get(`/inventory/batches/${batchId}`);
        setBatch(batchResponse.data.data);
        const templateResponse = await apiClient.get('/labels/default');
        setTemplate(templateResponse.data.data);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || err.message || 'Failed to load data');
      }
    };
    fetchData();
  }, [batchId]);

  // ═══════════════════════════════════════════════════════════════════
  //  PDF DOWNLOAD — uses jsPDF with pt units + high-res barcode images
  // ═══════════════════════════════════════════════════════════════════
  const handleDownloadPDF = useCallback(() => {
    if (!batch || !template) return;

    const w_mm = Number(template.labelWidth) || 63;
    const h_mm = Number(template.labelHeight) || 22;
    const w = w_mm * MM_TO_PT;
    const h = h_mm * MM_TO_PT;
    const orient = w > h ? 'l' : 'p';

    const doc = new jsPDF({ orientation: orient, unit: 'pt', format: [w, h], compress: true });

    batch.batchItems.forEach((batchItem, idx) => {
      if (idx > 0) doc.addPage([w, h], orient);
      const item = batchItem.inventoryItem;

      if (template.showBorder) {
        const bw = (template.borderWidth || 1) * 0.75;
        doc.setLineWidth(bw);
        doc.setDrawColor(template.borderColor || '#000');
        doc.rect(bw / 2, bw / 2, w - bw, h - bw);
      }

      template.fields.forEach((field) => {
        const val = String(field.customText || getFieldValue(item, field.field));
        if (!val && !['line', 'rectangle'].includes(field.type)) return;

        if (field.type === 'text') {
          const fs = field.fontSize || 10;
          doc.setFontSize(fs);
          doc.setTextColor(field.color || '#000');
          doc.setFont('helvetica', field.fontWeight === 'bold' ? 'bold' : 'normal');
          doc.text(val, Number(field.x) * MM_TO_PT, Number(field.y) * MM_TO_PT + fs * 0.8, {
            align: (field.textAlign as 'left' | 'center' | 'right') || 'left',
          });
        } else if (field.type === 'barcode') {
          const fx = Number(field.x) * MM_TO_PT;
          const fy = Number(field.y) * MM_TO_PT;
          const fw = (Number(field.width) || 30) * MM_TO_PT;
          const fh = (Number(field.height) || 10) * MM_TO_PT;
          const dataUrl = generateBarcodeDataURL(val, Number(field.height) || 10);
          if (dataUrl) {
            doc.addImage(dataUrl, 'PNG', fx, fy, fw, fh);
          }
        } else if (field.type === 'line') {
          doc.setDrawColor(field.borderColor || field.color || '#000');
          doc.setLineWidth((field.borderWidth || 1) * 0.75);
          const lw = (Number(field.width) || w_mm) * MM_TO_PT;
          doc.line(field.x * MM_TO_PT, field.y * MM_TO_PT, field.x * MM_TO_PT + lw, field.y * MM_TO_PT);
        } else if (field.type === 'rectangle') {
          doc.setDrawColor(field.borderColor || '#000');
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
    });

    doc.save(`Labels_${batch.batchNumber}.pdf`);
  }, [batch, template]);

  // ═══════════════════════════════════════════════════════════════════
  //  DIRECT PRINT — opens a dedicated print window with all labels
  //  Uses an iframe with a standalone HTML document so the browser's
  //  print engine gets a clean DOM with proper @page rules.
  // ═══════════════════════════════════════════════════════════════════
  const handlePrint = useCallback(() => {
    if (!batch || !template) return;

    const w = Number(template.labelWidth) || 63;
    const h = Number(template.labelHeight) || 22;

    // Build label HTML for each item
    const labelsHTML = batch.batchItems.map((batchItem, idx) => {
      const item = batchItem.inventoryItem;
      const isLast = idx === batch.batchItems.length - 1;

      const fieldsHTML = template.fields.map((field) => {
        const val = field.customText || getFieldValue(item, field.field);

        if (field.type === 'text') {
          return `<div style="
            position: absolute;
            left: ${field.x}mm;
            top: ${field.y}mm;
            ${field.width ? `width: ${field.width}mm;` : ''}
            ${field.height ? `height: ${field.height}mm;` : ''}
            font-size: ${field.fontSize || 10}pt;
            font-family: ${field.fontFamily || 'Arial'}, sans-serif;
            font-weight: ${field.fontWeight || 'normal'};
            text-align: ${field.textAlign || 'left'};
            color: ${field.color || '#000'};
            white-space: nowrap;
            line-height: 1.1;
            display: flex;
            align-items: center;
          ">${field.label ? `<span>${field.label} </span>` : ''}<span>${val}</span></div>`;
        }

        if (field.type === 'barcode') {
          const svgStr = generateBarcodeSVGString(val, Number(field.height) || 10);
          return `<div style="
            position: absolute;
            left: ${field.x}mm;
            top: ${field.y}mm;
            width: ${field.width || 30}mm;
            height: ${field.height || 10}mm;
          ">${svgStr}</div>`;
        }

        if (field.type === 'line') {
          return `<div style="
            position: absolute;
            left: ${field.x}mm;
            top: ${field.y}mm;
            width: ${field.width || w}mm;
            height: ${field.borderWidth || 1}px;
            background: ${field.borderColor || field.color || '#000'};
          "></div>`;
        }

        if (field.type === 'rectangle') {
          return `<div style="
            position: absolute;
            left: ${field.x}mm;
            top: ${field.y}mm;
            width: ${field.width || 10}mm;
            height: ${field.height || 10}mm;
            background: ${field.backgroundColor || 'transparent'};
            border: ${field.borderWidth || 1}px solid ${field.borderColor || '#000'};
          "></div>`;
        }

        return '';
      }).join('\n');

      return `
        <div class="label${isLast ? ' last' : ''}" style="
          width: ${w}mm;
          height: ${h}mm;
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
          background: ${template.backgroundColor || '#fff'};
          ${template.showBorder ? `border: ${template.borderWidth || 1}px solid ${template.borderColor || '#000'};` : ''}
          ${template.borderRadius ? `border-radius: ${template.borderRadius}px;` : ''}
        ">
          ${fieldsHTML}
        </div>
      `;
    }).join('\n');

    // Build the full print document
    const printHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Labels_${batch.batchNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page {
      size: ${w}mm ${h}mm;
      margin: 0;
    }
    body {
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .label {
      page-break-after: always;
      page-break-inside: avoid;
      break-after: page;
      break-inside: avoid;
    }
    .label.last {
      page-break-after: auto;
      break-after: auto;
    }
    /* Ensure SVG barcodes print with crisp edges */
    svg {
      shape-rendering: crispEdges;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  ${labelsHTML}
</body>
</html>`;

    // Use an iframe for more reliable rendering
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      alert('Failed to create print frame');
      document.body.removeChild(iframe);
      return;
    }

    iframeDoc.open();
    iframeDoc.write(printHTML);
    iframeDoc.close();

    // Wait for content to render fully, then print
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch { /* print failed */ }
      // Clean up iframe after print dialog closes
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch { /* already removed */ }
      }, 2000);
    }, 800);
  }, [batch, template]);

  // ═══════════════════════════════════════════════════════════════════
  //  ZEBRA ZPL PRINT — sends native ZPL commands via USB
  //  Uses Zebra's native Code 128 barcode rendering at 203 DPI
  // ═══════════════════════════════════════════════════════════════════
  const handleZebraPrint = useCallback(async () => {
    if (!batch || !template) return;

    try {
      setZebraStatus('Generating ZPL...');
      const zpl = generateBatchZPL(batch.batchItems, template);

      setZebraStatus('Connecting to Zebra printer...');
      const printerName = await sendZPLViaCUPS(zpl);

      setZebraStatus(`✅ Sent ${batch.batchItems.length} labels to ${printerName}!`);
      setTimeout(() => setZebraStatus(null), 5000);
    } catch (err: any) {
      setZebraStatus(`❌ ${err.message || 'Failed to print'}`);
      setTimeout(() => setZebraStatus(null), 8000);
    }
  }, [batch, template]);

  const handleDownloadZPL = useCallback(() => {
    if (!batch || !template) return;
    const zpl = generateBatchZPL(batch.batchItems, template);
    downloadZPLFile(zpl, `Labels_${batch.batchNumber}.zpl`);
  }, [batch, template]);

  // ═══════════════════════════════════════════════════════════════════
  //  Rendering
  // ═══════════════════════════════════════════════════════════════════

  const labelW_mm = template ? (Number(template.labelWidth) || 63) : 63;
  const labelH_mm = template ? (Number(template.labelHeight) || 22) : 22;

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800 font-semibold mb-2">Error Loading Labels</p>
            <p className="text-red-600 text-sm">{error}</p>
            <Button onClick={() => router.push('/inventory/batches')} className="mt-4" variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Batches
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!batch || !template) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Print Labels - Batch {batch.batchNumber}
          </h1>
          <p className="text-gray-600 mt-1">
            {batch.batchItems?.length || 0} items ready for printing
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => router.push('/inventory/batches')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Batches
          </Button>
          <Button onClick={handleDownloadPDF} variant="secondary">
            <Download className="h-4 w-4 mr-2" /> PDF
          </Button>
          <Button onClick={handlePrint} variant="secondary">
            <Printer className="h-4 w-4 mr-2" /> Browser Print
          </Button>
          <Button onClick={handleDownloadZPL} variant="secondary">
            <FileDown className="h-4 w-4 mr-2" /> Download ZPL
          </Button>
          <Button onClick={handleZebraPrint} className="bg-blue-600 hover:bg-blue-700">
            <Usb className="h-4 w-4 mr-2" /> Print to Zebra
          </Button>
        </div>
      </div>

      {/* Success */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
              <Check className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-900">Batch Completed Successfully!</h3>
              <p className="text-green-700 text-sm">
                All {batch.batchItems?.length} items added to inventory. Print labels below.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zebra Status */}
      {zebraStatus && (
        <Card className={`${zebraStatus.startsWith('✅') ? 'bg-green-50 border-green-200' : zebraStatus.startsWith('❌') ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
          <CardContent className="p-4">
            <p className={`text-sm font-medium ${zebraStatus.startsWith('✅') ? 'text-green-800' :
              zebraStatus.startsWith('❌') ? 'text-red-800' : 'text-blue-800'
              }`}>
              {zebraStatus}
            </p>
          </CardContent>
        </Card>
      )}

      {/* On-screen preview of labels */}
      <Card>
        <CardHeader>
          <CardTitle>Label Preview</CardTitle>
        </CardHeader>
        <CardContent className="bg-gray-50 p-6">
          <div className="flex flex-col items-center gap-4">
            {batch.batchItems?.map((batchItem) => {
              const item = batchItem.inventoryItem;
              return (
                <div
                  key={item.id}
                  className="relative bg-white shadow"
                  style={{
                    width: `${labelW_mm}mm`,
                    height: `${labelH_mm}mm`,
                    border: template.showBorder
                      ? `${template.borderWidth || 1}px solid ${template.borderColor || '#000'}`
                      : '1px dashed #ccc',
                    borderRadius: template.borderRadius ? `${template.borderRadius}px` : '0',
                    backgroundColor: template.backgroundColor || '#fff',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                  }}
                >
                  {template.fields.map((field) => {
                    const fieldValue = field.customText || getFieldValue(item, field.field);

                    if (field.type === 'text') {
                      return (
                        <div
                          key={field.id}
                          style={{
                            position: 'absolute',
                            left: `${field.x}mm`,
                            top: `${field.y}mm`,
                            width: field.width ? `${field.width}mm` : 'auto',
                            height: field.height ? `${field.height}mm` : 'auto',
                            fontSize: field.fontSize ? `${field.fontSize}pt` : '10pt',
                            fontFamily: field.fontFamily || 'Arial',
                            fontWeight: field.fontWeight || 'normal',
                            textAlign: (field.textAlign as any) || 'left',
                            color: field.color || '#000',
                            backgroundColor: field.backgroundColor || 'transparent',
                            border: field.borderWidth
                              ? `${field.borderWidth}px solid ${field.borderColor || '#000'}`
                              : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            lineHeight: 1.1,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {field.label && <span>{field.label} </span>}
                          <span>{fieldValue}</span>
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
                            height: field.height ? `${field.height}mm` : '10mm',
                          }}
                        >
                          <BarcodeImage value={fieldValue} width={field.width} height={field.height} fontSize={field.fontSize} />
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
                            width: field.width ? `${field.width}mm` : '100%',
                            height: `${field.borderWidth || 1}px`,
                            backgroundColor: field.borderColor || field.color || '#000',
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
                            width: field.width ? `${field.width}mm` : '10mm',
                            height: field.height ? `${field.height}mm` : '10mm',
                            backgroundColor: field.backgroundColor || 'transparent',
                            border: field.borderWidth
                              ? `${field.borderWidth}px solid ${field.borderColor || '#000'}`
                              : '1px solid #000',
                          }}
                        />
                      );
                    }

                    return null;
                  })}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Printing Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="font-semibold text-blue-900 mb-1">🏷️ Zebra ZD888 (Recommended)</p>
            <p>• Click <strong>&quot;Print to Zebra&quot;</strong> — sends ZPL labels directly to your Zebra printer via the server</p>
            <p>• Click <strong>&quot;Download ZPL&quot;</strong> — saves a <code>.zpl</code> file</p>
            <p className="text-xs text-blue-700 mt-1">Uses the printer&apos;s native 203 DPI barcode rendering for perfect quality</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="font-semibold text-gray-900 mb-1">📋 Manual ZPL Printing (Terminal)</p>
            <p>1. Click <strong>&quot;Download ZPL&quot;</strong> to get the <code>.zpl</code> file</p>
            <p>2. Open Terminal and run:</p>
            <code className="block bg-gray-800 text-green-400 rounded p-2 mt-1 text-xs font-mono">
              lp -d Zebra_Technologies_ZTC_ZD888_203dpi_ZPL -o raw ~/Downloads/Labels_{batch.batchNumber}.zpl
            </code>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-1">Other Options</p>
            <p>• <strong>&quot;Browser Print&quot;</strong> — standard print dialog (for non-Zebra printers)</p>
            <p>• <strong>&quot;PDF&quot;</strong> — PDF download with one label per page</p>
          </div>
          <div className="text-xs text-gray-500 border-t pt-2">
            <p>Template: <span className="font-semibold">{template.name}</span> • Size: {labelW_mm}mm × {labelH_mm}mm • Labels: {batch.batchItems?.length}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
