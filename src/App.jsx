import React, { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { Timestamp, addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, startAfter, updateDoc, where } from 'firebase/firestore'
import { auth, db, messaging, requestNotificationPermission, onMessage } from './firebase.js'
import { useStore } from './store/useStore.js'
import Spinner from './components/Spinner.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// 인증 전 페이지는 즉시 로드 (로그인/가입 화면은 빠르게 보여야 함)
import LoginPage          from './pages/LoginPage.jsx'
import JoinPage           from './pages/JoinPage.jsx'
import Layout             from './components/Layout.jsx'
import LandingPage        from './pages/LandingPage.jsx'
import SetupUsernamePage  from './pages/SetupUsernamePage.jsx'
import LegalPage          from './pages/LegalPage.jsx'
import VerifyEmailPage    from './pages/VerifyEmailPage.jsx'
import { TERMS_DATA }     from './legal/termsData.js'
import { PRIVACY_DATA }   from './legal/privacyData.js'
import { GUIDELINES_DATA } from './legal/guidelinesData.js'

// 인증 후 페이지는 lazy load — 초기 번들에서 분리
const HomePage          = lazy(() => import('./pages/HomePage.jsx'))
const ProjectPage       = lazy(() => import('./pages/ProjectPage.jsx'))
const ChatPage          = lazy(() => import('./pages/ChatPage.jsx'))
const ProfilePage       = lazy(() => import('./pages/ProfilePage.jsx'))
const ConnectPage       = lazy(() => import('./pages/ConnectPage.jsx'))
const CreateProjectPage = lazy(() => import('./pages/CreateProjectPage.jsx'))
const WrapupPage        = lazy(() => import('./pages/WrapupPage.jsx'))
const MatchPage         = lazy(() => import('./pages/MatchPage.jsx'))
const HelpPage          = lazy(() => import('./pages/HelpPage.jsx'))
const MessagesPage      = lazy(() => import('./pages/MessagesPage.jsx'))
const CalendarPage      = lazy(() => import('./pages/CalendarPage.jsx'))
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage.jsx'))
const AdminPage         = lazy(() => import('./pages/AdminPage.jsx'))
const NotFoundPage      = lazy(() => import('./pages/NotFoundPage.jsx'))
const PricingPage           = lazy(() => import('./pages/PricingPage.jsx'))
const StudentVerifyPage     = lazy(() => import('./pages/StudentVerifyPage.jsx'))

// 오늘 생일인 팀원 감지 → 전체방 케이크 메시지 + Firestore 알림 전송
// birthdayLogs/{YYYY}_{memberId}_{projectId} 로 중복 방지
async function checkBirthdays(projects, myUid) {
  const now     = new Date()
  const todayMD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const todayKey = `${now.getFullYear()}-${todayMD}`

  // 하루에 한 번만 — localStorage로 빠른 중복 방지
  const lastCheck = localStorage.getItem('teamp-birthday-check')
  if (lastCheck === todayKey) return
  localStorage.setItem('teamp-birthday-check', todayKey)

  const activeProjects = projects.filter((p) => p.status === 'active' && !p.isTutorial)

  // ── 내 생일 자축 (본인 기기에서 직접 체크) ──
  try {
    const mySnap = await getDoc(doc(db, 'users', myUid))
    if (mySnap.exists()) {
      const myData = mySnap.data()
      const myBD = myData.birthday?.slice(5) // "YYYY-MM-DD" → "MM-DD"
      if (myBD === todayMD) {
        for (const project of activeProjects) {
          const logId  = `${now.getFullYear()}_${myUid}_${project.id}`
          const logRef = doc(db, 'birthdayLogs', logId)
          try {
            const logSnap = await getDoc(logRef)
            if (logSnap.exists()) continue
            await setDoc(logRef, { sentAt: serverTimestamp(), sentBy: myUid })
          } catch { continue }

          const allRoom = project.rooms?.find((r) => r.name === '전체' && !r.isDm)
          const link = allRoom ? `/project/${project.id}/chat/${allRoom.id}` : `/project/${project.id}`

          if (allRoom) {
            addDoc(collection(db, 'rooms', allRoom.id, 'messages'), {
              senderId: 'system', senderName: '팀프', type: 'notify',
              text: `🎂 오늘은 ${myData.name} 님의 생일이에요! 다 같이 축하해요 🎉`,
              time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
              createdAt: serverTimestamp(),
            }).catch(() => {})
          }

          addDoc(collection(db, 'notifications'), {
            targetUserId: myUid, type: 'birthday',
            text: `🎉 ${myData.name} 님, 생일을 진심으로 축하해요! 함께한 팀원들 모두 오늘 하루 응원하고 있어요 🎂`,
            projectId: project.id,
            projectName: project.name,
            link, read: false,
            createdAt: serverTimestamp(),
          }).catch(() => {})
        }
      }
    }
  } catch {}

  // ── 팀원 생일 체크 (나 제외) ──
  const memberIdSet = new Set()
  activeProjects.forEach((p) => {
    p.members?.forEach((m) => { if (m.id !== myUid) memberIdSet.add(m.id) })
  })
  if (memberIdSet.size === 0) return

  const birthdayMembers = []
  await Promise.all([...memberIdSet].map(async (uid) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid))
      if (snap.exists()) {
        const d = snap.data()
        if (d.birthday?.slice(5) === todayMD) birthdayMembers.push({ id: uid, name: d.name || '팀원' })
      }
    } catch {}
  }))
  if (birthdayMembers.length === 0) return

  for (const member of birthdayMembers) {
    const sharedProjects = activeProjects.filter((p) => p.memberIds?.includes(member.id))
    for (const project of sharedProjects) {
      const logId  = `${now.getFullYear()}_${member.id}_${project.id}`
      const logRef = doc(db, 'birthdayLogs', logId)
      try {
        const logSnap = await getDoc(logRef)
        if (logSnap.exists()) continue
        await setDoc(logRef, { sentAt: serverTimestamp(), sentBy: myUid })
      } catch { continue }

      const allRoom = project.rooms?.find((r) => r.name === '전체' && !r.isDm)
      const link = allRoom ? `/project/${project.id}/chat/${allRoom.id}` : `/project/${project.id}`

      if (allRoom) {
        addDoc(collection(db, 'rooms', allRoom.id, 'messages'), {
          senderId: 'system', senderName: '팀프', type: 'notify',
          text: `🎂 오늘은 ${member.name} 님의 생일이에요! 다 같이 축하해요 🎉`,
          time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          createdAt: serverTimestamp(),
        }).catch(() => {})
      }

      // 생일 당사자에게 따뜻한 개인 알림
      addDoc(collection(db, 'notifications'), {
        targetUserId: member.id, type: 'birthday',
        text: `🎉 ${member.name} 님, 생일을 진심으로 축하해요! 함께한 팀원들 모두 오늘 하루 응원하고 있어요 🎂`,
        projectId: project.id,
        projectName: project.name,
        link, read: false,
        createdAt: serverTimestamp(),
      }).catch(() => {})
    }
  }
}

