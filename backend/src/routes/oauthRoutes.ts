/**
 * OAuth Routes
 */

import { Router } from 'express';
import {
  initiateOAuth,
  handleOAuthCallback,
  refreshAccessToken,
  revokeTokens
} from '../controllers/oauthController';

const router = Router();

// Initiate OAuth flow
router.post('/initiate', initiateOAuth);

// Handle OAuth callback
router.get('/callback', handleOAuthCallback);

// Refresh access token
router.post('/refresh', refreshAccessToken);

// Revoke tokens (disconnect broker)
router.post('/revoke', revokeTokens);

export default router;
