import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

// General API rate limiter
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests from this IP, please try again after 15 minutes',
        },
    },
    skip: (req) => {
        // Enforce in test environment for verification
        if (env.NODE_ENV === 'test') return false;
        // Skip rate limiting in development or for specific trusted IPs if needed
        return env.NODE_ENV === 'development' || req.ip === '127.0.0.1';
    },
});

// Strict rate limiter for auth routes (login, register, etc.)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 login attempts per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'AUTH_RATE_LIMIT_EXCEEDED',
            message: 'Too many login attempts from this IP, please try again after 15 minutes',
        },
    },
    skip: (req) => {
        if (env.NODE_ENV === 'test') return false;
        return env.NODE_ENV === 'development' || req.ip === '127.0.0.1';
    },
});
