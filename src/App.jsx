import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase.js'
import { useStore } from './store/useStore.js'

import LoginPage         from './pages/LoginPage.jsx'
import JoinPage          from './pages/JoinPage.jsx'
import Layout            from './components/Layout.jsx'
import HomePage          from './pages/HomePage.jsx'
import ProjectPage       from './pages/ProjectPage.jsx'
import ChatPage          from './pages/ChatPage.jsx'
import ProfilePage       from './pages/ProfilePage.jsx'
import ConnectPage       from './pages/ConnectPage.jsx'
import CreateProjectPage from './pages/CreateProjectPage.jsx'

function PrivateRoute({ children, ready }) {
  const isLoggedIn = useStore((s) => s.isLoggedIn)
  if (!ready) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '14px', color: '#6B6B6B' }}>
      불러오는 중...
    </div>
  )
  return isLoggedIn ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { login, logout } = useStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid))
          if (snap.exists()) {
            const d = snap.data()
            login(d.name, d.email, user.uid, { affiliation: d.affiliation || '', phone: d.phone || '' })
          } else {
            login(user.displayName || '사용자', user.email, user.uid)
          }
        } catch {
          login(user.displayName || '사용자', user.email, user.uid)
        }
      } else {
        logout()
      }
      setReady(true)
    })
    return () => unsub()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/" element={<PrivateRoute ready={ready}><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home"                            element={<HomePage />} />
          <Route path="project/:projectId"              element={<ProjectPage />} />
          <Route path="project/:projectId/chat/:roomId" element={<ChatPage />} />
          {/* 캘린더는 ProjectPage 탭 안에서 렌더링 — 별도 라우트 없음 */}
          <Route path="create"                          element={<CreateProjectPage />} />
          <Route path="profile"                         element={<ProfilePage />} />
          <Route path="connect"                         element={<ConnectPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}