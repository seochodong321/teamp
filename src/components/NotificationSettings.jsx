import React, { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db, requestNotificationPermission } from '../firebase.js'
import { useStore } from '../store/useStore.js'

// 알림 권한 상태별 안내 + 켜기. 한 번 거부하면 JS로 재요청이 불가능하므로
// denied 상태에서는 브라우저/기기 설정에서 직접 허용하도록 안내한다.
export default function NotificationSettings() {
  const currentUser = useStore((s) => s.currentUser)
  const supported = typeof window !== 'undefined' && 'Notification' in window
  const [perm, setPerm] = useState(supported ? Notification.permission : 'unsupported')
  const [busy, setBusy] = useState(false)

  const enable = async () => {
    setBusy(true)
    try {
      const token = await requestNotificationPermission()
      if (token && currentUser?.id) {
        await updateDoc(doc(db, 'users', currentUser.id), { fcmToken: token }).catch(() => {})
      }
    } finally {
      setPerm(supported ? Notification.permission : 'unsupported')
      setBusy(false)
    }
  }

  const box = { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }
  const icon = { fontSize: 22, flexShrink: 0 }
  const txt = { flex: 1, minWidth: 0 }
  const title = { fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }
  const desc = { fontSize: 12.5, color: 'var(--text-secondary)', margin: '2px 0 0', lineHeight: 1.55 }
  const btn = { flexShrink: 0, padding: '9px 16px', background: 'var(--primary)', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none' }

  if (perm === 'granted') return (
    <div style={box}>
      <span style={icon}>🔔</span>
      <div style={txt}>
        <p style={title}>알림이 켜져 있어요</p>
        <p style={desc}>메시지·할 일 배정·공지·마일스톤 알림을 받아요.</p>
      </div>
    </div>
  )

  if (perm === 'denied') return (
    <div style={box}>
      <span style={icon}>🔕</span>
      <div style={txt}>
        <p style={title}>알림이 차단돼 있어요</p>
        <p style={desc}>브라우저(또는 기기) 설정에서 이 사이트의 알림을 <strong>허용</strong>으로 바꿔주세요. 주소창 옆 자물쇠 → 알림에서 바꿀 수 있어요.</p>
      </div>
    </div>
  )

  if (perm === 'unsupported') return (
    <div style={box}>
      <span style={icon}>📱</span>
      <div style={txt}>
        <p style={title}>이 환경은 웹 알림을 지원하지 않아요</p>
        <p style={desc}>iPhone은 Safari에서 <strong>"홈 화면에 추가"</strong>로 설치하면 알림을 받을 수 있어요.</p>
      </div>
    </div>
  )

  // default — 아직 요청 안 함
  return (
    <div style={box}>
      <span style={icon}>🔔</span>
      <div style={txt}>
        <p style={title}>알림을 켜면 놓치지 않아요</p>
        <p style={desc}>메시지·할 일·공지가 오면 바로 알려드려요.</p>
      </div>
      <button style={busy ? { ...btn, opacity: 0.6 } : btn} onClick={enable} disabled={busy}>
        {busy ? '여는 중...' : '알림 받기'}
      </button>
    </div>
  )
}
