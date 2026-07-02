import { initializeApp } from 'firebase/app'
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  // 선택 — GA4 계측용. 없으면 analytics.js가 조용히 no-op (빌드 필수 아님)
  ...(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
    ? { measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID } : {}),
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
// 브라우저 재시작 후에도 로그인 유지 (기본값 명시)
setPersistence(auth, browserLocalPersistence).catch(() => {})
// persistentLocalCache = IndexedDB 오프라인 캐시 (enableIndexedDbPersistence deprecated 대체)
export const db = initializeFirestore(app, { localCache: persistentLocalCache() })
export const storage = getStorage(app)

// FCM은 푸시 지원 브라우저에서만 초기화. iOS Safari 등은 serviceWorker는 있어도
// Notification/Push API가 없어 getMessaging이 messaging/unsupported-browser로 throw → try/catch로 흡수.
export const messaging = (() => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || typeof Notification === 'undefined') return null
  try { return getMessaging(app) } catch { return null }
})()

export async function requestNotificationPermission() {
  if (!messaging) return null
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    })
    return token
  } catch {
    return null
  }
}

export { onMessage }