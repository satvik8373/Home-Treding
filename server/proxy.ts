import http from 'node:http'
import https from 'node:https'
import { HttpsProxyAgent } from 'https-proxy-agent'

export function createProxyFetcher(proxyUrl: string): typeof fetch {
  const agent = new HttpsProxyAgent(proxyUrl)
  return async function proxyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
    const targetUrl = new URL(urlStr)
    const method = init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')
    const headers = new Headers(init?.headers ?? (typeof input === 'object' && 'headers' in input ? input.headers : undefined))
    const body = init?.body
    const signal = init?.signal

    return new Promise<Response>((resolve, reject) => {
      if (signal?.aborted) {
        return reject(signal.reason ?? new Error('Aborted'))
      }
      const isHttps = targetUrl.protocol === 'https:'
      const requestFn = isHttps ? https.request : http.request
      const reqHeaders: Record<string, string> = {}
      headers.forEach((value, key) => { reqHeaders[key] = value })

      const req = requestFn(targetUrl, {
        method,
        headers: reqHeaders,
        agent,
      }, res => {
        const chunks: Buffer[] = []
        res.on('data', chunk => chunks.push(Buffer.from(chunk)))
        res.on('end', () => {
          const resBody = Buffer.concat(chunks)
          const resHeaders = new Headers()
          for (const [key, val] of Object.entries(res.headers)) {
            if (Array.isArray(val)) {
              for (const v of val) resHeaders.append(key, v)
            } else if (val != null) {
              resHeaders.set(key, val)
            }
          }
          resolve(new Response(resBody, {
            status: res.statusCode ?? 200,
            statusText: res.statusMessage ?? '',
            headers: resHeaders,
          }))
        })
      })

      if (signal) {
        const onAbort = () => {
          req.destroy(signal.reason ?? new Error('Aborted'))
          reject(signal.reason ?? new Error('Aborted'))
        }
        signal.addEventListener('abort', onAbort, { once: true })
        req.on('close', () => signal.removeEventListener('abort', onAbort))
      }

      req.on('error', reject)
      if (body) {
        if (typeof body === 'string' || Buffer.isBuffer(body)) {
          req.write(body)
        }
      }
      req.end()
    })
  }
}
