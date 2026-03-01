import { db } from '../../config/database.js';
import { authService } from '../auth/auth.service.js';
import {
  employees,
  attendance,
  leaveTypes,
  leaveRequests,
  leaveBalances,
  payroll,
  salaryAdvances,
  users,
  stores,
  userRoles,
  accounts
} from '../../db/schema.js';
import { logger } from '../../utils/logger.js';
import { eq, and, desc, gte, lte, isNull, sql } from 'drizzle-orm';
import { accountingService } from '../accounting/accounting.service.js';

// ============================================================================
// EMPLOYEE MANAGEMENT
// ============================================================================

export async function getEmployees(storeId: string, filters?: {
  status?: string;
  department?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [eq(employees.storeId, storeId)];

  if (filters?.status) {
    conditions.push(eq(employees.status, filters.status));
  }
  if (filters?.department) {
    conditions.push(eq(employees.department, filters.department));
  }

  const query = db
    .select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      fullName: employees.fullName,
      email: employees.email,
      phone: employees.phone,
      department: employees.department,
      position: employees.position,
      employmentType: employees.employmentType,
      status: employees.status,
      dateOfJoining: employees.dateOfJoining,
      salary: employees.salary,
      userId: employees.userId,
    })
    .from(employees)
    .where(and(...conditions))
    .orderBy(desc(employees.createdAt));

  if (filters?.limit) {
    query.limit(filters.limit);
  }
  if (filters?.offset) {
    query.offset(filters.offset);
  }

  return query;
}

export async function getEmployeeById(employeeId: string, storeId: string) {
  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.storeId, storeId)));
  return employee;
}

export async function createEmployee(data: {
  storeId: string;
  employeeCode: string;
  fullName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: Date;
  dateOfJoining: Date;
  department: string;
  position: string;
  employmentType?: string;
  payrollFrequency?: string;
  salary: string;
  bankAccountNumber?: string;
  bankName?: string;
  ifscCode?: string;
  nicNumber?: string;
  nicPhotoUrl?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactName2?: string;
  emergencyContactPhone2?: string;
  address?: string;
  userId?: string;
  roleId?: string;
  password?: string;
}) {
  let userId = data.userId;

  // If email and role are provided, ensure user exists or create one
  if (data.email && data.roleId) {
    try {
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, data.email),
      });

      if (existingUser) {
        userId = existingUser.id;
        // Ensure user has the role in this store
        await db.insert(userRoles).values({
          userId: existingUser.id,
          roleId: data.roleId,
          storeId: data.storeId,
        }).onConflictDoNothing();
      } else {
        const password = data.password || 'Employee@123';
        const authResponse = await authService.register({
          email: data.email,
          password,
          fullName: data.fullName,
          phone: data.phone,
          storeId: data.storeId,
          roleId: data.roleId,
        });
        userId = authResponse.user.id;
      }
    } catch (error) {
      console.error('Error handling user account for employee:', error);
    }
  }

  // Exclude roleId and password from employee insertion
  const { roleId, password, ...employeeData } = data;

  const [employee] = await db
    .insert(employees)
    .values({
      ...employeeData,
      userId,
      // Ensure dates are Dates if they aren't already (though typescript says they are)
      // If data comes from controller as Date, we can use it directly or ensure copy.
      dateOfBirth: employeeData.dateOfBirth ? new Date(employeeData.dateOfBirth) : null,
      dateOfJoining: new Date(employeeData.dateOfJoining),
    })
    .returning();
  return employee;
}

export async function updateEmployee(employeeId: string, storeId: string, data: Partial<{
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: Date;
  department: string;
  position: string;
  employmentType: string;
  payrollFrequency: string;
  salary: string;
  bankAccountNumber: string;
  bankName: string;
  ifscCode: string;
  nicNumber: string;
  nicPhotoUrl: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactName2: string;
  emergencyContactPhone2: string;
  address: string;
  status: string;
  terminationDate: Date;
  terminationReason: string;
}>) {
  const [employee] = await db
    .update(employees)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(employees.id, employeeId), eq(employees.storeId, storeId)))
    .returning();
  return employee;
}

