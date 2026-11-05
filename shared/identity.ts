import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const tenantId = (uid: string) => createHash('sha256').update(`firebase:${uid}`).digest('hex')
export const validTenant = (id: unknown): id is string => id === 'owner' || typeof id === 'string' && /^[a-f0-9]{64}$/.test(id)
const signature = (payload: string, secret: string, purpose: string) => createHmac('sha256', secret).update(`${purpose}:${payload}`).digest('base64url')
export function sealIdentity(value: object, secret: string, purpose: string) {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${payload}.${signature(payload, secret, purpose)}`
}
export function openIdentity(token: string, secret: string, purpose: string, now = Date.now()): { tenant: string; expires: number } | null {
  try {
    if (token.length > 2048) return null
    const [payload, signed, extra] = token.split('.')
    if (extra || !payload || !signed) return null
    const actual = Buffer.from(signed), expected = Buffer.from(signature(payload, secret, purpose))
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return validTenant(value.tenant) && Number.isSafeInteger(value.expires) && value.expires > now ? value : null
  } catch { return null }
}
