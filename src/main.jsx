import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import OfflineBanner from './components/OfflineBanner.jsx'
import './styles/global.css'

// 다크 모드 초기 적용 (깜빡임 방지)
const savedTheme = localStorage.getItem('teamp-theme')
if (savedTheme === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark')
}

// 서비스워커 등록 (PWA 오프라인 지원)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => reg.update())
      .catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <OfflineBanner />
    <App />
  </React.StrictMode>,
)