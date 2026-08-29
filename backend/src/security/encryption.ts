import crypto from 'crypto';

// Use environment encryption secret or a secure fallback for development
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY 
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex') 
  : crypto.scryptSync(process.env.JWT_SECRET || 'mavrix-trading-dhan-secret-key-2026', 'salt', 32);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypt sensitive strings like API keys and access tokens
 */
export function encryptToken(text: string): string {
  if (!text) return '';
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt encrypted token string
 */
export function decryptToken(encryptedPayload: string): string {
  if (!encryptedPayload) return '';
  
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    // If not in encrypted format (e.g. legacy plain tokens during migration), return as-is
    return encryptedPayload;
  }
  
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Mask sensitive string for frontend presentation (e.g. 1108893841 -> 1108***841)
 */
export function maskIdentifier(identifier: string): string {
  if (!identifier) return '';
  if (identifier.length <= 4) return '****';
  const prefix = identifier.slice(0, 4);
  const suffix = identifier.slice(-3);
  return `${prefix}***${suffix}`;
}
