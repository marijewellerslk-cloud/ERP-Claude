import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import * as hrmController from './hrm.controller.js';

const RESOURCES = {
  EMPLOYEES: 'employees',
  ATTENDANCE: 'attendance',
  LEAVE: 'leave',
  PAYROLL: 'payroll',
} as const;

const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  APPROVE: 'approve',
} as const;

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// EMPLOYEE ROUTES
// ============================================================================

// List employees
router.get('/employees', requirePermission(RESOURCES.EMPLOYEES, ACTIONS.READ), hrmController.getEmployees);

// Get employee by ID
router.get('/employees/:id', requirePermission(RESOURCES.EMPLOYEES, ACTIONS.READ), hrmController.getEmployeeById);

// Get employee summary (attendance, leave, payroll)
router.get('/employees/:id/summary', requirePermission(RESOURCES.EMPLOYEES, ACTIONS.READ), hrmController.getEmployeeSummary);

// Create employee
router.post('/employees', requirePermission(RESOURCES.EMPLOYEES, ACTIONS.CREATE), hrmController.createEmployee);

// Update employee
router.put('/employees/:id', requirePermission(RESOURCES.EMPLOYEES, ACTIONS.UPDATE), hrmController.updateEmployee);

// ============================================================================
// ATTENDANCE ROUTES
// ============================================================================

// Get attendance records
router.get('/attendance', requirePermission(RESOURCES.ATTENDANCE, ACTIONS.READ), hrmController.getAttendance);

// Get today's attendance
router.get('/attendance/today', requirePermission(RESOURCES.ATTENDANCE, ACTIONS.READ), hrmController.getTodayAttendance);

// Get attendance report
router.get('/attendance/report', requirePermission(RESOURCES.ATTENDANCE, ACTIONS.READ), hrmController.getAttendanceReport);

// Export attendance report
router.get('/attendance/export', requirePermission(RESOURCES.ATTENDANCE, ACTIONS.READ), hrmController.exportAttendance);

// Mark check-in
router.post('/attendance/check-in', requirePermission(RESOURCES.ATTENDANCE, ACTIONS.CREATE), hrmController.markCheckIn);

// Mark check-out
router.post('/attendance/check-out', requirePermission(RESOURCES.ATTENDANCE, ACTIONS.CREATE), hrmController.markCheckOut);

// Mark attendance (manual entry)
router.post('/attendance', requirePermission(RESOURCES.ATTENDANCE, ACTIONS.CREATE), hrmController.markAttendance);

// ============================================================================
// LEAVE MANAGEMENT ROUTES
// ============================================================================

// Get leave types
router.get('/leave-types', requirePermission(RESOURCES.LEAVE, ACTIONS.READ), hrmController.getLeaveTypes);

// Create leave type
router.post('/leave-types', requirePermission(RESOURCES.LEAVE, ACTIONS.CREATE), hrmController.createLeaveType);

// Get leave requests
router.get('/leave-requests', requirePermission(RESOURCES.LEAVE, ACTIONS.READ), hrmController.getLeaveRequests);

// Create leave request
router.post('/leave-requests', requirePermission(RESOURCES.LEAVE, ACTIONS.CREATE), hrmController.createLeaveRequest);

// Approve leave request
router.put('/leave-requests/:id/approve', requirePermission(RESOURCES.LEAVE, ACTIONS.APPROVE), hrmController.approveLeaveRequest);

// Reject leave request
router.put('/leave-requests/:id/reject', requirePermission(RESOURCES.LEAVE, ACTIONS.APPROVE), hrmController.rejectLeaveRequest);

// Get leave balances for an employee
router.get('/leave-balances/:employeeId', requirePermission(RESOURCES.LEAVE, ACTIONS.READ), hrmController.getLeaveBalances);

// ============================================================================
// PAYROLL ROUTES
// ============================================================================

// Get payroll records
router.get('/payroll', requirePermission(RESOURCES.PAYROLL, ACTIONS.READ), hrmController.getPayrollRecords);

// Generate monthly payroll
router.post('/payroll/generate', requirePermission(RESOURCES.PAYROLL, ACTIONS.CREATE), hrmController.generatePayroll);

// Export payroll records
router.get('/payroll/export', requirePermission(RESOURCES.PAYROLL, ACTIONS.READ), hrmController.exportPayroll);

// Update payroll record
router.put('/payroll/:id', requirePermission(RESOURCES.PAYROLL, ACTIONS.UPDATE), hrmController.updatePayroll);

// Approve payroll
router.put('/payroll/:id/approve', requirePermission(RESOURCES.PAYROLL, ACTIONS.APPROVE), hrmController.approvePayroll);

// Process payroll payment
router.post('/payroll/:id/pay', requirePermission(RESOURCES.PAYROLL, ACTIONS.APPROVE), hrmController.processPayrollPayment);

// ============================================================================
// SALARY ADVANCE ROUTES
// ============================================================================

// Get salary advances
router.get('/advances', requirePermission(RESOURCES.PAYROLL, ACTIONS.READ), hrmController.getSalaryAdvances);

// Create salary advance request
router.post('/advances', requirePermission(RESOURCES.PAYROLL, ACTIONS.CREATE), hrmController.createSalaryAdvance);

// Approve salary advance
router.put('/advances/:id/approve', requirePermission(RESOURCES.PAYROLL, ACTIONS.APPROVE), hrmController.approveSalaryAdvance);

// Reject salary advance
router.put('/advances/:id/reject', requirePermission(RESOURCES.PAYROLL, ACTIONS.APPROVE), hrmController.rejectSalaryAdvance);

export default router;
