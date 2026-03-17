/* 简单离线缓存（不依赖第三方库）
   - 生产环境启用（main.ts 会判断 import.meta.env.PROD）
   - cache-first 静态资源，网络失败则回退缓存
*/

const CACHE = 'wm-personal-planner-cache-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(['/', '/manifest.webmanifest', '/favicon.svg']).catch(() => undefined),
      )
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => undefined)
          return res
        })
        .catch(() => cached)

      return cached || fetchPromise
    }),
  )
})

