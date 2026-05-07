const CACHE_NAME = 'teamp-v2'

// 앱 셸 — 오프라인에서도 빈 화면 대신 앱 프레임을 보여주기 위해 캐시
const APP_SHELL = ['/index.html', '/']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  // Firebase / 외부 API 요청은 항상 네트워크 우선
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) {
    return
  }

  // HTML 내비게이션 요청 — 오프라인 시 캐시된 index.html로 폴백
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    )
    return
  }

  // JS/CSS/이미지 정적 에셋 — 캐시 우선, 없으면 네트워크
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'image') {
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (!response || response.status !== 200) return response
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
      })
    )
  }
})

// 푸시 알림 수신 (FCM firebase-messaging-sw.js 외 폴백)
self.addEventListener('push', (e) => {
  if (!e.data) return
  let data = {}
  try { data = e.data.json() } catch { data = { notification: { title: 'Teamp', body: e.data.text() } } }

  const { title, body, icon } = data.notification || {}
  e.waitUntil(
    self.registration.showNotification(title || 'Teamp', {
      body: body || '',
      icon: icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: data.data || {},
    })
  )
})

// 알림 클릭 → 앱으로 포커스
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes(self.location.origin))
      if (existing) {
        existing.focus()
        existing.navigate(url)
      } else {
        clients.openWindow(url)
      }
    })
  )
})
