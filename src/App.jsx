import React, { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
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
import WrapupPage        from './pages/WrapupPage.jsx'

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
  const { login, logout, setProjects, createTutorialProject } = useStore()
  const [ready, setReady] = useState(false)
  const projectsUnsubRef = useRef(null)  // 프로젝트 구독 cleanup용

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // 유저 정보 Firestore에서 로드
        try {
          const snap = await getDoc(doc(db, 'users', user.uid))
          const d = snap.exists() ? snap.data() : {}
          login(d.name || user.displayName || '사용자', d.email || user.email, user.uid, d)
        } catch {
          login(user.displayName || '사용자', user.email, user.uid)
        }

        // 이전 구독 해제 후 재구독 (계정 전환 대비)
        if (projectsUnsubRef.current) projectsUnsubRef.current()

        // 사용자가 속한 프로젝트 실시간 구독
        projectsUnsubRef.current = onSnapshot(
          query(collection(db, 'projects'), where('memberIds', 'array-contains', user.uid)),
          async (snapshot) => {
            const projects = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
            setProjects(projects)

            // 첫 로그인 감지 — Firestore에 프로젝트가 없으면 튜토리얼 생성
            if (snapshot.empty && !snapshot.metadata.fromCache) {
              const currentUser = useStore.getState().currentUser
              if (currentUser) {
                try {
                  await createTutorialProject(currentUser.id, currentUser.name)
                } catch (e) {
                  console.error('튜토리얼 프로젝트 생성 실패:', e)
                }
              }
            }
          }
        )
      } else {
        // 로그아웃 시 구독 해제
        if (projectsUnsubRef.current) {
          projectsUnsubRef.current()
          projectsUnsubRef.current = null
        }
        logout()
      }
      setReady(true)
    })

    return () => {
      unsub()
      if (projectsUnsubRef.current) projectsUnsubRef.current()
    }
  }, [login, logout, setProjects, createTutorialProject])

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
          <Route path="project/:projectId/wrapup"      element={<WrapupPage />} />
          <Route path="create"                          element={<CreateProjectPage />} />
          <Route path="profile"                         element={<ProfilePage />} />
          <Route path="connect"                         element={<ConnectPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
