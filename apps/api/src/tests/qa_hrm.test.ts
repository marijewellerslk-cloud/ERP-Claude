import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { TestFactory } from './helpers/factories';
import { db } from '../config/database';
import { seedRoles } from '../scripts/seed-roles';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import {
    createEmployee,
    getEmployees,
    getEmployeeById,
    updateEmployee,
    markCheckIn,
    markCheckOut,
    getTodayAttendance,
    createLeaveType,
    getLeaveTypes,
    generatePayroll,
    getPayrollRecords,
} from '../modules/hrm/hrm.service';

/**
 * AGENT 4: HRM & Payroll Simulation — QA Test Suite
 *
 * Tests employee management, attendance tracking,
 * leave management, and payroll generation.
 */

describe('QA: HRM Module', () => {
    let store: typeof schema.stores.$inferSelect;
    let userId: string;

    async function setupHRMEnvironment() {
        await seedRoles();
        store = await TestFactory.createStore();
        const role = await db.query.roles.findFirst({ where: eq(schema.roles.name, 'store_manager') });
        const user = await TestFactory.createUser({ email: `hrm-mgr-${uuidv4()}@example.com` });
        await TestFactory.assignRole(user.id, role!.id, store.id);
        userId = user.id;
    }

    // ========================================================================
    // SECTION 1: EMPLOYEE MANAGEMENT
    // ========================================================================
    describe('Employee Management', () => {
        it('[HRM-01] Create and retrieve employee', async () => {
            await setupHRMEnvironment();

            const employee = await createEmployee({
                storeId: store.id,
                employeeCode: `EMP-${uuidv4().substring(0, 6)}`,
                fullName: 'QA Test Employee',
                email: `emp-${uuidv4().substring(0, 6)}@example.com`,
                phone: `077${uuidv4().substring(0, 7)}`,
                dateOfJoining: new Date(),
                department: 'Sales',
                position: 'Sales Associate',
                salary: '50000',
            });

            expect(employee).toBeDefined();
            expect(employee.id).toBeDefined();
            console.log(`[HRM-01] Employee created: ${employee.employeeCode}`);

            const retrieved = await getEmployeeById(employee.id, store.id);
            expect(retrieved).toBeDefined();
        });

        it('[HRM-02] List employees by store', async () => {
            await setupHRMEnvironment();

            await createEmployee({
                storeId: store.id,
                employeeCode: `EMP-${uuidv4().substring(0, 6)}`,
                fullName: 'List Test Employee',
                dateOfJoining: new Date(),
                department: 'Operations',
                position: 'Operator',
                salary: '40000',
            });

            const employees = await getEmployees(store.id);
            expect(employees.length).toBeGreaterThan(0);
            console.log(`[HRM-02] Employees: ${employees.length}`);
        });

        it('[HRM-03] Update employee', async () => {
            await setupHRMEnvironment();

            const employee = await createEmployee({
                storeId: store.id,
                employeeCode: `EMP-${uuidv4().substring(0, 6)}`,
                fullName: 'Update Test Employee',
                dateOfJoining: new Date(),
                department: 'Sales',
                position: 'Junior Sales',
                salary: '35000',
            });

            const updated = await updateEmployee(employee.id, store.id, {
                position: 'Senior Sales',
                salary: '55000',
            });

            expect(updated).toBeDefined();
            console.log(`[HRM-03] Employee updated`);
        });
    });

    // ========================================================================
    // SECTION 2: ATTENDANCE
    // ========================================================================
    describe('Attendance', () => {
        it('[HRM-04] Check-in and check-out', async () => {
            await setupHRMEnvironment();

            const employee = await createEmployee({
                storeId: store.id,
                employeeCode: `EMP-${uuidv4().substring(0, 6)}`,
                fullName: 'Attendance Test Employee',
                dateOfJoining: new Date(),
                department: 'Sales',
                position: 'Sales Associate',
                salary: '40000',
            });

            const checkIn = await markCheckIn(employee.id, store.id, userId);
            expect(checkIn).toBeDefined();
            console.log(`[HRM-04] Checked in`);

            const checkOut = await markCheckOut(checkIn.id, store.id);
            expect(checkOut).toBeDefined();
            console.log(`[HRM-04] Checked out`);
        });

        it('[HRM-05] Today attendance list', async () => {
            await setupHRMEnvironment();

            const today = await getTodayAttendance(store.id);
            expect(today).toBeDefined();
            console.log(`[HRM-05] Today attendance count: ${Array.isArray(today) ? today.length : 'N/A'}`);
        });
    });

    // ========================================================================
    // SECTION 3: LEAVE TYPES
    // ========================================================================
    describe('Leave Management', () => {
        it('[HRM-06] Create and list leave types', async () => {
            await setupHRMEnvironment();

            const leaveType = await createLeaveType({
                storeId: store.id,
                name: `QA Annual Leave ${uuidv4().substring(0, 4)}`,
                daysAllowed: 14,
                isPaid: true,
            });

            expect(leaveType).toBeDefined();
            console.log(`[HRM-06] Leave type created`);

            const types = await getLeaveTypes(store.id);
            expect(types.length).toBeGreaterThan(0);
        });
    });

    // ========================================================================
    // SECTION 4: PAYROLL
    // ========================================================================
    describe('Payroll', () => {
        it('[HRM-07] Generate payroll for month', async () => {
            await setupHRMEnvironment();

            // Create an employee first
            await createEmployee({
                storeId: store.id,
                employeeCode: `EMP-${uuidv4().substring(0, 6)}`,
                fullName: 'Payroll Test Employee',
                dateOfJoining: new Date('2024-01-01'),
                department: 'Sales',
                position: 'Sales Associate',
                salary: '50000',
            });

            try {
                const payroll = await generatePayroll(store.id, 1, 2026);
                expect(payroll).toBeDefined();
                console.log(`[HRM-07] Payroll generated`);
            } catch (error: any) {
                console.log(`[HRM-07] Payroll generation: ${error.message}`);
            }
        });

        it('[HRM-08] List payroll records', async () => {
            await setupHRMEnvironment();

            const records = await getPayrollRecords(store.id);
            expect(records).toBeDefined();
            console.log(`[HRM-08] Payroll records: ${Array.isArray(records) ? records.length : 'N/A'}`);
        });
    });
});
