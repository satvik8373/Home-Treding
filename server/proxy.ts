import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'
import { lookup } from 'node:dns/promises'
import type { Duplex } from 'node:stream'
import type { EgressMode } from '../shared/setup.ts'

const NULL_BODY_STATUSES = new Set([101, 204, 205, 304])

export function isPublicIpAddress(value: string): boolean {
  const normalized = value.trim().replace(/^\[|\]$/g, '')
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(normalized)?.[1]
  const ipv4Candidate = mapped ?? normalized
  if (net.isIPv4(ipv4Candidate)) {
    const [a, b, c] = ipv4Candidate.split('.').map(Number)
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || a === 100 && b >= 64 && b <= 127
      || a === 169 && b === 254
      || a === 172 && b >= 16 && b <= 31
      || a === 192 && (b === 168 || b === 0 && (c === 0 || c === 2))
      || a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)
      || a === 203 && b === 0 && c === 113)
  }
  if (net.isIPv6(normalized)) {
    const lower = normalized.toLowerCase()
    if (lower === '::' || lower === '::1') return false
    const firstHextet = parseInt(lower.split(':')[0] || '0', 16)
    if ((firstHextet & 0xfe00) === 0xfc00) return false // fc00::/7 ULA
    if ((firstHextet & 0xffc0) === 0xfe80) return false // fe80::/10 link-local
    if ((firstHextet & 0xff00) === 0xff00) return false // ff00::/8 multicast
    return true
  }
  return false
}

export function egressModeOf(routeUrl: string | null | undefined): EgressMode {
  if (!routeUrl) return 'direct'
  return routeUrl.startsWith('bind://') ? 'interface' : 'proxy'
}

export function formatEgressLabel(routeUrl: string): string {
  if (routeUrl.startsWith('bind://')) {
    return `Interface ${routeUrl.slice('bind://'.length)}`
  }
  try {
    const u = new URL(routeUrl)
    return `${u.protocol}//${u.host}`
  } catch {
    return 'Custom Proxy'
  }
}

export interface ValidateProxyOptions {
  allowOperatorRoutes?: boolean
  resolveHost?: (hostname: string) => Promise<{ address: string }[]>
}

export async function validateEgressRoute(raw: string, options: ValidateProxyOptions = {}): Promise<string> {
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > 512) {
    throw new Error('Enter a valid HTTP or HTTPS proxy URL, e.g. http://host:port')
  }
  if (trimmed.startsWith('bind://')) {
    if (!options.allowOperatorRoutes) {
      throw new Error('Interface binding routes can only be configured by the host operator.')
    }
    const ip = trimmed.slice('bind://'.length).trim()
    if (!net.isIPv4(ip)) throw new Error('Invalid local interface IPv4 address.')
    return `bind://${ip}`
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.search || parsed.hash) {
      throw new Error()
    }
    if (parsed.pathname && parsed.pathname !== '/') throw new Error()
  } catch {
    throw new Error('Enter a valid HTTP or HTTPS proxy URL, e.g. http://username:password@host:port or http://host:port')
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!options.allowOperatorRoutes) {
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      throw new Error('Private or loopback proxy hosts cannot be configured from the dashboard.')
    }
    if (net.isIP(hostname)) {
      if (!isPublicIpAddress(hostname)) {
        throw new Error('Private, loopback, or reserved IP proxy addresses are blocked.')
      }
    } else {
      const resolveHost = options.resolveHost ?? ((host: string) => lookup(host, { all: true }))
      let records: { address: string }[]
      try {
        records = await resolveHost(hostname)
      } catch {
        throw new Error('Proxy hostname could not be resolved.')
      }
      if (!records.length || !records.every(r => isPublicIpAddress(r.address))) {
        throw new Error('Proxy hostname resolves to a private or non-public IP address.')
      }
    }
  }
  return parsed.toString().replace(/\/$/, '')
}

class ProxyConnectAgent extends https.Agent {
  private proxy: URL
  constructor(proxyUrl: string) {
    super({ keepAlive: false })
    this.proxy = new URL(proxyUrl)
  }

