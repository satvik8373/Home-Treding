import fs from 'fs';
import path from 'path';
import { decryptToken } from '../security/encryption';

export interface StoredDhanAuth {
  clientId: string;
  accessToken: string;
}

export function brokerStorageFile(): string {
  const candidates = [
    path.join(__dirname, '../../data/broker-connections.json'),
    path.join(process.cwd(), 'backend', 'data', 'broker-connections.json'),
    path.join(process.cwd(), 'data', 'broker-connections.json')
  ];
  return candidates.find(candidate => fs.existsSync(candidate)) || candidates[0];
}

// Exact owner match. A record created under the legacy default user is not
// silently assigned to another signed-in account.
export function storedDhanAuth(userId: string): StoredDhanAuth | null {
  if (!userId) return null;
  try {
    const file = brokerStorageFile();
    if (!fs.existsSync(file)) return null;
    const rows: Array<{ userId: string; broker: string; status: string; clientId: string; encryptedAccessToken: string }> =
      JSON.parse(fs.readFileSync(file, 'utf8'));
    const connection = rows.find(row => row.userId === userId && row.broker === 'dhan' &&
      row.status === 'Connected' && row.clientId && row.encryptedAccessToken);
    if (!connection) return null;
    const accessToken = decryptToken(connection.encryptedAccessToken);
    return accessToken ? { clientId: connection.clientId, accessToken } : null;
  } catch {
    return null;
  }
}
