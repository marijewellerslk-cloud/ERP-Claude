export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  OWNER: 'owner',
  STORE_MANAGER: 'store_manager',
  ACCOUNTANT: 'accountant',
  SALESPERSON: 'salesperson',
  CASHIER: 'cashier',
  EMPLOYEE: 'employee',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_DESCRIPTIONS = {
  [ROLES.SUPER_ADMIN]: 'Full system access across all stores and system settings',
  [ROLES.OWNER]: 'Multi-branch access with command center, all business operations',
  [ROLES.STORE_MANAGER]: 'Full access within assigned store, staff management',
  [ROLES.ACCOUNTANT]: 'Accounting operations, financial reports, payroll view',
  [ROLES.SALESPERSON]: 'Inventory read, sales operations, customer management',
  [ROLES.CASHIER]: 'POS operations, payment processing',
  [ROLES.EMPLOYEE]: 'Basic access, own attendance and leave',
} as const;

// Role hierarchy levels (higher number = more privileges)
export const ROLE_LEVELS = {
  [ROLES.EMPLOYEE]: 1,
  [ROLES.CASHIER]: 2,
  [ROLES.SALESPERSON]: 3,
  [ROLES.ACCOUNTANT]: 4,
  [ROLES.STORE_MANAGER]: 5,
  [ROLES.OWNER]: 6,
  [ROLES.SUPER_ADMIN]: 7,
} as const;

// Check if a role has higher or equal privileges
export function hasHigherOrEqualRole(userRole: RoleName, requiredRole: RoleName): boolean {
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
}

// Check if a role can manage another role (must be higher level)
export function canManageRole(managerRole: RoleName, targetRole: RoleName): boolean {
  return ROLE_LEVELS[managerRole] > ROLE_LEVELS[targetRole];
}
