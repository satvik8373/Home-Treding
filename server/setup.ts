import { createHash } from 'node:crypto'
import { isIPv4 } from 'node:net'
import type { ExecutionSetup, NetworkProfile } from '../shared/setup.ts'
import type { BacktestRepository } from './backtest/service.ts'

export function publicIPv4(value: unknown): value is string {
  if (typeof value !== 'string' || !isIPv4(value)) return false
  const [a, b, c] = value.split('.').map(Number)
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 100 && b >= 64 && b <= 127 || a === 169 && b === 254
    || a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 168 || b === 0 && (c === 0 || c === 2))
    || a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) || a === 203 && b === 0 && c === 113)
}

const IP_PROVIDERS = [
  'https://api.ipify.org',
  'https://api4.ipify.org',
  'https://ifconfig.me/ip',
  'https://icanhazip.com',
  'https://checkip.amazonaws.com',
]

/** Fixed, credential-free request from the execution process, never the browser or Vercel gateway. */
export async function observeExecutionIPv4(fetcher: typeof fetch = fetch): Promise<string> {
  let lastError: Error | null = null
  for (const url of IP_PROVIDERS) {
    try {
      const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(5000), headers: { accept: 'text/plain' } })
      if (!response.ok || !response.body) throw new Error('IP lookup unavailable')
      let body = ''
      if (response.body && typeof (response.body as ReadableStream<Uint8Array>).getReader === 'function') {
        const reader = (response.body as ReadableStream<Uint8Array>).getReader()
        try {
          for (;;) {
            const chunk = await reader.read(); if (chunk.done) break
            body += Buffer.from(chunk.value).toString('utf8')
            if (body.length > 64) throw new Error('Invalid IP lookup')
          }
        } finally { await reader.cancel().catch(() => {}) }
      } else if (typeof response.text === 'function') {
        body = await response.text()
      }
      if (body.length > 64) throw new Error('Invalid IP lookup')
      const ip = body.trim()
      if (!publicIPv4(ip)) throw new Error('Invalid IP lookup')
      return ip
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('IP lookup failed')
    }
  }
  throw lastError ?? new Error('IP lookup unavailable')
}

