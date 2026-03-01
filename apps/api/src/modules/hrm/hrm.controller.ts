import { Request, Response, NextFunction } from 'express';
import * as XLSX from 'xlsx';
import * as hrmService from './hrm.service.js';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  markAttendanceSchema,
  checkInSchema,
  checkOutSchema,
  createLeaveTypeSchema,
  createLeaveRequestSchema,
  rejectLeaveSchema,
  generatePayrollSchema,
  updatePayrollSchema,
  processPaymentSchema,
  createAdvanceSchema,
  rejectAdvanceSchema,
  employeeQuerySchema,
  attendanceQuerySchema,
  leaveRequestQuerySchema,
  payrollQuerySchema,
  advanceQuerySchema,
} from './hrm.validation.js';

// ============================================================================
// EMPLOYEE CONTROLLERS
// ============================================================================

export async function getEmployees(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const filters = employeeQuerySchema.parse(req.query);
    const employees = await hrmService.getEmployees(storeId, filters);

    res.json({ data: employees });
  } catch (error) {
    next(error);
  }
}

export async function getEmployeeById(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    const { id } = req.params;

    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const employee = await hrmService.getEmployeeById(id, storeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ data: employee });
  } catch (error) {
    next(error);
  }
}

export async function createEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const defaultStoreId = req.user?.storeId;
    if (!defaultStoreId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const data = createEmployeeSchema.parse(req.body);

    // Allow superadmin to assign a specific store ID
    // Otherwise fallback to the creator's store ID
    const storeId = (['superadmin', 'super_admin'].includes(req.user?.role || '') && data.storeId)
      ? data.storeId
      : defaultStoreId;

    const employee = await hrmService.createEmployee({
      ...data,
      storeId,
      email: data.email || undefined,
      phone: data.phone || undefined,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      dateOfJoining: new Date(data.dateOfJoining),
    });

    // Initialize leave balances for the current year
    const currentYear = new Date().getFullYear();
    await hrmService.initializeLeaveBalances(employee.id, storeId, currentYear);

    res.status(201).json({ data: employee });
  } catch (error) {
    next(error);
  }
}

export async function updateEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    const { id } = req.params;

    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const data = updateEmployeeSchema.parse(req.body);
    const employee = await hrmService.updateEmployee(id, storeId, {
      ...data,
      email: data.email || undefined,
      phone: data.phone || undefined,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      terminationDate: data.terminationDate ? new Date(data.terminationDate) : undefined,
      terminationReason: data.terminationReason || undefined,
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ data: employee });
  } catch (error) {
    next(error);
  }
}

export async function getEmployeeSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    const { id } = req.params;

    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const summary = await hrmService.getEmployeeSummary(id, storeId);
    if (!summary) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// ATTENDANCE CONTROLLERS
// ============================================================================

export async function getAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const filters = attendanceQuerySchema.parse(req.query);
    const records = await hrmService.getAttendance(storeId, {
      ...filters,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    });

    res.json({ data: records });
  } catch (error) {
    next(error);
  }
}

export async function getTodayAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const attendance = await hrmService.getTodayAttendance(storeId);
    res.json({ data: attendance });
  } catch (error) {
    next(error);
  }
}

export async function markCheckIn(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    const userId = req.user?.userId;

    if (!storeId || !userId) {
      return res.status(400).json({ error: 'Authentication required' });
    }

    const { employeeId } = checkInSchema.parse(req.body);
    const record = await hrmService.markCheckIn(employeeId, storeId, userId);

    res.status(201).json({ data: record });
  } catch (error: any) {
    if (error.message === 'Attendance already marked for today') {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
}

export async function markCheckOut(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const { attendanceId } = checkOutSchema.parse(req.body);
    const record = await hrmService.markCheckOut(attendanceId, storeId);

    res.json({ data: record });
  } catch (error: any) {
    if (error.message === 'Attendance record not found' || error.message === 'Already checked out') {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
}

export async function markAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    const userId = req.user?.userId;

    if (!storeId || !userId) {
      return res.status(400).json({ error: 'Authentication required' });
    }

    const data = markAttendanceSchema.parse(req.body);
    const record = await hrmService.markAttendance({
      ...data,
      storeId,
      date: new Date(data.date),
      checkIn: data.checkIn ? new Date(data.checkIn) : undefined,
      checkOut: data.checkOut ? new Date(data.checkOut) : undefined,
      notes: data.notes || undefined,
      createdBy: userId,
    });

    res.status(201).json({ data: record });
  } catch (error) {
    next(error);
  }
}

export async function getAttendanceReport(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const report = await hrmService.getAttendanceReport(storeId, month, year);
    res.json({ data: report });
  } catch (error) {
    next(error);
  }
}

