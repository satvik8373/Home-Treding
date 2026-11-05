export type DeploymentStatus = 'checking' | 'setup' | 'unavailable' | 'locked' | 'open'

/** Only an explicit successful access response enables authenticated engine requests. */
export function accessStatus(status: number, body: unknown): DeploymentStatus {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'unavailable'
  const value = body as Record<string, unknown>
  if ([200, 503].includes(status) && value.configured === false) return 'setup'
  if (status !== 200 || value.configured !== true) return 'unavailable'
  return value.authenticated === true ? 'open' : value.authenticated === false ? 'locked' : 'unavailable'
}
