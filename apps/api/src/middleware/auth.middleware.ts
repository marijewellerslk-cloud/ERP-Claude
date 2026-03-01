import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import { timeRestrictionMiddleware } from './time-restriction.middleware.js';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    storeId: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No authorization header provided',
        },
      });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid authorization header format. Use: Bearer <token>',
        },
      });
    }

    const token = parts[1];

    try {
      const payload = verifyAccessToken(token);

      req.user = {
        userId: payload.userId,
        storeId: payload.storeId,
        email: payload.email,
        role: payload.role,
        permissions: payload.permissions,
      };

      timeRestrictionMiddleware(req, res, next);
    } catch (error: any) {
      logger.warn('Token verification failed', { error: error.message });

      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: error.message || 'Invalid or expired token',
        },
      });
    }
  } catch (error) {
    logger.error('Authentication middleware error', { error });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during authentication',
      },
    });
  }
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  try {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const token = parts[1];
      const payload = verifyAccessToken(token);

      req.user = {
        userId: payload.userId,
        storeId: payload.storeId,
        email: payload.email,
        role: payload.role,
        permissions: payload.permissions,
      };
    }
  } catch (error) {
    // Ignore errors for optional auth
    logger.debug('Optional auth token invalid', { error });
  }

  next();
}
