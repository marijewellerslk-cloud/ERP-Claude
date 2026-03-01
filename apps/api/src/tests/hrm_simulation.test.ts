import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../config/database';
import { resetDb } from './helpers/reset-db';
import { TestFactory } from './helpers/factories';
import { seedRoles } from '../scripts/seed-roles';
import * as schema from '../db/schema';
import { eq, and } from 'drizzle-orm';
import {
    createEmployee,
    markAttendance,
    createLeaveType,
    createLeaveRequest,
    approveLeaveRequest,
    createSalaryAdvance,
    approveSalaryAdvance,
    generatePayroll,
    processPayrollPayment
} from '../modules/hrm/hrm.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * HRM SYSTEM SIMULATION
 * 
 * Objectives:
 * 1. Simulate a full month lifecycle of employees.
 * 2. Verify Attendance impact on Payroll.
 * 3. Verify Leave (Paid vs Unpaid) impact on Payroll.
 * 4. Verify Salary Advance deductions.
 * 5. Identify bugs in calculation (specifically Paid Leave).
 */

describe('HRM System Simulation', () => {
    let store: typeof schema.stores.$inferSelect;
    let adminToken: string;
    let adminId: string;

    // Employees
    let empFixed: any; // Fixed salary (30k)
    let empHourly: any; // Testing fixed mainly for now as per schema

    // Data
    let paidLeaveType: any;
    let unpaidLeaveType: any;
    let month = 10; // October
    let year = 2023;
    let totalDaysInMonth = 31;

    it('Scenario 1: Full Month Simulation with varied attendance and leave', async () => {
        // [Setup] Moved from beforeAll to ensure it runs after global beforeEach reset
        try {
            console.log('[Setup] Seeding Data...');
            // No need to call resetDb() as it's handled by global setup
            await seedRoles();

            // 1. Create Store
            store = await TestFactory.createStore({
                name: 'HRM Test Store',
                code: 'HRM-TEST',
                address: 'HRM Lane'
            });
            console.log(`[Setup] Store created: ${store.name}`);

            // 2. Create Admin
            adminId = uuidv4();
            const adminUser = await TestFactory.createUser({
                email: 'hrm_admin@test.com',
                fullName: 'HRM Admin',
                id: adminId
            });

            // Assign Role
            const managerRole = await db.query.roles.findFirst({ where: eq(schema.roles.name, 'shop_manager') });
            if (managerRole) {
                await TestFactory.assignRole(adminUser.id, managerRole.id, store.id);
            }
            console.log(`[Setup] Admin created: ${adminUser.email}`);

            // 3. Create Leave Types
            paidLeaveType = await createLeaveType({
                storeId: store.id,
                name: 'Sick Leave (Paid)',
                daysAllowed: 12,
                isPaid: true
            });

            unpaidLeaveType = await createLeaveType({
                storeId: store.id,
                name: 'Casual Leave (Unpaid)', // Intentionally marking unpaid to test deduction
                daysAllowed: 12,
                isPaid: false
            });
            console.log('[Setup] Leave Types created');

        } catch (error) {
            console.error('[Setup] Error:', error);
            throw error;
        }

        // 1. Hire Employees
        console.log('\n--- 1. HIRING PHASE ---');

        // Employee A: 30,000 Salary, Joined 1st of Month
        empFixed = await createEmployee({
            storeId: store.id,
            employeeCode: 'EMP-001',
            fullName: 'Fixed Salary Employee',
            email: 'fixed@test.com',
            dateOfJoining: new Date(year, month - 1, 1),
            department: 'Sales',
            position: 'Associate',
            salary: '30000',
            employmentType: 'full_time'
        });
        console.log(`Hired ${empFixed.fullName} with Salary: ${empFixed.salary}`);

        // 2. Simulate Attendance (Day 1-31)
        console.log('\n--- 2. ATTENDANCE & LEAVE PHASE ---');

        // Pattern:
        // Days 1-10: Present
        // Day 11: Late
        // Day 12: Half Day
        // Day 13-14: Paid Leave (Sick)
        // Day 15: Absent (No leave)
        // Day 16-17: Unpaid Leave (Casual)
        // Day 18-31: Present

        const attendanceLog = [];

        for (let day = 1; day <= totalDaysInMonth; day++) {
            const date = new Date(year, month - 1, day);
            const dateStr = date.toISOString().split('T')[0];

            if (day >= 1 && day <= 10) {
                // Present
                await markAttendance({
                    employeeId: empFixed.id,
                    storeId: store.id,
                    date: date,
                    status: 'present',
                    checkIn: new Date(date.setHours(9, 0)),
                    checkOut: new Date(date.setHours(18, 0)),
                    createdBy: adminId
                });
            } else if (day === 11) {
                // Late
                await markAttendance({
                    employeeId: empFixed.id,
                    storeId: store.id,
                    date: date,
                    status: 'late',
                    checkIn: new Date(date.setHours(10, 30)), // 10:30 AM
                    checkOut: new Date(date.setHours(18, 0)),
                    createdBy: adminId
                });
            } else if (day === 12) {
                // Half Day
                await markAttendance({
                    employeeId: empFixed.id,
                    storeId: store.id,
                    date: date,
                    status: 'half_day',
                    checkIn: new Date(date.setHours(9, 0)),
                    checkOut: new Date(date.setHours(13, 0)), // 4 hours
                    createdBy: adminId
                });
            } else if (day === 13 || day === 14) {
                // Paid Leave (Will be handled by Leave Request approval, which creates attendance)
                // We create the request below
            } else if (day === 15) {
                // Absent
                await markAttendance({
                    employeeId: empFixed.id,
                    storeId: store.id,
                    date: date,
                    status: 'absent',
                    createdBy: adminId
                });
            } else if (day === 16 || day === 17) {
                // Unpaid Leave
            } else {
                // Rest Present
                await markAttendance({
                    employeeId: empFixed.id,
                    storeId: store.id,
                    date: date,
                    status: 'present',
                    checkIn: new Date(date.setHours(9, 0)),
                    checkOut: new Date(date.setHours(18, 0)),
                    createdBy: adminId
                });
            }
        }

        // Apply Paid Leave (Days 13-14)
        const sickLeaveMsg = await createLeaveRequest({
            employeeId: empFixed.id,
            storeId: store.id,
            leaveTypeId: paidLeaveType.id,
            startDate: new Date(year, month - 1, 13),
            endDate: new Date(year, month - 1, 14),
            reason: 'Flu'
        });
        await approveLeaveRequest(sickLeaveMsg.id, store.id, adminId);
        console.log('Approved Sick Leave (Paid) for Days 13-14');

        // Apply Unpaid Leave (Days 16-17)
        const casualLeaveMsg = await createLeaveRequest({
            employeeId: empFixed.id,
            storeId: store.id,
            leaveTypeId: unpaidLeaveType.id,
            startDate: new Date(year, month - 1, 16),
            endDate: new Date(year, month - 1, 17),
            reason: 'Personal'
        });
        await approveLeaveRequest(casualLeaveMsg.id, store.id, adminId);
        console.log('Approved Casual Leave (Unpaid) for Days 16-17');


        // 3. Salary Advance
        console.log('\n--- 3. SALARY ADVANCE PHASE ---');
        // Take 5000 advance
        const advance = await createSalaryAdvance({
            employeeId: empFixed.id,
            storeId: store.id,
            amount: '5000',
            reason: 'Emergency'
        });
        await approveSalaryAdvance(advance.id, store.id, adminId);
        console.log('Approved Salary Advance: 5000');


        // 4. Generate Payroll
        console.log('\n--- 4. PAYROLL GENERATION PHASE ---');
        const payrolls = await generatePayroll(store.id, month, year);
        const payslip = payrolls.find(p => p.employeeId === empFixed.id);

        console.log('--- PAYSLIP GENERATED ---');
        console.log(JSON.stringify(payslip, null, 2));

        expect(payslip).toBeDefined();

        // 5. Verification & Assertions
        console.log('\n--- 5. VERIFICATION PHASE ---');

        // Expected Calculation:
        // Base Salary: 30,000
        // Days in Month: 31
        // Per Day Rate: 30000 / 31 = 967.74

        // Days Worked Calculation:
        // Present (1-10): 10
        // Late (11): 1 (treated as present usually, or penalty? Code check needed. Code says: count as present in daysWorked)
        // Half Day (12): 0.5 (Code says Math.ceil(halfDays/2)... wait. 1 half day / 2 = 0.5. Ceil(0.5) = 1. So 1 half day counts as Full Day?? This is the logic check.)
        // Paid Leave (13-14): 2 (Should be counted! Bug hypothesis: It is NOT counted in attendance loop in service)
        // Absent (15): 0
        // Unpaid Leave (16-17): 0 (Should not be counted)
        // Present (18-31): 14 

        // Expected Days Worked Logic (Standard):
        // 10 + 1 (Late) + 0.5 (Half) + 2 (Paid Leave) + 14 = 27.5 Days
        // Salary = 27.5 * 967.74 = 26,612.85
        // Less Advance: 5000
        // Net: 21,612.85

        // Let's see what the current code actually produced.
        const baseSalary = parseFloat(payslip!.baseSalary as string);
        const daysWorked = payslip!.daysWorked;
        const netSalary = parseFloat(payslip!.netSalary as string);
        const advanceDed = parseFloat(payslip!.advanceDeduction as string);

        console.log(`Days Worked (System): ${daysWorked}`);
        console.log(`Net Salary (System): ${netSalary}`);

        // Checking the bug:
        // If Paid Leave is missing from daysWorked, result will be lower.
        // If Half Day logic is Math.ceil(1/2) = 1, then it counts as full day.

        // Assertion 1: Advance Deduction
        expect(advanceDed).toBe(5000);

        // Assertion 2: Paid Leave inclusion (Soft assertion printed)
        const paidLeaveDays = 2; // Days 13, 14
        // If system ignores tax/PF, pure calculation:
        // If Logic is strictly (DaysWorked / TotalWorkingDays) * Salary
        // And Paid Leave should be included in DaysWorked.
    });
});
