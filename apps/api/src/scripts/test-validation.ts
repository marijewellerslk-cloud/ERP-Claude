import { settleBalanceSchema } from '../modules/suppliers/suppliers.validation.js';

const input = {
    settlementType: 'monetary',
    amount: 100,
    paymentMethod: 'cash',
    paymentReference: '',
    notes: ''
};

try {
    const v = settleBalanceSchema.parse(input);
    console.log('Valid:', v);
} catch (e: any) {
    console.log('Invalid:', JSON.stringify(e.errors, null, 2));
}

const inputGold = {
    settlementType: 'gold',
    goldWeightGrams: 10,
    notes: ''
};

try {
    const v = settleBalanceSchema.parse(inputGold);
    console.log('Valid Gold:', v);
} catch (e: any) {
    console.log('Invalid Gold:', JSON.stringify(e.errors, null, 2));
}
