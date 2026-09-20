import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { userStore } from '../database/userStore';
import { signJwt } from '../security/jwt';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/**
 * Register a new user
 */
export const register = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { uid, name, email, password, phone } = req.body;

  if (!email) {
    throw new AppError('Email is required', 400);
  }

  const existing = userStore.findByEmail(email);
  if (existing) {
    throw new AppError('An account with this email already exists', 409);
  }

  const user = userStore.createUser({
    uid,
    email,
    name: name || email.split('@')[0],
    password,
    phone
  });

  const token = signJwt({
    uid: user.uid,
    email: user.email,
    name: user.name
  });

  logger.info(`User registered successfully: ${user.email} (${user.uid})`);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    token,
    user: userStore.sanitize(user)
  });
});

/**
 * Login existing user
 */
export const login = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, password, uid } = req.body;

  let user = null;

  if (email && password) {
    user = userStore.findByEmail(email);
    if (!user || (user.passwordHash && !userStore.verifyPassword(password, user.passwordHash))) {
      throw new AppError('Invalid email or password', 401);
    }
  } else if (uid) {
    user = userStore.findByUid(uid);
    if (!user && email) {
      user = userStore.createUser({ uid, email, name: req.body.name });
    }
  } else if (email) {
    user = userStore.findByEmail(email);
  }

  if (!user) {
    throw new AppError('User not found. Please register first.', 404);
  }

  if (!user.isActive) {
    throw new AppError('Account is deactivated. Please contact support.', 403);
  }

  const token = signJwt({
    uid: user.uid,
    email: user.email,
    name: user.name
  });

  userStore.updateUser(user.uid, { updatedAt: new Date().toISOString() });

  logger.info(`User logged in: ${user.email} (${user.uid})`);

  res.json({
    success: true,
    message: 'Login successful',
    token,
    user: userStore.sanitize(user)
  });
});

/**
 * Sync / exchange session (for Google auth or Firebase auth bridge)
 */
export const syncSession = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { uid, email, name, phone } = req.body;

  if (!uid && !req.userId) {
    throw new AppError('User ID is required to sync session', 400);
  }

  const effectiveUid = uid || req.userId!;
  const effectiveEmail = email || req.user?.email || `${effectiveUid}@user.local`;
  const effectiveName = name || req.user?.name || effectiveEmail.split('@')[0];

  let user = userStore.findByUid(effectiveUid);
  if (!user) {
    user = userStore.findByEmail(effectiveEmail);
    if (user) {
      user = userStore.updateUser(user.uid, { uid: effectiveUid, name: effectiveName });
    } else {
      user = userStore.createUser({
        uid: effectiveUid,
        email: effectiveEmail,
        name: effectiveName,
        phone
      });
    }
  }

  if (!user) {
    throw new AppError('Failed to synchronize user session', 500);
  }

  const token = signJwt({
    uid: user.uid,
    email: user.email,
    name: user.name
  });

  res.json({
    success: true,
    message: 'Session synchronized',
    token,
    user: userStore.sanitize(user)
  });
});

/**
 * Get current user profile (Strictly authenticated)
 */
export const getProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new AppError('Unauthorized', 401);
  }

  let user = userStore.findByUid(req.userId);
  if (!user) {
    // If authenticated via valid token but not yet in store, auto-provision
    user = userStore.createUser({
      uid: req.userId,
      email: req.user?.email || `${req.userId}@user.local`,
      name: req.user?.name || 'Trader'
    });
  }

  res.json({
    success: true,
    user: userStore.sanitize(user)
  });
});

/**
 * Update current user profile
 */
export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new AppError('Unauthorized', 401);
  }

  const { name, phone } = req.body;
  const updated = userStore.updateUser(req.userId, {
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {})
  });

  if (!updated) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: userStore.sanitize(updated)
  });
});

/**
 * Forgot password
 */
export const forgotPassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email } = req.body;
  if (!email) {
    throw new AppError('Email is required', 400);
  }

  res.json({
    success: true,
    message: 'If an account exists with this email, password reset instructions have been dispatched.'
  });
});

/**
 * Reset password
 */
export const resetPassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    throw new AppError('Email and new password are required', 400);
  }

  const user = userStore.findByEmail(email);
  if (user) {
    userStore.updateUser(user.uid, {
      passwordHash: userStore.hashPassword(newPassword)
    });
  }

  res.json({
    success: true,
    message: 'Password reset completed successfully. You can now login with your new password.'
  });
});
