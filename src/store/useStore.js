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
  if (n <= 0) return 0
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

const makeDummyProjects = (myId, myName, myEmail, myAffiliation) => [
  {
    id: 'proj_1',
    name: '2025 졸업작품',
    purpose: '앱 개발 및 발표를 위한 팀 프로젝트',
    category: '학교',
    startDate: '2025-03-01',
    endDate: '2025-06-30',
    status: 'active',
    leaderId: myId,
    members: [
      { id: myId,     name: myName,  role: 'leader',     roomIds: ['room_dm','room_1','room_2','room_3'], memo: '', affiliation: myAffiliation || '', email: myEmail || '' },
      { id: 'user_2', name: '김하은', role: 'sub-leader', roomIds: ['room_dm','room_1','room_2'],          memo: 'DB 설계 및 백엔드', affiliation: 'OO대학교', email: 'haeun@example.com' },
      { id: 'user_3', name: '이준혁', role: 'member',     roomIds: ['room_dm','room_1','room_2'],          memo: '', affiliation: 'OO대학교', email: 'junho@example.com' },
      { id: 'user_4', name: '박민준', role: 'member',     roomIds: ['room_dm','room_1','room_3'],          memo: '', affiliation: 'OO대학교', email: 'minjun@example.com' },
    ],
    rooms: [
      { id: 'room_dm', name: '나와의 채팅', lastMessage: '나만 보는 메모 공간이에요', unread: 0, time: '', ...ROOM_COLORS[4], isDm: true },
      { id: 'room_1',  name: '전체',        lastMessage: '발표 자료 수정 완료했어요',  unread: 3, time: '09:50', ...ROOM_COLORS[0] },
      { id: 'room_2',  name: '개발팀',      lastMessage: 'API 연동 거의 다 됐어요!',   unread: 0, time: '방금',  ...ROOM_COLORS[1] },
      { id: 'room_3',  name: '디자인팀',    lastMessage: '시안 올렸어요',              unread: 1, time: '10:10', ...ROOM_COLORS[2] },
    ],
    announcements: [
      { id: 'ann_1', authorId: myId, author: myName, title: '중간 발표 미팅 안내', content: '이번 주 금요일 오후 3시에 중간 발표 미팅 있습니다!', isGlobal: true, createdAt: '2025-03-10', fileName: null },
    ],
    events: [
      { id: 'ev_1', title: '중간 발표 미팅',  date: '2025-04-25', time: '15:00', createdBy: myId, scope: 'all',   roomIds: [], isPersonal: false },
      { id: 'ev_2', title: '최종 제출 마감',  date: '2025-06-28', time: '23:59', createdBy: myId, scope: 'all',   roomIds: [], isPersonal: false },
      { id: 'ev_3', title: '개발팀 코드리뷰', date: '2025-04-28', time: '14:00', createdBy: myId, scope: 'rooms', roomIds: ['room_2'], isPersonal: false },
    ],
    isPublic: true,
  },
  {
    id: 'proj_2',
    name: '신입생 오리엔테이션',
    purpose: '신입생 환영 행사 기획 및 진행',
    category: '학교',
    startDate: '2025-02-01',
    endDate: '2025-03-02',
    status: 'archived',
    leaderId: 'user_5',
    members: [
      { id: myId,     name: myName,  role: 'member', roomIds: [], memo: '행사 당일 진행 및 사회', affiliation: myAffiliation || '', email: myEmail || '' },
      { id: 'user_5', name: '최리더', role: 'leader', roomIds: [], memo: '', affiliation: '', email: '' },
    ],
    rooms: [], announcements: [], events: [], isPublic: true,
  },
]

const makeDummyMessages = () => ({
  room_dm: [],
  room_1: [
    { id: 'm1', senderId: 'user_2', senderName: '김하은', type: 'text', text: 'DB 설계 완료했어요!', time: '09:20' },
    { id: 'm2', senderId: 'user_3', senderName: '이준혁', type: 'text', text: '확인했어요!',         time: '09:35' },
  ],
  room_2: [{ id: 'm4', senderId: 'user_2', senderName: '김하은', type: 'text', text: '오늘 개발 목표 공유해요', time: '09:00' }],
  room_3: [{ id: 'm6', senderId: 'user_4', senderName: '박민준', type: 'text', text: '시안 올렸어요', time: '10:10' }],
})

const INIT_INVITES = [
  { id: 'invite_1', projectName: 'UX 스터디 그룹', projectId: 'proj_invite_1', fromName: '박지수', purpose: 'UX/UI 스터디', endDate: '2025-08-31' },
]

