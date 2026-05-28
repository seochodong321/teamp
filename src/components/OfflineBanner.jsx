import React, { useState, useEffect } from 'react'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  const [justBack, setJustBack] = useState(false)

  useEffect(() => {
    const goOffline = () => { setOffline(true); setJustBack(false) }
    const goOnline  = () => {
      setOffline(false)
      setJustBack(true)
      setTimeout(() => setJustBack(false), 3000)
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online',  goOnline)
    }
  }, [])

  if (!offline && !justBack) return null

  const style = {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'Pretendard, -apple-system, sans-serif',
    background: offline ? '#1a1a1a' : '#059669',
    color: '#fff',
    transition: 'background 0.3s',
  }

  return (
    <div style={style} role="alert" aria-live="polite">
      {offline
        ? <><span>📡</span> 오프라인 상태예요. 네트워크 연결을 확인해주세요.</>
        : <><span>✓</span> 다시 연결됐어요!</>
      }
    </div>
  )
}