function PrivateRoute({ children, ready }) {
  const isLoggedIn          = useStore((s) => s.isLoggedIn)
  const needsUsernameSetup  = useStore((s) => s.needsUsernameSetup)
  if (!ready) return <Spinner size={40} label="팀프 불러오는 중…" />
  if (!isLoggedIn) return <Navigate to="/login" replace />
  if (needsUsernameSetup)  return <Navigate to="/setup-username" replace />
  return children
}

export default function App() {
  const { login, logout, setProjects, createTutorialProject, setDmRoomList, addNotification, addChatToast, incrementUnread, setInvites, setNeedsUsernameSetup, setMatchPostCount } = useStore()
  const isLoggedIn  = useStore((s) => s.isLoggedIn)
  const projects    = useStore((s) => s.projects)
  const dmRoomList  = useStore((s) => s.dmRoomList)
  const [ready, setReady] = useState(false)
  const projectsUnsubRef  = useRef(null)
  const dmUnsubRef        = useRef(null)
  const notifUnsubRef     = useRef(null)
  const inviteUnsubRef    = useRef(null)
  const msgWatchersRef    = useRef({}) // roomId → unsub
  const dmMsgWatchersRef  = useRef({}) // dmRoomId → unsub
  const matchUnsubRef     = useRef(null)
  const onMessageUnsubRef = useRef(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // 1. Firebase Auth 복원 즉시 기본 정보로 로그인 → UI 즉시 표시
        login(user.displayName || '사용자', user.email, user.uid)
        setReady(true)

        // 2. Firestore 프로필 백그라운드 로드 (UI 블로킹 없음)
        getDoc(doc(db, 'users', user.uid)).then((snap) => {
          if (snap.exists()) {
            const d = snap.data()
            login(d.name || user.displayName || '사용자', d.email || user.email, user.uid, d)
            // username 없는 기존 이메일 계정은 강제 이동 안 함
          } else {
            // Firestore 문서 없음 = 소셜 로그인 신규 유저 (이메일 가입은 항상 문서 생성)
            login(user.displayName || '사용자', user.email, user.uid)
            setNeedsUsernameSetup(true)
          }
        }).catch(() => {})

        // 이전 구독 해제 후 재구독 (계정 전환 대비)
        if (projectsUnsubRef.current) projectsUnsubRef.current()
        if (dmUnsubRef.current) dmUnsubRef.current()
        if (notifUnsubRef.current) notifUnsubRef.current()
        if (inviteUnsubRef.current) inviteUnsubRef.current()
        if (matchUnsubRef.current) matchUnsubRef.current()

        // 팀프 매치 오픈 게시글 수 실시간 구독 (N 배지용)
        matchUnsubRef.current = onSnapshot(
          query(collection(db, 'matchPosts'), where('status', '==', 'open')),
          (snap) => setMatchPostCount(snap.size),
          () => {}
        )

        // 사용자가 속한 프로젝트 실시간 구독
        projectsUnsubRef.current = onSnapshot(
          query(collection(db, 'projects'), where('memberIds', 'array-contains', user.uid)),
          async (snapshot) => {
            const projects = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
            setProjects(projects)

            // 피드백 수집 마감일 지난 프로젝트 자동 종료 (캐시 아닌 실제 데이터일 때만)
            if (!snapshot.metadata.fromCache) {
              const now = new Date()
              projects.forEach((p) => {
                if (p.status === 'collecting' && p.feedbackDeadline && now > new Date(p.feedbackDeadline)) {
                  updateDoc(doc(db, 'projects', p.id), { status: 'archived' }).catch(() => {})
                }
              })
            }

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

            // 생일 체크 — 오늘 처음 로드할 때만 실행
            if (!snapshot.metadata.fromCache) {
              checkBirthdays(projects, user.uid).catch(() => {})
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
                // 할 일 배정 알림은 토스트로도 표시
                if (noti.type === 'todo') {
                  addChatToast({
                    id: `ct_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    icon: '✅',
                    senderName: noti.projectName || '할 일 알림',
                    text: noti.text,
                    roomId: null,
                    projectId: noti.projectId,
                    roomName: null,
                    link: noti.link,
                  })
                }
                updateDoc(doc(db, 'notifications', change.doc.id), { read: true }).catch(() => {})
              }
            })
          }
        )

        // 내게 온 프로젝트 초대 실시간 구독 — 복합 인덱스 불필요하도록 단일 조건 + 클라이언트 필터
        inviteUnsubRef.current = onSnapshot(
          query(collection(db, 'projectInvites'), where('inviteeId', '==', user.uid)),
          (snapshot) => {
            const invites = snapshot.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((inv) => inv.status === 'pending')
            setInvites(invites)
          },
          (error) => console.error('[invites] 구독 오류:', error)
        )

        // FCM 토큰 등록 (알림 권한이 이미 granted인 경우 자동 등록)
        if (Notification.permission === 'granted') {
          requestNotificationPermission().then((token) => {
            if (token) {
              updateDoc(doc(db, 'users', user.uid), { fcmToken: token }).catch(() => {})
            }
          }).catch(() => {})
        }

        // 포그라운드 메시지 처리 (이전 리스너 해제 후 재등록)
        if (messaging) {
          if (onMessageUnsubRef.current) onMessageUnsubRef.current()
          onMessageUnsubRef.current = onMessage(messaging, (payload) => {
            const { title, body } = payload.notification || {}
            addNotification({ type: 'push', text: body || title || '새 알림이 있어요' })
          })
        }

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
                      text: `💬 ${senderName}님이 1:1 대화를 시작했어요`,
                      link: `/project/${room.projectId}/chat/${room.id}`,
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
        if (inviteUnsubRef.current) { inviteUnsubRef.current(); inviteUnsubRef.current = null }
        if (matchUnsubRef.current) { matchUnsubRef.current(); matchUnsubRef.current = null }
        if (onMessageUnsubRef.current) { onMessageUnsubRef.current(); onMessageUnsubRef.current = null }
        setMatchPostCount(0)
        // 채팅방 메시지 감시 구독도 해제 (permission 오류 방지)
        Object.values(msgWatchersRef.current).forEach((unsub) => unsub())
        msgWatchersRef.current = {}
        Object.values(dmMsgWatchersRef.current).forEach((unsub) => unsub())
        dmMsgWatchersRef.current = {}
        logout()
        setReady(true)
      }
    })

    return () => {
      unsub()
      if (projectsUnsubRef.current) projectsUnsubRef.current()
      if (dmUnsubRef.current) dmUnsubRef.current()
      if (notifUnsubRef.current) notifUnsubRef.current()
      if (inviteUnsubRef.current) inviteUnsubRef.current()
      if (matchUnsubRef.current) matchUnsubRef.current()
      if (onMessageUnsubRef.current) onMessageUnsubRef.current()
    }
  }, [login, logout, setProjects, createTutorialProject, setDmRoomList, addNotification, setInvites, setNeedsUsernameSetup])

  // 백그라운드 메시지 감시 — 열려있지 않은 채팅방에 새 메시지 오면 토스트
  useEffect(() => {
    if (!isLoggedIn) return
    const uid = useStore.getState().currentUser?.id
    if (!uid) return

    const MAX_WATCHED_ROOMS = 20
    const roomProjectMap = {}
    // lastMessageAt 기준 최근 활동한 방 우선 최대 20개만 감시
    const candidateRooms = []
    projects.forEach((project) => {
      ;(project.rooms || []).forEach((room) => {
        if (!room.isDm) {
          roomProjectMap[room.id] = { projectId: project.id, roomName: room.name }
          candidateRooms.push({ id: room.id, lastMessageAt: room.lastMessageAt || '' })
        }
      })
    })
    candidateRooms.sort((a, b) => (b.lastMessageAt > a.lastMessageAt ? 1 : -1))
    const allRoomIds = new Set(candidateRooms.slice(0, MAX_WATCHED_ROOMS).map((r) => r.id))

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
            incrementUnread(roomId)
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
  }, [projects, isLoggedIn, addChatToast, incrementUnread])

  // DM 룸 메시지 감시 — 1:1 DM 새 메시지 unread 카운트
  useEffect(() => {
    if (!isLoggedIn) return
    const uid = useStore.getState().currentUser?.id
    if (!uid) return

    const activeIds = new Set(dmRoomList.map((r) => r.id))

    // 없어진 DM 방 구독 해제
    Object.keys(dmMsgWatchersRef.current).forEach((roomId) => {
      if (!activeIds.has(roomId)) {
        dmMsgWatchersRef.current[roomId]()
        delete dmMsgWatchersRef.current[roomId]
      }
    })

    dmRoomList.forEach((room) => {
      if (dmMsgWatchersRef.current[room.id]) return
      const startTime = Timestamp.now()
      const unsub = onSnapshot(
        query(
          collection(db, 'rooms', room.id, 'messages'),
          orderBy('createdAt', 'asc'),
          startAfter(startTime)
        ),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type !== 'added') return
            const msg = { id: change.doc.id, ...change.doc.data() }
            const { currentUser } = useStore.getState()
            if (!currentUser || msg.senderId === currentUser.id) return
            if (msg.senderId === 'system' || msg.type === 'notify') return
            if (window.location.pathname.includes(`/chat/${room.id}`)) return
            incrementUnread(room.id)
            const preview = msg.type === 'image' ? '📷 사진'
              : msg.type === 'file' ? '📎 파일'
              : msg.type === 'poll' ? '📊 투표'
              : (msg.text || '').slice(0, 60)
            addChatToast({
              id: `ct_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              senderName: msg.senderName || '누군가',
              text: preview,
              roomId: room.id,
              projectId: room.projectId,
              roomName: msg.senderName || 'DM',
            })
          })
        },
        (error) => console.error(`[dm-toast] room ${room.id} 구독 오류:`, error)
      )
      dmMsgWatchersRef.current[room.id] = unsub
    })
  }, [dmRoomList, isLoggedIn, incrementUnread])

  return (
    <BrowserRouter>
      <AppRoutes ready={ready} isLoggedIn={isLoggedIn} />
    </BrowserRouter>
  )
}

