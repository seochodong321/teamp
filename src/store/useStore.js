import { create } from 'zustand'
import { differenceInDays, parseISO, isAfter } from 'date-fns'

function calcProgress(startDate, endDate) {
  const now = new Date()
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  const total = differenceInDays(end, start)
  const elapsed = differenceInDays(now, start)
  if (elapsed <= 0) return 0
  if (elapsed >= total) return 100
  return Math.round((elapsed / total) * 100)
}

function formatUnread(n) {
  if (!n || n <= 0) return 0
  if (n > 99) return '+99'
  return n
}

const ROOM_COLORS = [
  { color: '#534AB7', colorBg: '#EEEDFE' },
  { color: '#0F6E56', colorBg: '#E1F5EE' },
  { color: '#993C1D', colorBg: '#FAECE7' },
  { color: '#185FA5', colorBg: '#E6F1FB' },
  { color: '#854F0B', colorBg: '#FAEEDA' },
]

const todayStr = () => new Date().toISOString().split('T')[0]

const makeTutorialProject = (myId, myName) => {
  const today = todayStr()
  return {
    id: 'proj_tutorial',
    name: '📖 Teamp 사용방법',
    purpose: 'Teamp의 주요 기능을 직접 체험해보세요!',
    category: '튜토리얼',
    startDate: today,
    endDate: today,
    status: 'active',
    leaderId: 'teamp_system',
    isTutorial: true,
    inviteCode: 'tutorial',
    members: [
      { id: myId, name: myName, role: 'member', roomIds: ['tut_dm', 'tut_all', 'tut_dev'], memo: '', affiliation: '', email: '' },
      { id: 'teamp_bot', name: 'Teamp 봇', role: 'leader', roomIds: ['tut_dm', 'tut_all', 'tut_dev'], memo: '', affiliation: 'Teamp', email: 'hello@teamp.app' },
    ],
    rooms: [
      { id: 'tut_dm',  name: '나와의 채팅', lastMessage: '메모처럼 혼자 쓸 수 있어요', unread: 0, time: '', ...ROOM_COLORS[4], isDm: true },
      { id: 'tut_all', name: '전체',        lastMessage: 'Teamp에 오신 걸 환영해요 👋', unread: 2, time: '방금', ...ROOM_COLORS[0] },
      { id: 'tut_dev', name: '개발팀',      lastMessage: '팀별 채팅방 예시예요',          unread: 0, time: '', ...ROOM_COLORS[1] },
    ],
    announcements: [
      {
        id: 'tut_ann_1', authorId: 'teamp_bot', author: 'Teamp 봇',
        title: '🎉 Teamp에 오신 걸 환영해요!',
        content: 'Teamp는 팀 프로젝트 단위로 협업하는 서비스예요.\n\n✅ 채팅방에서 팀원과 소통하세요\n✅ 게시판에 공지나 글을 올려보세요\n✅ 캘린더로 팀 일정을 공유하세요\n✅ 할 일을 만들어 진행 상태를 관리하세요\n✅ 팀원 초대 링크로 동료를 불러오세요',
        isGlobal: true, createdAt: today, fileName: null,
      },
    ],
    todos: [
      { id: 'tut_todo_1', title: '채팅방에 메시지 보내보기', assignee: myId, dueDate: today, priority: 'low', status: 'todo', createdBy: 'teamp_bot', createdAt: today },
      { id: 'tut_todo_2', title: '게시판에 글 작성해보기', assignee: myId, dueDate: today, priority: 'medium', status: 'todo', createdBy: 'teamp_bot', createdAt: today },
      { id: 'tut_todo_3', title: 'Teamp 살펴보기', assignee: myId, dueDate: today, priority: 'high', status: 'in-progress', createdBy: 'teamp_bot', createdAt: today },
    ],
    events: [
      { id: 'tut_ev_1', title: 'Teamp 첫 접속!', date: today, time: '00:00', createdBy: 'teamp_bot', scope: 'all', roomIds: [], isPersonal: false },
    ],
    isPublic: false,
  }
}

