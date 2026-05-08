import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

// 오프라인 캐시 — 네트워크 끊겨도 마지막 데이터 유지
enableIndexedDbPersistence(db).catch((e) => {
  if (e.code === 'failed-precondition') {
    // 탭 여러 개 열려있을 때 — 무시해도 됨
  } else if (e.code === 'unimplemented') {
    // 브라우저가 IndexedDB 미지원 — 무시
  }
})

// FCM은 서비스워커가 있는 브라우저에서만 초기화
export const messaging = typeof window !== 'undefined' && 'serviceWorker' in navigator
  ? getMessaging(app)
  : null

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