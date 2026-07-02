import { useEffect, useRef } from 'react'
import { Timestamp, collection, onSnapshot, orderBy, query, startAfter } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useStore } from '../store/useStore.js'

// 백그라운드 메시지 감시 훅 — 열려있지 않은 채팅방/DM에 새 메시지가 오면
// 토스트 + 안읽음 카운트. 프로젝트 방은 최근 활동 순 최대 20개만 감시(읽기비용 상한).
// 반환하는 watcher refs는 useSession이 로그아웃 시 함께 해제한다(권한 오류 방지).
export function useChatToastWatchers() {
  const isLoggedIn  = useStore((s) => s.isLoggedIn)
  const projects    = useStore((s) => s.projects)
  const dmRoomList  = useStore((s) => s.dmRoomList)
  const addChatToast    = useStore((s) => s.addChatToast)
  const incrementUnread = useStore((s) => s.incrementUnread)
  const msgWatchersRef    = useRef({}) // roomId → unsub
  const dmMsgWatchersRef  = useRef({}) // dmRoomId → unsub

  // 프로젝트 방 감시 — 열려있지 않은 채팅방에 새 메시지 오면 토스트
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
              : msg.type === 'poll' ? '📊 투표'
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
            if ((useStore.getState().mutedDms || []).includes(room.id)) return  // 음소거된 DM
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

  return { msgWatchersRef, dmMsgWatchersRef }
}
