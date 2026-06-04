import React from 'react'

export default function Spinner({ size = 36, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 12 }}>
      <div style={{ width: size, height: size, borderRadius: '50%', border: '3px solid var(--primary-light)', borderTopColor: 'var(--primary)', animation: 'spin 0.75s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      {label && <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}>{label}</span>}
    </div>
  )
}
