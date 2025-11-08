/**
 * Token Manager Service
 * Handles automatic token refresh and token storage
 */

import axios from 'axios';
import { logger } from '../utils/logger';

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  userId: string;
  brokerId: string;
}

// In-memory token storage (in production, use Redis or Database)
const tokenStore = new Map<string, TokenData>();

class TokenManager {
  /**
   * Store tokens for a user
   */
  storeTokens(
    userId: string,
    brokerId: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number
  ): void {
    const expiresAt = Date.now() + expiresIn * 1000;
    
    const key = `${userId}:${brokerId}`;
    tokenStore.set(key, {
      accessToken,
      refreshToken,
      expiresAt,
      userId,
      brokerId
    });

    logger.info(`Tokens stored for user ${userId}, broker ${brokerId}`);
  }

  /**
   * Get valid access token (auto-refresh if expired)
   */
  async getAccessToken(userId: string, brokerId: string): Promise<string | null> {
    const key = `${userId}:${brokerId}`;
    const tokenData = tokenStore.get(key);

    if (!tokenData) {
      logger.warn(`No tokens found for user ${userId}, broker ${brokerId}`);
      return null;
    }

    // Check if token is expired or expiring soon (within 5 minutes)
    const fiveMinutes = 5 * 60 * 1000;
    const isExpiringSoon = tokenData.expiresAt - Date.now() < fiveMinutes;

    if (isExpiringSoon) {
      logger.info(`Token expiring soon for user ${userId}, refreshing...`);
      
      try {
        const newTokens = await this.refreshToken(tokenData.refreshToken);
        
        // Update stored tokens
        this.storeTokens(
          userId,
          brokerId,
          newTokens.accessToken,
          newTokens.refreshToken,
          newTokens.expiresIn
        );

        return newTokens.accessToken;
      } catch (error) {
        logger.error('Failed to refresh token:', error);
        // Return expired token, let the API call fail and handle re-auth
        return tokenData.accessToken;
      }
    }

    return tokenData.accessToken;
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const response = await axios.post(
      `${process.env.API_BASE_URL}/api/oauth/refresh`,
      { refreshToken }
    );

    if (!response.data.success) {
      throw new Error('Token refresh failed');
    }

    return {
      accessToken: response.data.data.accessToken,
      refreshToken: response.data.data.refreshToken,
      expiresIn: response.data.data.expiresIn
    };
  }

  /**
   * Remove tokens for a user
   */
  removeTokens(userId: string, brokerId: string): void {
    const key = `${userId}:${brokerId}`;
    tokenStore.delete(key);
    logger.info(`Tokens removed for user ${userId}, broker ${brokerId}`);
  }

  /**
   * Check if user has valid tokens
   */
  hasValidTokens(userId: string, brokerId: string): boolean {
    const key = `${userId}:${brokerId}`;
    return tokenStore.has(key);
  }

  /**
   * Get token expiry time
   */
  getTokenExpiry(userId: string, brokerId: string): Date | null {
    const key = `${userId}:${brokerId}`;
    const tokenData = tokenStore.get(key);
    
    if (!tokenData) {
      return null;
    }

    return new Date(tokenData.expiresAt);
  }
}

export default new TokenManager();
