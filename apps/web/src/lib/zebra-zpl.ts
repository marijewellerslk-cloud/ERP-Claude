/**
 * Zebra ZPL (Zebra Programming Language) Generator
 * Generates ZPL code for Zebra thermal printer
 * Label Size: 100mm x 15mm (jewelry label)
 * Resolution: 203 DPI (8 dots per mm)
 * Label reference: Jewelry price tag stickers with tearable/perforated section
 */

export interface BarcodeData {
  itemNumber: string;
  barcode: string; // Will be used for both Code 128 and as data for QR
  weight: number; // in grams
  costRatePercentage: number;
  minSellingRatePercentage: number;
  stoneWeight: number; // in grams
  netWeight: number; // in grams
}

/**
 * Generate ZPL code for 100mm x 15mm jewelry label
 * Layout (horizontal label):
 * Left section (70mm): Item details + barcode
 * Right section (30mm): QR code for quick scan
 *
 * Label dimensions:
 * - Width: 100mm = 800 dots (at 8 dots/mm)
 * - Height: 15mm = 120 dots (at 8 dots/mm)
 */
export function generateZPL(data: BarcodeData): string {
  const {
    itemNumber,
    barcode,
    weight,
    costRatePercentage,
    minSellingRatePercentage,
    stoneWeight,
    netWeight,
  } = data;

  // ZPL Commands:
  // ^XA = Start of label
  // ^FO = Field Origin (position x, y)
  // ^A0 = Font (0=default), N=normal, height, width
  // ^BC = Code 128 barcode
  // ^BQ = QR Code
  // ^FD = Field Data
  // ^FS = Field Separator
  // ^XZ = End of label
  // ^PW = Print Width (8 dots/mm * 100mm = 800 dots)
  // ^LL = Label Length (8 dots/mm * 15mm = 120 dots)
  // ^GB = Graphic Box (for lines/borders)

  const zpl = `^XA
^PW800
^LL120

~TA000
~JSN
^LT0
^MNW
^MTT
^PON
^PMN
^LH0,0
^JMA
^PR6,6
~SD15
^JUS
^LRN
^CI27
^PA0,1,1,0
^XZ

^XA
^MMT
^PW800
^LL120
^LS0

^FO10,10^A0N,20,20^FH^FDItem: ${itemNumber}^FS

^FO10,35^A0N,16,16^FH^FDWt: ${weight.toFixed(3)}g  Net: ${netWeight.toFixed(3)}g^FS

^FO10,55^A0N,14,14^FH^FDStone: ${stoneWeight.toFixed(3)}g^FS

^FO10,75^A0N,16,16^FH^FDCost: ${costRatePercentage.toFixed(1)}%  Min: ${minSellingRatePercentage.toFixed(1)}%^FS

^FO300,35^BCN,50,N,N,N^FD${barcode}^FS

^FO650,10^BQN,2,6^FDQA,${barcode}^FS

^FO580,5^GB2,110,2^FS

^PQ1,0,1,Y
^XZ`;

  return zpl;
}

/**
 * Generate ZPL for multiple labels
 */
export function generateBatchZPL(items: BarcodeData[]): string {
  return items.map((item) => generateZPL(item)).join('\n\n');
}

/**
 * Download ZPL file for manual printing
 */
export function downloadZPL(zpl: string, filename: string = 'barcode.zpl') {
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

/**
 * Send ZPL to printer via USB (requires browser support or native app)
 * This is a placeholder - actual implementation depends on the environment
 */
export async function printToZebraUSB(zpl: string): Promise<void> {
  // For USB printing, you would need:
  // 1. Chrome with WebUSB API
  // 2. Or a native desktop app bridge
  // 3. Or browser extension

  // Check if Web Serial API is available (for USB connection)
  if ('serial' in navigator) {
    try {
      // Request port access
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });

      const encoder = new TextEncoder();
      const writer = port.writable.getWriter();
      await writer.write(encoder.encode(zpl));
      writer.releaseLock();

      await port.close();
    } catch (error) {
      console.error('USB printing failed:', error);
      throw new Error('Failed to print via USB. Please download ZPL file instead.');
    }
  } else {
    throw new Error('USB printing not supported in this browser. Please download ZPL file.');
  }
}

/**
 * Send ZPL to network printer
 * Requires backend API endpoint to handle network printing
 */
export async function printToZebraNetwork(
  zpl: string,
  printerIP: string,
  port: number = 9100
): Promise<void> {
  // This requires a backend endpoint as browsers can't make raw TCP connections
  const response = await fetch('/api/v1/print/zebra', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      zpl,
      printerIP,
      port,
    }),
  });

  if (!response.ok) {
    throw new Error('Network printing failed');
  }
}

/**
 * Preview ZPL as image using Labelary API
 * Labelary provides free ZPL preview service
 */
export async function previewZPL(zpl: string): Promise<string> {
  // Use Labelary web service to convert ZPL to PNG
  // 8dpmm = 203 DPI, label size 100mm x 15mm (3.94" x 0.59")
  // Using 4x0.6 inches as closest standard size
  const response = await fetch('http://api.labelary.com/v1/printers/8dpmm/labels/4x0.6/0/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: zpl,
  });

  if (!response.ok) {
    throw new Error('Failed to generate preview');
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
