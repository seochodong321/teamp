import React, { useState, useEffect } from 'react'

// 홈 화면 설치 유도. iOS Safari는 beforeinstallprompt가 없어 수동 안내가 필요하고,
// Android/Chrome/데스크톱은 네이티브 설치 프롬프트를 띄운다.
// 이미 설치(standalone)됐거나 한 번 닫았으면 노출하지 않는다.
export default function InstallPrompt() {
  const isStandalone = typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream

  const [deferred, setDeferred] = useState(null)
  const [dismissed, setDismissed] = useState(
    () => typeof localStorage !== 'undefined' && !!localStorage.getItem('teamp-install-dismissed')
  )

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const close = () => { localStorage.setItem('teamp-install-dismissed', '1'); setDismissed(true) }

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    let outcome
    try { ({ outcome } = await deferred.userChoice) } catch {}
    setDeferred(null)
    if (outcome === 'accepted') close() // 취소했으면 다음에 다시 보여줌
  }

  if (isStandalone || dismissed) return null
  // 네이티브 설치 프롬프트(안드/크롬/데스크톱)도, iOS 안내도 띄울 게 없으면 숨김
  if (!deferred && !isIOS) return null

  const bar = {
    display: 'flex', alignItems: 'center', gap: 10,
    margin: '10px 12px 0', padding: '12px 14px',
    background: 'var(--primary-light)', border: '1px solid var(--border)',
    borderRadius: 12, fontFamily: 'inherit',
  }
  const txt = { flex: 1, minWidth: 0, fontSize: 13, color: 'var(--primary-dark)', lineHeight: 1.5 }
  const btn = { flexShrink: 0, padding: '8px 14px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
  const x = { flexShrink: 0, width: 28, height: 28, borderRadius: 6, background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: 13, cursor: 'pointer' }

  return (
    <div style={bar} role="region" aria-label="앱 설치">
      <span style={{ fontSize: 20, flexShrink: 0 }}>📲</span>
      {deferred ? (
        <>
          <span style={txt}>홈 화면에 앱으로 추가하면 알림도 받고 더 빠르게 열려요.</span>
          <button style={btn} onClick={install}>설치</button>
        </>
      ) : (
        // iOS Safari 수동 안내
        <span style={txt}>
          홈 화면에 추가하면 알림을 받을 수 있어요 — Safari 하단 <strong>공유</strong> →
          <strong> "홈 화면에 추가"</strong>를 눌러주세요.
        </span>
      )}
      <button style={x} onClick={close} aria-label="닫기">✕</button>
    </div>
  )
}