  override createConnection(options: https.RequestOptions, callback?: (err: Error | null, stream: Duplex) => void): Duplex | null | undefined {
    const targetHost = String(options.host || options.hostname || '')
    const targetPort = Number(options.port || 443)
    const connectAuthority = net.isIPv6(targetHost.replace(/^\[|\]$/g, ''))
      ? `[${targetHost.replace(/^\[|\]$/g, '')}]:${targetPort}`
      : `${targetHost}:${targetPort}`
    const proxyHost = this.proxy.hostname.replace(/^\[|\]$/g, '')
    const proxyPort = Number(this.proxy.port || (this.proxy.protocol === 'https:' ? 443 : 80))

    const socket = this.proxy.protocol === 'https:'
      ? tls.connect({ host: proxyHost, port: proxyPort, servername: net.isIP(proxyHost) ? undefined : proxyHost })
      : net.connect({ host: proxyHost, port: proxyPort })

    let settled = false
    const fail = (err: Error) => {
      if (settled) return
      settled = true
      socket.removeListener('error', fail)
      socket.removeListener('data', onData)
      socket.removeListener('close', onCloseBeforeTunnel)
      if (!socket.destroyed) socket.destroy()
      callback?.(err, undefined as unknown as Duplex)
    }
    const onCloseBeforeTunnel = () => fail(new Error('Proxy closed connection before tunnel established'))
    socket.once('error', fail)
    socket.once('close', onCloseBeforeTunnel)

    const headers: string[] = [
      `CONNECT ${connectAuthority} HTTP/1.1`,
      `Host: ${connectAuthority}`,
    ]
    if (this.proxy.username || this.proxy.password) {
      const credentials = `${decodeURIComponent(this.proxy.username)}:${decodeURIComponent(this.proxy.password)}`
      headers.push(`Proxy-Authorization: Basic ${Buffer.from(credentials).toString('base64')}`)
    }
    headers.push('Connection: keep-alive', '', '')

    let buffer = Buffer.alloc(0)
    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk])
      const end = buffer.indexOf('\r\n\r\n')
      if (end === -1) {
        if (buffer.length > 16_384) fail(new Error('Proxy response headers too large'))
        return
      }
      socket.removeListener('data', onData)
      socket.removeListener('error', fail)
      socket.removeListener('close', onCloseBeforeTunnel)
      settled = true

      const head = buffer.subarray(0, end).toString('latin1')
      const statusCode = Number(/^HTTP\/\d\.\d\s+(\d{3})/.exec(head.split('\r\n')[0] || '')?.[1] ?? 0)
      if (statusCode !== 200) {
        if (!socket.destroyed) socket.destroy()
        callback?.(new Error(`Proxy CONNECT failed (HTTP ${statusCode || 'unknown'})`), undefined as unknown as Duplex)
        return
      }

      const rest = buffer.subarray(end + 4)
      if (rest.length > 0) socket.unshift(rest)

      const cleanTargetHost = targetHost.replace(/^\[|\]$/g, '')
      const tlsSocket = tls.connect({
        socket,
        servername: typeof options.servername === 'string' && options.servername
          ? options.servername
          : net.isIP(cleanTargetHost) ? undefined : cleanTargetHost,
        rejectUnauthorized: options.rejectUnauthorized ?? true,
        minVersion: options.minVersion,
        maxVersion: options.maxVersion,
        ca: options.ca,
      })
      callback?.(null, tlsSocket)
    }

    const readyEvent = this.proxy.protocol === 'https:' ? 'secureConnect' : 'connect'
    socket.once(readyEvent, () => {
      socket.on('data', onData)
      socket.write(headers.join('\r\n'))
    })
    return undefined
  }
}

export function createEgressAgent(routeUrl: string): https.Agent {
  if (routeUrl.startsWith('bind://')) {
    return new https.Agent({ localAddress: routeUrl.slice('bind://'.length), keepAlive: true })
  }
  return new ProxyConnectAgent(routeUrl)
}

async function serializeBody(body: BodyInit | null | undefined, headers: Headers): Promise<Buffer | string | undefined> {
  if (body == null) return undefined
  if (typeof body === 'string') return body
  if (Buffer.isBuffer(body)) return body
  if (body instanceof URLSearchParams) {
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
    }
    return body.toString()
  }
  if (ArrayBuffer.isView(body)) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength)
  }
  if (body instanceof ArrayBuffer) {
    return Buffer.from(body)
  }
  throw new Error('Unsupported request body type for proxy fetch')
}

