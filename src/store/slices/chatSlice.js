import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, arrayRemove,
  serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../firebase.js'
import { txProject, txMessage, notifyUser } from '../helpers.js'

export const createChatSlice = (set, get) => ({
  messages: {},
  dmRooms: {},
  dmRoomList: [],
  dmUnreadCounts: {},

  setRoomMessages: (roomId, msgs) =>
    set((s) => ({ messages: { ...s.messages, [roomId]: msgs } })),

  setDmRoomList: (rooms) => set({ dmRoomList: rooms }),

  sendMessage: async (roomId, text, type = 'text') => {
    const { currentUser, projects } = get()
    const msgRef = doc(collection(db, 'rooms', roomId, 'messages'))
    const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    const project = projects.find(p => p.rooms.some(r => r.id === roomId))

    await setDoc(msgRef, {
      id: msgRef.id,
      senderId: currentUser.id, senderName: currentUser.name,
      type, text, time: timeStr,
      projectId: project?.id || null,   // Cloud Function 푸시 발송용 (프로젝트 방 멤버 해석)
      readBy: [currentUser.id],
      createdAt: serverTimestamp(),
    })

    if (project) {
      const lastText = type === 'image' ? '📷 사진'
        : type === 'file' ? '📎 파일'
        : type === 'poll' ? '📊 투표'
        : text
      try {
        await txProject(project.id, (data) => ({
          rooms: data.rooms.map(r => r.id === roomId
            ? { ...r, lastMessage: `${currentUser.name}: ${lastText}`, time: '방금', lastMessageAt: new Date().toISOString() }
            : r),
        }))
      } catch (e) {
        console.error('[sendMessage] lastMessage 업데이트 실패:', e)
      }
    }

    // DM: 상대가 나갔던 방이면 카톡식으로 되살림 — 상대 목록에 다시 띄우고 새 메시지 알림.
    // (상대 clearedAt 워터마크는 유지돼 상대는 이 새 메시지부터만 보임)
    if (!project) {
      const dm = get().dmRoomList.find((r) => r.id === roomId)
        || Object.values(get().dmRooms).find((r) => r.id === roomId)
      const otherId = dm?.isDirect && (dm.participants || []).find((id) => id !== currentUser.id)
      if (otherId && (dm.left || []).includes(otherId)) {
        try {
          await updateDoc(doc(db, 'dmRooms', roomId), { left: arrayRemove(otherId) })
          await notifyUser(otherId, {
            type: 'dm',
            text: `💬 ${currentUser.name}님이 메시지를 보냈어요`,
            link: `/project/${dm.projectId}/chat/${roomId}`,
          })
        } catch (e) {
          console.error('[DM] 상대 재노출 실패:', e)
        }
      }
    }
  },

  sendFile: async (roomId, file) => {
    const { currentUser, projects } = get()
    const isImage = file.type?.startsWith('image/')
    let fileUrl = null
    if (isImage) {
      const sRef = storageRef(storage, `chat/${roomId}/${Date.now()}_${file.name}`)
      await uploadBytes(sRef, file)
      fileUrl = await getDownloadURL(sRef)
    }
    const project = projects.find(p => p.rooms.some(r => r.id === roomId))
    const msgRef = doc(collection(db, 'rooms', roomId, 'messages'))
    await setDoc(msgRef, {
      id: msgRef.id,
      senderId: currentUser.id, senderName: currentUser.name,
      type: isImage ? 'image' : 'file',
      text: file.name,
      fileUrl: fileUrl || null,
      projectId: project?.id || null,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      readBy: [currentUser.id],
      createdAt: serverTimestamp(),
    })
  },

  sendPoll: async (roomId, question, options) => {
    const { currentUser, projects } = get()
    const project = projects.find(p => p.rooms.some(r => r.id === roomId))
    const msgRef = doc(collection(db, 'rooms', roomId, 'messages'))
    await setDoc(msgRef, {
      id: msgRef.id,
      senderId: currentUser.id, senderName: currentUser.name,
      type: 'poll', text: question,
      options: options.map((o, i) => ({ id: i, label: o, votes: [] })),
      projectId: project?.id || null,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      createdAt: serverTimestamp(),
    })
  },

  votePoll: async (roomId, msgId, optionId) => {
    const { currentUser, showError } = get()
    const prevMessages = get().messages
    set((s) => ({
      messages: {
        ...s.messages,
        [roomId]: s.messages[roomId]?.map(m => {
          if (m.id !== msgId) return m
          const alreadyVoted = m.options.find(o => o.id === optionId)?.votes.includes(currentUser.id)
          return {
            ...m,
            options: m.options.map(o => {
              if (o.id === optionId)
                return { ...o, votes: alreadyVoted ? o.votes.filter(v => v !== currentUser.id) : [...o.votes, currentUser.id] }
              return { ...o, votes: o.votes.filter(v => v !== currentUser.id) }
            }),
          }
        }),
      },
    }))
    try {
      await txMessage(roomId, msgId, (data) => {
        const alreadyVoted = data.options.find(o => o.id === optionId)?.votes.includes(currentUser.id)
        return {
          options: data.options.map(o => {
            if (o.id === optionId)
              return { ...o, votes: alreadyVoted ? o.votes.filter(v => v !== currentUser.id) : [...o.votes, currentUser.id] }
            return { ...o, votes: o.votes.filter(v => v !== currentUser.id) }
          }),
        }
      })
    } catch (e) {
      set({ messages: prevMessages })
      showError('투표 저장에 실패했어요.')
      console.error('[votePoll]', e)
    }
  },

  markAsRead: (roomId) =>
    set((s) => ({
      projects: s.projects.map((p) => ({
        ...p, rooms: p.rooms.map((r) => r.id === roomId ? { ...r, unread: 0 } : r),
      })),
      dmUnreadCounts: { ...s.dmUnreadCounts, [roomId]: 0 },
    })),

  incrementUnread: (roomId) =>
    set((s) => {
      const isProjectRoom = s.projects.some((p) => p.rooms.some((r) => r.id === roomId))
      if (isProjectRoom) {
        return {
          projects: s.projects.map((p) => ({
            ...p,
            rooms: p.rooms.map((r) =>
              r.id === roomId ? { ...r, unread: (r.unread || 0) + 1 } : r
            ),
          })),
        }
      }
      return {
        dmUnreadCounts: { ...s.dmUnreadCounts, [roomId]: (s.dmUnreadCounts[roomId] || 0) + 1 },
      }
    }),

  getOrCreateDmRoom: async (projectId, otherUserId, otherUserName) => {
    const { currentUser } = get()
    const dmKey  = [currentUser.id, otherUserId].sort().join('_')
    const roomId = `dm_${dmKey}`
    const dmRef  = doc(db, 'dmRooms', roomId)

    // getDoc: 문서가 없을 때 rules에서 permission denied가 날 수 있음 → 폴백으로 생성
    let dmSnap = null
    try {
      dmSnap = await getDoc(dmRef)
    } catch (e) {
      console.warn('[DM] getDoc 실패 — 신규 생성 시도:', e.code)
    }

    if (dmSnap?.exists()) {
      const data  = { id: roomId, ...dmSnap.data() }
      const iLeft = (data.left || []).includes(currentUser.id)

      if (iLeft) {
        // 내가 나갔던 방을 내가 다시 엶 → 나만 목록에 되살림(clearedAt 워터마크는 유지해
        // 나간 시점 이후 메시지만 보이게). 공유 메시지·상대 화면은 그대로. 알림 없음.
        try {
          await updateDoc(dmRef, { left: arrayRemove(currentUser.id) })
        } catch (e) {
          console.error('[DM] 재개 오류:', e)
        }
        const revived = { ...data, left: (data.left || []).filter((id) => id !== currentUser.id) }
        set((s) => ({ dmRooms: { ...s.dmRooms, [dmKey]: revived } }))
        return revived
      }

      // 기존 방 — 메시지·상태 그대로 유지
      set((s) => ({ dmRooms: { ...s.dmRooms, [dmKey]: data } }))
      return data
    }

    // 방 없음 — 신규 생성
    const newRoom = {
      id: roomId, dmKey, projectId,
      participants: [currentUser.id, otherUserId],
      participantNames: { [currentUser.id]: currentUser.name, [otherUserId]: otherUserName },
      isDirect: true, createdBy: currentUser.id,
      left: [], lastMessage: '',
    }
    try {
      await setDoc(dmRef, { ...newRoom, createdAt: serverTimestamp() })
    } catch (e) {
      console.error('[DM] 방 생성 오류:', e)
      throw e
    }
    notifyUser(otherUserId, {
      type: 'dm',
      text: `💬 ${currentUser.name}님이 1:1 대화를 시작했어요`,
      link: `/project/${projectId}/chat/${roomId}`,
    })
    set((s) => ({
      dmRooms:  { ...s.dmRooms,  [dmKey]: newRoom },
      messages: { ...s.messages, [roomId]: [] },
    }))
    return newRoom
  },

  // 카톡식 1:1 나가기 — 나간 사람만 목록에서 숨기고, 이 시점 이후 메시지만 보이도록
  // clearedAt 워터마크를 남긴다. 공유 메시지·상대 화면은 그대로. 시스템 메시지·알림 없음.
  leaveDmRoom: async (roomId) => {
    const { currentUser } = get()
    const dmRef  = doc(db, 'dmRooms', roomId)
    const dmSnap = await getDoc(dmRef)
    if (dmSnap.exists()) {
      const dmData  = dmSnap.data()
      const newLeft = [...new Set([...(dmData.left || []), currentUser.id])]
      if (newLeft.length >= (dmData.participants || []).length) {
        // 둘 다 나감 → 메시지는 정리하고 방 문서는 left로 닫아 둔다.
        // (firestore.rules상 dmRooms delete 불가 + 양쪽 목록에서 이미 숨겨짐)
        const batch = writeBatch(db)
        const allMsgsSnap = await getDocs(collection(db, 'rooms', roomId, 'messages'))
        allMsgsSnap.docs.forEach((d) => batch.delete(d.ref))
        batch.update(dmRef, { left: newLeft })
        await batch.commit()
      } else {
        await updateDoc(dmRef, {
          left: newLeft,
          [`clearedAt.${currentUser.id}`]: serverTimestamp(),
        })
      }
    }
    set((s) => {
      const newDmRooms = { ...s.dmRooms }
      const key = Object.keys(newDmRooms).find((k) => newDmRooms[k].id === roomId)
      if (key) delete newDmRooms[key]
      return { dmRooms: newDmRooms }
    })
  },

})
