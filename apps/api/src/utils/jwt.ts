import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface JWTPayload {
  userId: string;
  storeId: string;
  email: string;
  role: string;
  permissions: string[];
}

export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
    issuer: 'mari-erp-api',
    audience: 'mari-erp-web',
  });
}

export function generateRefreshToken(payload: Omit<JWTPayload, 'permissions'>): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
    issuer: 'mari-erp-api',
    audience: 'mari-erp-web',
  });
}

export function verifyAccessToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'mari-erp-api',
      audience: 'mari-erp-web',
    }) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

export function verifyRefreshToken(token: string): Omit<JWTPayload, 'permissions'> {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'mari-erp-api',
      audience: 'mari-erp-web',
    }) as Omit<JWTPayload, 'permissions'>;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
}