export function createProxyFetcher(routeUrl: string): typeof fetch {
  const isBind = routeUrl.startsWith('bind://')
  const localAddress = isBind ? routeUrl.slice('bind://'.length) : undefined
  const httpsAgent = isBind ? new https.Agent({ localAddress, keepAlive: false }) : new ProxyConnectAgent(routeUrl)
  const httpAgent = isBind ? new http.Agent({ localAddress, keepAlive: false }) : undefined
  const parsedProxy = isBind ? null : new URL(routeUrl)

  return async function proxyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const targetUrl = new URL(urlStr)
    const method = init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')
    const headers = new Headers(init?.headers ?? (typeof input === 'object' && 'headers' in input ? input.headers : undefined))
    const signal = init?.signal
    const serializedBody = await serializeBody(init?.body, headers)

    return new Promise<Response>((resolve, reject) => {
      if (signal?.aborted) {
        return reject(signal.reason ?? new Error('Aborted'))
      }

      const isHttpsTarget = targetUrl.protocol === 'https:'
      const reqHeaders: Record<string, string> = {}
      headers.forEach((value, key) => { reqHeaders[key] = value })
      if (serializedBody !== undefined && !headers.has('content-length')) {
        reqHeaders['content-length'] = String(Buffer.byteLength(serializedBody))
      }

      let req: http.ClientRequest
      if (!isBind && !isHttpsTarget && parsedProxy) {
        // Plain HTTP targets over an HTTP/HTTPS proxy use absolute-URI proxy forwarding.
        if (parsedProxy.username || parsedProxy.password) {
          const auth = Buffer.from(`${decodeURIComponent(parsedProxy.username)}:${decodeURIComponent(parsedProxy.password)}`).toString('base64')
          reqHeaders['proxy-authorization'] = `Basic ${auth}`
        }
        reqHeaders['host'] = targetUrl.host
        const proxyClient = parsedProxy.protocol === 'https:' ? https.request : http.request
        req = proxyClient({
          host: parsedProxy.hostname.replace(/^\[|\]$/g, ''),
          port: Number(parsedProxy.port || (parsedProxy.protocol === 'https:' ? 443 : 80)),
          method,
          path: targetUrl.toString(),
          headers: reqHeaders,
        })
      } else {
        const requestFn = isHttpsTarget ? https.request : http.request
        req = requestFn(targetUrl, {
          method,
          headers: reqHeaders,
          agent: isHttpsTarget ? httpsAgent : httpAgent,
        })
      }

      let settled = false
      const cleanupAbort = () => {
        if (signal && onAbort) signal.removeEventListener('abort', onAbort)
      }
      const fail = (err: unknown) => {
        if (settled) return
        settled = true
        cleanupAbort()
        reject(err)
      }
      let onAbort: (() => void) | null = null
      if (signal) {
        onAbort = () => {
          const reason = signal.reason ?? new Error('Aborted')
          req.destroy(reason instanceof Error ? reason : new Error(String(reason)))
          fail(reason)
        }
        signal.addEventListener('abort', onAbort, { once: true })
      }

      req.on('response', res => {
        const status = res.statusCode ?? 200
        if (init?.redirect === 'error' && status >= 300 && status < 400) {
          res.resume()
          req.destroy()
          return fail(new TypeError('Unexpected redirect'))
        }
        const chunks: Buffer[] = []
        res.on('data', chunk => chunks.push(Buffer.from(chunk)))
        res.on('error', err => fail(err))
        res.on('end', () => {
          if (settled) return
          settled = true
          cleanupAbort()
          const resHeaders = new Headers()
          for (const [key, val] of Object.entries(res.headers)) {
            if (Array.isArray(val)) {
              for (const v of val) resHeaders.append(key, v)
            } else if (val != null) {
              resHeaders.set(key, val)
            }
          }
          const bodyInit = NULL_BODY_STATUSES.has(status) ? null : Buffer.concat(chunks)
          resolve(new Response(bodyInit, {
            status,
            statusText: res.statusMessage ?? '',
            headers: resHeaders,
          }))
        })
      })

      req.on('error', fail)
      if (serializedBody !== undefined) req.write(serializedBody)
      req.end()
    })
  }
}
