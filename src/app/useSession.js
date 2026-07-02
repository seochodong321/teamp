import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, doc, getCountFromServer, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { auth, db, messaging, requestNotificationPermission, onMessage } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import { loadPrivateFields } from '../store/helpers.js'
import { BANNED_MESSAGE } from '../constants.js'
import { checkBirthdays } from '../services/birthdays.js'

// 세션 수명주기 훅 — 인증 부트스트랩 + 세션 스코프 실시간 구독을 한 곳에서 관리.
//   로그인: 프로필 로드(정지계정 차단) → projects·notifications·invites·dmRooms 구독,
//           매치 배지 1회 집계, FCM 토큰 등록, 포그라운드 푸시 리스너.
//   로그아웃: 위 구독 전부 해제 + 스토어 초기화.
// msgWatchersRef/dmMsgWatchersRef는 useChatToastWatchers 소유지만, 로그아웃 시
// 여기서 함께 해제해야 권한 오류(구독 살아있는 채 인증 상실)가 없다 — 명시적 주입.
export function useSession({ msgWatchersRef, dmMsgWatchersRef }) {
  const { login, logout, setProjects, createTutorialProject, setDmRoomList, addNotification, addChatToast, setInvites, setNeedsUsernameSetup, setMatchPostCount } = useStore()
  const [ready, setReady] = useState(false)
  const projectsUnsubRef  = useRef(null)
  const dmUnsubRef        = useRef(null)
  const notifUnsubRef     = useRef(null)
  const inviteUnsubRef    = useRef(null)
  const matchUnsubRef     = useRef(null)
  const onMessageUnsubRef = useRef(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // 1. Firebase Auth 복원 즉시 기본 정보로 로그인 → UI 즉시 표시
        login(user.displayName || '사용자', user.email, user.uid)
        setReady(true)

        // 2. Firestore 프로필 백그라운드 로드 (UI 블로킹 없음)
        getDoc(doc(db, 'users', user.uid)).then(async (snap) => {
          if (snap.exists()) {
            const d = snap.data()
            // 어드민이 정지(banned)한 계정 — 즉시 로그아웃해 접근 차단
            if (d.banned) {
              signOut(auth).catch(() => {})
              logout()
              window.alert(BANNED_MESSAGE)
              return
            }
            // 민감 PII(phone·blockedUsers)는 본인전용 서브문서에서 병합 (없으면 본문서 값 — 마이그레이션 전 호환)
            const priv = await loadPrivateFields(user.uid)
            login(d.name || user.displayName || '사용자', d.email || user.email, user.uid, { ...d, ...priv })
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
        if (matchUnsubRef.current) { matchUnsubRef.current(); matchUnsubRef.current = null }

        // 팀프 매치 오픈 게시글 수 — 배지("새 글 있음")용 카운트.
        // 모든 유저가 모든 open 글을 실시간 구독하던 것(읽기비용 폭증) → 1회 집계로 대체.
        // 배지는 "마지막으로 본 이후 새 글 있나"라 실시간일 필요 없음(로드/로그인 시 갱신).
        getCountFromServer(query(collection(db, 'matchPosts'), where('status', '==', 'open')))
          .then((snap) => setMatchPostCount(snap.data().count))
          .catch(() => {})

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
        // typeof 가드: iOS Safari·일부 WebView엔 Notification API가 없음(ReferenceError 방지)
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
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

  return ready
}
