import { db } from '../config/database.js';
import { SuppliersService } from '../modules/suppliers/suppliers.service.js';

const suppliersService = new SuppliersService();

async function test() {
    try {
        const suppliers = await db.query.suppliers.findMany({ limit: 1 });
        if (suppliers.length === 0) { console.log('No suppliers'); process.exit(0); }
        const supplier = suppliers[0];

        console.log('Testing settlement for supplier:', supplier.id, 'store:', supplier.storeId);

        // We need a userId, let's get any admin user
        const users = await db.query.users.findMany({ limit: 1 });
        if (users.length === 0) { console.log('No users'); process.exit(0); }
        const user = users[0];

        const input = {
            settlementType: 'monetary',
            amount: 1,
            paymentMethod: 'cash',
            notes: 'Test settlement'
        } as any;

        const res = await suppliersService.settleBalance(supplier.id, supplier.storeId, input, user.id);
        console.log('Success:', res);
    } catch (e: any) {
        console.error('Error settling:', e.message);
        if (e.errors) console.error('Details:', e.errors);
        console.error(e.stack);
    } finally {
        process.exit(0);
    }
}

test();
