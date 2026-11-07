import { importX509, jwtVerify } from 'jose'
import type { JWTVerifyGetKey } from 'jose'

export interface VerifiedUser { uid: string; expires: number; name?: string; email?: string }
const CERTIFICATES = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
let certificates: Record<string, string> = {}, expires = 0, pending: Promise<void> | null = null
async function refresh() {
  if (Date.now() < expires) return
  pending ??= (async () => {
    const response = await fetch(CERTIFICATES, { redirect: 'error', signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error('Sign-in verification unavailable.')
    const text = await response.text()
    if (text.length > 64_000) throw new Error('Invalid signing certificates.')
    const body: unknown = JSON.parse(text)
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.values(body).some(value => typeof value !== 'string')) throw new Error('Invalid signing certificates.')
    certificates = body as Record<string, string>
    const ttl = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1] ?? 300)
    expires = Date.now() + Math.min(Math.max(ttl, 30), 21600) * 1000
  })()
  try { await pending } finally { pending = null }
}
const googleKey: JWTVerifyGetKey = async header => {
  if (header.alg !== 'RS256' || !header.kid || !/^[\w-]{1,128}$/.test(header.kid)) throw new Error('Invalid signing key.')
  await refresh()
  const certificate = certificates[header.kid]
  if (typeof certificate !== 'string') throw new Error('Unknown signing key. Try again shortly.')
  return importX509(certificate, 'RS256')
}
/** Firebase's documented verification rules, using Google's fixed certificate endpoint and jose signature validation. */
export function createGoogleVerifier(resolveKey: JWTVerifyGetKey = googleKey) {
  return async (token: string, projectId: string, allowSessionRenewal = false): Promise<VerifiedUser> => {
    if (!/^[a-z0-9-]{3,64}$/.test(projectId) || token.length > 12_000) throw new Error('Invalid sign-in.')
    const { payload: user } = await jwtVerify(token, resolveKey, { algorithms: ['RS256'], audience: projectId, issuer: `https://securetoken.google.com/${projectId}`, requiredClaims: ['sub', 'iat', 'exp', 'auth_time'], maxTokenAge: '1h' })
    const firebase = user.firebase as { sign_in_provider?: string } | undefined
    const now = Date.now() / 1000
    if (firebase?.sign_in_provider !== 'google.com' || user.email_verified !== true || !user.sub || user.sub.length > 128
      || typeof user.auth_time !== 'number' || !Number.isFinite(user.auth_time) || (!allowSessionRenewal && now - user.auth_time > 300) || user.auth_time > now
      || typeof user.iat !== 'number' || user.iat > now || allowSessionRenewal && now - user.iat > 300 || typeof user.exp !== 'number') throw new Error('Sign in with Google again.')
    return { uid: user.sub, expires: user.exp * 1000, name: typeof user.name === 'string' ? user.name.slice(0, 100) : undefined, email: typeof user.email === 'string' ? user.email.slice(0, 254) : undefined }
  }
}
export const verifyGoogleUser = createGoogleVerifier()
