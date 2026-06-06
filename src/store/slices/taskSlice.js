import { collection, doc, addDoc, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { txProject, todayStr, notifyUser } from '../helpers.js'

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
        // 멤버에게 푸시 알림 (작성자 제외) — Cloud Function이 발송
        project.members.filter((m) => m.id !== currentUser.id).forEach((m) => {
          batch.set(doc(collection(db, 'notifications')), {
            targetUserId: m.id, type: 'announcement',
            text: `📢 새 공지: ${title}`,
            link: `/project/${projectId}?tab=board`,
            read: false, createdAt: serverTimestamp(),
          })
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

    try {
      await txProject(projectId, (data) => ({
        todos: [...(data.todos || []), todo],
        lastActivityAt: new Date().toISOString(),
      }))
    } catch {
      get().showError('할 일 추가에 실패했어요.')
      throw new Error()
    }
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
    try {
      await txProject(projectId, (data) => ({
        todos: data.todos.filter((t) => t.id !== todoId),
      }))
    } catch {
      get().showError('할 일 삭제에 실패했어요.')
    }
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

    try {
      await txProject(projectId, (data) => ({
        events: [...(data.events || []), ev].sort((a, b) => a.date.localeCompare(b.date)),
        lastActivityAt: new Date().toISOString(),
      }))
    } catch {
      get().showError('일정 추가에 실패했어요.')
      throw new Error()
    }
  },

  removeEvent: async (projectId, eventId) => {
    const { currentUser, projects } = get()
    const project = projects.find((p) => p.id === projectId)
    const ev = project?.events.find((e) => e.id === eventId)
    if (!ev) return
    const me = project.members.find((m) => m.id === currentUser.id)
    if (ev.createdBy !== currentUser.id && me?.role !== 'leader' && me?.role !== 'sub-leader') return
    try {
      await txProject(projectId, (data) => ({
        events: data.events.filter((e) => e.id !== eventId),
      }))
    } catch {
      get().showError('일정 삭제에 실패했어요.')
    }
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
    try {
      await txProject(projectId, (data) => ({
        milestones: [...(data.milestones || []), ms],
        lastActivityAt: new Date().toISOString(),
      }))
    } catch {
      get().showError('마일스톤 추가에 실패했어요.')
      throw new Error()
    }
  },

  updateMilestone: async (projectId, milestoneId, { action, note, ...changes }) => {
    const { currentUser, projects } = get()
    const now = new Date().toISOString()
    const entry = { action: action || 'modified', at: now, by: currentUser.id, byName: currentUser.name, note: note || '' }
    try {
      await txProject(projectId, (data) => ({
        milestones: (data.milestones || []).map((m) =>
          m.id !== milestoneId ? m : { ...m, ...changes, history: [...(m.history || []), entry] }
        ),
      }))
      // 마일스톤 '달성으로 전환'될 때만 멤버에게 푸시 (재완료 토글 시 스팸 방지)
      const prevMs = projects.find((p) => p.id === projectId)?.milestones?.find((m) => m.id === milestoneId)
      if (changes.status === 'done' && prevMs?.status !== 'done') {
        const project = projects.find((p) => p.id === projectId)
        const title = prevMs?.title || '마일스톤'
        const batch = writeBatch(db)
        ;(project?.members || []).filter((m) => m.id !== currentUser.id).forEach((m) => {
          batch.set(doc(collection(db, 'notifications')), {
            targetUserId: m.id, type: 'milestone',
            text: `🏁 마일스톤 달성: ${title}`,
            link: `/project/${projectId}?tab=milestone`,
            read: false, createdAt: serverTimestamp(),
          })
        })
        await batch.commit()
      }
    } catch {
      get().showError('마일스톤 업데이트에 실패했어요.')
    }
  },

  deleteMilestone: async (projectId, milestoneId) => {
    try {
      await txProject(projectId, (data) => ({
        milestones: (data.milestones || []).filter((m) => m.id !== milestoneId),
      }))
    } catch {
      get().showError('마일스톤 삭제에 실패했어요.')
    }
  },

  addComment: async (projectId, annId, content) => {
    const { currentUser } = get()
    const comment = {
      id: `cmt_${Date.now()}`,
      authorId: currentUser.id,
      author: currentUser.name,
      content,
      createdAt: new Date().toISOString(),
      replies: [],
    }
    let annAuthorId = null
    try {
      await txProject(projectId, (data) => {
        annAuthorId = data.announcements.find((a) => a.id === annId)?.authorId || null
        return {
          announcements: data.announcements.map((a) =>
            a.id !== annId ? a : { ...a, comments: [...(a.comments || []), comment] }
          ),
        }
      })
      // 글 작성자에게 댓글 알림 (본인 댓글 제외)
      if (annAuthorId && annAuthorId !== currentUser.id) {
        await notifyUser(annAuthorId, {
          type: 'comment',
          text: `💬 ${currentUser.name}님이 회원님의 게시글에 댓글을 남겼어요`,
          link: `/project/${projectId}?tab=board`,
          projectId,
        })
      }
    } catch {
      get().showError('댓글 등록에 실패했어요.')
    }
  },

  deleteComment: async (projectId, annId, commentId) => {
    try {
      await txProject(projectId, (data) => ({
        announcements: data.announcements.map((a) =>
          a.id !== annId ? a : { ...a, comments: (a.comments || []).filter((c) => c.id !== commentId) }
        ),
      }))
    } catch {
      get().showError('댓글 삭제에 실패했어요.')
    }
  },

  addReply: async (projectId, annId, commentId, content) => {
    const { currentUser } = get()
    const reply = {
      id: `rpl_${Date.now()}`,
      authorId: currentUser.id,
      author: currentUser.name,
      content,
      createdAt: new Date().toISOString(),
    }
    let cmtAuthorId = null
    try {
      await txProject(projectId, (data) => {
        const ann = data.announcements.find((a) => a.id === annId)
        cmtAuthorId = ann?.comments?.find((c) => c.id === commentId)?.authorId || null
        return {
          announcements: data.announcements.map((a) =>
            a.id !== annId ? a : {
              ...a, comments: (a.comments || []).map((c) =>
                c.id !== commentId ? c : { ...c, replies: [...(c.replies || []), reply] }
              ),
            }
          ),
        }
      })
      // 댓글 작성자에게 답글 알림 (본인 답글 제외)
      if (cmtAuthorId && cmtAuthorId !== currentUser.id) {
        await notifyUser(cmtAuthorId, {
          type: 'comment',
          text: `💬 ${currentUser.name}님이 회원님의 댓글에 답글을 남겼어요`,
          link: `/project/${projectId}?tab=board`,
          projectId,
        })
      }
    } catch {
      get().showError('대댓글 등록에 실패했어요.')
    }
  },

  deleteReply: async (projectId, annId, commentId, replyId) => {
    try {
      await txProject(projectId, (data) => ({
        announcements: data.announcements.map((a) =>
          a.id !== annId ? a : {
            ...a, comments: (a.comments || []).map((c) =>
              c.id !== commentId ? c : { ...c, replies: (c.replies || []).filter((r) => r.id !== replyId) }
            ),
          }
        ),
      }))
    } catch {
      get().showError('대댓글 삭제에 실패했어요.')
    }
  },
})
