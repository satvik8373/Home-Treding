import { Request, Response, NextFunction } from 'express';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';

// Initialize Firebase Admin
try {
  if (getApps().length === 0) {
    initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'mine-treding',
    });
  }
} catch (error: any) {
  logger.warn('Firebase Admin initialization note:', error.message);
}

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
  };
  userId?: string;
}

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.split('Bearer ')[1];

    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: (decodedToken as any).name,
      };
      req.userId = decodedToken.uid;

      next();
    } catch (error) {
      logger.error('Token verification failed:', error);
      throw new AppError('Invalid or expired token', 401);
    }
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      
      try {
        const decodedToken = await getAuth().verifyIdToken(token);
        req.user = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          name: (decodedToken as any).name,
        };
        req.userId = decodedToken.uid;
      } catch (error) {
        logger.warn('Optional auth token invalid:', error);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
