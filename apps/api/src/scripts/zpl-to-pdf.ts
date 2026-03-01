import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.resolve(__dirname, '../../generated_labels.zpl');
const outputPath = path.resolve(__dirname, '../../generated_labels.pdf');

// Labelary API configuration
// 8 dpmm (203 dpi) is standard for Zebra ZD888
// 63mm = 2.48 inches
// 22mm = 0.866 inches
const dpmm = 8;
const width = 2.48;
const height = 0.866142; // 22mm in inches

const apiUrl = `http://api.labelary.com/v1/printers/${dpmm}dpmm/labels/${width}x${height}/0/`;

async function convertZplToPdf() {
    try {
        if (!fs.existsSync(inputPath)) {
            console.error(`Input file not found: ${inputPath}`);
            process.exit(1);
        }

        const zpl = fs.readFileSync(inputPath, 'utf8');

        console.log(`Sending ZPL to Labelary API (${apiUrl})...`);

        const response = await fetch(apiUrl, {
            method: 'POST',
            body: zpl,
            headers: {
                'Accept': 'application/pdf', // Request PDF
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`API Error ${response.status}: ${text}`);
        }

        const buffer = await response.arrayBuffer();
        fs.writeFileSync(outputPath, Buffer.from(buffer));

        console.log(`Successfully generated PDF.`);
        console.log(`File saved to: ${outputPath}`);

    } catch (error) {
        console.error('Error generating PDF:', error);
        process.exit(1);
    }
}

convertZplToPdf();
