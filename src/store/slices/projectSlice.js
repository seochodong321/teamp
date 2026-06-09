import {
  collection, doc, addDoc, setDoc, getDoc, updateDoc,
  arrayUnion, arrayRemove, writeBatch, serverTimestamp,
} from 'firebase/firestore'
import { differenceInDays, parseISO, isAfter } from 'date-fns'
import { db } from '../../firebase.js'
import { calcProgress, formatUnread, ROOM_COLORS, todayStr, txProject, makeTutorialProject, makeTutorialMessages, deleteProjectDeep, notifyUser } from '../helpers.js'

export const createProjectSlice = (set, get) => ({
  projects: [],
  roomOrders: {},
  mutedProjects: [],
  mutedDms: [],
  hiddenProjects: [],
  pinnedId: null,

  setProjects: (firestoreProjects) => {
    const { projects: local, currentUser, connects } = get()
    const merged = firestoreProjects.map(fp => {
      const lp = local.find(p => p.id === fp.id)
      if (!lp) return fp
      return {
        ...fp,
        rooms: fp.rooms.map(r => {
          const lr = lp.rooms?.find(lr => lr.id === r.id)
          return { ...r, unread: lr?.unread ?? 0 }
        }),
      }
    })

    set((s) => {
      const stateUpdate = { projects: merged }
      if (currentUser) {
        const existingIds = new Set(s.connects.map(c => c.id))
        const newConnects = []
        firestoreProjects.forEach(fp => {
          fp.members?.forEach(m => {
            if (m.id !== currentUser.id && !existingIds.has(m.id)) {
              existingIds.add(m.id)
              newConnects.push({
                id: m.id, name: m.name,
                affiliation: m.affiliation || '',
                email: m.email || '',
                projectName: fp.name,
                connectedAt: new Date().toISOString().split('T')[0],
              })
            }
          })
        })
        if (newConnects.length > 0) stateUpdate.connects = [...s.connects, ...newConnects]
      }
      return stateUpdate
    })
  },

  createTutorialProject: async (userId, userName) => {
    const { currentUser } = get()
    const myUsername = currentUser?.username || null
    const proj = makeTutorialProject(userId, userName, myUsername)
    const msgs = makeTutorialMessages(userId)
    const batch = writeBatch(db)
    batch.set(doc(db, 'projects', proj.id), proj)
    proj.rooms.forEach(room => {
      const roomMsgs = msgs[room.id] || []
      roomMsgs.forEach(msg => {
        const msgRef = doc(collection(db, 'rooms', room.id, 'messages'))
        batch.set(msgRef, { ...msg, createdAt: serverTimestamp() })
      })
    })
    await batch.commit()
    get().addNotification({
      type: 'welcome',
      title: '🎉 Teamp에 오신 걸 환영해요!',
      message: '둘러보면서 Teamp 사용방법을 익혀보세요',
      projectId: proj.id,
      link: `/project/${proj.id}`,
    })
  },

  getProgress: (project) => project.status === 'archived' ? 100 : calcProgress(
    project.projectStartDate || project.startDate,
    project.projectEndDate   || project.endDate,
  ),
  getDday: (endDate) => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const end = new Date(endDate + 'T00:00:00')
    const diff = Math.round((end - today) / 86400000)
    if (diff < 0) return '기한 초과'
    if (diff === 0) return 'D-day'
    return `D-${diff}`
  },
  isExpired: (endDate) => isAfter(new Date(), parseISO(endDate)),
  formatUnread,

  canManage: (project, userId) => {
    const me = project.members.find((m) => m.id === userId)
    return me?.role === 'leader'
  },

  getVisibleRooms: (project, userId) => {
    const me = project.members.find((m) => m.id === userId)
    if (!me) return []
    const visible = (me.role === 'leader' || me.role === 'sub-leader')
      ? project.rooms
      : project.rooms.filter((r) => (me.roomIds || []).includes(r.id))
    const filtered = visible.filter((r) => {
      if (!r.isDm) return true
      if (r.ownerId) return r.ownerId === userId
      return me.role === 'leader'
    })
    const order = get().roomOrders[project.id]
    if (!order) return filtered
    return [...filtered].sort((a, b) => {
      const ai = order.indexOf(a.id), bi = order.indexOf(b.id)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
  },

  reorderRooms: (projectId, newOrder) =>
    set((s) => ({ roomOrders: { ...s.roomOrders, [projectId]: newOrder } })),

  hideProject: (projectId) => set((s) => ({
    hiddenProjects: s.hiddenProjects.includes(projectId)
      ? s.hiddenProjects
      : [...s.hiddenProjects, projectId],
  })),

  toggleMuteProject: (projectId) => set((s) => ({
    mutedProjects: s.mutedProjects.includes(projectId)
      ? s.mutedProjects.filter((id) => id !== projectId)
      : [...s.mutedProjects, projectId],
  })),

  // 차단보다 약한 단계 — 특정 1:1 대화 알림만 끄기(메시지는 그대로 옴)
  toggleMuteDm: (roomId) => set((s) => ({
    mutedDms: s.mutedDms.includes(roomId)
      ? s.mutedDms.filter((id) => id !== roomId)
      : [...s.mutedDms, roomId],
  })),

  setPinnedId: (id) => set({ pinnedId: id }),

  createProject: async (data) => {
    const { currentUser } = get()
    const projectId = `proj_${Date.now()}`
    const rooms = [
      { id: `room_dm_${Date.now()}`,  name: '나와의 채팅', lastMessage: '나만 보는 메모 공간이에요', unread: 0, time: '', lastMessageAt: null, ...ROOM_COLORS[4], isDm: true, ownerId: currentUser.id },
      { id: `room_all_${Date.now()}`, name: '전체',        lastMessage: '채팅방이 생성됐어요',       unread: 0, time: '방금', lastMessageAt: new Date().toISOString(), ...ROOM_COLORS[0], isDm: false },
      ...data.roomNames.filter((n) => n && n.trim() && n !== '전체' && n !== '나와의 채팅').map((name, i) => ({
        id: `room_${Date.now()}_${i}`, name, lastMessage: '채팅방이 생성됐어요', unread: 0, time: '방금', lastMessageAt: new Date().toISOString(),
        ...ROOM_COLORS[(i + 1) % ROOM_COLORS.length], isDm: false,
      })),
    ]
    const pStart = data.projectStartDate || data.startDate || ''
    const pEnd   = data.projectEndDate   || data.endDate   || ''
    const postEnd = data.postEndDate || (pEnd ? (() => {
      const d = new Date(pEnd + 'T00:00:00'); d.setDate(d.getDate() + 14); return d.toISOString().split('T')[0]
    })() : '')
    const project = {
      id: projectId, inviteCode: projectId,
      name: data.name, emoji: data.emoji || '📁', purpose: data.purpose, category: data.category,
      startDate: pStart, endDate: pEnd,              // 하위 호환
      projectStartDate: pStart, projectEndDate: pEnd, postEndDate: postEnd,
      status: 'active', leaderId: currentUser.id,
      memberIds: [currentUser.id],
      members: [{
        id: currentUser.id, name: currentUser.name, role: 'leader',
        roomIds: rooms.map((r) => r.id), memo: '',
        affiliation: data.affiliation ?? currentUser.affiliation ?? '',
        email: currentUser.email || '',
        profileId: data.profileId || 'default',
      }],
      rooms, announcements: [], todos: [],
      events: [
        ...(pStart ? [{ id: `evt_start_${projectId}`, title: `${data.emoji || '📁'} ${data.name} 시작`, date: pStart, type: 'event', isSystem: true }] : []),
        ...(pEnd   ? [{ id: `evt_end_${projectId}`,   title: `${data.emoji || '📁'} ${data.name} 마감`, date: pEnd,   type: 'event', isSystem: true }] : []),
      ],
      isPublic: false,
    }
    await setDoc(doc(db, 'projects', projectId), project)
    return project
  },

  addRoom: async (projectId, roomName) => {
    const { projects } = get()
    const project = projects.find((p) => p.id === projectId)
    if (!project) return
    const colorIdx = project.rooms.filter((r) => !r.isDm).length % ROOM_COLORS.length
    const newRoom = {
      id: `room_${Date.now()}`, name: roomName.trim(),
      lastMessage: '채팅방이 생성됐어요', unread: 0, time: '방금', lastMessageAt: new Date().toISOString(),
      ...ROOM_COLORS[colorIdx], isDm: false,
    }
    await txProject(projectId, (data) => ({
      rooms: [...data.rooms, newRoom],
      members: data.members.map((m) =>
        (m.role === 'leader' || m.role === 'sub-leader')
          ? { ...m, roomIds: [...m.roomIds, newRoom.id] } : m
      ),
    }))
    return newRoom
  },

  updateMemberRole: async (projectId, memberId, role) => {
    await txProject(projectId, (data) => ({
      members: data.members.map((m) => {
        if (m.id !== memberId) return m
        const roomIds = (role === 'leader' || role === 'sub-leader') ? data.rooms.map((r) => r.id) : m.roomIds
        return { ...m, role, roomIds }
      }),
    }))
  },

  setMemberRooms: async (projectId, memberId, roomIds) => {
    await txProject(projectId, (data) => ({
      members: data.members.map((m) => m.id !== memberId ? m : { ...m, roomIds }),
    }))
  },

  toggleMemberRoom: async (projectId, memberId, roomId) => {
    await txProject(projectId, (data) => ({
      members: data.members.map((m) => {
        if (m.id !== memberId) return m
        const has = m.roomIds.includes(roomId)
        return { ...m, roomIds: has ? m.roomIds.filter((r) => r !== roomId) : [...m.roomIds, roomId] }
      }),
    }))
  },

  addCoLeader: async (projectId, memberId) => {
    const { currentUser } = get()
    const project = get().projects.find((p) => p.id === projectId)
    if (!project) return
    const myRole = project.members.find((m) => m.id === currentUser.id)?.role
    if (myRole !== 'leader') return
    await txProject(projectId, (data) => ({
      members: data.members.map((m) =>
        m.id === memberId
          ? { ...m, role: 'leader', roomIds: data.rooms.map((r) => r.id) }
          : m
      ),
    }))
  },

  updateMemberMemo: async (projectId, memberId, memo) => {
    await txProject(projectId, (data) => ({
      members: data.members.map((m) => m.id === memberId ? { ...m, memo } : m),
    }))
  },

  archiveProject: async (projectId) => {
    try {
      await updateDoc(doc(db, 'projects', projectId), { status: 'archived' })
    } catch (e) {
      get().showError('프로젝트 마감에 실패했어요.')
      throw e
    }
  },

  leaveOrDeleteProject: async (projectId) => {
    const { currentUser, projects } = get()
    const project = projects.find((p) => p.id === projectId)
    if (!project) return
    const me = project.members.find((m) => m.id === currentUser.id)
    const isLeader = me?.role === 'leader'
    const otherLeaders = project.members.filter((m) => m.id !== currentUser.id && m.role === 'leader')
    const otherMembers = project.members.filter((m) => m.id !== currentUser.id)

    if (isLeader && otherLeaders.length === 0 && otherMembers.length > 0) {
      return { error: '리더가 혼자면 나갈 수 없어요. 다른 멤버에게 공동리더 권한을 부여하거나 프로젝트를 마감하세요.' }
    }
    const isSoloDelete = isLeader && otherMembers.length === 0
    // 낙관적 업데이트 — 완전 삭제 케이스에만 적용 (나가기는 onSnapshot이 자동 드롭)
    if (isSoloDelete) {
      set((s) => ({ projects: s.projects.filter((p) => p.id !== projectId) }))
    }
    try {
      if (isSoloDelete) {
        await deleteProjectDeep(project)  // 메시지·파일까지 완전 삭제
      } else {
        await updateDoc(doc(db, 'projects', projectId), {
          memberIds: arrayRemove(currentUser.id),
          members: arrayRemove(me),
          // 함께한 기록 보존 — 나가도 formerMembers에 남겨 랩업·명단에 유지
          formerMembers: arrayUnion({ id: me.id, name: me.name, role: me.role, affiliation: me.affiliation || '', leftAt: new Date().toISOString(), leftReason: 'left' }),
        })
      }
    } catch (e) {
      // 실패 시 원래 위치에 복원 (순서 유지)
      if (isSoloDelete) {
        const idx = projects.findIndex((p) => p.id === projectId)
        set((s) => {
          const next = [...s.projects]
          next.splice(idx >= 0 ? idx : next.length, 0, project)
          return { projects: next }
        })
      }
      get().showError('프로젝트에서 나가지 못했어요.')
      throw e
    }
  },

  extendProject: async (projectId, newEndDate) => {
    try {
      await updateDoc(doc(db, 'projects', projectId), { endDate: newEndDate })
    } catch (e) {
      get().showError('기간 연장에 실패했어요.')
      throw e
    }
  },

  updateProjectInfo: async (projectId, updates) => {
    const prev = get().projects.find((p) => p.id === projectId)
    set((s) => ({
      projects: s.projects.map((p) => p.id === projectId ? { ...p, ...updates } : p),
    }))
    try {
      await updateDoc(doc(db, 'projects', projectId), updates)
    } catch (e) {
      if (prev) set((s) => ({ projects: s.projects.map((p) => p.id === projectId ? prev : p) }))
      throw e
    }
  },

  togglePublic: async (projectId) => {
    await txProject(projectId, (data) => ({ isPublic: !data.isPublic }))
  },

  kickMember: async (projectId, memberId) => {
    const proj = get().projects.find((p) => p.id === projectId)
    const projectName = proj?.name || '프로젝트'
    const wasMember = (proj?.members || []).some((m) => m.id === memberId)
    await txProject(projectId, (data) => {
      const leaving = (data.members || []).find((m) => m.id === memberId)
      if (!leaving) return {}
      // 함께한 기록 보존 — members에서 빼되 formerMembers에 남겨 랩업·명단에 유지
      const former = (data.formerMembers || []).filter((m) => m.id !== memberId)
      former.push({ id: leaving.id, name: leaving.name, role: leaving.role, affiliation: leaving.affiliation || '', leftAt: new Date().toISOString(), leftReason: 'removed' })
      return {
        members: data.members.filter((m) => m.id !== memberId),
        memberIds: (data.memberIds || []).filter((id) => id !== memberId),
        formerMembers: former,
      }
    })
    // 조용히 사라지지 않게 — 당사자에게 1회 담담한 안내(평가 아님)
    if (wasMember) {
      await notifyUser(memberId, {
        type: 'system',
        text: `🍃 "${projectName}" 프로젝트에서 나가게 되었어요`,
        link: '/home',
      })
    }
  },

  addMemberToProject: async (projectId, userId, userName) => {
    const project = get().projects.find((p) => p.id === projectId)
    if (!project) return { success: false }
    if (project.members.find((m) => m.id === userId)) return { success: false, message: '이미 멤버예요' }
    const allRoomId    = project.rooms.find((r) => r.name === '전체')?.id
    const personalDmId = `room_dm_${projectId}_${userId}`
    const alreadyHasDm = project.rooms.find((r) => r.id === personalDmId)
    const personalDm   = alreadyHasDm ? null : { id: personalDmId, name: '나와의 채팅', isDm: true, ownerId: userId, lastMessage: '나만 보는 메모 공간이에요', unread: 0, time: '', ...ROOM_COLORS[4] }
    const newMember    = { id: userId, name: userName, role: 'member', roomIds: [personalDmId, allRoomId].filter(Boolean), memo: '', affiliation: '', email: '' }
    const addPayload   = { members: arrayUnion(newMember), memberIds: arrayUnion(userId) }
    if (personalDm) addPayload.rooms = arrayUnion(personalDm)
    await updateDoc(doc(db, 'projects', projectId), addPayload)
    if (allRoomId) {
      await addDoc(collection(db, 'rooms', allRoomId, 'messages'), {
        senderId: 'teampbot', senderName: '팀프봇', type: 'notify',
        text: `👋 ${userName}님이 팀에 합류했어요! 함께 해서 반가워요.`,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        createdAt: serverTimestamp(),
      })
    }
    return { success: true }
  },

  checkAndArchive: async (projectId) => {
    const project = get().projects.find((p) => p.id === projectId)
    if (!project || project.status !== 'collecting') return
    if (!project.feedbackDeadline) return
    if (new Date() > new Date(project.feedbackDeadline)) {
      await updateDoc(doc(db, 'projects', projectId), { status: 'archived' })
    }
  },

  setCoverImage: async (projectId, coverValue) => {
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId ? { ...p, coverImage: coverValue } : p
      ),
    }))
    await updateDoc(doc(db, 'projects', projectId), { coverImage: coverValue || null })
  },
})
