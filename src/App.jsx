import React, { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { Timestamp, collection, doc, getDoc, onSnapshot, orderBy, query, startAfter, updateDoc, where } from 'firebase/firestore'
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
import MatchPage         from './pages/MatchPage.jsx'
import HelpPage          from './pages/HelpPage.jsx'

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
  const { login, logout, setProjects, createTutorialProject, setDmRoomList, addNotification, addChatToast } = useStore()
  const isLoggedIn = useStore((s) => s.isLoggedIn)
  const projects   = useStore((s) => s.projects)
  const [ready, setReady] = useState(false)
  const projectsUnsubRef  = useRef(null)
  const dmUnsubRef        = useRef(null)
  const notifUnsubRef     = useRef(null)
  const msgWatchersRef    = useRef({}) // roomId → unsub

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
        if (dmUnsubRef.current) dmUnsubRef.current()
        if (notifUnsubRef.current) notifUnsubRef.current()

        // 사용자가 속한 프로젝트 실시간 구독
        projectsUnsubRef.current = onSnapshot(
          query(collection(db, 'projects'), where('memberIds', 'array-contains', user.uid)),
          async (snapshot) => {
            const projects = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
            setProjects(projects)

            // 튜토리얼 프로젝트 리더 자동 수정
            const tutProj = projects.find((p) => p.isTutorial)
            if (tutProj && tutProj.leaderId !== user.uid) {
              updateDoc(doc(db, 'projects', tutProj.id), {
                leaderId: user.uid,
                members: tutProj.members.map((m) => ({ ...m, role: m.id === user.uid ? 'leader' : 'member' })),
              }).catch(() => {})
            }

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
        // Firestore 푸시 알림 구독 (read: false인 것만)
        notifUnsubRef.current = onSnapshot(
          query(
            collection(db, 'notifications'),
            where('targetUserId', '==', user.uid),
            where('read', '==', false)
          ),
          (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const noti = change.doc.data()
                addNotification({
                  type: noti.type || 'system',
                  text: noti.text,
                  projectId: noti.projectId,
                  link: noti.link,
                })
                updateDoc(doc(db, 'notifications', change.doc.id), { read: true }).catch(() => {})
              }
            })
          }
        )

        // 1:1 DM 방 실시간 구독
        let isFirstDmSnap = true  // 최초 로드 시 기존 방을 'added'로 처리하는 것 방지
        dmUnsubRef.current = onSnapshot(
          query(collection(db, 'dmRooms'), where('participants', 'array-contains', user.uid)),
          (snapshot) => {
            const rooms = snapshot.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((r) => !(r.left || []).includes(user.uid))
            // 초기 로드가 아닌 경우에만 새 DM 알림
            if (!isFirstDmSnap) {
              snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                  const room = { id: change.doc.id, ...change.doc.data() }
                  if (room.createdBy && room.createdBy !== user.uid) {
                    const senderName = room.participantNames?.[room.createdBy] || '누군가'
                    addNotification({
                      type: 'dm',
                      text: `${senderName} 님이 1:1 대화를 시작했어요`,
                      projectId: room.projectId,
                    })
                  }
                }
              })
            }
            isFirstDmSnap = false
            setDmRoomList(rooms)
          }
        )
      } else {
        // 로그아웃 시 구독 해제
        if (projectsUnsubRef.current) { projectsUnsubRef.current(); projectsUnsubRef.current = null }
        if (dmUnsubRef.current) { dmUnsubRef.current(); dmUnsubRef.current = null }
        if (notifUnsubRef.current) { notifUnsubRef.current(); notifUnsubRef.current = null }
        logout()
      }
      setReady(true)
    })

    return () => {
      unsub()
      if (projectsUnsubRef.current) projectsUnsubRef.current()
      if (dmUnsubRef.current) dmUnsubRef.current()
      if (notifUnsubRef.current) notifUnsubRef.current()
    }
  }, [login, logout, setProjects, createTutorialProject, setDmRoomList, addNotification])

  // 백그라운드 메시지 감시 — 열려있지 않은 채팅방에 새 메시지 오면 토스트
  useEffect(() => {
    if (!isLoggedIn) return
    const uid = useStore.getState().currentUser?.id
    if (!uid) return

    const roomProjectMap = {}
    const allRoomIds = new Set()
    projects.forEach((project) => {
      ;(project.rooms || []).forEach((room) => {
        if (!room.isDm) {
          allRoomIds.add(room.id)
          roomProjectMap[room.id] = { projectId: project.id, roomName: room.name }
        }
      })
    })

    // 이미 없어진 방 구독 해제
    Object.keys(msgWatchersRef.current).forEach((roomId) => {
      if (!allRoomIds.has(roomId)) {
        msgWatchersRef.current[roomId]()
        delete msgWatchersRef.current[roomId]
      }
    })

    // 새 방 구독
    allRoomIds.forEach((roomId) => {
      if (msgWatchersRef.current[roomId]) return
      const startTime = Timestamp.now()
      const unsub = onSnapshot(
        query(
          collection(db, 'rooms', roomId, 'messages'),
          orderBy('createdAt', 'asc'),
          startAfter(startTime)
        ),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type !== 'added') return
            const msg = { id: change.doc.id, ...change.doc.data() }
            const { currentUser, mutedProjects } = useStore.getState()
            if (!currentUser || msg.senderId === currentUser.id) return
            if (msg.senderId === 'system' || msg.senderId === 'teampbot') return
            if (msg.type === 'notify') return
            const info = roomProjectMap[roomId]
            if (!info) return
            if ((mutedProjects || []).includes(info.projectId)) return
            if (window.location.pathname.includes(`/chat/${roomId}`)) return
            const preview = msg.type === 'image' ? '📷 사진'
              : msg.type === 'file' ? '📎 파일'
              : msg.type === 'vote' ? '📊 투표'
              : (msg.text || '').slice(0, 60)
            addChatToast({
              id: `ct_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              senderName: msg.senderName || '누군가',
              text: preview,
              roomId,
              projectId: info.projectId,
              roomName: info.roomName,
            })
          })
        },
        (error) => console.error(`[toast] room ${roomId} 구독 오류:`, error)
      )
      msgWatchersRef.current[roomId] = unsub
    })
  }, [projects, isLoggedIn, addChatToast])

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
          <Route path="match"                           element={<MatchPage />} />
          <Route path="help"                            element={<HelpPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
