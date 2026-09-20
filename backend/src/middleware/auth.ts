import { Request, Response, NextFunction } from 'express';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';
import { verifyJwt } from '../security/jwt';

// Initialize Firebase Admin gracefully
try {
  if (getApps().length === 0) {
    initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'mavrix-trading',
    });
  }
} catch (error: any) {
  logger.warn('Firebase Admin initialization notice:', error.message);
}

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
  };
  userId?: string;
}

/**
 * Verify token from either:
 * 1. App-issued HS256 JWT
 * 2. Firebase Auth ID Token
 */
export const verifyAuthToken = async (token: string): Promise<{ uid: string; email?: string; name?: string } | null> => {
  if (!token || typeof token !== 'string') return null;

  // 1. Try App-issued HS256 JWT
  const jwtDecoded = verifyJwt(token);
  if (jwtDecoded && jwtDecoded.uid) {
    return {
      uid: jwtDecoded.uid,
      email: jwtDecoded.email,
      name: jwtDecoded.name
    };
  }

  // 2. Try Firebase ID Token
  try {
    const firebaseDecoded = await getAuth().verifyIdToken(token);
    if (firebaseDecoded && firebaseDecoded.uid) {
      return {
        uid: firebaseDecoded.uid,
        email: firebaseDecoded.email,
        name: (firebaseDecoded as any).name || (firebaseDecoded as any).displayName
      };
    }
  } catch {
    // Firebase verification failed or offline
  }

  return null;
};

/**
 * Mandatory Authentication Middleware
 * Strictly requires a valid bearer token and sets req.userId and req.user
 */
export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Please sign in.', 401);
    }

    const token = authHeader.split('Bearer ')[1]?.trim();
    if (!token) {
      throw new AppError('Authentication token missing.', 401);
    }

    const verified = await verifyAuthToken(token);
    if (!verified || !verified.uid) {
      throw new AppError('Invalid or expired authentication session. Please sign in again.', 401);
    }

    req.user = verified;
    req.userId = verified.uid;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional Authentication Middleware
 * Extracts user if token is present and valid, but does not block unauthenticated requests
 */
export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1]?.trim();
      if (token) {
        const verified = await verifyAuthToken(token);
        if (verified) {
          req.user = verified;
          req.userId = verified.uid;
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