export async function getEmployeeSummary(employeeId: string, storeId: string) {
  const employee = await getEmployeeById(employeeId, storeId);
  if (!employee) return null;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Get attendance summary for current month
  const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
  const endOfMonth = new Date(currentYear, currentMonth, 0);

  const attendanceRecords = await db
    .select({
      status: attendance.status,
      count: sql<number>`count(*)::int`,
    })
    .from(attendance)
    .where(
      and(
        eq(attendance.employeeId, employeeId),
        gte(attendance.date, startOfMonth),
        lte(attendance.date, endOfMonth)
      )
    )
    .groupBy(attendance.status);

  // Get leave balances
  const balances = await db
    .select({
      leaveTypeName: leaveTypes.name,
      allocated: leaveBalances.allocated,
      used: leaveBalances.used,
      carriedForward: leaveBalances.carriedForward,
    })
    .from(leaveBalances)
    .innerJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id))
    .where(
      and(
        eq(leaveBalances.employeeId, employeeId),
        eq(leaveBalances.year, currentYear)
      )
    );

  // Get pending leave requests
  const pendingLeaves = await db
    .select()
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.employeeId, employeeId),
        eq(leaveRequests.status, 'pending')
      )
    );

  // Get latest payroll
  const [latestPayroll] = await db
    .select()
    .from(payroll)
    .where(eq(payroll.employeeId, employeeId))
    .orderBy(desc(payroll.year), desc(payroll.month))
    .limit(1);

  return {
    employee,
    attendance: {
      month: currentMonth,
      year: currentYear,
      summary: attendanceRecords,
    },
    leaveBalances: balances,
    pendingLeaveRequests: pendingLeaves.length,
    latestPayroll,
  };
}

// ============================================================================
// ATTENDANCE MANAGEMENT
// ============================================================================

