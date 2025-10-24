import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const register = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { uid, name, email, phone } = req.body;

  if (!uid || !name || !email) {
    throw new AppError('Missing required fields', 400);
  }

  try {
    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 OR firebase_uid = $2',
      [email, uid]
    );

    if (existingUser.rows.length > 0) {
      throw new AppError('User already exists', 409);
    }

    // Create user in database
    const result = await query(
      `INSERT INTO users (firebase_uid, email, phone, name, is_verified)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, firebase_uid, email, name, created_at`,
      [uid, email, phone || null, name, true]
    );

    const user = result.rows[0];

    logger.info('User registered:', { userId: user.id, email });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        uid: user.firebase_uid,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    logger.error('Registration error:', error);
    throw error;
  }
});

export const login = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { uid } = req.body;

  if (!uid) {
    throw new AppError('User ID required', 400);
  }

  try {
    // Get or create user
    let result = await query(
      'SELECT id, firebase_uid, email, name, is_active FROM users WHERE firebase_uid = $1',
      [uid]
    );

    if (result.rows.length === 0) {
      // User doesn't exist in our DB, create from Firebase data
      if (req.user) {
        result = await query(
          `INSERT INTO users (firebase_uid, email, name, is_verified)
           VALUES ($1, $2, $3, $4)
           RETURNING id, firebase_uid, email, name, is_active`,
          [uid, req.user.email, req.user.name, true]
        );
      } else {
        throw new AppError('User not found', 404);
      }
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw new AppError('Account is deactivated', 403);
    }

    // Update last login
    await query(
      'UPDATE users SET updated_at = NOW() WHERE id = $1',
      [user.id]
    );

    logger.info('User logged in:', { userId: user.id, email: user.email });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        uid: user.firebase_uid,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    throw error;
  }
});

export const getProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new AppError('Unauthorized', 401);
  }

  try {
    const result = await query(
      `SELECT id, firebase_uid, email, phone, name, subscription_plan, 
              subscription_expires_at, created_at
       FROM users WHERE firebase_uid = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = result.rows[0];

    res.json({
      user: {
        id: user.id,
        uid: user.firebase_uid,
        email: user.email,
        phone: user.phone,
        name: user.name,
        subscriptionPlan: user.subscription_plan,
        subscriptionExpiresAt: user.subscription_expires_at,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    throw error;
  }
});

export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new AppError('Unauthorized', 401);
  }

  const { name, phone } = req.body;

  try {
    const result = await query(
      `UPDATE users 
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           updated_at = NOW()
       WHERE firebase_uid = $3
       RETURNING id, firebase_uid, email, phone, name`,
      [name, phone, req.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = result.rows[0];

    logger.info('Profile updated:', { userId: user.id });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        uid: user.firebase_uid,
        email: user.email,
        phone: user.phone,
        name: user.name,
      },
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    throw error;
  }
});

export const forgotPassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError('Email is required', 400);
  }

  try {
    // Check if user exists (but don't reveal if they do or don't)
    await query(
      'SELECT id, email FROM users WHERE email = $1',
      [email]
    );

    // Always return success to prevent email enumeration
    // Firebase will handle sending the reset email
    logger.info('Password reset requested:', { email });

    res.json({
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    throw error;
  }
});

export const resetPassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Firebase handles password reset via email link
  // This endpoint is for confirmation after reset
  const { uid } = req.body;

  if (!uid) {
    throw new AppError('User ID required', 400);
  }

  try {
    // Verify user exists
    const result = await query(
      'SELECT id, email FROM users WHERE firebase_uid = $1',
      [uid]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    logger.info('Password reset confirmed:', { uid });

    res.json({
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    throw error;
  }
});
