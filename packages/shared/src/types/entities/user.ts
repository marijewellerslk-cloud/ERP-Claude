export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface Store {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  parentStoreId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string | null;
  createdAt: Date;
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  storeId: string;
  createdAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  storeId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface AuthUser extends User {
  roles: Array<{
    role: Role;
    store: Store;
    permissions: Permission[];
  }>;
  currentStore: Store;
}
