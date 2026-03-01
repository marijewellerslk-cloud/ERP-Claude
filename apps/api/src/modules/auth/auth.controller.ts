import { Request, Response } from 'express';
import { authService } from './auth.service.js';
import { registerSchema, loginSchema, refreshTokenSchema } from './auth.validation.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { logger } from '../../utils/logger.js';

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const validatedData = registerSchema.parse(req.body);

      const result = await authService.register(validatedData);

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(201).json({
        success: true,
        data: {
          accessToken: result.accessToken,
          user: result.user,
          store: result.store,
        },
      });
    } catch (error: any) {
      logger.error('Registration error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: error.errors,
          },
        });
      }

      res.status(400).json({
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: error.message || 'Failed to register user',
        },
      });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const validatedData = loginSchema.parse(req.body);

      const result = await authService.login(validatedData);

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        success: true,
        data: {
          accessToken: result.accessToken,
          user: result.user,
          store: result.store,
        },
      });
    } catch (error: any) {
      logger.error('Login error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: error.errors,
          },
        });
      }

      res.status(401).json({
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message: error.message || 'Invalid credentials',
        },
      });
    }
  }

  async refreshToken(req: Request, res: Response) {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'MISSING_REFRESH_TOKEN',
            message: 'Refresh token not provided',
          },
        });
      }

      const result = await authService.refreshAccessToken(refreshToken);

      res.json({
        success: true,
        data: {
          accessToken: result.accessToken,
        },
      });
    } catch (error: any) {
      logger.error('Refresh token error:', error);

      res.status(401).json({
        success: false,
        error: {
          code: 'REFRESH_FAILED',
          message: error.message || 'Failed to refresh token',
        },
      });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (refreshToken) {
        await authService.logout(refreshToken);
      }

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      res.json({
        success: true,
        data: {
          message: 'Logged out successfully',
        },
      });
    } catch (error: any) {
      logger.error('Logout error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'LOGOUT_FAILED',
          message: 'Failed to logout',
        },
      });
    }
  }

  async me(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      // Fetch full user details
      const user = await authService.getUsers().then(users => users.find(u => u.id === req.user!.userId));

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
      }

      const [role, permissions] = await Promise.all([
        authService.getUserRole(req.user.userId, req.user.storeId),
        authService.getUserPermissions(req.user.userId, req.user.storeId),
      ]);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: role,
            permissions: permissions,
          },
        },
      });
    } catch (error: any) {
      logger.error('Get user error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_USER_FAILED',
          message: 'Failed to fetch user details',
        },
      });
    }
  }

  async getRoles(req: Request, res: Response) {
    try {
      const roles = await authService.getRoles();
      res.json({
        success: true,
        data: roles,
      });
    } catch (error: any) {
      logger.error('Get roles error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ROLES_FAILED',
          message: 'Failed to fetch roles',
        },
      });
    }
  }

  async getUsers(req: Request, res: Response) {
    try {
      const users = await authService.getUsers();
      res.json({
        success: true,
        data: users,
      });
    } catch (error: any) {
      logger.error('Get users error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_USERS_FAILED',
          message: 'Failed to fetch users',
        },
      });
    }
  }
  async getUsersWithRoles(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }
      const users = await authService.getUsersWithRoles(req.user.storeId);
      res.json({ success: true, data: users });
    } catch (error: any) {
      logger.error('Get users with roles error:', error);
      res.status(500).json({ success: false, error: { code: 'FETCH_USERS_FAILED', message: error.message } });
    }
  }

  async createUser(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }

      const { email, password, fullName, phone, roleId } = req.body;
      if (!email || !password || !fullName || !roleId) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Email, password, full name, and role are required' } });
      }

      const user = await authService.createUser({
        email,
        password,
        fullName,
        phone,
        roleId,
        storeId: req.user.storeId,
      });

      res.status(201).json({ success: true, data: user });
    } catch (error: any) {
      logger.error('Create user error:', error);
      const status = error.message.includes('already exists') ? 409 : 500;
      res.status(status).json({ success: false, error: { code: 'CREATE_USER_FAILED', message: error.message } });
    }
  }

  async resetPassword(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }

      const { userId } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' } });
      }

      const result = await authService.resetPassword(userId, newPassword);
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Reset password error:', error);
      res.status(500).json({ success: false, error: { code: 'RESET_PASSWORD_FAILED', message: error.message } });
    }
  }

  async updateUserRole(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }

      const { userId } = req.params;
      const { roleId } = req.body;

      if (!roleId) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Role ID is required' } });
      }

      const result = await authService.updateUserRole(userId, roleId, req.user.storeId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Update user role error:', error);
      res.status(500).json({ success: false, error: { code: 'UPDATE_ROLE_FAILED', message: error.message } });
    }
  }

  async toggleUserActive(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }

      const { userId } = req.params;
      const result = await authService.toggleUserActive(userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Toggle user active error:', error);
      res.status(500).json({ success: false, error: { code: 'TOGGLE_ACTIVE_FAILED', message: error.message } });
    }
  }

  async getLoginHistory(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }

      const history = await authService.getLoginHistory(req.user.userId);
      res.json({ success: true, data: history });
    } catch (error: any) {
      logger.error('Get login history error:', error);
      res.status(500).json({ success: false, error: { code: 'FETCH_HISTORY_FAILED', message: error.message } });
    }
  }

  async getActiveSessions(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }

      const sessions = await authService.getActiveSessions(req.user.userId);
      res.json({ success: true, data: sessions });
    } catch (error: any) {
      logger.error('Get active sessions error:', error);
      res.status(500).json({ success: false, error: { code: 'FETCH_SESSIONS_FAILED', message: error.message } });
    }
  }

  async revokeSession(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }

      const { sessionId } = req.params;
      await authService.revokeSession(sessionId, req.user.userId);
      res.json({ success: true, data: { message: 'Session revoked successfully' } });
    } catch (error: any) {
      logger.error('Revoke session error:', error);
      res.status(500).json({ success: false, error: { code: 'REVOKE_SESSION_FAILED', message: error.message } });
    }
  }
}

export const authController = new AuthController();