type Context = { account: string; apiKey: string } | null
export class ExecutionNetwork {
  private observation: ExecutionSetup['observed'] = null
  private current = false
  private attemptedAt = -Infinity
  private error: string | null = null
  private task: Promise<void> | null = null
  constructor(private repository: BacktestRepository, private context: () => Context,
    private environment: () => NodeJS.ProcessEnv = () => process.env, private observe = observeExecutionIPv4, private now = Date.now) {
    const previous = this.repository.get<{ ipv4: string; checkedAt: number; changed: boolean }>('setup:last-observed-ip')
    if (previous && publicIPv4(previous.ipv4)) {
      this.observation = { ipv4: previous.ipv4, checkedAt: previous.checkedAt ?? 0, changed: !!previous.changed }
    }
  }
  private scope(context: NonNullable<Context>) {
    return createHash('sha256').update(JSON.stringify([context.account, context.apiKey])).digest('hex')
  }
  private profileKey(context: NonNullable<Context>) {
    return `setup:registered-ip:${this.scope(context)}`
  }
  save(input: unknown) {
    const context = this.context()
    if (!context) throw new Error('Connect mStock before saving its registered IP details.')
    const body = input as Record<string, unknown> | null
    if (!body || body.account !== context.account || body.connectionScope !== this.scope(context)) throw new Error('Broker connection changed. Recheck execution IP setup before saving.')
    if (!body || !publicIPv4(body.primary) || body.secondary != null && body.secondary !== '' && !publicIPv4(body.secondary)) throw new Error('Enter valid public IPv4 addresses from your mStock API key settings.')
    const secondary = typeof body.secondary === 'string' && body.secondary ? body.secondary : null
    if (body.primary === secondary) throw new Error('Secondary IP must differ from the primary IP, or leave it empty.')
    const profile: NetworkProfile = { primary: body.primary, secondary, savedAt: this.now() }
    this.repository.put(this.profileKey(context), profile)
    return { saved: true }
  }
  private async refresh() {
    this.attemptedAt = this.now()
    try {
      const ipv4 = await this.observe()
      if (!publicIPv4(ipv4)) throw new Error('Invalid observer result')
      const previous = this.repository.get<{ ipv4: string; changed: boolean }>('setup:last-observed-ip')
      this.observation = { ipv4, checkedAt: this.now(), changed: previous ? previous.ipv4 !== ipv4 || previous.changed : false }
      this.repository.put('setup:last-observed-ip', this.observation)
      this.current = true; this.error = null
    } catch {
      this.current = false; this.error = 'Could not observe the execution IPv4. Retry shortly; no broker action was sent.'
    }
  }
  async read(): Promise<ExecutionSetup> {
    if (!this.task && this.now() - this.attemptedAt >= (this.current ? 30_000 : 15_000)) {
      const task = this.refresh(); this.task = task
      void task.finally(() => { if (this.task === task) this.task = null })
    }
    if (this.task) await this.task
    const context = this.context(), env = this.environment(), expected = env.N009_EXECUTION_IPV4 ?? ''
    const profile = context ? this.repository.get<NetworkProfile>(this.profileKey(context)) : null
    const validExpected = publicIPv4(expected) ? expected : null
    const savedProxy = this.repository.get<{ url: string; ipv4?: string; savedAt: number }>('setup:workspace-proxy')
    let proxyLabel: string | null = null
    if (savedProxy?.url) {
      try {
        const u = new URL(savedProxy.url)
        proxyLabel = `${u.protocol}//${u.host}`
      } catch {
        proxyLabel = 'Custom Proxy'
      }
    }
    return { location: env.N009_EXECUTION_LOCATION === 'hosted' ? 'hosted' : env.N009_EXECUTION_LOCATION === 'local' ? 'local' : 'unspecified',
      observed: this.observation ? { ...this.observation } : null, current: this.current, error: expected && !validExpected ? 'The host execution IPv4 configuration is invalid. Ask the operator to correct it.' : this.error,
      expectedIPv4: validExpected, expectedMatch: validExpected && this.current ? validExpected === this.observation?.ipv4 : null,
      account: context?.account ?? null, connectionScope: context ? this.scope(context) : null, profile, registeredMatch: profile && this.current ? [profile.primary, profile.secondary].includes(this.observation!.ipv4) : null,
      registrationSource: 'user-entered', brokerRegistrationVerified: false,
      proxyConfigured: !!savedProxy?.url, proxyLabel }
  }
  async saveProxy(proxyUrlInput: unknown): Promise<{ saved: boolean; ipv4: string | null }> {
    const raw = typeof proxyUrlInput === 'string' ? proxyUrlInput.trim() : null
    if (!raw) {
      this.repository.put('setup:workspace-proxy', null)
      this.current = false
      this.attemptedAt = -Infinity
      await this.read()
      return { saved: true, ipv4: this.observation?.ipv4 ?? null }
    }
    let parsed: URL
    try {
      parsed = new URL(raw)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
    } catch {
      throw new Error('Enter a valid HTTP or HTTPS proxy URL, e.g. http://username:password@host:port or http://host:port')
    }
    const { createProxyFetcher } = await import('./proxy.ts')
    const proxyFetcher = createProxyFetcher(raw)
    let ipv4: string
    try {
      ipv4 = await observeExecutionIPv4(proxyFetcher)
    } catch (err) {
      throw new Error(`Proxy connection test failed: ${err instanceof Error ? err.message : 'Could not observe IP through proxy'}`)
    }
    this.repository.put('setup:workspace-proxy', { url: raw, ipv4, savedAt: this.now() })
    this.observation = { ipv4, checkedAt: this.now(), changed: false }
    this.current = true
    this.error = null
    return { saved: true, ipv4 }
  }
}
