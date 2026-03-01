'use client';

import { useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import JsBarcode from 'jsbarcode';

function SampleBarcode({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width: 1.5,
          height: 25,
          displayValue: false,
          margin: 0,
        });
      } catch (e) {
        // ignore
      }
    }
  }, [value]);

  return <svg ref={svgRef} className="w-full h-8" />;
}

// Sample data for demonstration
const sampleItems = [
  {
    id: '1',
    sku: 'GRG-22K-001',
    name: 'Gold Ring with Diamond',
    metalType: 'gold',
    purity: '22K',
    grossWeight: '5.250',
    netWeight: '4.800',
  },
  {
    id: '2',
    sku: 'NCL-22K-042',
    name: 'Gold Chain - Rope Design',
    metalType: 'gold',
    purity: '22K',
    grossWeight: '12.350',
    netWeight: '12.350',
  },
  {
    id: '3',
    sku: 'BNG-22K-015',
    name: 'Gold Bangle - Traditional',
    metalType: 'gold',
    purity: '22K',
    grossWeight: '28.500',
    netWeight: '28.500',
  },
  {
    id: '4',
    sku: 'ERG-22K-087',
    name: 'Gold Earrings - Studs',
    metalType: 'gold',
    purity: '22K',
    grossWeight: '3.150',
    netWeight: '2.950',
  },
  {
    id: '5',
    sku: 'PND-22K-023',
    name: 'Gold Pendant with Ruby',
    metalType: 'gold',
    purity: '22K',
    grossWeight: '4.750',
    netWeight: '4.200',
  },
  {
    id: '6',
    sku: 'BRC-22K-011',
    name: 'Gold Bracelet - Modern',
    metalType: 'gold',
    purity: '22K',
    grossWeight: '18.900',
    netWeight: '18.900',
  },
];

export default function SampleLabelsPage() {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Sample_Labels_MARI_Jewellers',
    pageStyle: `
      @page {
        size: A4;
        margin: 10mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .no-print {
          display: none !important;
        }
      }
    `,
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-8">
      {/* Header - No Print */}
      <div className="flex justify-between items-start no-print">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Sample Label Sheet
          </h1>
          <p className="text-gray-600 mt-1">
            Preview and test the label printing format
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/inventory')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inventory
          </Button>
          <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
            <Printer className="h-4 w-4 mr-2" />
            Print Sample Labels
          </Button>
        </div>
      </div>

      {/* Info Card - No Print */}
      <Card className="bg-blue-50 border-blue-200 no-print">
        <CardContent className="p-6">
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              About These Sample Labels
            </h3>
            <ul className="text-blue-700 text-sm space-y-1 list-disc list-inside">
              <li>This is a demonstration of how your printed labels will look</li>
              <li>Each label contains: Company name, SKU, Item name, Metal type, Purity, and Weights</li>
              <li>Labels are sized for A4 paper (2 columns layout)</li>
              <li>Barcode is included for scanning (visual placeholder for now)</li>
              <li>After completing a batch, you'll see actual labels with your real data</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Printable Label Sheet */}
      <div ref={printRef} className="bg-white">
        {/* Print Header */}
        <div className="text-center mb-6 print-only" style={{ display: 'none' }}>
          <h2 className="text-xl font-bold">MARI Jewellers</h2>
          <p className="text-sm text-gray-600">Sample Label Sheet</p>
          <p className="text-xs text-gray-500">
            Printed on: {new Date().toLocaleDateString('en-LK')}
          </p>
        </div>

        {/* Label Grid - 2 columns, A4 compatible */}
        <div className="grid grid-cols-2 gap-4">
          {sampleItems.map((item) => (
            <div
              key={item.id}
              className="border-2 border-gray-800 p-4 rounded-lg break-inside-avoid"
              style={{
                width: '100%',
                minHeight: '120px',
                pageBreakInside: 'avoid',
              }}
            >
              {/* Company Header */}
              <div className="text-center border-b-2 border-gray-300 pb-2 mb-2">
                <h3 className="font-bold text-lg">MARI Jewellers</h3>
              </div>

              {/* Item Details */}
              <div className="space-y-1">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-sm">SKU:</span>
                  <span className="font-mono text-sm font-semibold">{item.sku}</span>
                </div>

                <div className="text-sm font-semibold border-t pt-1">
                  {item.name}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                  <div>
                    <span className="text-gray-600">Metal:</span>{' '}
                    <span className="font-semibold capitalize">{item.metalType}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Purity:</span>{' '}
                    <span className="font-semibold">{item.purity}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Gross:</span>{' '}
                    <span className="font-semibold">{parseFloat(item.grossWeight).toFixed(3)}g</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Net:</span>{' '}
                    <span className="font-semibold">{parseFloat(item.netWeight).toFixed(3)}g</span>
                  </div>
                </div>
              </div>

              {/* Barcode */}
              <div className="mt-3 text-center border-t pt-2">
                <SampleBarcode value={item.sku} />
                <p className="text-xs font-mono mt-1">{item.sku}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Print Footer */}
        <div className="text-center mt-8 text-xs text-gray-500 print-only" style={{ display: 'none' }}>
          <p>This is a sample label sheet for testing purposes</p>
        </div>
      </div>

      {/* Instructions - No Print */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle>Label Specifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm mb-2">Paper Recommendations:</h4>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li><strong>Size:</strong> A4 (210mm × 297mm)</li>
              <li><strong>Type:</strong> Sticker paper or regular paper with glue</li>
              <li><strong>Weight:</strong> 80gsm - 120gsm for best results</li>
              <li><strong>Finish:</strong> Matte or glossy as per preference</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-2">Label Features:</h4>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>Each label: approximately 90mm × 60mm</li>
              <li>2 columns × 4 rows = 8 labels per A4 sheet</li>
              <li>Includes company branding at top</li>
              <li>Bold SKU for easy identification</li>
              <li>Barcode for scanning (placeholder - will be real barcodes in production)</li>
              <li>All weights shown with 3 decimal precision</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-2">How to Use:</h4>
            <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
              <li>Click "Print Sample Labels" to open print dialog</li>
              <li>Load A4 sticker paper into your printer</li>
              <li>Print the sample sheet</li>
              <li>Cut along the borders</li>
              <li>Test the size and readability</li>
              <li>Adjust printer settings if needed (scale, margins, etc.)</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <style jsx global>{`
        @media print {
          .print-only {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
