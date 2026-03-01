import { eq, and, lte, isNull } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import {
  users,
  stores,
  userRoles,
  roles,
  rolePermissions,
  permissions,
  sessions,
  loginHistory,
} from '../../db/schema.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt.js';
import { logger } from '../../utils/logger.js';

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  storeId: string;
  roleId: string;
}

export interface LoginInput {
  email: string;
  password: string;
  storeId?: string; // Optional - will auto-detect from user's assigned store
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    role: string;
    permissions: string[];
  };
  store: {
    id: string;
    name: string;
    code: string;
  };
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, input.email),
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Verify store exists
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, input.storeId),
    });

    if (!store) {
      throw new Error('Store not found');
    }

    // Verify role exists
    const role = await db.query.roles.findFirst({
      where: eq(roles.id, input.roleId),
    });

    if (!role) {
      throw new Error('Role not found');
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        phone: input.phone || null,
        isActive: true,
      })
      .returning();

    // Assign role to user for the store
    await db.insert(userRoles).values({
      userId: user.id,
      roleId: input.roleId,
      storeId: input.storeId,
    });

    logger.info(`User registered: ${user.email}`, { userId: user.id });

    // Generate tokens
    return this.generateAuthResponse(user.id, input.storeId);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    // Find user by email
    const user = await db.query.users.findFirst({
      where: eq(users.email, input.email),
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      throw new Error('Account is disabled');
    }

    // Verify password
    console.log(`[DEBUG] Login attempt for ${input.email}`);
    // console.log(`[DEBUG] Input password: ${input.password}`);
    // console.log(`[DEBUG] Stored hash: ${user.passwordHash}`);
    const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
    console.log(`[DEBUG] Password valid: ${isPasswordValid}`);

    if (!isPasswordValid) {
      await this.logLoginAttempt(user.id, 'failed');
      throw new Error('Invalid credentials');
    }

    // Auto-detect store if not provided
    let storeId = input.storeId;
    if (!storeId) {
      // Get user's first assigned store
      const userRole = await db.query.userRoles.findFirst({
        where: eq(userRoles.userId, user.id),
        with: {
          store: true,
          role: true,
        },
      });

      if (!userRole) {
        throw new Error('User is not assigned to any store');
      }

      storeId = userRole.storeId;
      console.log(`[DEBUG] Auto-detected store: ${storeId} (${userRole.store.name})`);
    } else {
      // Verify user has access to the specified store
      const userRole = await db.query.userRoles.findFirst({
        where: and(eq(userRoles.userId, user.id), eq(userRoles.storeId, storeId)),
        with: {
          store: true,
          role: true,
        },
      });

      if (!userRole) {
        throw new Error('User does not have access to this store');
      }
    }

    // Log success
    await this.logLoginAttempt(user.id, 'success');

    logger.info(`User logged in: ${user.email}`, {
      userId: user.id,
      storeId,
    });

    // Verify store is active before allowing login
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, storeId),
    });
    if (store && !store.isActive) {
      throw new Error('Store is deactivated');
    }

    // Time-based access control
    // Restricted window: 10:00 PM (22:00) to 6:00 AM (06:00)
    const now = new Date();
    const currentHour = now.getHours();
    const RESTRICTED_START_HOUR = 22;
    const RESTRICTED_END_HOUR = 6;

    // Privileged roles exempt from restriction
    // fetching role name to check
    const roleName = await this.getUserRole(user.id, storeId);
    const PRIVILEGED_ROLES = ['super_admin', 'superadmin', 'owner', 'store_manager', 'general_manager'];

    const isRestrictedTime =
      RESTRICTED_START_HOUR < RESTRICTED_END_HOUR
        ? currentHour >= RESTRICTED_START_HOUR && currentHour < RESTRICTED_END_HOUR
        : currentHour >= RESTRICTED_START_HOUR || currentHour < RESTRICTED_END_HOUR;

    if (isRestrictedTime && !PRIVILEGED_ROLES.includes(roleName)) {
      await this.logLoginAttempt(user.id, 'failed');
      throw new Error('System access is restricted during off-hours (10:00 PM - 6:00 AM)');
    }

    // Generate tokens
    return this.generateAuthResponse(user.id, storeId);
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const { verifyRefreshToken } = await import('../../utils/jwt.js');
      const payload = verifyRefreshToken(refreshToken);

      // Verify session exists
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const session = await db.query.sessions.findFirst({
        where: eq(sessions.tokenHash, tokenHash),
      });

      if (!session) {
        throw new Error('Invalid refresh token');
      }

      if (session.expiresAt < new Date()) {
        await db.delete(sessions).where(eq(sessions.id, session.id));
        throw new Error('Refresh token expired');
      }

      // Get user role and permissions
      const userRole = await this.getUserRole(payload.userId, payload.storeId);
      const userPermissions = await this.getUserPermissions(payload.userId, payload.storeId);

      // Generate new access token
      const accessToken = generateAccessToken({
        userId: payload.userId,
        storeId: payload.storeId,
        email: payload.email,
        role: userRole,
        permissions: userPermissions,
      });

      return { accessToken };
    } catch (error) {
      logger.error('Refresh token error:', error);
      throw new Error('Invalid or expired refresh token');
    }
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
      logger.info('User logged out');
    } catch (error) {
      logger.error('Logout error:', error);
      throw new Error('Failed to logout');
    }
  }

  async getUserRole(userId: string, storeId: string): Promise<string> {
    // Get user's primary role for the store
    const userRole = await db.query.userRoles.findFirst({
      where: and(eq(userRoles.userId, userId), eq(userRoles.storeId, storeId)),
      with: {
        role: true,
      },
    });

    return userRole?.role?.name || 'employee';
  }

  async getUserPermissions(userId: string, storeId: string): Promise<string[]> {
    // Check cache first
    const cacheKey = `permissions:${userId}:${storeId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.warn('Redis cache miss for permissions', { userId, storeId });
    }

    // Get user's roles for the store
    const userRolesList = await db.query.userRoles.findMany({
      where: and(eq(userRoles.userId, userId), eq(userRoles.storeId, storeId)),
      with: {
        role: {
          with: {
            rolePermissions: {
              with: {
                permission: true,
              },
            },
          },
        },
      },
    });

    // Extract permissions
    const permissionSet = new Set<string>();
    for (const userRole of userRolesList) {
      for (const rp of userRole.role.rolePermissions) {
        permissionSet.add(`${rp.permission.resource}:${rp.permission.action}`);
      }
    }

    const permissionsList = Array.from(permissionSet);

    // Cache permissions for 15 minutes
    try {
      await redis.setEx(cacheKey, 900, JSON.stringify(permissionsList));
    } catch (error) {
      logger.warn('Failed to cache permissions', { userId, storeId });
    }

    return permissionsList;
  }

  async getRoles(): Promise<{ id: string; name: string; description: string | null }[]> {
    const allRoles = await db.select().from(roles);
    return allRoles.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
    }));
  }

  async getUsers(): Promise<{ id: string; fullName: string; email: string }[]> {
    const allUsers = await db.select().from(users);
    return allUsers.map(u => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
    }));
  }

  async getUsersWithRoles(storeId: string) {
    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        phone: users.phone,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(isNull(users.deletedAt))
      .orderBy(users.fullName);

    const result = [];
    for (const user of allUsers) {
      const userRolesList = await db.query.userRoles.findMany({
        where: and(eq(userRoles.userId, user.id), eq(userRoles.storeId, storeId)),
        with: { role: true },
      });

      result.push({
        ...user,
        roles: userRolesList.map(ur => ({
          id: ur.role.id,
          name: ur.role.name,
        })),
      });
    }

    return result;
  }

  async createUser(input: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    roleId: string;
    storeId: string;
  }) {
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, input.email),
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const role = await db.query.roles.findFirst({
      where: eq(roles.id, input.roleId),
    });
    if (!role) {
      throw new Error('Role not found');
    }

    const passwordHash = await hashPassword(input.password);

    const [user] = await db
      .insert(users)
      .values({
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        phone: input.phone || null,
        isActive: true,
      })
      .returning();

    await db.insert(userRoles).values({
      userId: user.id,
      roleId: input.roleId,
      storeId: input.storeId,
    });

    logger.info(`User created: ${user.email}`, { userId: user.id });

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      isActive: user.isActive,
      roles: [{ id: role.id, name: role.name }],
    };
  }

  async resetPassword(userId: string, newPassword: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new Error('User not found');
    }

    const passwordHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));

    logger.info(`Password reset for user: ${user.email}`, { userId });
    return { success: true };
  }

  async updateUserRole(userId: string, roleId: string, storeId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) {
      throw new Error('User not found');
    }

    // Prevent changing roles of protected accounts (superadmin, owner)
    const isProtected = await this.isProtectedUser(userId);
    if (isProtected) {
      throw new Error('Cannot change the role of a SuperAdmin or Owner account. These accounts are protected.');
    }

    const role = await db.query.roles.findFirst({
      where: eq(roles.id, roleId),
    });
    if (!role) {
      throw new Error('Role not found');
    }

    // Remove existing roles for this store
    await db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.storeId, storeId)));

    // Assign new role
    await db.insert(userRoles).values({
      userId,
      roleId,
      storeId,
    });

    logger.info(`Role updated for user: ${user.email} to ${role.name}`, { userId, roleId });

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: [{ id: role.id, name: role.name }],
    };
  }

  async toggleUserActive(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Prevent deactivating protected accounts (superadmin, owner)
    if (user.isActive) {
      const isProtected = await this.isProtectedUser(userId);
      if (isProtected) {
        throw new Error('Cannot deactivate a SuperAdmin or Owner account. These accounts are protected.');
      }
    }

    const [updated] = await db
      .update(users)
      .set({ isActive: !user.isActive, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    logger.info(`User ${updated.isActive ? 'activated' : 'deactivated'}: ${user.email}`, { userId });

    return {
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      isActive: updated.isActive,
    };
  }

  /**
   * Check if a user has a protected role (superadmin or owner) in any store.
   * Protected users cannot be deactivated or have their roles changed.
   */
  private async isProtectedUser(userId: string): Promise<boolean> {
    const protectedRoleNames = ['super_admin', 'superadmin', 'owner'];

    const userRolesList = await db.query.userRoles.findMany({
      where: eq(userRoles.userId, userId),
      with: { role: true },
    });

    return userRolesList.some(ur => protectedRoleNames.includes(ur.role.name));
  }

  private async generateAuthResponse(userId: string, storeId: string): Promise<AuthResponse> {
    // Get user details
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get store details
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, storeId),
    });

    if (!store) {
      throw new Error('Store not found');
    }

    // Get user role and permissions
    const userRole = await this.getUserRole(userId, storeId);
    const userPermissions = await this.getUserPermissions(userId, storeId);

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      storeId: store.id,
      email: user.email,
      role: userRole,
      permissions: userPermissions,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      storeId: store.id,
      email: user.email,
      role: userRole,
    });

    // Clean up expired sessions for this user to prevent accumulation
    const now = new Date();
    await db.delete(sessions).where(
      and(
        eq(sessions.userId, user.id),
        lte(sessions.expiresAt, now),
      )
    );

    // Store session
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await db.insert(sessions).values({
      userId: user.id,
      storeId: store.id,
      tokenHash,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: userRole,
        permissions: userPermissions,
      },
      store: {
        id: store.id,
        name: store.name,
        code: store.code,
      },
    };
  }

  async logLoginAttempt(userId: string, status: 'success' | 'failed') {
    try {
      await db.insert(loginHistory).values({
        userId,
        status,
        // IP and UserAgent should ideally be passed here, but for now we settle for status
        // We will need to update the method signature to accept request details if we want full fidelity
      });
    } catch (error) {
      logger.error('Failed to log login attempt:', error);
      // Don't fail the login process just because logging failed
    }
  }

  async getLoginHistory(userId: string) {
    return db.query.loginHistory.findMany({
      where: eq(loginHistory.userId, userId),
      orderBy: (history, { desc }) => [desc(history.createdAt)],
      limit: 20,
    });
  }

  async getActiveSessions(userId: string) {
    return db.query.sessions.findMany({
      where: eq(sessions.userId, userId),
      orderBy: (session, { desc }) => [desc(session.createdAt)],
      with: {
        store: true,
      },
    });
  }

  async revokeSession(sessionId: string, userId: string) {
    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, sessionId), eq(sessions.userId, userId)),
    });

    if (!session) {
      throw new Error('Session not found or does not belong to user');
    }

    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return { success: true };
  }
}

export const authService = new AuthService();