export const useStore = create((set, get) => ({
  isLoggedIn: false,
  currentUser: null,
  projects: [],
  messages: {},
  invites: INIT_INVITES,
  roomOrders: {},
  dmRooms: {},

  login: (name, email, uid, extra = {}) => {
    const user = {
      id: uid || 'user_me',
      name: name || '사용자',
      username: `@${(email || 'user').split('@')[0]}`,
      bio: '',
      email: email || '',
      affiliation: extra.affiliation || '',
      phone: extra.phone || '',
    }
    set({
      isLoggedIn: true,
      currentUser: user,
      projects: makeDummyProjects(user.id, user.name, user.email, user.affiliation),
      messages: makeDummyMessages(),
    })
  },

  logout: () => set({ isLoggedIn: false, currentUser: null, projects: [], messages: {}, roomOrders: {}, dmRooms: {} }),

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
      const ai = order.indexOf(a.id)
      const bi = order.indexOf(b.id)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
  },

  reorderRooms: (projectId, newOrder) => set((s) => ({ roomOrders: { ...s.roomOrders, [projectId]: newOrder } })),

  acceptInvite: (id) => set((s) => ({ invites: s.invites.filter((i) => i.id !== id) })),
  declineInvite: (id) => set((s) => ({ invites: s.invites.filter((i) => i.id !== id) })),

  // ─── 1:1 채팅 ────────────────────────────────────────
  getOrCreateDmRoom: (projectId, otherUserId, otherUserName) => {
    const { currentUser, dmRooms } = get()
    const dmKey = [currentUser.id, otherUserId].sort().join('_')
    if (dmRooms[dmKey]) return dmRooms[dmKey]
    const newRoom = { id: `dm_${dmKey}`, dmKey, projectId, name: otherUserName, otherUserId, isDirect: true }
    set((s) => ({ dmRooms: { ...s.dmRooms, [dmKey]: newRoom }, messages: { ...s.messages, [`dm_${dmKey}`]: [] } }))
    return newRoom
  },

  // ─── 메시지 ──────────────────────────────────────────
  sendMessage: (roomId, text, type = 'text') => {
    const { currentUser } = get()
    const msg = { id: `m_${Date.now()}`, senderId: currentUser.id, senderName: currentUser.name, type, text, time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) }
    set((s) => ({
      messages: { ...s.messages, [roomId]: [...(s.messages[roomId] || []), msg] },
      projects: s.projects.map((p) => ({ ...p, rooms: p.rooms.map((r) => r.id === roomId ? { ...r, lastMessage: `나: ${text}`, time: '방금' } : r) })),
    }))
  },

  sendFile: (roomId, fileName) => {
    const { currentUser } = get()
    const msg = { id: `m_${Date.now()}`, senderId: currentUser.id, senderName: currentUser.name, type: 'file', text: fileName, time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) }
    set((s) => ({ messages: { ...s.messages, [roomId]: [...(s.messages[roomId] || []), msg] } }))
  },

  sendPoll: (roomId, question, options) => {
    const { currentUser } = get()
    const msg = { id: `m_${Date.now()}`, senderId: currentUser.id, senderName: currentUser.name, type: 'poll', text: question, options: options.map((o, i) => ({ id: i, label: o, votes: [] })), time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) }
    set((s) => ({ messages: { ...s.messages, [roomId]: [...(s.messages[roomId] || []), msg] } }))
  },

  votePoll: (roomId, msgId, optionId) => {
    const { currentUser } = get()
    set((s) => ({
      messages: { ...s.messages, [roomId]: s.messages[roomId].map((m) => { if (m.id !== msgId) return m; return { ...m, options: m.options.map((o) => { if (o.id !== optionId) return o; const has = o.votes.includes(currentUser.id); return { ...o, votes: has ? o.votes.filter((v) => v !== currentUser.id) : [...o.votes, currentUser.id] } }) } }) },
    }))
  },

  markAsRead: (roomId) => set((s) => ({ projects: s.projects.map((p) => ({ ...p, rooms: p.rooms.map((r) => r.id === roomId ? { ...r, unread: 0 } : r) })) })),

  // ─── 게시판 ──────────────────────────────────────────
  addAnnouncement: (projectId, { title, content, isGlobal, fileName }) => {
    const { currentUser } = get()
    const ann = { id: `ann_${Date.now()}`, authorId: currentUser.id, author: currentUser.name, title, content, isGlobal, fileName: fileName || null, createdAt: new Date().toISOString().split('T')[0] }
    set((s) => ({ projects: s.projects.map((p) => p.id === projectId ? { ...p, announcements: [ann, ...p.announcements] } : p) }))
  },

  deleteAnnouncement: (projectId, annId) => {
    const { currentUser, projects } = get()
    const project = projects.find((p) => p.id === projectId)
    const ann = project?.announcements.find((a) => a.id === annId)
    if (!ann) return
    const me = project.members.find((m) => m.id === currentUser.id)
    if (ann.authorId !== currentUser.id && me?.role !== 'leader') return
    set((s) => ({ projects: s.projects.map((p) => p.id === projectId ? { ...p, announcements: p.announcements.filter((a) => a.id !== annId) } : p) }))
  },

  // ─── 캘린더 ──────────────────────────────────────────
  addEvent: (projectId, { title, date, time, scope, roomIds, isPersonal }) => {
    const { currentUser } = get()
    const project = get().projects.find((p) => p.id === projectId)
    const ev = { id: `ev_${Date.now()}`, title, date, time, createdBy: currentUser.id, scope, roomIds: roomIds || [], isPersonal: isPersonal || false }
    if (!isPersonal) {
      const notifyMsg = { id: `notify_${Date.now()}`, senderId: 'system', senderName: '📅 일정 알림', type: 'notify', text: `[${title}] ${date} ${time}에 일정이 있어요`, time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) }
      set((s) => {
        const newMessages = { ...s.messages }
        const targetRooms = scope === 'all' ? project.rooms.filter((r) => !r.isDm).map((r) => r.id) : roomIds
        targetRooms.forEach((rId) => { newMessages[rId] = [...(newMessages[rId] || []), { ...notifyMsg, id: `${notifyMsg.id}_${rId}` }] })
        return { messages: newMessages }
      })
    }
    set((s) => ({ projects: s.projects.map((p) => p.id !== projectId ? p : { ...p, events: [...p.events, ev].sort((a, b) => a.date.localeCompare(b.date)) }) }))
  },

  removeEvent: (projectId, eventId) => {
    const { currentUser, projects } = get()
    const project = projects.find((p) => p.id === projectId)
    const ev = project?.events.find((e) => e.id === eventId)
    if (!ev) return
    const me = project.members.find((m) => m.id === currentUser.id)
    if (ev.createdBy !== currentUser.id && me?.role !== 'leader' && me?.role !== 'sub-leader') return
    set((s) => ({ projects: s.projects.map((p) => p.id === projectId ? { ...p, events: p.events.filter((e) => e.id !== eventId) } : p) }))
  },

  // ─── 프로젝트 생성 ───────────────────────────────────
  createProject: (data) => {
    const { currentUser } = get()
    const rooms = [
      { id: `room_dm_${Date.now()}`,  name: '나와의 채팅', lastMessage: '나만 보는 메모 공간이에요', unread: 0, time: '', ...ROOM_COLORS[4], isDm: true },
      { id: `room_all_${Date.now()}`, name: '전체',        lastMessage: '채팅방이 생성됐어요',       unread: 0, time: '방금', ...ROOM_COLORS[0] },
      ...data.roomNames.filter((n) => n !== '전체' && n !== '나와의 채팅').map((name, i) => ({
        id: `room_${Date.now()}_${i}`, name, lastMessage: '채팅방이 생성됐어요', unread: 0, time: '방금', ...ROOM_COLORS[(i + 1) % ROOM_COLORS.length],
      })),
    ]
    const project = {
      id: `proj_${Date.now()}`, ...data, status: 'active', leaderId: currentUser.id,
      members: [{ id: currentUser.id, name: currentUser.name, role: 'leader', roomIds: rooms.map((r) => r.id), memo: '', affiliation: currentUser.affiliation || '', email: currentUser.email || '' }],
      rooms, announcements: [], events: [], isPublic: false,
    }
    set((s) => ({ projects: [project, ...s.projects] }))
    return project
  },

  updateMemberRole: (projectId, memberId, role) => {
    set((s) => ({ projects: s.projects.map((p) => { if (p.id !== projectId) return p; return { ...p, members: p.members.map((m) => { if (m.id !== memberId) return m; const roomIds = (role === 'leader' || role === 'sub-leader') ? p.rooms.map((r) => r.id) : m.roomIds; return { ...m, role, roomIds } }) } }) }))
  },

  toggleMemberRoom: (projectId, memberId, roomId) => {
    set((s) => ({ projects: s.projects.map((p) => { if (p.id !== projectId) return p; return { ...p, members: p.members.map((m) => { if (m.id !== memberId) return m; const has = m.roomIds.includes(roomId); return { ...m, roomIds: has ? m.roomIds.filter((r) => r !== roomId) : [...m.roomIds, roomId] } }) } }) }))
  },

  transferLeader: (projectId, newLeaderId) => {
    const { currentUser } = get()
    set((s) => ({ projects: s.projects.map((p) => { if (p.id !== projectId || p.leaderId !== currentUser.id) return p; return { ...p, leaderId: newLeaderId, members: p.members.map((m) => { if (m.id === currentUser.id) return { ...m, role: 'member' }; if (m.id === newLeaderId) return { ...m, role: 'leader', roomIds: p.rooms.map((r) => r.id) }; return m }) } }) }))
  },

  updateMemberMemo: (projectId, memberId, memo) => {
    set((s) => ({ projects: s.projects.map((p) => p.id !== projectId ? p : { ...p, members: p.members.map((m) => m.id === memberId ? { ...m, memo } : m) }) }))
  },

  archiveProject: (projectId) => set((s) => ({ projects: s.projects.map((p) => p.id === projectId ? { ...p, status: 'archived' } : p) })),
  extendProject: (projectId, newEndDate) => set((s) => ({ projects: s.projects.map((p) => p.id === projectId ? { ...p, endDate: newEndDate } : p) })),
  togglePublic: (projectId) => set((s) => ({ projects: s.projects.map((p) => p.id === projectId ? { ...p, isPublic: !p.isPublic } : p) })),
  updateMyMemo: (projectId, memo) => { const { currentUser } = get(); get().updateMemberMemo(projectId, currentUser.id, memo) },
}))