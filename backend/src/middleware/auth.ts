import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';

// Initialize Firebase Admin (you'll need to add service account)
// For now, we'll use a simple approach
let firebaseAdmin: admin.app.App;

try {
  // In production, use service account JSON
  // For development, we'll initialize without credentials
  if (!admin.apps.length) {
    firebaseAdmin = admin.initializeApp({
      projectId: 'mine-treding',
    });
  } else {
    firebaseAdmin = admin.app();
  }
} catch (error) {
  logger.error('Firebase Admin initialization error:', error);
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
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.split('Bearer ')[1];

    try {
      // Verify Firebase token
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name,
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
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          name: decodedToken.name,
        };
        req.userId = decodedToken.uid;
      } catch (error) {
        // Token invalid but continue anyway
        logger.warn('Optional auth token invalid:', error);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
