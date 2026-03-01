import { z } from 'zod';

// Employee validation schemas
export const createEmployeeSchema = z.object({
  employeeCode: z.string().min(1).max(20),
  fullName: z.string().min(1).max(255),
  storeId: z.string().uuid().optional().nullable().transform(v => v ?? undefined),
  email: z.string().email().optional().nullable().transform(v => v ?? undefined),
  phone: z.string().max(20).optional().nullable().transform(v => v ?? undefined),
  dateOfBirth: z.string().optional().nullable().transform(v => v ?? undefined),
  dateOfJoining: z.string(),
  department: z.enum(['sales', 'accounting', 'management', 'operations']),
  position: z.string().min(1).max(100),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'probationary']).optional().default('full_time'),
  salary: z.string().or(z.number()).transform(v => String(v)),
  bankAccountNumber: z.string().max(50).optional().nullable().transform(v => v ?? undefined),
  bankName: z.string().max(100).optional().nullable().transform(v => v ?? undefined),
  ifscCode: z.string().max(15).optional().nullable().transform(v => v ?? undefined),
  nicNumber: z.string().max(20).optional().nullable().transform(v => v ?? undefined),
  nicPhotoUrl: z.string().optional().nullable().transform(v => v ?? undefined),
  emergencyContactName: z.string().max(255).optional().nullable().transform(v => v ?? undefined),
  emergencyContactPhone: z.string().max(20).optional().nullable().transform(v => v ?? undefined),
  emergencyContactName2: z.string().max(255).optional().nullable().transform(v => v ?? undefined),
  emergencyContactPhone2: z.string().max(20).optional().nullable().transform(v => v ?? undefined),
  payrollFrequency: z.enum(['monthly', 'weekly']).optional().default('monthly'),
  address: z.string().optional().nullable().transform(v => v ?? undefined),
  roleId: z.string().uuid().optional().nullable().transform(v => v ?? undefined),
  password: z.string().min(6).optional().nullable().transform(v => v ?? undefined),
  userId: z.string().uuid().optional().nullable().transform(v => v ?? undefined),
});

export const updateEmployeeSchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  email: z.string().email().optional().nullable().transform(v => v ?? undefined),
  phone: z.string().max(20).optional().nullable().transform(v => v ?? undefined),
  dateOfBirth: z.string().optional().nullable().transform(v => v ?? undefined),
  department: z.enum(['sales', 'accounting', 'management', 'operations']).optional(),
  position: z.string().min(1).max(100).optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'probationary']).optional(),
  salary: z.string().or(z.number()).transform(v => String(v)).optional(),
  bankAccountNumber: z.string().max(50).optional().nullable().transform(v => v ?? undefined),
  bankName: z.string().max(100).optional().nullable().transform(v => v ?? undefined),
  ifscCode: z.string().max(15).optional().nullable().transform(v => v ?? undefined),
  nicNumber: z.string().max(20).optional().nullable().transform(v => v ?? undefined),
  nicPhotoUrl: z.string().optional().nullable().transform(v => v ?? undefined),
  emergencyContactName: z.string().max(255).optional().nullable().transform(v => v ?? undefined),
  emergencyContactPhone: z.string().max(20).optional().nullable().transform(v => v ?? undefined),
  emergencyContactName2: z.string().max(255).optional().nullable().transform(v => v ?? undefined),
  emergencyContactPhone2: z.string().max(20).optional().nullable().transform(v => v ?? undefined),
  payrollFrequency: z.enum(['monthly', 'weekly']).optional(),
  address: z.string().optional().nullable().transform(v => v ?? undefined),
  status: z.enum(['active', 'on_leave', 'terminated', 'resigned']).optional(),
  terminationDate: z.string().optional().nullable().transform(v => v ?? undefined),
  terminationReason: z.string().optional().nullable().transform(v => v ?? undefined),
});

// Attendance validation schemas
export const markAttendanceSchema = z.object({
  employeeId: z.string().uuid(),
  date: z.string(),
  status: z.enum(['present', 'absent', 'half_day', 'late', 'on_leave']),
  checkIn: z.string().optional().nullable().transform(v => v ?? undefined),
  checkOut: z.string().optional().nullable().transform(v => v ?? undefined),
  notes: z.string().optional().nullable().transform(v => v ?? undefined),
});

export const checkInSchema = z.object({
  employeeId: z.string().uuid(),
});

export const checkOutSchema = z.object({
  attendanceId: z.string().uuid(),
});

// Leave validation schemas
export const createLeaveTypeSchema = z.object({
  name: z.string().min(1).max(100),
  daysAllowed: z.number().int().min(0),
  isPaid: z.boolean().optional().default(true),
  carryForward: z.boolean().optional().default(false),
  maxCarryForward: z.number().int().min(0).optional().default(0),
});

export const createLeaveRequestSchema = z.object({
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional().nullable(),
});

export const rejectLeaveSchema = z.object({
  reason: z.string().min(1),
});

// Payroll validation schemas
export const generatePayrollSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  cycle: z.enum(['monthly', 'weekly']).optional().default('monthly'),
});

export const updatePayrollSchema = z.object({
  bonus: z.string().or(z.number()).transform(v => String(v)).optional(),
  allowances: z.string().or(z.number()).transform(v => String(v)).optional(),
  deductions: z.string().or(z.number()).transform(v => String(v)).optional(),
  deductionNotes: z.string().optional().nullable(),
});

export const processPaymentSchema = z.object({
  paymentMethod: z.enum(['cash', 'bank_transfer', 'cheque']),
  paymentReference: z.string().optional().nullable(),
});

// Salary advance validation schemas
export const createAdvanceSchema = z.object({
  employeeId: z.string().uuid(),
  amount: z.string().or(z.number()).transform(v => String(v)),
  reason: z.string().optional().nullable(),
});

export const rejectAdvanceSchema = z.object({
  reason: z.string().min(1),
});

// Query params schemas
export const employeeQuerySchema = z.object({
  status: z.enum(['active', 'on_leave', 'terminated', 'resigned']).optional(),
  department: z.enum(['sales', 'accounting', 'management', 'operations']).optional(),
  search: z.string().optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

export const attendanceQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['present', 'absent', 'half_day', 'late', 'on_leave']).optional(),
});

export const leaveRequestQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
});

export const payrollQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  month: z.string().transform(Number).optional(),
  year: z.string().transform(Number).optional(),
  status: z.enum(['draft', 'pending_approval', 'approved', 'paid']).optional(),
});

export const advanceQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'deducted']).optional(),
});
