// Local preview is an authenticated client of the hosted account engine, not a second executor.
export const ACCOUNT_ORIGIN = 'https://home-treding.vercel.app'
const cookies: Record<string, string> = { n009_preview_access: '__Host-n009', n009_preview_refresh: '__Host-n009-refresh' }
export function hostedCookies(value = '') {
  return value.split(';').map(part => part.trim()).flatMap(part => {
    const index = part.indexOf('='), name = cookies[part.slice(0, index)]
    return index > 0 && name ? [`${name}=${part.slice(index + 1)}`] : []
  }).join('; ')
}
export function previewCookies(values: string[]) {
  return values.flatMap(value => {
    const [first, ...attributes] = value.split(';'), index = first.indexOf('=')
    const name = Object.entries(cookies).find(([, hosted]) => hosted === first.slice(0, index))?.[0]
    if (!name || index < 1) return []
    // Only on the loopback development listener. Signatures, HttpOnly and SameSite=Strict remain intact.
    return [`${name}=${first.slice(index + 1)};${attributes.filter(attribute => !/^\s*(Secure|Domain\s*=)/i.test(attribute)).join(';')}`]
  })
}
export function trustedPreviewRequest(host = '', origin?: string, site?: string) {
  if (!/^(localhost|127\.0\.0\.1):5173$/.test(host) || site === 'cross-site') return false
  return !origin || origin === `http://${host}`
}