const makeTutorialMessages = () => ({
  tut_dm: [
    { id: 'tdm1', senderId: 'teamp_bot', senderName: 'Teamp 봇', type: 'text', text: '여기는 나와의 채팅방이에요. 메모처럼 혼자 쓸 수 있어요 📝', time: '방금' },
  ],
  tut_all: [
    { id: 'tall1', senderId: 'teamp_bot', senderName: 'Teamp 봇', type: 'text', text: 'Teamp에 오신 걸 환영해요 👋', time: '방금' },
    { id: 'tall2', senderId: 'teamp_bot', senderName: 'Teamp 봇', type: 'text', text: '여기에 메시지를 보내보세요!', time: '방금' },
  ],
  tut_dev: [
    { id: 'tdev1', senderId: 'teamp_bot', senderName: 'Teamp 봇', type: 'text', text: '팀별 채팅방을 만들어 소그룹으로 소통할 수 있어요', time: '방금' },
  ],
})

export const useStore = create((set, get) => ({
  isLoggedIn: false,
  currentUser: null,
  projects: [],
  messages: {},
  invites: [],
  roomOrders: {},
  dmRooms: {},
  connects: [],
  notifications: [],

  login: (name, email, uid, extra = {}) => {
    const user = {
      id: uid || 'user_me',
      name: name || '사용자',
      username: `@${(email || 'user').split('@')[0]}`,
      bio: '',
      oneliner: extra.oneliner || '',
      email: email || '',
      affiliation: extra.affiliation || '',
      phone: extra.phone || '',
    }
    set({
      isLoggedIn: true,
      currentUser: user,
      projects: [makeTutorialProject(user.id, user.name)],
      messages: makeTutorialMessages(),
      connects: [],
      notifications: [
        {
          id: 'noti_welcome',
          type: 'welcome',
          title: '🎉 Teamp에 오신 걸 환영해요!',
          message: '둘러보면서 Teamp 사용방법을 익혀보세요',
          projectId: 'proj_tutorial',
          link: '/project/proj_tutorial',
          read: false,
          createdAt: Date.now(),
        },
      ],
    })
  },

  logout: () => set({
    isLoggedIn: false, currentUser: null,
    projects: [], messages: {}, roomOrders: {}, dmRooms: {}, connects: [], invites: [], notifications: [],
  }),

  getProgress: (project) => project.status === 'archived' ? 100 : calcProgress(project.startDate, project.endDate),
  getDday: (endDate) => {
    const diff = differenceInDays(parseISO(endDate), new Date())
    if (diff < 0) return '기한 초과'
    if (diff === 0) return 'D-day'
    return `D-${diff}`
  },
  isExpired: (endDate) => isAfter(new Date(), parseISO(endDate)),
  formatUnread,

  canManage: (project, userId) => {
    const me = project.members.find((m) => m.id === userId)
    return me?.role === 'leader' || me?.role === 'sub-leader'
  },

  getVisibleRooms: (project, userId) => {
    const me = project.members.find((m) => m.id === userId)
    if (!me) return []
    const visible = (me.role === 'leader' || me.role === 'sub-leader')
      ? project.rooms
      : project.rooms.filter((r) => me.roomIds.includes(r.id))
    const order = get().roomOrders[project.id]
    if (!order) return visible
    return [...visible].sort((a, b) => {
      const ai = order.indexOf(a.id), bi = order.indexOf(b.id)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
  },

  reorderRooms: (projectId, newOrder) =>
    set((s) => ({ roomOrders: { ...s.roomOrders, [projectId]: newOrder } })),

  acceptInvite: (id) => set((s) => ({ invites: s.invites.filter((i) => i.id !== id) })),
  declineInvite: (id) => set((s) => ({ invites: s.invites.filter((i) => i.id !== id) })),

  getProjectByInviteCode: (code) => {
    return get().projects.find((p) => p.inviteCode === code || p.id === code)
  },

  joinProjectByCode: (code) => {
    const { currentUser, projects, connects } = get()
    const project = projects.find((p) => p.inviteCode === code || p.id === code)
    if (!project) return { success: false, message: '유효하지 않은 초대 링크예요.' }
    if (project.members.find((m) => m.id === currentUser.id)) {
      return { success: true, message: '이미 참여 중인 프로젝트예요.', projectId: project.id }
    }
    const allRoomIds = [project.rooms.find((r) => r.isDm)?.id, project.rooms.find((r) => r.name === '전체')?.id].filter(Boolean)
    const newMember = {
      id: currentUser.id, name: currentUser.name, role: 'member',
      roomIds: allRoomIds, memo: '', affiliation: currentUser.affiliation || '', email: currentUser.email || '',
    }
    const joinMsg = {
      id: `join_${Date.now()}`, senderId: 'system', senderName: '시스템', type: 'notify',
      text: `${currentUser.name} 님이 프로젝트에 참여했어요 🎉`,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    }
    const newConnects = project.members
      .filter((m) => m.id !== currentUser.id && !connects.find((c) => c.id === m.id))
      .map((m) => ({
        id: m.id, name: m.name, affiliation: m.affiliation || '',
        email: m.email || '', projectName: project.name,
        connectedAt: todayStr(),
      }))
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id !== project.id ? p : { ...p, members: [...p.members, newMember] }
      ),
      messages: {
        ...s.messages,
        ...(allRoomIds[1] ? { [allRoomIds[1]]: [...(s.messages[allRoomIds[1]] || []), joinMsg] } : {}),
      },
      connects: [...s.connects, ...newConnects],
    }))
    // 기존 멤버들에게 알림
    project.members.forEach((m) => {
      get().addNotification({
        type: 'invite',
        title: `🎉 새 멤버가 참여했어요`,
        message: `${currentUser.name} 님이 ${project.emoji || ''} ${project.name}에 참여했어요`,
        projectId: project.id,
        link: `/project/${projectId}?tab=todo`,
      })
    })
    return { success: true, projectId: project.id }
  },

  removeConnect: (userId) =>
    set((s) => ({ connects: s.connects.filter((c) => c.id !== userId) })),

  addConnectsFromProject: (projectId) => {
    const { projects, currentUser, connects } = get()
    const project = projects.find((p) => p.id === projectId)
    if (!project) return
    const newConnects = project.members
      .filter((m) => m.id !== currentUser.id && !connects.find((c) => c.id === m.id))
      .map((m) => ({
        id: m.id, name: m.name, affiliation: m.affiliation || '',
        email: m.email || '', projectName: project.name, connectedAt: todayStr(),
      }))
    if (newConnects.length > 0) set((s) => ({ connects: [...s.connects, ...newConnects] }))
  },

  getOrCreateDmRoom: (projectId, otherUserId, otherUserName) => {
    const { currentUser, dmRooms } = get()
    const dmKey = [currentUser.id, otherUserId].sort().join('_')
    if (dmRooms[dmKey]) return dmRooms[dmKey]
    const newRoom = { id: `dm_${dmKey}`, dmKey, projectId, name: otherUserName, otherUserId, isDirect: true }
    set((s) => ({
      dmRooms: { ...s.dmRooms, [dmKey]: newRoom },
      messages: { ...s.messages, [`dm_${dmKey}`]: [] },
    }))
    return newRoom
  },

  sendMessage: (roomId, text, type = 'text') => {
    const { currentUser } = get()
    const msg = {
      id: `m_${Date.now()}`, senderId: currentUser.id, senderName: currentUser.name,
      type, text, time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    }
    set((s) => ({
      messages: { ...s.messages, [roomId]: [...(s.messages[roomId] || []), msg] },
      projects: s.projects.map((p) => ({
        ...p,
        rooms: p.rooms.map((r) => r.id === roomId ? { ...r, lastMessage: `나: ${text}`, time: '방금' } : r),
      })),
    }))
  },

  sendFile: (roomId, fileName) => {
    const { currentUser } = get()
    const msg = {
      id: `m_${Date.now()}`, senderId: currentUser.id, senderName: currentUser.name,
      type: 'file', text: fileName,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    }
    set((s) => ({ messages: { ...s.messages, [roomId]: [...(s.messages[roomId] || []), msg] } }))
  },

  sendPoll: (roomId, question, options) => {
    const { currentUser } = get()
    const msg = {
      id: `m_${Date.now()}`, senderId: currentUser.id, senderName: currentUser.name,
      type: 'poll', text: question,
      options: options.map((o, i) => ({ id: i, label: o, votes: [] })),
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    }
    set((s) => ({ messages: { ...s.messages, [roomId]: [...(s.messages[roomId] || []), msg] } }))
  },

  votePoll: (roomId, msgId, optionId) => {
    const { currentUser } = get()
    set((s) => ({
      messages: {
        ...s.messages,
        [roomId]: s.messages[roomId].map((m) => {
          if (m.id !== msgId) return m
          return {
            ...m,
            options: m.options.map((o) => {
              if (o.id !== optionId) return o
              const has = o.votes.includes(currentUser.id)
              return { ...o, votes: has ? o.votes.filter((v) => v !== currentUser.id) : [...o.votes, currentUser.id] }
            }),
          }
        }),
      },
    }))
  },

  markAsRead: (roomId) =>
    set((s) => ({
      projects: s.projects.map((p) => ({
        ...p, rooms: p.rooms.map((r) => r.id === roomId ? { ...r, unread: 0 } : r),
      })),
    })),

  addAnnouncement: (projectId, { title, content, isGlobal, fileName }) => {
    const { currentUser } = get()
    const ann = {
      id: `ann_${Date.now()}`, authorId: currentUser.id, author: currentUser.name,
      title, content, isGlobal, fileName: fileName || null, createdAt: todayStr(),
    }
    if (isGlobal) {
      const project = get().projects.find((p) => p.id === projectId)
      const notifyMsg = {
        id: `notify_${Date.now()}`, senderId: 'system', senderName: '📢 공지', type: 'notify',
        text: `[공지] ${title}`,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      }
      if (project) {
        set((s) => {
          const newMessages = { ...s.messages }
          project.rooms.filter((r) => !r.isDm).forEach((r) => {
            newMessages[r.id] = [...(newMessages[r.id] || []), { ...notifyMsg, id: `${notifyMsg.id}_${r.id}` }]
          })
          return { messages: newMessages }
        })
      }
    }
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId ? { ...p, announcements: [ann, ...p.announcements] } : p
      ),
    }))
  },

  deleteAnnouncement: (projectId, annId) => {
    const { currentUser, projects } = get()
    const project = projects.find((p) => p.id === projectId)
    const ann = project?.announcements.find((a) => a.id === annId)
    if (!ann) return
    const me = project.members.find((m) => m.id === currentUser.id)
    if (ann.authorId !== currentUser.id && me?.role !== 'leader') return
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId ? { ...p, announcements: p.announcements.filter((a) => a.id !== annId) } : p
      ),
    }))
  },

  // ─── 할 일 (Todo) ──────────────────────────────────────
  addTodo: (projectId, { title, assignee, dueDate, priority }) => {
    const { currentUser } = get()
    const todo = {
      id: `todo_${Date.now()}`,
      title, assignee: assignee || null, dueDate: dueDate || null,
      priority: priority || 'medium',
      status: 'todo',
      createdBy: currentUser.id,
      createdAt: todayStr(),
    }
    if (assignee && assignee !== currentUser.id) {
      const project = get().projects.find((p) => p.id === projectId)
      const assigneeMember = project?.members.find((m) => m.id === assignee)
      if (assigneeMember) {
        const notifyMsg = {
          id: `notify_${Date.now()}`,
          senderId: 'system',
          senderName: '✅ 할 일 알림',
          type: 'notify',
          text: `${assigneeMember.name} 님에게 할 일이 배정됐어요: "${title}"`,
          time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        }
        const allRoom = project.rooms.find((r) => r.name === '전체')
        if (allRoom) {
          set((s) => ({
            messages: { ...s.messages, [allRoom.id]: [...(s.messages[allRoom.id] || []), notifyMsg] },
          }))
        }
        // 알림 추가
        get().addNotification({
          type: 'todo',
          title: `✅ 새 할 일이 배정됐어요`,
          message: title,
          projectId,
          link: `/project/${projectId}?tab=board`,
        })
      }
    }
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId ? { ...p, todos: [...(p.todos || []), todo] } : p
      ),
    }))
  },

  updateTodo: (projectId, todoId, updates) => {
    const { currentUser, projects } = get()
    const project = projects.find((p) => p.id === projectId)
    const todo = project?.todos?.find((t) => t.id === todoId)
    if (!todo) return
    const me = project.members.find((m) => m.id === currentUser.id)
    const isLeaderOrSub = me?.role === 'leader' || me?.role === 'sub-leader'
    if (todo.createdBy !== currentUser.id && todo.assignee !== currentUser.id && !isLeaderOrSub) return
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id !== projectId ? p : {
          ...p, todos: p.todos.map((t) => t.id === todoId ? { ...t, ...updates } : t),
        }
      ),
    }))
  },

  deleteTodo: (projectId, todoId) => {
    const { currentUser, projects } = get()
    const project = projects.find((p) => p.id === projectId)
    const todo = project?.todos?.find((t) => t.id === todoId)
    if (!todo) return
    const me = project.members.find((m) => m.id === currentUser.id)
    if (todo.createdBy !== currentUser.id && me?.role !== 'leader') return
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id !== projectId ? p : { ...p, todos: p.todos.filter((t) => t.id !== todoId) }
      ),
    }))
  },

  // ─── 캘린더 ───────────────────────────────────────────
  addEvent: (projectId, { title, date, time, scope, roomIds, isPersonal }) => {
    const { currentUser } = get()
    const project = get().projects.find((p) => p.id === projectId)
    const ev = {
      id: `ev_${Date.now()}`, title, date, time, createdBy: currentUser.id,
      scope, roomIds: roomIds || [], isPersonal: isPersonal || false,
    }
    if (!isPersonal) {
      const notifyMsg = {
        id: `notify_${Date.now()}`, senderId: 'system', senderName: '📅 일정 알림', type: 'notify',
        text: `[${title}] ${date} ${time}에 일정이 있어요`,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      }
      set((s) => {
        const newMessages = { ...s.messages }
        const targetRooms = scope === 'all'
          ? project.rooms.filter((r) => !r.isDm).map((r) => r.id)
          : roomIds
        targetRooms.forEach((rId) => {
          newMessages[rId] = [...(newMessages[rId] || []), { ...notifyMsg, id: `${notifyMsg.id}_${rId}` }]
        })
        return { messages: newMessages }
      })
    }
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id !== projectId ? p : { ...p, events: [...p.events, ev].sort((a, b) => a.date.localeCompare(b.date)) }
      ),
    }))
  },

  removeEvent: (projectId, eventId) => {
    const { currentUser, projects } = get()
    const project = projects.find((p) => p.id === projectId)
    const ev = project?.events.find((e) => e.id === eventId)
    if (!ev) return
    const me = project.members.find((m) => m.id === currentUser.id)
    if (ev.createdBy !== currentUser.id && me?.role !== 'leader' && me?.role !== 'sub-leader') return
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId ? { ...p, events: p.events.filter((e) => e.id !== eventId) } : p
      ),
    }))
  },

  createProject: (data) => {
    const { currentUser } = get()
    const projectId = `proj_${Date.now()}`
    const rooms = [
      { id: `room_dm_${Date.now()}`,  name: '나와의 채팅', lastMessage: '나만 보는 메모 공간이에요', unread: 0, time: '', ...ROOM_COLORS[4], isDm: true },
      { id: `room_all_${Date.now()}`, name: '전체',        lastMessage: '채팅방이 생성됐어요',       unread: 0, time: '방금', ...ROOM_COLORS[0], isDm: false },
      ...data.roomNames.filter((n) => n && n.trim() && n !== '전체' && n !== '나와의 채팅').map((name, i) => ({
        id: `room_${Date.now()}_${i}`, name, lastMessage: '채팅방이 생성됐어요', unread: 0, time: '방금',
        ...ROOM_COLORS[(i + 1) % ROOM_COLORS.length], isDm: false,
      })),
    ]
    const project = {
      id: projectId,
      inviteCode: projectId,
      name: data.name, emoji: data.emoji || '📁', purpose: data.purpose, category: data.category,
      startDate: data.startDate, endDate: data.endDate,
      status: 'active', leaderId: currentUser.id,
      members: [{
        id: currentUser.id, name: currentUser.name, role: 'leader',
        roomIds: rooms.map((r) => r.id), memo: '',
        affiliation: currentUser.affiliation || '', email: currentUser.email || '',
      }],
      rooms, announcements: [], todos: [], events: [], isPublic: false,
    }
    set((s) => ({ projects: [project, ...s.projects] }))
    return project
  },

  addRoom: (projectId, roomName) => {
    const { projects } = get()
    const project = projects.find((p) => p.id === projectId)
    if (!project) return
    const colorIdx = project.rooms.filter((r) => !r.isDm).length % ROOM_COLORS.length
    const newRoom = {
      id: `room_${Date.now()}`, name: roomName.trim(),
      lastMessage: '채팅방이 생성됐어요', unread: 0, time: '방금',
      ...ROOM_COLORS[colorIdx], isDm: false,
    }
    set((s) => ({
      projects: s.projects.map((p) => {
        if (p.id !== projectId) return p
        return {
          ...p, rooms: [...p.rooms, newRoom],
          members: p.members.map((m) =>
            (m.role === 'leader' || m.role === 'sub-leader')
              ? { ...m, roomIds: [...m.roomIds, newRoom.id] } : m
          ),
        }
      }),
      messages: { ...s.messages, [newRoom.id]: [] },
    }))
    return newRoom
  },

  updateMemberRole: (projectId, memberId, role) =>
    set((s) => ({
      projects: s.projects.map((p) => {
        if (p.id !== projectId) return p
        return {
          ...p, members: p.members.map((m) => {
            if (m.id !== memberId) return m
            const roomIds = (role === 'leader' || role === 'sub-leader') ? p.rooms.map((r) => r.id) : m.roomIds
            return { ...m, role, roomIds }
          }),
        }
      }),
    })),

  setMemberRooms: (projectId, memberId, roomIds) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id !== projectId ? p : {
          ...p, members: p.members.map((m) => m.id !== memberId ? m : { ...m, roomIds }),
        }
      ),
    })),

  toggleMemberRoom: (projectId, memberId, roomId) =>
    set((s) => ({
      projects: s.projects.map((p) => {
        if (p.id !== projectId) return p
        return {
          ...p, members: p.members.map((m) => {
            if (m.id !== memberId) return m
            const has = m.roomIds.includes(roomId)
            return { ...m, roomIds: has ? m.roomIds.filter((r) => r !== roomId) : [...m.roomIds, roomId] }
          }),
        }
      }),
    })),

  transferLeader: (projectId, newLeaderId) => {
    const { currentUser } = get()
    set((s) => ({
      projects: s.projects.map((p) => {
        if (p.id !== projectId || p.leaderId !== currentUser.id) return p
        return {
          ...p, leaderId: newLeaderId,
          members: p.members.map((m) => {
            if (m.id === currentUser.id) return { ...m, role: 'member' }
            if (m.id === newLeaderId) return { ...m, role: 'leader', roomIds: p.rooms.map((r) => r.id) }
            return m
          }),
        }
      }),
    }))
  },

  updateMemberMemo: (projectId, memberId, memo) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id !== projectId ? p : { ...p, members: p.members.map((m) => m.id === memberId ? { ...m, memo } : m) }
      ),
    })),

  archiveProject: (projectId) =>
    set((s) => ({ projects: s.projects.map((p) => p.id === projectId ? { ...p, status: 'archived' } : p) })),

  extendProject: (projectId, newEndDate) =>
    set((s) => ({ projects: s.projects.map((p) => p.id === projectId ? { ...p, endDate: newEndDate } : p) })),

  togglePublic: (projectId) =>
    set((s) => ({ projects: s.projects.map((p) => p.id === projectId ? { ...p, isPublic: !p.isPublic } : p) })),

  // ─── 프로필 편집 ──────────────────────────────────────
  updateProfile: (updates) =>
    set((s) => ({
      currentUser: { ...s.currentUser, ...updates },
    })),
    
// ─── 알림 ─────────────────────────────────────────────
  addNotification: (noti) =>
    set((s) => ({
      notifications: [
        {
          id: `noti_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          read: false,
          createdAt: Date.now(),
          ...noti,
        },
        ...s.notifications,
      ].slice(0, 100), // 최대 100개만 보관
    })),

  markNotificationRead: (notiId) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === notiId ? { ...n, read: true } : n
      ),
    })),

  markAllNotificationsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),

  removeNotification: (notiId) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== notiId),
    })),

  clearAllNotifications: () => set({ notifications: [] }),

  updateMyMemo: (projectId, memo) => {
    const { currentUser } = get()
    get().updateMemberMemo(projectId, currentUser.id, memo)
  },
}))