export async function exportAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const report = await hrmService.getAttendanceReport(storeId, month, year);

    // Flatten data for Excel
    const data = report.employees.map(e => ({
      'Employee Code': e.employeeCode,
      'Name': e.employeeName,
      'Department': e.department,
      'Present Days': e.presentDays,
      'Late Days': e.lateDays,
      'Half Days': e.halfDays,
      'Absent Days': e.absentDays,
      'Leave Days': e.leaveDays,
      'Total Work Hours': e.totalWorkHours,
      'Overtime Hours': e.totalOvertimeHours
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${month}_${year}.xlsx`);
    res.send(buffer);

  } catch (error) {
    next(error);
  }
}

// ============================================================================
// LEAVE CONTROLLERS
// ============================================================================

export async function getLeaveTypes(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const types = await hrmService.getLeaveTypes(storeId);
    res.json({ data: types });
  } catch (error) {
    next(error);
  }
}

export async function createLeaveType(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const data = createLeaveTypeSchema.parse(req.body);
    const leaveType = await hrmService.createLeaveType({
      ...data,
      storeId,
    });

    res.status(201).json({ data: leaveType });
  } catch (error) {
    next(error);
  }
}

export async function getLeaveRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const filters = leaveRequestQuerySchema.parse(req.query);
    const requests = await hrmService.getLeaveRequests(storeId, filters);

    res.json({ data: requests });
  } catch (error) {
    next(error);
  }
}

export async function createLeaveRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const data = createLeaveRequestSchema.parse(req.body);
    const request = await hrmService.createLeaveRequest({
      ...data,
      storeId,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    });

    res.status(201).json({ data: request });
  } catch (error: any) {
    if (error.message?.includes('Insufficient leave balance')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
}

export async function approveLeaveRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!storeId || !userId) {
      return res.status(400).json({ error: 'Authentication required' });
    }

    const request = await hrmService.approveLeaveRequest(id, storeId, userId);
    res.json({ data: request });
  } catch (error: any) {
    if (error.message === 'Leave request not found' || error.message === 'Leave request is not pending') {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
}

export async function rejectLeaveRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!storeId || !userId) {
      return res.status(400).json({ error: 'Authentication required' });
    }

    const { reason } = rejectLeaveSchema.parse(req.body);
    const request = await hrmService.rejectLeaveRequest(id, storeId, userId, reason);

    res.json({ data: request });
  } catch (error) {
    next(error);
  }
}

export async function getLeaveBalances(req: Request, res: Response, next: NextFunction) {
  try {
    const { employeeId } = req.params;
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;

    const balances = await hrmService.getLeaveBalances(employeeId, year);
    res.json({ data: balances });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// PAYROLL CONTROLLERS
// ============================================================================

export async function getPayrollRecords(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const filters = payrollQuerySchema.parse(req.query);
    const records = await hrmService.getPayrollRecords(storeId, filters);

    res.json({ data: records });
  } catch (error) {
    next(error);
  }
}

export async function exportPayroll(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const filters = payrollQuerySchema.parse(req.query);
    const records = await hrmService.getPayrollRecords(storeId, filters);

    // Flatten data for Excel
    const data = records.map(p => ({
      'Employee Code': p.employeeCode,
      'Name': p.employeeName,
      'Department': p.department,
      'Month': `${p.month}/${p.year}`,
      'Cycle': p.cycle,
      'Base Salary': p.baseSalary,
      'Days Worked': p.daysWorked,
      'Overtime Amount': p.overtimeAmount,
      'Bonus': p.bonus,
      'Allowances': p.allowances,
      'Deductions': p.deductions,
      'Advances': p.advanceDeduction,
      'EPF (Employee)': p.epfEmployee,
      'Net Salary': p.netSalary,
      'Status': p.status,
      'Payment Method': p.paymentMethod || '-',
      'Paid At': p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '-'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Payroll');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=payroll_export.xlsx`);
    res.send(buffer);

  } catch (error) {
    next(error);
  }
}

export async function generatePayroll(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const { month, year, cycle } = generatePayrollSchema.parse(req.body);
    const records = await hrmService.generatePayroll(storeId, month, year, cycle);

    res.status(201).json({ data: records, message: `Generated ${records.length} payroll records` });
  } catch (error) {
    next(error);
  }
}

export async function updatePayroll(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    const { id } = req.params;

    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const data = updatePayrollSchema.parse(req.body);
    const record = await hrmService.updatePayroll(id, storeId, data);

    res.json({ data: record });
  } catch (error: any) {
    if (error.message === 'Payroll record not found') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
}

export async function approvePayroll(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!storeId || !userId) {
      return res.status(400).json({ error: 'Authentication required' });
    }

    const record = await hrmService.approvePayroll(id, storeId, userId);
    if (!record) {
      return res.status(404).json({ error: 'Payroll record not found or not in draft status' });
    }

    res.json({ data: record });
  } catch (error) {
    next(error);
  }
}

export async function processPayrollPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!storeId || !userId) {
      return res.status(400).json({ error: 'Authentication required' });
    }

    const data = processPaymentSchema.parse(req.body);
    const record = await hrmService.processPayrollPayment(id, storeId, userId, data);

    res.json({ data: record });
  } catch (error: any) {
    if (error.message === 'Payroll record not found' || error.message === 'Payroll must be approved before payment') {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
}

// ============================================================================
// SALARY ADVANCE CONTROLLERS
// ============================================================================

export async function getSalaryAdvances(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const filters = advanceQuerySchema.parse(req.query);
    const advances = await hrmService.getSalaryAdvances(storeId, filters);

    res.json({ data: advances });
  } catch (error) {
    next(error);
  }
}

export async function createSalaryAdvance(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const data = createAdvanceSchema.parse(req.body);
    const advance = await hrmService.createSalaryAdvance({
      ...data,
      storeId,
    });

    res.status(201).json({ data: advance });
  } catch (error) {
    next(error);
  }
}

export async function approveSalaryAdvance(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!storeId || !userId) {
      return res.status(400).json({ error: 'Authentication required' });
    }

    const advance = await hrmService.approveSalaryAdvance(id, storeId, userId);
    if (!advance) {
      return res.status(404).json({ error: 'Advance request not found or not pending' });
    }

    res.json({ data: advance });
  } catch (error) {
    next(error);
  }
}

export async function rejectSalaryAdvance(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.user?.storeId;
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!storeId || !userId) {
      return res.status(400).json({ error: 'Authentication required' });
    }

    const { reason } = rejectAdvanceSchema.parse(req.body);
    const advance = await hrmService.rejectSalaryAdvance(id, storeId, userId, reason);

    res.json({ data: advance });
  } catch (error) {
    next(error);
  }
}
