importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

// Firebase 설정은 빌드 시 환경 변수가 없으므로 직접 기입
// Vite 빌드 후 env는 SW에서 접근 불가 — 하드코딩 필요
firebase.initializeApp({
  apiKey: 'AIzaSyDagiyf6Na75mbeLGwTOLWdjYhx33aWapg',
  authDomain: 'teamp-7923c.firebaseapp.com',
  projectId: 'teamp-7923c',
  storageBucket: 'teamp-7923c.firebasestorage.app',
  messagingSenderId: '322925743978',
  appId: '1:322925743978:web:9f00a649fc2f69e4245f13',
})

const messaging = firebase.messaging()

// 백그라운드 메시지 수신 → 시스템 알림 표시
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {}
  self.registration.showNotification(title || 'Teamp', {
    body: body || '',
    icon: icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data || {},
  })
})

// 알림 클릭 시 해당 URL로 이동
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
