import {
  collection, doc, addDoc, getDoc, getDocs, setDoc, query, where,
  serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../firebase.js'
import { txProject, txMessage } from '../helpers.js'

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

    await setDoc(msgRef, {
      id: msgRef.id,
      senderId: currentUser.id, senderName: currentUser.name,
      type, text, time: timeStr,
      readBy: [currentUser.id],
      createdAt: serverTimestamp(),
    })

    const project = projects.find(p => p.rooms.some(r => r.id === roomId))
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
  },

  sendFile: async (roomId, file) => {
    const { currentUser } = get()
    const isImage = file.type?.startsWith('image/')
    let fileUrl = null
    if (isImage) {
      const sRef = storageRef(storage, `chat/${roomId}/${Date.now()}_${file.name}`)
      await uploadBytes(sRef, file)
      fileUrl = await getDownloadURL(sRef)
    }
    const msgRef = doc(collection(db, 'rooms', roomId, 'messages'))
    await setDoc(msgRef, {
      id: msgRef.id,
      senderId: currentUser.id, senderName: currentUser.name,
      type: isImage ? 'image' : 'file',
      text: file.name,
      fileUrl: fileUrl || null,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      readBy: [currentUser.id],
      createdAt: serverTimestamp(),
    })
  },

  sendPoll: async (roomId, question, options) => {
    const { currentUser } = get()
    const msgRef = doc(collection(db, 'rooms', roomId, 'messages'))
    await setDoc(msgRef, {
      id: msgRef.id,
      senderId: currentUser.id, senderName: currentUser.name,
      type: 'poll', text: question,
      options: options.map((o, i) => ({ id: i, label: o, votes: [] })),
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

    const dmSnap = await getDoc(dmRef)

    if (dmSnap.exists()) {
      const data    = { id: roomId, ...dmSnap.data() }
      const leftArr = data.left || []
      const hadLeft = leftArr.length > 0

      try {
        const msgsRef     = collection(db, 'rooms', roomId, 'messages')
        const allMsgsSnap = await getDocs(msgsRef)
        const batch       = writeBatch(db)
        allMsgsSnap.docs.forEach((d) => batch.delete(d.ref))
        batch.update(dmRef, { left: [], createdBy: currentUser.id })
        await batch.commit()
      } catch (e) {
        console.error('[DM] 메시지 초기화 오류:', e)
      }

      if (hadLeft) {
        addDoc(collection(db, 'notifications'), {
          targetUserId: otherUserId, type: 'dm',
          text: `💬 ${currentUser.name}님이 대화를 다시 시작했어요`,
          link: `/project/${projectId}/chat/${roomId}`,
          read: false, createdAt: serverTimestamp(),
        }).catch(() => {})
      }

      const freshRoom = { ...data, left: [], createdBy: currentUser.id }
      set((s) => ({
        dmRooms:  { ...s.dmRooms,  [dmKey]: freshRoom },
        messages: { ...s.messages, [roomId]: [] },
      }))
      return freshRoom
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
    addDoc(collection(db, 'notifications'), {
      targetUserId: otherUserId, type: 'dm',
      text: `💬 ${currentUser.name}님이 1:1 대화를 시작했어요`,
      link: `/project/${projectId}/chat/${roomId}`,
      read: false, createdAt: serverTimestamp(),
    }).catch(() => {})
    set((s) => ({
      dmRooms:  { ...s.dmRooms,  [dmKey]: newRoom },
      messages: { ...s.messages, [roomId]: [] },
    }))
    return newRoom
  },

  leaveDmRoom: async (roomId) => {
    const { currentUser } = get()
    const msgsRef = collection(db, 'rooms', roomId, 'messages')

    const myMsgsSnap = await getDocs(query(msgsRef, where('senderId', '==', currentUser.id)))
    const batch = writeBatch(db)
    myMsgsSnap.docs.forEach((d) => batch.delete(d.ref))
    const sysRef = doc(collection(db, 'rooms', roomId, 'messages'))
    batch.set(sysRef, {
      senderId: 'system', type: 'notify',
      text: `${currentUser.name}님이 퇴장하셨습니다`,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      createdAt: serverTimestamp(),
    })

    const dmRef  = doc(db, 'dmRooms', roomId)
    const dmSnap = await getDoc(dmRef)
    if (dmSnap.exists()) {
      const dmData = dmSnap.data()
      const newLeft = [...new Set([...(dmData.left || []), currentUser.id])]
      if (newLeft.length >= (dmData.participants || []).length) {
        const allMsgsSnap = await getDocs(msgsRef)
        allMsgsSnap.docs.forEach((d) => batch.delete(d.ref))
        batch.delete(dmRef)
      } else {
        batch.update(dmRef, { left: newLeft })
      }
    }
    await batch.commit()

    set((s) => {
      const newDmRooms = { ...s.dmRooms }
      const key = Object.keys(newDmRooms).find((k) => newDmRooms[k].id === roomId)
      if (key) delete newDmRooms[key]
      return { dmRooms: newDmRooms }
    })
  },

  reinviteToDm: async (roomId) => {
    const { currentUser } = get()
    const dmRef  = doc(db, 'dmRooms', roomId)
    const dmSnap = await getDoc(dmRef)
    if (!dmSnap.exists()) return null
    const data = dmSnap.data()
    const otherUserId = (data.participants || []).find((id) => id !== currentUser.id)
    const dmKey = data.dmKey

    const msgsRef     = collection(db, 'rooms', roomId, 'messages')
    const allMsgsSnap = await getDocs(msgsRef)
    const batch = writeBatch(db)
    allMsgsSnap.docs.forEach((d) => batch.delete(d.ref))
    batch.update(dmRef, { left: [] })

    const notiRef = doc(collection(db, 'notifications'))
    batch.set(notiRef, {
      targetUserId: otherUserId,
      type: 'dm',
      text: `💬 ${currentUser.name}님이 대화를 다시 시작했어요`,
      link: `/project/${data.projectId}/chat/${roomId}`,
      read: false,
      createdAt: serverTimestamp(),
    })
    await batch.commit()

    set((s) => {
      const newDmRooms = { ...s.dmRooms }
      const key = dmKey || Object.keys(newDmRooms).find((k) => newDmRooms[k].id === roomId)
      if (key && newDmRooms[key]) newDmRooms[key] = { ...newDmRooms[key], left: [] }
      return { dmRooms: newDmRooms, messages: { ...s.messages, [roomId]: [] } }
    })
    return { id: roomId, ...data, left: [] }
  },
})
