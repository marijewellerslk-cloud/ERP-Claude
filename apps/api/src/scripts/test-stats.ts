import { db } from '../config/database.js';
import { SuppliersService } from '../modules/suppliers/suppliers.service.js';

const suppliersService = new SuppliersService();

async function test() {
    const suppliers = await db.query.suppliers.findMany({ limit: 1 });
    if (suppliers.length === 0) return console.log('No suppliers');

    const supplierId = suppliers[0].id;
    const storeId = suppliers[0].storeId;

    console.log('Testing getSuppliersOverview...');
    try {
        const overview = await suppliersService.getSuppliersOverview(storeId);
        console.log('Overview:', overview);
    } catch (e: any) {
        console.error('Overview Error:', e.message);
    }

    console.log('\nTesting getSupplierStats...');
    try {
        const stats = await suppliersService.getSupplierStats(supplierId, storeId);
        console.log('Stats:', stats);
    } catch (e: any) {
        console.error('Stats Error:', e.message);
    }

    process.exit(0);
}

test();
