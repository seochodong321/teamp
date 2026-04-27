import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase.js'
import { useStore } from './store/useStore.js'

import LoginPage         from './pages/LoginPage.jsx'
import Layout            from './components/Layout.jsx'
import HomePage          from './pages/HomePage.jsx'
import ProjectPage       from './pages/ProjectPage.jsx'
import ChatPage          from './pages/ChatPage.jsx'
import CalendarPage      from './pages/CalendarPage.jsx'
import ProfilePage       from './pages/ProfilePage.jsx'
import CreateProjectPage from './pages/CreateProjectPage.jsx'

function PrivateRoute({ children, ready }) {
  const isLoggedIn = useStore((s) => s.isLoggedIn)
  if (!ready) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontSize:'14px', color:'#6B6B6B' }}>불러오는 중...</div>
  return isLoggedIn ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { login, logout } = useStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Firebase 세션 감지 — 새로고침해도 로그인 상태 유지
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid))
          if (snap.exists()) {
            const d = snap.data()
            login(d.name, d.email, user.uid)
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
        <Route path="/" element={<PrivateRoute ready={ready}><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home"                            element={<HomePage />} />
          <Route path="project/:projectId"              element={<ProjectPage />} />
          <Route path="project/:projectId/chat/:roomId" element={<ChatPage />} />
          <Route path="project/:projectId/calendar"     element={<CalendarPage />} />
          <Route path="create"                          element={<CreateProjectPage />} />
          <Route path="profile"                         element={<ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}