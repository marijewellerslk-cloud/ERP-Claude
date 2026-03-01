import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base template with placeholders
// Comments from user request removed for clean ZPL
const ZPL_TEMPLATE = `
^XA
^PW504
^LL176
^LS-10
^FO480,6,1^A0N,20,20^FD Mari Jewellers^FS
^FO480,28,1^A0N,16,16^FD {PRODUCT_NAME}^FS
^FO480,48,1^A0N,16,16^FD SKU {SKU}^FS
^FO480,68,1^A0N,16,16^FD Wt {WEIGHT}   NT Wt {NET_WEIGHT}^FS
^FO480,88,1^A0N,16,16^FD Rate 105%   St 0.000^FS
^FO480,112,1^BCN,32,N,N,N^FD {SKU}^FS
^XZ
`;

const items = [
    { name: 'Monaco Bracelet - Flex cut', sku: 'BR001', weight: '8.000g', netWeight: '8.000g' },
    { name: 'Gold Ring - Classic', sku: 'RN002', weight: '4.500g', netWeight: '4.500g' },
    { name: 'Diamond Earring', sku: 'ER003', weight: '2.100g', netWeight: '2.100g' },
    { name: 'Platinum Chain', sku: 'CH004', weight: '12.350g', netWeight: '12.350g' },
    { name: 'Silver Anklet', sku: 'AK005', weight: '15.000g', netWeight: '15.000g' },
    { name: 'Gold Necklace - 22K', sku: 'NK006', weight: '25.000g', netWeight: '25.000g' },
    { name: 'Diamond Pendant', sku: 'PD007', weight: '3.200g', netWeight: '3.200g' },
    { name: 'Rose Gold Bangle', sku: 'BG008', weight: '18.500g', netWeight: '18.500g' },
    { name: 'Silver Toe Ring', sku: 'TR009', weight: '5.600g', netWeight: '5.600g' },
    { name: 'Platinum Band', sku: 'RN010', weight: '6.000g', netWeight: '6.000g' },
    { name: 'Gold Jhumka', sku: 'ER011', weight: '14.200g', netWeight: '14.200g' },
    { name: 'Solitaire Ring', sku: 'RN012', weight: '3.800g', netWeight: '3.800g' },
    { name: 'Mangalsutra - Short', sku: 'MS013', weight: '10.500g', netWeight: '10.500g' },
    { name: 'Nose Pin - Diamond', sku: 'NP014', weight: '0.450g', netWeight: '0.450g' },
    { name: 'Silver Bracelet - Men', sku: 'BR015', weight: '22.000g', netWeight: '22.000g' },
    { name: 'Gold Coin - 5g', sku: 'CN016', weight: '5.000g', netWeight: '5.000g' },
    { name: 'Kids Bangle', sku: 'BG017', weight: '8.200g', netWeight: '8.200g' },
    { name: 'Ruby Ring', sku: 'RN018', weight: '5.100g', netWeight: '5.100g' },
    { name: 'Emerald Necklace', sku: 'NK019', weight: '35.000g', netWeight: '35.000g' },
    { name: 'Sapphire Studs', sku: 'ER020', weight: '2.800g', netWeight: '2.800g' }
];

let zplOutput = '';

items.forEach(item => {
    let label = ZPL_TEMPLATE.trim()
        .replace('{PRODUCT_NAME}', item.name)
        .replace(/{SKU}/g, item.sku)
        .replace('{WEIGHT}', item.weight)
        .replace('{NET_WEIGHT}', item.netWeight);

    zplOutput += label + '\n';
});

// Output to the root of apps/api for easy access
const outputPath = path.resolve(__dirname, '../../generated_labels.zpl');

try {
    fs.writeFileSync(outputPath, zplOutput);
    console.log(`Successfully generated ${items.length} labels.`);
    console.log(`File saved to: ${outputPath}`);
    console.log('You can send this file to your Zebra printer.');
} catch (error) {
    console.error('Error writing file:', error);
}
