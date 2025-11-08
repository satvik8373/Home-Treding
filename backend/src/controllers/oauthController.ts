/**
 * OAuth Controller for Broker Authentication
 * Implements OAuth 2.0 flow with automatic token refresh
 */

import { Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// OAuth Configuration
const DHAN_OAUTH_CONFIG = {
  authUrl: 'https://api.dhan.co/oauth2/auth',
  tokenUrl: 'https://api.dhan.co/oauth2/token',
  clientId: process.env.DHAN_CLIENT_ID || '',
  clientSecret: process.env.DHAN_CLIENT_SECRET || '',
  redirectUri: process.env.DHAN_REDIRECT_URI || 'http://localhost:3000/auth/callback'
};

// Store for OAuth state (in production, use Redis)
const oauthStates = new Map<string, { userId: string; timestamp: number }>();

/**
 * Step 1: Initiate OAuth flow
 * Generates authorization URL for user to login
 */
export const initiateOAuth = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required'
    });
  }

  // Generate random state for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  
  // Store state with user ID (expires in 10 minutes)
  oauthStates.set(state, {
    userId,
    timestamp: Date.now()
  });

  // Clean up old states (older than 10 minutes)
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [key, value] of oauthStates.entries()) {
    if (value.timestamp < tenMinutesAgo) {
      oauthStates.delete(key);
    }
  }

  // Build authorization URL
  const authUrl = `${DHAN_OAUTH_CONFIG.authUrl}?` +
    `client_id=${DHAN_OAUTH_CONFIG.clientId}&` +
    `redirect_uri=${encodeURIComponent(DHAN_OAUTH_CONFIG.redirectUri)}&` +
    `response_type=code&` +
    `state=${state}&` +
    `scope=orders,holdings,positions,funds`;

  logger.info('OAuth flow initiated for user:', userId);

  res.json({
    success: true,
    authUrl,
    state
  });
});

/**
 * Step 2: Handle OAuth callback
 * Exchange authorization code for access token and refresh token
 */
export const handleOAuthCallback = asyncHandler(async (req: Request, res: Response) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).json({
      success: false,
      message: 'Authorization code and state are required'
    });
  }

  // Verify state (CSRF protection)
  const stateData = oauthStates.get(state as string);
  if (!stateData) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired state. Please try again.'
    });
  }

  // Remove used state
  oauthStates.delete(state as string);

  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post(
      DHAN_OAUTH_CONFIG.tokenUrl,
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: DHAN_OAUTH_CONFIG.redirectUri,
        client_id: DHAN_OAUTH_CONFIG.clientId,
        client_secret: DHAN_OAUTH_CONFIG.clientSecret
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const {
      access_token,
      refresh_token,
      expires_in,
      token_type
    } = tokenResponse.data;

    logger.info('OAuth tokens obtained successfully for user:', stateData.userId);

    res.json({
      success: true,
      data: {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in,
        tokenType: token_type,
        userId: stateData.userId
      }
    });
  } catch (error: any) {
    logger.error('OAuth callback error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to exchange authorization code for tokens',
      error: error.response?.data || error.message
    });
  }
});

/**
 * Step 3: Refresh access token
 * Use refresh token to get new access token when expired
 */
export const refreshAccessToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token is required'
    });
  }

  try {
    const tokenResponse = await axios.post(
      DHAN_OAUTH_CONFIG.tokenUrl,
      {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: DHAN_OAUTH_CONFIG.clientId,
        client_secret: DHAN_OAUTH_CONFIG.clientSecret
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const {
      access_token,
      refresh_token,
      expires_in,
      token_type
    } = tokenResponse.data;

    logger.info('Access token refreshed successfully');

    res.json({
      success: true,
      data: {
        accessToken: access_token,
        refreshToken: refresh_token || refreshToken, // Some APIs don't return new refresh token
        expiresIn: expires_in,
        tokenType: token_type
      }
    });
  } catch (error: any) {
    logger.error('Token refresh error:', error.message);

    // If refresh token is invalid, user needs to re-authenticate
    if (error.response?.status === 401 || error.response?.status === 400) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired. Please reconnect your broker account.',
        requiresReauth: true
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to refresh access token',
      error: error.response?.data || error.message
    });
  }
});

/**
 * Revoke tokens (logout)
 */
export const revokeTokens = asyncHandler(async (req: Request, res: Response) => {
  const { accessToken } = req.body;

  if (!accessToken) {
    return res.status(400).json({
      success: false,
      message: 'Access token is required'
    });
  }

  try {
    // Revoke token with broker
    await axios.post(
      'https://api.dhan.co/oauth2/revoke',
      {
        token: accessToken,
        client_id: DHAN_OAUTH_CONFIG.clientId,
        client_secret: DHAN_OAUTH_CONFIG.clientSecret
      }
    );

    logger.info('Tokens revoked successfully');

    res.json({
      success: true,
      message: 'Broker disconnected successfully'
    });
  } catch (error: any) {
    logger.error('Token revocation error:', error.message);

    res.json({
      success: true,
      message: 'Broker disconnected (token may already be invalid)'
    });
  }
});

export default {
  initiateOAuth,
  handleOAuthCallback,
  refreshAccessToken,
  revokeTokens
};