function AppRoutes({ ready, isLoggedIn }) {
  const location = useLocation()
  return (
    <ErrorBoundary key={location.pathname}>
      <Suspense fallback={<Spinner size={36} label="불러오는 중..." />}>
        <Routes>
          <Route path="/u/:username" element={<PublicProfilePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/join/:code" element={<JoinPage />} />
          <Route path="/setup-username" element={<SetupUsernamePage />} />
          <Route path="/terms"        element={<LegalPage data={TERMS_DATA} />} />
          <Route path="/privacy"      element={<LegalPage data={PRIVACY_DATA} />} />
          <Route path="/guidelines"   element={<LegalPage data={GUIDELINES_DATA} />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          {/* 루트: 비로그인 → 랜딩, 로그인 → /home 리다이렉트 */}
          <Route path="/" element={
            !ready ? <Spinner /> : isLoggedIn ? <Navigate to="/home" replace /> : <LandingPage />
          } />

          {/* 인증된 레이아웃 (pathless) */}
          <Route element={<PrivateRoute ready={ready}><Layout /></PrivateRoute>}>
            <Route path="/admin"                           element={<AdminPage />} />
            <Route path="/home"                            element={<HomePage />} />
            <Route path="/project/:projectId"              element={<ProjectPage />} />
            <Route path="/project/:projectId/chat/:roomId" element={<ChatPage />} />
            <Route path="/project/:projectId/wrapup"       element={<WrapupPage />} />
            <Route path="/create"                          element={<CreateProjectPage />} />
            <Route path="/profile"                         element={<ProfilePage />} />
            <Route path="/connect"                         element={<ConnectPage />} />
            <Route path="/match"                           element={<MatchPage />} />
            <Route path="/calendar"                        element={<CalendarPage />} />
            <Route path="/messages"                        element={<MessagesPage />} />
            <Route path="/help"                            element={<HelpPage />} />
            <Route path="/pricing"                         element={<PricingPage />} />
            <Route path="/verify-student"                  element={<StudentVerifyPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
