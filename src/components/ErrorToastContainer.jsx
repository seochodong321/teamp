import React from 'react'
import { useStore } from '../store/useStore.js'

export default function ErrorToastContainer() {
  const { errorToasts, dismissError, successToasts, dismissSuccess } = useStore()
  if (!errorToasts.length && !successToasts.length) return null

  const toastStyle = (type) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    background: type === 'success' ? '#1A3A2A' : '#1F1F1F',
    color: '#fff',
    padding: '10px 16px', borderRadius: 10,
    fontSize: 13, fontWeight: 500,
    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
    pointerEvents: 'auto',
    animation: 'slideUp 0.2s ease',
    borderLeft: type === 'success' ? '3px solid #2ECC71' : '3px solid #E74C3C',
  })

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999,
      pointerEvents: 'none',
    }}>
      {errorToasts.map((e) => (
        <div key={e.id} style={toastStyle('error')}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ flex: 1 }}>{e.message}</span>
          <button onClick={() => dismissError(e.id)} style={{ color: '#888', fontSize: 12, marginLeft: 4 }}>✕</button>
        </div>
      ))}
      {successToasts.map((t) => (
        <div key={t.id} style={toastStyle('success')}>
          <span style={{ fontSize: 16 }}>✅</span>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button onClick={() => dismissSuccess(t.id)} style={{ color: '#888', fontSize: 12, marginLeft: 4 }}>✕</button>
        </div>
      ))}
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  )
}
