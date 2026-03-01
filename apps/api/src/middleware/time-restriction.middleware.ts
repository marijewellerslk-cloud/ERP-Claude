import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware.js';
import { logger } from '../utils/logger.js';

// Configuration for restricted hours (24-hour format)
// Restricted window: 10:00 PM (22:00) to 6:00 AM (06:00)
const RESTRICTED_START_HOUR = 22;
const RESTRICTED_END_HOUR = 6;

// Privileged roles that are exempt from time restrictions
const PRIVILEGED_ROLES = ['super_admin', 'superadmin', 'owner', 'store_manager', 'general_manager'];

export const timeRestrictionMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    // If user is not authenticated, let auth middleware handle it (or it's a public route)
    if (!req.user) {
        return next();
    }

    const now = new Date();
    const currentHour = now.getHours();

    // Check if current time is within restricted window
    // Case 1: Start hour < End hour (e.g., 22:00 to 23:00) - simple range check
    // Case 2: Start hour > End hour (e.g., 22:00 to 06:00) - crossing midnight
    const isRestrictedTime =
        RESTRICTED_START_HOUR < RESTRICTED_END_HOUR
            ? currentHour >= RESTRICTED_START_HOUR && currentHour < RESTRICTED_END_HOUR
            : currentHour >= RESTRICTED_START_HOUR || currentHour < RESTRICTED_END_HOUR;

    if (isRestrictedTime) {
        // Check if user has a privileged role
        // We need to look at the user's role from the token payload (req.user.role)
        const userRole = req.user.role;

        if (!userRole || !PRIVILEGED_ROLES.includes(userRole)) {
            logger.warn(`Access denied due to time restrictions. User: ${req.user.userId}, Role: ${userRole}, Time: ${now.toISOString()}`);
            return res.status(403).json({
                success: false,
                error: {
                    code: 'ACCESS_RESTRICTED_TIME',
                    message: 'System access is restricted during off-hours (10:00 PM - 6:00 AM). Please contact your administrator.',
                },
            });
        }
    }

    next();
};
