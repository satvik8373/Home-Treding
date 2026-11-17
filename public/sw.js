// Network-only v2: never cache account data, trading APIs, Firebase helpers or market prices.
self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys()
      await Promise.all(keys.map(key => caches.delete(key)))
    }
    await self.clients.claim()
  })())
})
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin || event.request.method !== 'GET' || event.request.mode !== 'navigate' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/__/')) return
  event.respondWith(fetch(event.request).catch(() => new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mavrix — offline</title><body style="font-family:system-ui;background:#f8fafc;color:#0f172a;padding:32px"><h1>Connection unavailable</h1><p>Reconnect to the internet and reopen Mavrix. The server engine runs independently; current trading status is unavailable here.</p></body></html>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })))
})

// Native Live Score Lock Screen Notification Actions (Square Off & Open)
self.addEventListener('notificationclick', event => {
  event.notification.close()
  if (event.action === 'stop') {
    event.waitUntil(
      fetch('/api/strategy/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }).catch(err => console.error('Failed to stop strategy from notification', err))
    )
  } else {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus()
        }
        if (self.clients.openWindow) return self.clients.openWindow('/')
      })
    )
  }
})
