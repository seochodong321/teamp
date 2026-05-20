import { collection, doc, addDoc, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { txProject, todayStr } from '../helpers.js'

export const createTaskSlice = (set, get) => ({
  addAnnouncement: async (projectId, { title, content, isGlobal, fileName }) => {
    const { currentUser } = get()
    const ann = {
      id: `ann_${Date.now()}`, authorId: currentUser.id, author: currentUser.name,
      title, content, isGlobal, fileName: fileName || null, createdAt: todayStr(),
    }

    if (isGlobal) {
      const project = get().projects.find((p) => p.id === projectId)
      if (project) {
        const batch = writeBatch(db)
        const notifyMsg = {
          senderId: 'system', senderName: '📢 공지', type: 'notify',
          text: `[공지] ${title}`,
          time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          createdAt: serverTimestamp(),
        }
        project.rooms.filter((r) => !r.isDm).forEach((r) => {
          const msgRef = doc(collection(db, 'rooms', r.id, 'messages'))
          batch.set(msgRef, { ...notifyMsg, id: msgRef.id })
        })
        await batch.commit()
      }
    }

    await txProject(projectId, (data) => ({
      announcements: [ann, ...(data.announcements || [])],
      lastActivityAt: new Date().toISOString(),
    }))
  },

  deleteAnnouncement: async (projectId, annId) => {
    const { currentUser, projects } = get()
    const project = projects.find((p) => p.id === projectId)
    const ann = project?.announcements.find((a) => a.id === annId)
    if (!ann) return
    const me = project.members.find((m) => m.id === currentUser.id)
    if (ann.authorId !== currentUser.id && me?.role !== 'leader') return
    await txProject(projectId, (data) => ({
      announcements: data.announcements.filter((a) => a.id !== annId),
    }))
  },

  addTodo: async (projectId, { title, description = '', assignees = [], dueDate, priority }) => {
    const { currentUser } = get()
    const todo = {
      id: `todo_${Date.now()}`,
      title, description: description.trim(), assignees, dueDate: dueDate || null,
      priority: priority || 'medium', status: 'todo',
      createdBy: currentUser.id, createdAt: todayStr(),
    }

    const otherAssignees = assignees.filter((id) => id !== currentUser.id)
    if (otherAssignees.length > 0) {
      const project = get().projects.find((p) => p.id === projectId)
      const allRoom = project?.rooms.find((r) => r.name === '전체')
      const names = otherAssignees.map((id) => project?.members.find((m) => m.id === id)?.name).filter(Boolean)
      if (names.length > 0 && allRoom) {
        await addDoc(collection(db, 'rooms', allRoom.id, 'messages'), {
          senderId: 'system', senderName: '✅ 할 일 알림', type: 'notify',
          text: `${names.join(', ')} 님에게 할 일이 배정됐어요: "${title}"`,
          time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          createdAt: serverTimestamp(),
        })
      }
      for (const targetUserId of otherAssignees) {
        await addDoc(collection(db, 'notifications'), {
          targetUserId,
          type: 'todo',
          text: `"${title}" 할 일이 배정됐어요`,
          projectId,
          projectName: project?.name || '',
          link: `/project/${projectId}?tab=todo`,
          read: false,
          createdAt: serverTimestamp(),
        })
      }
    }

    await txProject(projectId, (data) => ({
      todos: [...(data.todos || []), todo],
      lastActivityAt: new Date().toISOString(),
    }))
  },

  updateTodo: async (projectId, todoId, updates) => {
    const { currentUser, projects, showError } = get()
    const project = projects.find((p) => p.id === projectId)
    const todo = project?.todos?.find((t) => t.id === todoId)
    if (!todo) return
    const me = project.members.find((m) => m.id === currentUser.id)
    const isLeaderOrSub = me?.role === 'leader' || me?.role === 'sub-leader'
    const isAssignee = todo.assignees?.includes(currentUser.id) || todo.assignee === currentUser.id
    if (todo.createdBy !== currentUser.id && !isAssignee && !isLeaderOrSub) return

    // 낙관적 업데이트 — 이전 상태 저장 후 선 반영
    const prevProjects = get().projects
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id !== projectId ? p : {
          ...p, todos: p.todos.map((t) => t.id === todoId ? { ...t, ...updates } : t),
        }
      ),
    }))
    try {
      await txProject(projectId, (data) => ({
        todos: data.todos.map((t) => t.id === todoId ? { ...t, ...updates } : t),
      }))
    } catch (e) {
      set({ projects: prevProjects })
      showError('할 일 저장에 실패했어요. 다시 시도해주세요.')
      console.error('[updateTodo]', e)
    }
  },

  deleteTodo: async (projectId, todoId) => {
    const { currentUser, projects } = get()
    const project = projects.find((p) => p.id === projectId)
    const todo = project?.todos?.find((t) => t.id === todoId)
    if (!todo) return
    const me = project.members.find((m) => m.id === currentUser.id)
    if (todo.createdBy !== currentUser.id && me?.role !== 'leader') return
    await txProject(projectId, (data) => ({
      todos: data.todos.filter((t) => t.id !== todoId),
    }))
  },

  addEvent: async (projectId, { title, date, time, scope, roomIds, isPersonal }) => {
    const { currentUser } = get()
    const project = get().projects.find((p) => p.id === projectId)
    const ev = {
      id: `ev_${Date.now()}`, title, date, time, createdBy: currentUser.id,
      scope, roomIds: roomIds || [], isPersonal: isPersonal || false,
    }

    if (!isPersonal && project) {
      const batch = writeBatch(db)
      const notifyMsg = {
        senderId: 'system', senderName: '📅 일정 알림', type: 'notify',
        text: `[${title}] ${date} ${time}에 일정이 있어요`,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        createdAt: serverTimestamp(),
      }
      const targetRooms = scope === 'all'
        ? project.rooms.filter((r) => !r.isDm).map((r) => r.id)
        : roomIds
      targetRooms.forEach((rId) => {
        const msgRef = doc(collection(db, 'rooms', rId, 'messages'))
        batch.set(msgRef, { ...notifyMsg, id: msgRef.id })
      })
      await batch.commit()
    }

    await txProject(projectId, (data) => ({
      events: [...(data.events || []), ev].sort((a, b) => a.date.localeCompare(b.date)),
      lastActivityAt: new Date().toISOString(),
    }))
  },

  removeEvent: async (projectId, eventId) => {
    const { currentUser, projects } = get()
    const project = projects.find((p) => p.id === projectId)
    const ev = project?.events.find((e) => e.id === eventId)
    if (!ev) return
    const me = project.members.find((m) => m.id === currentUser.id)
    if (ev.createdBy !== currentUser.id && me?.role !== 'leader' && me?.role !== 'sub-leader') return
    await txProject(projectId, (data) => ({
      events: data.events.filter((e) => e.id !== eventId),
    }))
  },

  addMilestone: async (projectId, { title, description, targetDate }) => {
    const { currentUser } = get()
    const now = new Date().toISOString()
    const ms = {
      id: `ms_${Date.now()}`,
      title, description: description || '', targetDate: targetDate || '',
      status: 'pending', completedAt: null, createdAt: now, createdBy: currentUser.id,
      history: [{ action: 'created', at: now, by: currentUser.id, byName: currentUser.name, note: '' }],
    }
    await txProject(projectId, (data) => ({
      milestones: [...(data.milestones || []), ms],
      lastActivityAt: new Date().toISOString(),
    }))
  },

  updateMilestone: async (projectId, milestoneId, { action, note, ...changes }) => {
    const { currentUser } = get()
    const now = new Date().toISOString()
    const entry = { action: action || 'modified', at: now, by: currentUser.id, byName: currentUser.name, note: note || '' }
    await txProject(projectId, (data) => ({
      milestones: (data.milestones || []).map((m) =>
        m.id !== milestoneId ? m : { ...m, ...changes, history: [...(m.history || []), entry] }
      ),
    }))
  },

  deleteMilestone: async (projectId, milestoneId) => {
    await txProject(projectId, (data) => ({
      milestones: (data.milestones || []).filter((m) => m.id !== milestoneId),
    }))
  },
})
