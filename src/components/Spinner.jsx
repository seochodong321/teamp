import React from 'react'

export default function Spinner({ size = 36, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12 }}>
      <div style={{ width: size, height: size, borderRadius: '50%', border: '3px solid #E8E6F8', borderTopColor: '#534AB7', animation: 'spin 0.75s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      {label && <span style={{ fontSize: 13, color: '#9B97C5', fontWeight: 500 }}>{label}</span>}
    </div>
  )
}
