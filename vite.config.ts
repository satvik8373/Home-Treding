import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { ACCOUNT_ORIGIN, hostedCookies, previewCookies, trustedPreviewRequest } from './shared/preview.ts'

// https://vite.dev/config/
export default defineConfig(() => ({
  define: { 'import.meta.env.VITE_ENGINE_MODE': JSON.stringify(process.env.VITE_ENGINE_MODE === 'isolated' ? 'isolated' : 'account') },
  plugins: [react(), { name: 'account-preview-origin', configureServer(server) {
    if (process.env.VITE_ENGINE_MODE === 'isolated') return
    server.middlewares.use('/api', (req, res, next) => {
      if (!trustedPreviewRequest(req.headers.host, req.headers.origin, req.headers['sec-fetch-site'] as string | undefined)) {
        res.statusCode = 403; res.end('Local account preview requires a same-origin loopback request.'); return
      }
      next()
    })
  } }],
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    proxy: { '/api': process.env.VITE_ENGINE_MODE === 'isolated' ? { target: 'http://127.0.0.1:4310' } : {
      target: ACCOUNT_ORIGIN, changeOrigin: true,
      configure(proxy) {
        proxy.on('proxyReq', (outgoing, incoming) => {
          outgoing.setHeader('cookie', hostedCookies(incoming.headers.cookie))
          if (incoming.headers.origin) outgoing.setHeader('origin', ACCOUNT_ORIGIN)
          for (const name of ['authorization', 'x-009-gateway-secret', 'x-009-workspace']) outgoing.removeHeader(name)
        })
        proxy.on('proxyRes', response => { if (response.headers['set-cookie']) response.headers['set-cookie'] = previewCookies(response.headers['set-cookie']) })
      },
    } },
  },
}))
