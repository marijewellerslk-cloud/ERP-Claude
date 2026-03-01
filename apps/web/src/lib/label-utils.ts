
import { format } from 'date-fns';

export interface InventoryItem {
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
    // Backend fields match
    dimensions?: any;
    calculatedCost?: string | number;
    makingCharges?: string | number;
    costRatePercentage?: string | number;
    // Derived/Mapped fields
    storeName?: string;
}

export const getFieldValue = (item: InventoryItem, fieldName?: string, customText?: string, companyName?: string): string => {
    if (customText) return customText;
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
            return item.itemType || '';
        case 'branch':
            return item.branch || 'Main Branch';
        case 'countryOfOrigin':
            return item.countryOfOrigin || '';
        case 'gemType':
            return item.gemType || (item.itemType === 'finished_goods' ? 'Diamond/Stone' : '');
        case 'gemWeight':
            return item.gemWeight || (item.stoneWeight ? `${parseFloat(item.stoneWeight).toFixed(3)} cts` : '');
        case 'costPrice':
            return item.calculatedCost ? Number(item.calculatedCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
        case 'makingCharges':
            return item.makingCharges ? Number(item.makingCharges).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
        case 'costRatePercentage':
            return item.costRatePercentage ? `${item.costRatePercentage}%` : '';
        case 'size':
            // Check for common size keys in dimensions
            if (!item.dimensions) return '';
            return item.dimensions.size || item.dimensions.ringSize || item.dimensions.bangleSize || item.dimensions.length || '';
        case 'companyName':
            return companyName || 'MARI Jewellers';
        default:
            return '';
    }
};

export const SAMPLE_ITEM: InventoryItem = {
    id: 'sample-1',
    sku: 'RG-22K-001',
    name: 'Gold Ring 22K',
    itemType: 'finished_goods',
    metalType: 'Gold',
    purity: '22K',
    grossWeight: '10.500',
    netWeight: '10.000',
    stoneWeight: '0.500',
    countryOfOrigin: 'Sri Lanka',
    branch: 'Colombo Main',
    storeName: 'MARI Jewellers',
    calculatedCost: 125000.00,
    costRatePercentage: 105,
    makingCharges: 5000.00,
    dimensions: {
        size: '12'
    }
};
