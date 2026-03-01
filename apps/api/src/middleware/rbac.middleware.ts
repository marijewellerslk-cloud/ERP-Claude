import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware.js';
import { logger } from '../utils/logger.js';

// Constants defined locally to avoid import issues
const WILDCARD_PERMISSION = '*:*';

function hasPermission(userPermissions: string[], requiredPermission: string): boolean {
  if (userPermissions.includes(WILDCARD_PERMISSION)) {
    return true;
  }
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }
  const [resource, action] = requiredPermission.split(':');
  if (userPermissions.includes(`${resource}:*`)) {
    return true;
  }
  return false;
}

export function requirePermission(resource: string, action: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const requiredPermission = `${resource}:${action}`;
    const userPermissions = req.user.permissions;

    if (!hasPermission(userPermissions, requiredPermission)) {
      logger.warn('Permission denied', {
        userId: req.user.userId,
        requiredPermission,
        userPermissions,
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to access this resource',
          details: {
            required: requiredPermission,
          },
        },
      });
    }

    next();
  };
}

export function requireAnyPermission(requiredPermissions: Array<{ resource: string; action: string }>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const userPermissions = req.user.permissions;

    // Check if user has wildcard permission
    if (userPermissions.includes(WILDCARD_PERMISSION)) {
      return next();
    }

    // Check if user has any of the required permissions
    const hasAnyPermission = requiredPermissions.some(({ resource, action }) => {
      const permission = `${resource}:${action}`;
      return hasPermission(userPermissions, permission);
    });

    if (!hasAnyPermission) {
      logger.warn('Permission denied - none of required permissions found', {
        userId: req.user.userId,
        requiredPermissions,
        userPermissions,
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to access this resource',
        },
      });
    }

    next();
  };
}

export function requireAllPermissions(requiredPermissions: Array<{ resource: string; action: string }>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const userPermissions = req.user.permissions;

    // Check if user has wildcard permission
    if (userPermissions.includes(WILDCARD_PERMISSION)) {
      return next();
    }

    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every(({ resource, action }) => {
      const permission = `${resource}:${action}`;
      return hasPermission(userPermissions, permission);
    });

    if (!hasAllPermissions) {
      logger.warn('Permission denied - missing required permissions', {
        userId: req.user.userId,
        requiredPermissions,
        userPermissions,
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to access this resource',
        },
      });
    }

    next();
  };
}