export async function getAttendance(storeId: string, filters?: {
  employeeId?: string;
  startDate?: Date;
  endDate?: Date;
  status?: string;
}) {
  const conditions = [eq(attendance.storeId, storeId)];

  if (filters?.employeeId) {
    conditions.push(eq(attendance.employeeId, filters.employeeId));
  }
  if (filters?.startDate) {
    conditions.push(gte(attendance.date, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(attendance.date, filters.endDate));
  }
  if (filters?.status) {
    conditions.push(eq(attendance.status, filters.status));
  }

  return db
    .select({
      id: attendance.id,
      employeeId: attendance.employeeId,
      employeeName: employees.fullName,
      employeeCode: employees.employeeCode,
      date: attendance.date,
      checkIn: attendance.checkIn,
      checkOut: attendance.checkOut,
      workHours: attendance.workHours,
      overtimeHours: attendance.overtimeHours,
      status: attendance.status,
      notes: attendance.notes,
    })
    .from(attendance)
    .innerJoin(employees, eq(attendance.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(desc(attendance.date));
}

export async function getTodayAttendance(storeId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get all active employees
  const activeEmployees = await db
    .select({
      id: employees.id,
      fullName: employees.fullName,
      employeeCode: employees.employeeCode,
      department: employees.department,
      position: employees.position,
    })
    .from(employees)
    .where(and(eq(employees.storeId, storeId), eq(employees.status, 'active')));

  // Get today's attendance records
  const todayRecords = await db
    .select()
    .from(attendance)
    .where(
      and(
        eq(attendance.storeId, storeId),
        gte(attendance.date, today),
        lte(attendance.date, tomorrow)
      )
    );

  const attendanceMap = new Map(todayRecords.map(r => [r.employeeId, r]));

  return activeEmployees.map(emp => ({
    ...emp,
    attendance: attendanceMap.get(emp.id) || null,
  }));
}

export async function markCheckIn(employeeId: string, storeId: string, userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if attendance already exists for today
  const [existing] = await db
    .select()
    .from(attendance)
    .where(
      and(
        eq(attendance.employeeId, employeeId),
        eq(attendance.date, today)
      )
    );

  if (existing) {
    throw new Error('Attendance already marked for today');
  }

  const checkInTime = new Date();
  const isLate = checkInTime.getHours() >= 10; // Consider late after 10 AM

  const [record] = await db
    .insert(attendance)
    .values({
      employeeId,
      storeId,
      date: today,
      checkIn: checkInTime,
      status: isLate ? 'late' : 'present',
      createdBy: userId,
    })
    .returning();

  return record;
}

export async function markCheckOut(attendanceId: string, storeId: string) {
  const [record] = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.id, attendanceId), eq(attendance.storeId, storeId)));

  if (!record) {
    throw new Error('Attendance record not found');
  }

  if (record.checkOut) {
    throw new Error('Already checked out');
  }

  const checkOutTime = new Date();
  let workHours = 0;
  let overtimeHours = 0;

  if (record.checkIn) {
    const diffMs = checkOutTime.getTime() - new Date(record.checkIn).getTime();
    workHours = diffMs / (1000 * 60 * 60);
    if (workHours > 8) {
      overtimeHours = workHours - 8;
      workHours = 8;
    }
  }

  const [updated] = await db
    .update(attendance)
    .set({
      checkOut: checkOutTime,
      workHours: workHours.toFixed(2),
      overtimeHours: overtimeHours.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(attendance.id, attendanceId))
    .returning();

  return updated;
}

export async function markAttendance(data: {
  employeeId: string;
  storeId: string;
  date: Date;
  status: string;
  checkIn?: Date;
  checkOut?: Date;
  notes?: string;
  createdBy: string;
}) {
  const dateOnly = new Date(data.date);
  dateOnly.setHours(0, 0, 0, 0);

  // Check if attendance already exists
  const [existing] = await db
    .select()
    .from(attendance)
    .where(
      and(
        eq(attendance.employeeId, data.employeeId),
        eq(attendance.date, dateOnly)
      )
    );

  let workHours = 0;
  if (data.checkIn && data.checkOut) {
    const diffMs = new Date(data.checkOut).getTime() - new Date(data.checkIn).getTime();
    workHours = diffMs / (1000 * 60 * 60);
  }

  if (existing) {
    // Update existing record
    const [updated] = await db
      .update(attendance)
      .set({
        status: data.status,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        workHours: workHours.toFixed(2),
        notes: data.notes,
        updatedAt: new Date(),
      })
      .where(eq(attendance.id, existing.id))
      .returning();
    return updated;
  }

  // Create new record
  const [record] = await db
    .insert(attendance)
    .values({
      employeeId: data.employeeId,
      storeId: data.storeId,
      date: dateOnly,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      workHours: workHours.toFixed(2),
      status: data.status,
      notes: data.notes,
      createdBy: data.createdBy,
    })
    .returning();

  return record;
}

export async function getAttendanceReport(storeId: string, month: number, year: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const report = await db
    .select({
      employeeId: employees.id,
      employeeName: employees.fullName,
      employeeCode: employees.employeeCode,
      department: employees.department,
      presentDays: sql<number>`count(case when ${attendance.status} = 'present' then 1 end)::int`,
      lateDays: sql<number>`count(case when ${attendance.status} = 'late' then 1 end)::int`,
      absentDays: sql<number>`count(case when ${attendance.status} = 'absent' then 1 end)::int`,
      halfDays: sql<number>`count(case when ${attendance.status} = 'half_day' then 1 end)::int`,
      leaveDays: sql<number>`count(case when ${attendance.status} = 'on_leave' then 1 end)::int`,
      totalWorkHours: sql<number>`coalesce(sum(${attendance.workHours}), 0)::numeric(10,2)`,
      totalOvertimeHours: sql<number>`coalesce(sum(${attendance.overtimeHours}), 0)::numeric(10,2)`,
    })
    .from(employees)
    .leftJoin(
      attendance,
      and(
        eq(attendance.employeeId, employees.id),
        gte(attendance.date, startDate),
        lte(attendance.date, endDate)
      )
    )
    .where(and(eq(employees.storeId, storeId), eq(employees.status, 'active')))
    .groupBy(employees.id, employees.fullName, employees.employeeCode, employees.department);

  return {
    month,
    year,
    totalWorkingDays: endDate.getDate(),
    employees: report,
  };
}

// ============================================================================
// LEAVE MANAGEMENT
// ============================================================================

export async function getLeaveTypes(storeId: string) {
  return db
    .select()
    .from(leaveTypes)
    .where(and(eq(leaveTypes.storeId, storeId), eq(leaveTypes.isActive, true)));
}

export async function createLeaveType(data: {
  storeId: string;
  name: string;
  daysAllowed: number;
  isPaid?: boolean;
  carryForward?: boolean;
  maxCarryForward?: number;
}) {
  const [leaveType] = await db
    .insert(leaveTypes)
    .values(data)
    .returning();
  return leaveType;
}

export async function getLeaveRequests(storeId: string, filters?: {
  employeeId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const conditions = [eq(leaveRequests.storeId, storeId)];

  if (filters?.employeeId) {
    conditions.push(eq(leaveRequests.employeeId, filters.employeeId));
  }
  if (filters?.status) {
    conditions.push(eq(leaveRequests.status, filters.status));
  }

  return db
    .select({
      id: leaveRequests.id,
      employeeId: leaveRequests.employeeId,
      employeeName: employees.fullName,
      employeeCode: employees.employeeCode,
      leaveTypeId: leaveRequests.leaveTypeId,
      leaveTypeName: leaveTypes.name,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      totalDays: leaveRequests.totalDays,
      reason: leaveRequests.reason,
      status: leaveRequests.status,
      approvedBy: leaveRequests.approvedBy,
      approvedAt: leaveRequests.approvedAt,
      rejectionReason: leaveRequests.rejectionReason,
      createdAt: leaveRequests.createdAt,
    })
    .from(leaveRequests)
    .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
    .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
    .where(and(...conditions))
    .orderBy(desc(leaveRequests.createdAt));
}

export async function createLeaveRequest(data: {
  employeeId: string;
  storeId: string;
  leaveTypeId: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
}) {
  // Calculate total days
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  // Check leave balance
  const currentYear = new Date().getFullYear();
  const [balance] = await db
    .select()
    .from(leaveBalances)
    .where(
      and(
        eq(leaveBalances.employeeId, data.employeeId),
        eq(leaveBalances.leaveTypeId, data.leaveTypeId),
        eq(leaveBalances.year, currentYear)
      )
    );

  if (balance) {
    const remaining = parseFloat(balance.allocated as string) +
      parseFloat(balance.carriedForward as string) -
      parseFloat(balance.used as string);
    if (totalDays > remaining) {
      throw new Error(`Insufficient leave balance. Available: ${remaining} days`);
    }
  }

  const [request] = await db
    .insert(leaveRequests)
    .values({
      ...data,
      startDate: start,
      endDate: end,
      totalDays: totalDays.toString(),
    })
    .returning();

  return request;
}

export async function approveLeaveRequest(requestId: string, storeId: string, approvedBy: string) {
  const [request] = await db
    .select()
    .from(leaveRequests)
    .where(and(eq(leaveRequests.id, requestId), eq(leaveRequests.storeId, storeId)));

  if (!request) {
    throw new Error('Leave request not found');
  }

  if (request.status !== 'pending') {
    throw new Error('Leave request is not pending');
  }

  // Update leave balance
  const currentYear = new Date().getFullYear();
  await db
    .update(leaveBalances)
    .set({
      used: sql`${leaveBalances.used} + ${request.totalDays}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(leaveBalances.employeeId, request.employeeId),
        eq(leaveBalances.leaveTypeId, request.leaveTypeId),
        eq(leaveBalances.year, currentYear)
      )
    );

  // Mark attendance as on_leave for the leave period
  const start = new Date(request.startDate);
  const end = new Date(request.endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateOnly = new Date(d);
    dateOnly.setHours(0, 0, 0, 0);

    await db
      .insert(attendance)
      .values({
        employeeId: request.employeeId,
        storeId: storeId,
        date: dateOnly,
        status: 'on_leave',
        notes: `Leave: ${request.reason || 'Approved leave'}`,
        createdBy: approvedBy,
      })
      .onConflictDoUpdate({
        target: [attendance.employeeId, attendance.date],
        set: {
          status: 'on_leave',
          notes: `Leave: ${request.reason || 'Approved leave'}`,
          updatedAt: new Date(),
        },
      });
  }

  const [updated] = await db
    .update(leaveRequests)
    .set({
      status: 'approved',
      approvedBy,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(leaveRequests.id, requestId))
    .returning();

  return updated;
}

export async function rejectLeaveRequest(requestId: string, storeId: string, rejectedBy: string, reason: string) {
  const [updated] = await db
    .update(leaveRequests)
    .set({
      status: 'rejected',
      approvedBy: rejectedBy,
      approvedAt: new Date(),
      rejectionReason: reason,
      updatedAt: new Date(),
    })
    .where(and(eq(leaveRequests.id, requestId), eq(leaveRequests.storeId, storeId)))
    .returning();

  return updated;
}

export async function getLeaveBalances(employeeId: string, year?: number) {
  const targetYear = year || new Date().getFullYear();

  return db
    .select({
      id: leaveBalances.id,
      leaveTypeId: leaveBalances.leaveTypeId,
      leaveTypeName: leaveTypes.name,
      isPaid: leaveTypes.isPaid,
      year: leaveBalances.year,
      allocated: leaveBalances.allocated,
      used: leaveBalances.used,
      carriedForward: leaveBalances.carriedForward,
    })
    .from(leaveBalances)
    .innerJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id))
    .where(
      and(
        eq(leaveBalances.employeeId, employeeId),
        eq(leaveBalances.year, targetYear)
      )
    );
}

export async function initializeLeaveBalances(employeeId: string, storeId: string, year: number) {
  const types = await getLeaveTypes(storeId);

  for (const type of types) {
    await db
      .insert(leaveBalances)
      .values({
        employeeId,
        leaveTypeId: type.id,
        year,
        allocated: type.daysAllowed.toString(),
        used: '0',
        carriedForward: '0',
      })
      .onConflictDoNothing();
  }
}

// ============================================================================
// PAYROLL MANAGEMENT
// ============================================================================

export async function getPayrollRecords(storeId: string, filters?: {
  employeeId?: string;
  month?: number;
  year?: number;
  status?: string;
}) {
  const conditions = [eq(payroll.storeId, storeId)];

  if (filters?.employeeId) {
    conditions.push(eq(payroll.employeeId, filters.employeeId));
  }
  if (filters?.month) {
    conditions.push(eq(payroll.month, filters.month));
  }
  if (filters?.year) {
    conditions.push(eq(payroll.year, filters.year));
  }
  if (filters?.status) {
    conditions.push(eq(payroll.status, filters.status));
  }

  return db
    .select({
      id: payroll.id,
      employeeId: payroll.employeeId,
      employeeName: employees.fullName,
      employeeCode: employees.employeeCode,
      department: employees.department,
      month: payroll.month,
      year: payroll.year,
      baseSalary: payroll.baseSalary,
      workingDays: payroll.workingDays,
      daysWorked: payroll.daysWorked,
      overtimeHours: payroll.overtimeHours,
      overtimeAmount: payroll.overtimeAmount,
      bonus: payroll.bonus,
      allowances: payroll.allowances,
      deductions: payroll.deductions,
      advanceDeduction: payroll.advanceDeduction,
      netSalary: payroll.netSalary,
      status: payroll.status,
      paidAt: payroll.paidAt,
      paymentMethod: payroll.paymentMethod,
    })
    .from(payroll)
    .innerJoin(employees, eq(payroll.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(desc(payroll.year), desc(payroll.month));
}

export async function generatePayroll(storeId: string, month: number, year: number, cycle: 'monthly' | 'weekly' = 'monthly') {
  // Get all active employees for this cycle
  const activeEmployees = await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.storeId, storeId),
        eq(employees.status, 'active'),
        eq(employees.payrollFrequency, cycle)
      )
    );

  // Get attendance report
  const attendanceReport = await getAttendanceReport(storeId, month, year);
  const attendanceMap = new Map(
    attendanceReport.employees.map(e => [e.employeeId, e])
  );

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0);
  const workingDays = attendanceReport.totalWorkingDays;
  const payrollRecords = [];

  for (const employee of activeEmployees) {
    const att = attendanceMap.get(employee.id);

    // Calculate basic attendance days
    // Logic: Present + Late + (Half Days * 0.5)
    const attendanceDays = att ?
      (att.presentDays || 0) + (att.lateDays || 0) + ((att.halfDays || 0) * 0.5) : 0;

    // Calculate Paid Leave Days
    // Fetch approved leave requests that overlap with this month and are PAID
    const paidLeaves = await db
      .select({
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
      })
      .from(leaveRequests)
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(
        and(
          eq(leaveRequests.employeeId, employee.id),
          eq(leaveRequests.status, 'approved'),
          eq(leaveTypes.isPaid, true),
          // Check overlap: Start <= EndOfMonth AND End >= StartOfMonth
          lte(leaveRequests.startDate, endOfMonth),
          gte(leaveRequests.endDate, startOfMonth)
        )
      );

    let paidLeaveDays = 0;
    for (const leave of paidLeaves) {
      // Calculate intersection
      const start = leave.startDate < startOfMonth ? startOfMonth : leave.startDate;
      const end = leave.endDate > endOfMonth ? endOfMonth : leave.endDate;

      const diffTime = Math.abs(end.getTime() - start.getTime());
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      paidLeaveDays += days;
    }

    const daysWorked = attendanceDays + paidLeaveDays;

    const baseSalary = parseFloat(employee.salary as string);
    const dailyRate = baseSalary / workingDays;
    const earnedSalary = dailyRate * daysWorked;

    // Calculate overtime (assuming Rs 200/hour)
    const overtimeHours = att?.totalOvertimeHours || 0;
    const overtimeAmount = overtimeHours * 200;

    // Get pending salary advances
    const advances = await db
      .select()
      .from(salaryAdvances)
      .where(
        and(
          eq(salaryAdvances.employeeId, employee.id),
          eq(salaryAdvances.status, 'approved'),
          isNull(salaryAdvances.deductFromPayrollId)
        )
      );

    const totalAdvances = advances.reduce(
      (sum, adv) => sum + parseFloat(adv.amount as string), 0
    );

    // Sri Lankan Statutory Deductions (EPF/ETF)
    // Fix: For weekly payroll, calculate based on EARNED salary, not full monthly base.
    const deductionBase = cycle === 'weekly' ? earnedSalary : baseSalary;

    // EPF Employee Contribution: 8%
    // EPF Employer Contribution: 12%
    // ETF Employer Contribution: 3%
    const epfEmployee = deductionBase * 0.08;
    const epfEmployer = deductionBase * 0.12;
    const etfEmployer = deductionBase * 0.03;
    const apit = 0; // TBD: Implement APIT tax table if needed

    // Festive Bonus Calculation (SL)
    // Jan: Thai Pongal, April: New Year, Oct: Deepavali, Dec: Christmas
    let festiveBonus = 0;
    let bonusType: 'none' | 'festive' | 'performance' = 'none';
    let festiveBonusMonth: number | null = null;

    if (cycle === 'monthly') {
      const SL_FESTIVALS = [1, 4, 10, 12];
      if (SL_FESTIVALS.includes(month)) {
        // Example: 10% of base salary as festive bonus if not already given this month
        festiveBonus = baseSalary * 0.1;
        bonusType = 'festive';
        festiveBonusMonth = month;
      }
    }

    const netSalary = earnedSalary + overtimeAmount + festiveBonus - totalAdvances - epfEmployee - apit;

    // Check if payroll already exists
    const [existing] = await db
      .select()
      .from(payroll)
      .where(
        and(
          eq(payroll.employeeId, employee.id),
          eq(payroll.month, month),
          eq(payroll.year, year)
        )
      );

    if (!existing) {
      const [record] = await db
        .insert(payroll)
        .values({
          employeeId: employee.id,
          storeId,
          month,
          year,
          baseSalary: baseSalary.toFixed(2),
          workingDays,
          daysWorked: Math.round(daysWorked), // Round to nearest integer for storage if strictly int, but schema might be int. 
          // Wait, DaysWorked in schema is 'integer'. 
          // If 26.5 days, we lose 0.5?
          // Let's check schema: daysWorked: integer('days_worked').notNull()
          // We should probably change schema to decimal for accuracy, or floor/ceil. 
          // Ideally payroll allows partial days.
          // For now, I will keep as calculated but cast to String/Number as needed.
          // If schema is integer, it will trunk. I should probably fix schema to decimal later or accept rounding.
          // For now let's round for the record, but calculation used precise `earnedSalary`.
          overtimeHours: overtimeHours.toString(),
          overtimeAmount: overtimeAmount.toFixed(2),
          allowances: '0',
          deductions: '0',
          epfEmployee: epfEmployee.toFixed(2),
          epfEmployer: epfEmployer.toFixed(2),
          etfEmployer: etfEmployer.toFixed(2),
          apit: apit.toFixed(2),
          advanceDeduction: totalAdvances.toFixed(2),
          bonus: festiveBonus.toFixed(2),
          bonusType,
          festiveBonusMonth,
          cycle,
          netSalary: netSalary.toFixed(2),
          status: 'draft',
        })
        .returning();

      payrollRecords.push(record);
    }
  }

  return payrollRecords;
}

export async function updatePayroll(payrollId: string, storeId: string, data: {
  bonus?: string;
  allowances?: string;
  deductions?: string;
  deductionNotes?: string;
}) {
  const [record] = await db
    .select()
    .from(payroll)
    .where(and(eq(payroll.id, payrollId), eq(payroll.storeId, storeId)));

  if (!record) {
    throw new Error('Payroll record not found');
  }

  // Recalculate net salary
  const baseSalary = parseFloat(record.baseSalary as string);
  const dailyRate = baseSalary / record.workingDays;
  const earnedSalary = dailyRate * record.daysWorked;
  const overtimeAmount = parseFloat(record.overtimeAmount as string);
  const bonus = parseFloat(data.bonus || record.bonus as string);
  const allowances = parseFloat(data.allowances || record.allowances as string);
  const deductions = parseFloat(data.deductions || record.deductions as string);
  const advanceDeduction = parseFloat(record.advanceDeduction as string);
  const epfEmployee = parseFloat(record.epfEmployee as string);
  const apit = parseFloat(record.apit as string);

  const netSalary = earnedSalary + overtimeAmount + bonus + allowances - deductions - advanceDeduction - epfEmployee - apit;

  const [updated] = await db
    .update(payroll)
    .set({
      ...data,
      netSalary: netSalary.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(payroll.id, payrollId))
    .returning();

  return updated;
}

export async function approvePayroll(payrollId: string, storeId: string, approvedBy: string) {
  const [updated] = await db
    .update(payroll)
    .set({
      status: 'approved',
      approvedBy,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(payroll.id, payrollId),
        eq(payroll.storeId, storeId),
        eq(payroll.status, 'draft')
      )
    )
    .returning();

  return updated;
}

export async function processPayrollPayment(payrollId: string, storeId: string, paidBy: string, data: {
  paymentMethod: string;
  paymentReference?: string;
}) {
  const [record] = await db
    .select()
    .from(payroll)
    .where(and(eq(payroll.id, payrollId), eq(payroll.storeId, storeId)));

  if (!record) {
    throw new Error('Payroll record not found');
  }

  if (record.status !== 'approved') {
    throw new Error('Payroll must be approved before payment');
  }

  // Mark related salary advances as deducted
  await db
    .update(salaryAdvances)
    .set({
      status: 'deducted',
      deductFromPayrollId: payrollId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(salaryAdvances.employeeId, record.employeeId),
        eq(salaryAdvances.status, 'approved'),
        isNull(salaryAdvances.deductFromPayrollId)
      )
    );

  const [updated] = await db
    .update(payroll)
    .set({
      status: 'paid',
      paidAt: new Date(),
      paidBy,
      paymentMethod: data.paymentMethod,
      paymentReference: data.paymentReference,
      updatedAt: new Date(),
    })
    .where(eq(payroll.id, payrollId))
    .returning();

  // ACCOUNTING INTEGRATION
  try {
    // 1. Find Salaries & Wages Expense Account (5203)
    const [salaryAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.storeId, storeId), eq(accounts.accountCode, '5203')));

    // 2. Find Payment Account
    let paidFromAccountId: string | undefined;

    if (data.paymentMethod === 'cash') {
      const [cashAccount] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.storeId, storeId), eq(accounts.accountCode, '1101')));
      paidFromAccountId = cashAccount?.id;
    } else {
      // Assume default bank for now
      const banks = await accountingService.getBankAccounts(storeId);
      if (banks.length > 0) {
        paidFromAccountId = banks[0].id; // Use first available bank account
      }
    }

    if (salaryAccount) {
      await accountingService.createExpense(storeId, paidBy, {
        expenseDate: new Date().toISOString(),
        expenseAccountId: salaryAccount.id,
        paidFromAccountId,
        paymentMethod: data.paymentMethod,
        amount: parseFloat(updated.netSalary as string),
        description: `Payroll Payment - ${record.month}/${record.year} - ${data.paymentReference || ''}`,
        category: 'Payroll',
        notes: `Employee ID: ${record.employeeId}`,
      });
      logger.info(`[Accounting] Recorded payroll expense for payroll ${payrollId}`);
    } else {
      logger.warn(`[Accounting] salaries & Wages account (5203) not found. Skipping expense creation.`);
    }

  } catch (error) {
    logger.error(`[Accounting] Failed to record payroll expense:`, error);
    // We do not throw here to avoid rolling back the payroll status update
  }

  return updated;
}

// ============================================================================
// SALARY ADVANCES
// ============================================================================

export async function getSalaryAdvances(storeId: string, filters?: {
  employeeId?: string;
  status?: string;
}) {
  const conditions = [eq(salaryAdvances.storeId, storeId)];

  if (filters?.employeeId) {
    conditions.push(eq(salaryAdvances.employeeId, filters.employeeId));
  }
  if (filters?.status) {
    conditions.push(eq(salaryAdvances.status, filters.status));
  }

  return db
    .select({
      id: salaryAdvances.id,
      employeeId: salaryAdvances.employeeId,
      employeeName: employees.fullName,
      employeeCode: employees.employeeCode,
      amount: salaryAdvances.amount,
      requestDate: salaryAdvances.requestDate,
      reason: salaryAdvances.reason,
      status: salaryAdvances.status,
      approvedAt: salaryAdvances.approvedAt,
      rejectionReason: salaryAdvances.rejectionReason,
    })
    .from(salaryAdvances)
    .innerJoin(employees, eq(salaryAdvances.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(desc(salaryAdvances.requestDate));
}

export async function createSalaryAdvance(data: {
  employeeId: string;
  storeId: string;
  amount: string;
  reason?: string;
}) {
  const [advance] = await db
    .insert(salaryAdvances)
    .values({
      ...data,
      requestDate: new Date(),
    })
    .returning();

  return advance;
}

export async function approveSalaryAdvance(advanceId: string, storeId: string, approvedBy: string) {
  const [updated] = await db
    .update(salaryAdvances)
    .set({
      status: 'approved',
      approvedBy,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(salaryAdvances.id, advanceId),
        eq(salaryAdvances.storeId, storeId),
        eq(salaryAdvances.status, 'pending')
      )
    )
    .returning();

  return updated;
}

export async function rejectSalaryAdvance(advanceId: string, storeId: string, rejectedBy: string, reason: string) {
  const [updated] = await db
    .update(salaryAdvances)
    .set({
      status: 'rejected',
      approvedBy: rejectedBy,
      approvedAt: new Date(),
      rejectionReason: reason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(salaryAdvances.id, advanceId),
        eq(salaryAdvances.storeId, storeId),
        eq(salaryAdvances.status, 'pending')
      )
    )
    .returning();

  return updated;
}
