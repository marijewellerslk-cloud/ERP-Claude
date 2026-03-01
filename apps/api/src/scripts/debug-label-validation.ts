import { z } from 'zod';
import { createLabelTemplateSchema } from '../modules/labels/labels.validation';

// Mock data for testing
const baseTemplate = {
    name: 'Debug Template',
    description: 'Testing validation',
    isDefault: false,
    pageWidth: 63,
    pageHeight: 22,
    labelWidth: 63,
    labelHeight: 22,
    fields: []
};

const fields = [
    {
        id: 'f1',
        type: 'text',
        key: 'productName',
        label: 'Product Name',
        x: 2,
        y: 2,
        width: 0.5, // Checking min(1) violation
        height: 5,
        fontSize: 4, // Checking min(6) violation
        isBold: true
    },
    {
        id: 'f2',
        type: 'text',
        key: 'price',
        label: 'Price',
        x: 2,
        y: 10,
        width: 20,
        height: 5,
        fontSize: 12
    },
    {
        id: 'f3',
        type: 'barcode',
        key: 'barcode',
        label: 'Barcode',
        x: 25,
        y: 10,
        width: 30,
        height: 10
    },
    // New fields
    {
        id: 'f4',
        type: 'text',
        key: 'costRatePercentage',
        label: 'Rate %',
        x: 50,
        y: 2,
        width: 10,
        height: 5,
        fontSize: 8
    },
    {
        id: 'f5',
        type: 'text',
        key: 'makingCharges',
        label: 'Making Charges',
        x: 50,
        y: 10,
        width: 10,
        height: 5,
        fontSize: 8
    },
    {
        id: 'f6',
        type: 'text',
        key: 'time', // Invalid field key test
        label: 'Time',
        x: 0,
        y: 0,
        width: 10,
        height: 10
    }
];

async function runValidationTest() {
    console.log('Starting Validation Debug...\n');

    // Test 1: Base Template (Empty Fields)
    try {
        console.log('Test 1: Base Template (63x22mm)');
        createLabelTemplateSchema.parse({ ...baseTemplate, fields: [] });
        console.log('✅ PASS');
    } catch (error) {
        console.error('❌ FAIL:', JSON.stringify(error.format(), null, 2));
    }

    // Test 2: Add Standard Fields
    try {
        console.log('\nTest 2: Standard Fields (Name, Price, Barcode)');
        const testFields = fields.slice(0, 3);
        createLabelTemplateSchema.parse({ ...baseTemplate, fields: testFields });
        console.log('✅ PASS');
    } catch (error) {
        console.error('❌ FAIL:', JSON.stringify(error.format(), null, 2));
    }

    // Test 3: Add New Fields (Rate %, Making Charges)
    try {
        console.log('\nTest 3: New Fields (Rate %, Making Charges)');
        const testFields = fields.slice(0, 5);
        createLabelTemplateSchema.parse({ ...baseTemplate, fields: testFields });
        console.log('✅ PASS');
    } catch (error) {
        console.error('❌ FAIL:', JSON.stringify(error.format(), null, 2));
    }

    // Test 4: Invalid Field Key
    try {
        console.log('\nTest 4: Invalid Field Key ("time")');
        const testFields = [fields[5]];
        createLabelTemplateSchema.parse({ ...baseTemplate, fields: testFields });
        console.log('❌ FAIL (Expected error but passed)');
    } catch (error) {
        console.log('✅ PASS (Caught expected error)');
        // console.log(JSON.stringify(error.format(), null, 2));
    }

    // Test 5: Check Dimensions Edge Cases
    try {
        console.log('\nTest 5: Small Dimensions (10x10mm)');
        createLabelTemplateSchema.parse({ ...baseTemplate, pageWidth: 10, pageHeight: 10, fields: [] });
        console.log('✅ PASS');
    } catch (error) {
        console.error('❌ FAIL:', JSON.stringify(error.format(), null, 2));
    }
}

runValidationTest();
