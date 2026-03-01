import { db } from '../config/database.js';
import { stores, users, employees } from '../db/schema.js';
import { createEmployee } from '../modules/hrm/hrm.service.js';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';

async function main() {
  console.log('Testing Employee Branch Assignment...');

  // Get superadmin user
  const superadmin = await db.query.users.findFirst({
    where: eq(users.email, 'admin@marijewellers.com')
  });

  if (!superadmin) {
    console.error('Superadmin not found!');
    process.exit(1);
  }

  // Get stores
  const allStores = await db.query.stores.findMany();
  if (allStores.length < 2) {
    console.log('Need at least 2 stores to test branch assignment.');
    process.exit(0);
  }

  const superAdminStore = allStores[0];
  const targetStore = allStores[1];

  console.log(`SuperAdmin Store: ${superAdminStore.name} (${superAdminStore.id})`);
  console.log(`Target Store: ${targetStore.name} (${targetStore.id})`);

  // Simulate createEmployee service test
  // Generate random employee code
  const code = 'EMP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  
  try {
    const employee = await createEmployee({
      storeId: targetStore.id, // Using explicit target store instead of superadmin store
      employeeCode: code,
      fullName: 'Test Branch Employee',
      dateOfJoining: new Date(),
      department: 'sales',
      position: 'Sales Tester',
      salary: '35000',
    });

    console.log(`Created employee: ${employee.fullName} with storeId: ${employee.storeId}`);

    if (employee.storeId === targetStore.id) {
      console.log('SUCCESS: Employee assigned to target branch.');
    } else {
      console.log('FAILED: Employee was NOT assigned to target branch.');
    }
  } catch (err) {
    console.error('Failed to create employee:', err);
  }
}

main().catch(console.error).finally(() => process.exit(0));
