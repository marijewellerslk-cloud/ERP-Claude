export const RESOURCES = {
  INVENTORY: 'inventory',
  SALES: 'sales',
  CUSTOMERS: 'customers',
  ACCOUNTING: 'accounting',
  SUPPLIERS: 'suppliers',
  GOLD_LOANS: 'gold_loans',
  CUSTOM_ORDERS: 'custom_orders',
  REPAIRS: 'repairs',
  REPORTS: 'reports',
  USERS: 'users',
  STORES: 'stores',
  SETTINGS: 'settings',
  // HRM Module Resources
  EMPLOYEES: 'employees',
  ATTENDANCE: 'attendance',
  LEAVE: 'leave',
  PAYROLL: 'payroll',
  // Multi-branch Command Center
  COMMAND_CENTER: 'command_center',
  BRANCHES: 'branches',
  // Karigar & Manufacturing Module
  KARIGARS: 'karigars',
  JOB_CARDS: 'job_cards',
  SCRAP: 'scrap',
  MELTING: 'melting',
  // Gold Pawning Module
  LOAN_CONFIG: 'loan_config',
  LOAN_KYC: 'loan_kyc',
  LOAN_AUCTIONS: 'loan_auctions',
  LOAN_DOCUMENTS: 'loan_documents',
  MARGIN_CALLS: 'margin_calls',
  BACKUPS: 'backups',
} as const;

export const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  APPROVE: 'approve',
  EXPORT: 'export',
  // HRM specific actions
  MARK_OWN: 'mark_own',       // Mark own attendance
  REQUEST_OWN: 'request_own', // Request own leave
  PAY: 'pay',                 // Process payroll payments
  AGGREGATE: 'aggregate',     // Aggregate data across branches
  // Gold Pawning specific actions
  VERIFY: 'verify',           // Verify KYC documents
  INITIATE_AUCTION: 'initiate_auction', // Start auction process
  WAIVE: 'waive',             // Waive margin call or penalty
  DISBURSE: 'disburse',       // Disburse loan amount
  RENEW: 'renew',             // Renew/extend loan
} as const;

export type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];
export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

// Helper function to create permission string
export function createPermission(resource: Resource, action: Action): string {
  return `${resource}:${action}`;
}

// Wildcard permission
export const WILDCARD_PERMISSION = '*:*';

// Check if user has permission (supports wildcards)
export function hasPermission(userPermissions: string[], requiredPermission: string): boolean {
  if (userPermissions.includes(WILDCARD_PERMISSION)) {
    return true;
  }

  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  const [resource, action] = requiredPermission.split(':');

  // Check for resource wildcard (e.g., "inventory:*")
  if (userPermissions.includes(`${resource}:*`)) {
    return true;
  }

  return false;
}

// Pre-defined permission sets for common use cases
export const PERMISSION_SETS = {
  // HRM permissions for different roles
  EMPLOYEE_HRM: [
    'attendance:mark_own',
    'attendance:read',
    'leave:request_own',
    'leave:read',
  ],
  MANAGER_HRM: [
    'employees:read',
    'employees:create',
    'employees:update',
    'attendance:*',
    'leave:*',
    'payroll:read',
  ],
  OWNER_HRM: [
    'employees:*',
    'attendance:*',
    'leave:*',
    'payroll:*',
    'command_center:*',
    'branches:*',
  ],
  // Full HRM access
  FULL_HRM: [
    'employees:*',
    'attendance:*',
    'leave:*',
    'payroll:*',
  ],
  // Gold Pawning permissions
  LOAN_OFFICER: [
    'gold_loans:create',
    'gold_loans:read',
    'gold_loans:update',
    'gold_loans:disburse',
    'loan_kyc:read',
    'loan_kyc:create',
    'loan_kyc:update',
    'loan_documents:read',
    'loan_documents:create',
    'margin_calls:read',
  ],
  LOAN_MANAGER: [
    'gold_loans:*',
    'loan_config:*',
    'loan_kyc:*',
    'loan_documents:*',
    'loan_auctions:*',
    'margin_calls:*',
  ],
} as const;
