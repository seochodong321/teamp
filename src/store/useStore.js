import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { differenceInDays, parseISO, isAfter } from 'date-fns'
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs,
  updateDoc, arrayUnion, query, where, runTransaction,
  serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase.js'

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

// 튜토리얼 프로젝트 — userId별 고유 ID 사용 (다중 사용자 충돌 방지)
const makeTutorialProject = (myId, myName) => {
  const today = todayStr()
  const projId = `proj_tutorial_${myId}`
  const dmId   = `tut_dm_${myId}`
  const allId  = `tut_all_${myId}`
  const devId  = `tut_dev_${myId}`
  return {
    id: projId,
    name: '📖 Teamp 사용방법',
    purpose: 'Teamp의 주요 기능을 직접 체험해보세요!',
    category: '튜토리얼',
    startDate: today,
    endDate: today,
    status: 'active',
    leaderId: myId,
    isTutorial: true,
    inviteCode: `tutorial_${myId}`,
    memberIds: [myId],
    members: [
      { id: myId, name: myName, role: 'leader', roomIds: [dmId, allId, devId], memo: '', affiliation: '', email: '' },
      { id: 'teamp_bot', name: 'Teamp 봇', role: 'member', roomIds: [dmId, allId, devId], memo: '', affiliation: 'Teamp', email: 'hello@teamp.app' },
    ],
    rooms: [
      { id: dmId,  name: '나와의 채팅', lastMessage: '메모처럼 혼자 쓸 수 있어요', unread: 0, time: '', ...ROOM_COLORS[4], isDm: true },
      { id: allId, name: '전체',        lastMessage: 'Teamp에 오신 걸 환영해요 👋', unread: 2, time: '방금', ...ROOM_COLORS[0] },
      { id: devId, name: '개발팀',      lastMessage: '팀별 채팅방 예시예요',          unread: 0, time: '', ...ROOM_COLORS[1] },
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
      { id: 'tut_todo_1', title: '채팅방에 메시지 보내보기', assignee: myId, dueDate: today, priority: 'low',    status: 'todo',        createdBy: 'teamp_bot', createdAt: today },
      { id: 'tut_todo_2', title: '게시판에 글 작성해보기',   assignee: myId, dueDate: today, priority: 'medium', status: 'todo',        createdBy: 'teamp_bot', createdAt: today },
      { id: 'tut_todo_3', title: 'Teamp 살펴보기',           assignee: myId, dueDate: today, priority: 'high',   status: 'in-progress', createdBy: 'teamp_bot', createdAt: today },
    ],
    events: [
      { id: 'tut_ev_1', title: 'Teamp 첫 접속!', date: today, time: '00:00', createdBy: 'teamp_bot', scope: 'all', roomIds: [], isPersonal: false },
    ],
    isPublic: false,
  }
}

const makeTutorialMessages = (myId) => ({
  [`tut_dm_${myId}`]: [
    { id: 'tdm1', senderId: 'teamp_bot', senderName: 'Teamp 봇', type: 'text', text: '여기는 나와의 채팅방이에요. 메모처럼 혼자 쓸 수 있어요 📝', time: '방금' },
  ],
  [`tut_all_${myId}`]: [
    { id: 'tall1', senderId: 'teamp_bot', senderName: 'Teamp 봇', type: 'text', text: 'Teamp에 오신 걸 환영해요 👋', time: '방금' },
    { id: 'tall2', senderId: 'teamp_bot', senderName: 'Teamp 봇', type: 'text', text: '여기에 메시지를 보내보세요!', time: '방금' },
  ],
  [`tut_dev_${myId}`]: [
    { id: 'tdev1', senderId: 'teamp_bot', senderName: 'Teamp 봇', type: 'text', text: '팀별 채팅방을 만들어 소그룹으로 소통할 수 있어요', time: '방금' },
  ],
})

// Firestore 프로젝트 트랜잭션 헬퍼 — 읽고 수정하고 쓰는 패턴
const txProject = async (projectId, updater) => {
  const ref = doc(db, 'projects', projectId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('프로젝트를 찾을 수 없어요')
    tx.update(ref, updater(snap.data()))
  })
}

// Firestore 메시지 트랜잭션 헬퍼
const txMessage = async (roomId, msgId, updater) => {
  const ref = doc(db, 'rooms', roomId, 'messages', msgId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('메시지를 찾을 수 없어요')
    tx.update(ref, updater(snap.data()))
  })
}

export const useStore = create(
  persist(
    (set, get) => ({
      isLoggedIn: false,
      currentUser: null,
      projects: [],
      messages: {},
      invites: [],
      roomOrders: {},
      dmRooms: {},
      connects: [],
      notifications: [],

      // ─── Firestore → Zustand 동기화 setters ─────────────
      setProjects: (firestoreProjects) => {
        const { projects: local } = get()
        // Firestore에 없는 로컬 unread 카운트 보존
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
        set({ projects: merged })
      },

      setRoomMessages: (roomId, msgs) =>
        set((s) => ({ messages: { ...s.messages, [roomId]: msgs } })),

      // ─── 인증 ────────────────────────────────────────────
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
        // projects는 Firestore onSnapshot이 채워줌 — 여기선 사용자 정보만 세팅
        set({ isLoggedIn: true, currentUser: user })
      },

      logout: () => set({
        isLoggedIn: false, currentUser: null,
        projects: [], messages: {}, roomOrders: {}, dmRooms: {}, connects: [], invites: [], notifications: [],
      }),

      // ─── 튜토리얼 프로젝트 Firestore 생성 ───────────────
      createTutorialProject: async (userId, userName) => {
        const proj = makeTutorialProject(userId, userName)
        const msgs = makeTutorialMessages(userId)
        const batch = writeBatch(db)
        // 프로젝트 문서 생성
        batch.set(doc(db, 'projects', proj.id), proj)
        // 튜토리얼 메시지를 각 채팅방에 배치 등록
        proj.rooms.forEach(room => {
          const roomMsgs = msgs[room.id] || []
          roomMsgs.forEach(msg => {
            const msgRef = doc(collection(db, 'rooms', room.id, 'messages'))
            batch.set(msgRef, { ...msg, createdAt: serverTimestamp() })
          })
        })
        await batch.commit()
        // 환영 알림은 로컬에 추가 (알림은 localStorage 관리)
        get().addNotification({
          type: 'welcome',
          title: '🎉 Teamp에 오신 걸 환영해요!',
          message: '둘러보면서 Teamp 사용방법을 익혀보세요',
          projectId: proj.id,
          link: `/project/${proj.id}`,
        })
      },

      // ─── 헬퍼 getters ────────────────────────────────────
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

      // ─── 초대 코드로 프로젝트 조회 ───────────────────────
      getProjectByInviteCode: async (code) => {
        // 로컬 store 먼저 확인
        const local = get().projects.find((p) => p.inviteCode === code || p.id === code)
        if (local) return local
        // inviteCode === projectId 이므로 직접 문서 조회 (비멤버도 읽을 수 있는 규칙 필요)
        try {
          const docSnap = await getDoc(doc(db, 'projects', code))
          if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() }
        } catch {}
        // 커스텀 코드 폴백
        try {
          const q = query(collection(db, 'projects'), where('inviteCode', '==', code))
          const snap = await getDocs(q)
          if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() }
        } catch {}
        return null
      },

      // ─── 초대 코드로 프로젝트 참여 ───────────────────────
      joinProjectByCode: async (code) => {
        const { currentUser, connects } = get()
        if (!currentUser) return { success: false, message: '로그인이 필요해요.' }

        // 직접 ID 조회 먼저 시도
        let projectDoc = null
        try {
          const docSnap = await getDoc(doc(db, 'projects', code))
          if (docSnap.exists()) projectDoc = docSnap
        } catch {}
        if (!projectDoc) {
          try {
            const q = query(collection(db, 'projects'), where('inviteCode', '==', code))
            const snap = await getDocs(q)
            if (!snap.empty) projectDoc = snap.docs[0]
          } catch {}
        }
        if (!projectDoc) return { success: false, message: '유효하지 않은 초대 링크예요.' }

        const project = { id: projectDoc.id, ...projectDoc.data() }

        if (project.members.find((m) => m.id === currentUser.id)) {
          return { success: true, message: '이미 참여 중인 프로젝트예요.', projectId: project.id }
        }

        const allRoomIds = [
          project.rooms.find((r) => r.isDm)?.id,
          project.rooms.find((r) => r.name === '전체')?.id,
        ].filter(Boolean)

        const newMember = {
          id: currentUser.id, name: currentUser.name, role: 'member',
          roomIds: allRoomIds, memo: '', affiliation: currentUser.affiliation || '', email: currentUser.email || '',
        }

        // arrayUnion으로 멤버 추가 — 비멤버도 자신을 추가할 수 있도록 Firestore 규칙 필요:
        // allow update: if request.auth.uid in request.resource.data.memberIds;
        await updateDoc(doc(db, 'projects', project.id), {
          members: arrayUnion(newMember),
          memberIds: arrayUnion(currentUser.id),
        })

        // 전체방에 참여 알림 메시지 전송
        const allRoomId = allRoomIds[1]
        if (allRoomId) {
          await addDoc(collection(db, 'rooms', allRoomId, 'messages'), {
            senderId: 'system', senderName: '시스템', type: 'notify',
            text: `${currentUser.name} 님이 프로젝트에 참여했어요 🎉`,
            time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            createdAt: serverTimestamp(),
          })
        }

        // 커넥트 추가 (로컬)
        const newConnects = project.members
          .filter((m) => m.id !== currentUser.id && !connects.find((c) => c.id === m.id))
          .map((m) => ({ id: m.id, name: m.name, affiliation: m.affiliation || '', email: m.email || '', projectName: project.name, connectedAt: todayStr() }))
        if (newConnects.length > 0) set((s) => ({ connects: [...s.connects, ...newConnects] }))

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
          .map((m) => ({ id: m.id, name: m.name, affiliation: m.affiliation || '', email: m.email || '', projectName: project.name, connectedAt: todayStr() }))
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

      // ─── 채팅 ─────────────────────────────────────────────
      sendMessage: async (roomId, text, type = 'text') => {
        const { currentUser, projects } = get()
        const msgRef = doc(collection(db, 'rooms', roomId, 'messages'))
        const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

        // Firestore에 메시지 저장 — onSnapshot이 setRoomMessages 호출
        await setDoc(msgRef, {
          id: msgRef.id,
          senderId: currentUser.id, senderName: currentUser.name,
          type, text, time: timeStr,
          createdAt: serverTimestamp(),
        })

        // lastMessage 업데이트 (프로젝트 문서에도 반영)
        const project = projects.find(p => p.rooms.some(r => r.id === roomId))
        if (project) {
          await txProject(project.id, (data) => ({
            rooms: data.rooms.map(r => r.id === roomId ? { ...r, lastMessage: `나: ${text}`, time: '방금' } : r),
          }))
        }
      },

      sendFile: async (roomId, fileName) => {
        const { currentUser } = get()
        const msgRef = doc(collection(db, 'rooms', roomId, 'messages'))
        await setDoc(msgRef, {
          id: msgRef.id,
          senderId: currentUser.id, senderName: currentUser.name,
          type: 'file', text: fileName,
          time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
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
        const { currentUser } = get()
        await txMessage(roomId, msgId, (data) => {
          const alreadyVoted = data.options.find(o => o.id === optionId)?.votes.includes(currentUser.id)
          return {
            options: data.options.map(o => {
              if (o.id === optionId) {
                // 같은 선택지 재클릭 시 취소 (toggle)
                return { ...o, votes: alreadyVoted ? o.votes.filter(v => v !== currentUser.id) : [...o.votes, currentUser.id] }
              }
              // 단일 선택 — 다른 선택지에서 본인 표 제거
              return { ...o, votes: o.votes.filter(v => v !== currentUser.id) }
            }),
          }
        })
        // 로컬 메시지 상태도 즉시 반영 (onSnapshot 전 UX 개선)
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
      },

      markAsRead: (roomId) =>
        set((s) => ({
          projects: s.projects.map((p) => ({
            ...p, rooms: p.rooms.map((r) => r.id === roomId ? { ...r, unread: 0 } : r),
          })),
        })),

      // ─── 게시판 ───────────────────────────────────────────
      addAnnouncement: async (projectId, { title, content, isGlobal, fileName }) => {
        const { currentUser } = get()
        const ann = {
          id: `ann_${Date.now()}`, authorId: currentUser.id, author: currentUser.name,
          title, content, isGlobal, fileName: fileName || null, createdAt: todayStr(),
        }

        if (isGlobal) {
          const project = get().projects.find((p) => p.id === projectId)
          if (project) {
            // 전체 채팅방에 공지 알림 메시지 일괄 등록
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

      // ─── 할 일 ────────────────────────────────────────────
      addTodo: async (projectId, { title, assignee, dueDate, priority }) => {
        const { currentUser } = get()
        const todo = {
          id: `todo_${Date.now()}`,
          title, assignee: assignee || null, dueDate: dueDate || null,
          priority: priority || 'medium', status: 'todo',
          createdBy: currentUser.id, createdAt: todayStr(),
        }

        if (assignee && assignee !== currentUser.id) {
          const project = get().projects.find((p) => p.id === projectId)
          const assigneeMember = project?.members.find((m) => m.id === assignee)
          const allRoom = project?.rooms.find((r) => r.name === '전체')
          if (assigneeMember && allRoom) {
            await addDoc(collection(db, 'rooms', allRoom.id, 'messages'), {
              senderId: 'system', senderName: '✅ 할 일 알림', type: 'notify',
              text: `${assigneeMember.name} 님에게 할 일이 배정됐어요: "${title}"`,
              time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
              createdAt: serverTimestamp(),
            })
          }
          get().addNotification({
            type: 'todo', title: '✅ 새 할 일이 배정됐어요', message: title,
            projectId, link: `/project/${projectId}?tab=board`,
          })
        }

        await txProject(projectId, (data) => ({
          todos: [...(data.todos || []), todo],
        }))
      },

      updateTodo: async (projectId, todoId, updates) => {
        const { currentUser, projects } = get()
        const project = projects.find((p) => p.id === projectId)
        const todo = project?.todos?.find((t) => t.id === todoId)
        if (!todo) return
        const me = project.members.find((m) => m.id === currentUser.id)
        const isLeaderOrSub = me?.role === 'leader' || me?.role === 'sub-leader'
        if (todo.createdBy !== currentUser.id && todo.assignee !== currentUser.id && !isLeaderOrSub) return

        // 낙관적 업데이트 — Firestore 응답 전 UX 개선
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId ? p : {
              ...p, todos: p.todos.map((t) => t.id === todoId ? { ...t, ...updates } : t),
            }
          ),
        }))

        await txProject(projectId, (data) => ({
          todos: data.todos.map((t) => t.id === todoId ? { ...t, ...updates } : t),
        }))
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

      // ─── 캘린더 ───────────────────────────────────────────
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

      // ─── 프로젝트 생성 ────────────────────────────────────
      createProject: async (data) => {
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
          memberIds: [currentUser.id],
          members: [{
            id: currentUser.id, name: currentUser.name, role: 'leader',
            roomIds: rooms.map((r) => r.id), memo: '',
            affiliation: currentUser.affiliation || '', email: currentUser.email || '',
          }],
          rooms, announcements: [], todos: [], events: [], isPublic: false,
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
          lastMessage: '채팅방이 생성됐어요', unread: 0, time: '방금',
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

      // ─── 멤버 권한 관리 ───────────────────────────────────
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

      transferLeader: async (projectId, newLeaderId) => {
        const { currentUser } = get()
        const project = get().projects.find((p) => p.id === projectId)
        if (!project || project.leaderId !== currentUser.id) return

        await txProject(projectId, (data) => ({
          leaderId: newLeaderId,
          members: data.members.map((m) => {
            if (m.id === currentUser.id) return { ...m, role: 'member' }
            if (m.id === newLeaderId) return { ...m, role: 'leader', roomIds: data.rooms.map((r) => r.id) }
            return m
          }),
        }))
      },

      updateMemberMemo: async (projectId, memberId, memo) => {
        await txProject(projectId, (data) => ({
          members: data.members.map((m) => m.id === memberId ? { ...m, memo } : m),
        }))
      },

      archiveProject: async (projectId) => {
        await updateDoc(doc(db, 'projects', projectId), { status: 'archived' })
      },

      extendProject: async (projectId, newEndDate) => {
        await updateDoc(doc(db, 'projects', projectId), { endDate: newEndDate })
      },

      togglePublic: async (projectId) => {
        await txProject(projectId, (data) => ({ isPublic: !data.isPublic }))
      },

      // ─── 랩업 ─────────────────────────────────────────────
      endProject: async (projectId, { collectFeedback, feedbackDuration }) => {
        const { projects, currentUser } = get()
        const project = projects.find((p) => p.id === projectId)
        if (!project) return

        // 통계 집계
        const allRoomIds = project.rooms.map((r) => r.id)
        let totalMessages = 0
        let totalFiles = 0
        const messageSenderCount = {}

        for (const rid of allRoomIds) {
          try {
            const snap = await getDocs(collection(db, 'rooms', rid, 'messages'))
            snap.forEach((d) => {
              const msg = d.data()
              totalMessages++
              if (msg.type === 'file') totalFiles++
              if (msg.senderId && msg.senderId !== 'system') {
                messageSenderCount[msg.senderId] = (messageSenderCount[msg.senderId] || 0) + 1
              }
            })
          } catch {}
        }

        const totalTodos = project.todos?.length ?? 0
        const completedTodos = project.todos?.filter((t) => t.done).length ?? 0

        const mostActiveUserId = Object.keys(messageSenderCount).sort(
          (a, b) => (messageSenderCount[b] || 0) - (messageSenderCount[a] || 0)
        )[0] || null
        const mostActiveUserName = project.members.find((m) => m.id === mostActiveUserId)?.name || null

        const feedbackDeadline = collectFeedback
          ? new Date(Date.now() + feedbackDuration * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          : null

        const wrapupData = {
          projectId,
          projectName: project.name,
          projectEmoji: project.emoji || '',
          createdAt: serverTimestamp(),
          summary: { totalMessages, totalTodos, completedTodos, totalFiles },
          highlights: {
            mostActiveUserId,
            mostActiveUserName,
            mostTodoCompletedUserId: null,
            mostTodoCompletedUserName: null,
            mostConnectedUserId: null,
            mostConnectedUserName: null,
          },
          members: project.members.map((m) => ({ userId: m.id, name: m.name, role: m.role })),
          reflections: [],
          feedbacks: [],
        }

        const wrapupRef = await addDoc(collection(db, 'wrapups'), wrapupData)

        await updateDoc(doc(db, 'projects', projectId), {
          status: collectFeedback ? 'collecting' : 'archived',
          collectFeedback: !!collectFeedback,
          feedbackDeadline,
          wrapupId: wrapupRef.id,
        })

        get().addNotification({
          type: 'system',
          text: `🏁 "${project.name}" 프로젝트가 마무리됐어요`,
          projectId,
        })
      },

      addReflection: async (wrapupId, text) => {
        const { currentUser } = get()
        await runTransaction(db, async (tx) => {
          const ref = doc(db, 'wrapups', wrapupId)
          const snap = await tx.get(ref)
          if (!snap.exists()) return
          const data = snap.data()
          const reflections = (data.reflections || []).filter((r) => r.userId !== currentUser.id)
          reflections.push({
            userId: currentUser.id,
            name: currentUser.name,
            text,
            createdAt: new Date().toISOString(),
          })
          tx.update(ref, { reflections })
        })
      },

      addFeedback: async (wrapupId, feedbackData) => {
        const { currentUser } = get()
        await runTransaction(db, async (tx) => {
          const ref = doc(db, 'wrapups', wrapupId)
          const snap = await tx.get(ref)
          if (!snap.exists()) return
          const data = snap.data()
          const feedbacks = (data.feedbacks || []).filter(
            (f) => !(f.fromUserId === currentUser.id && f.toUserId === feedbackData.toUserId)
          )
          feedbacks.push({
            fromUserId: currentUser.id,
            fromUserName: feedbackData.isAnonymous ? '익명' : currentUser.name,
            toUserId: feedbackData.toUserId,
            toUserName: feedbackData.toUserName,
            positives: feedbackData.positives,
            improvements: feedbackData.improvements,
            comment: feedbackData.comment || '',
            isAnonymous: feedbackData.isAnonymous,
            createdAt: new Date().toISOString(),
          })
          tx.update(ref, { feedbacks })
        })
      },

      checkAndArchive: async (projectId) => {
        const project = get().projects.find((p) => p.id === projectId)
        if (!project || project.status !== 'collecting') return
        if (!project.feedbackDeadline) return
        const deadline = new Date(project.feedbackDeadline)
        if (new Date() > deadline) {
          await updateDoc(doc(db, 'projects', projectId), { status: 'archived' })
        }
      },

      // ─── 프로필 ───────────────────────────────────────────
      updateProfile: async (updates) => {
        const { currentUser } = get()
        set((s) => ({ currentUser: { ...s.currentUser, ...updates } }))
        try {
          await updateDoc(doc(db, 'users', currentUser.id), updates)
        } catch (e) {
          console.error('프로필 Firestore 업데이트 실패:', e)
        }
      },

      updateMyMemo: (projectId, memo) => {
        const { currentUser } = get()
        get().updateMemberMemo(projectId, currentUser.id, memo)
      },

      // ─── 알림 ─────────────────────────────────────────────
      addNotification: (noti) =>
        set((s) => ({
          notifications: [
            {
              id: `noti_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              read: false, createdAt: Date.now(), ...noti,
            },
            ...s.notifications,
          ].slice(0, 100),
        })),

      markNotificationRead: (notiId) =>
        set((s) => ({ notifications: s.notifications.map((n) => n.id === notiId ? { ...n, read: true } : n) })),

      markAllNotificationsRead: () =>
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      removeNotification: (notiId) =>
        set((s) => ({ notifications: s.notifications.filter((n) => n.id !== notiId) })),

      clearAllNotifications: () => set({ notifications: [] }),

      // ─── 다크 모드 ────────────────────────────────────────
      theme: (typeof window !== 'undefined' && localStorage.getItem('teamp-theme')) || 'light',

      setTheme: (theme) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('teamp-theme', theme)
          const html = document.documentElement
          const body = document.body
          if (theme === 'dark') {
            html.setAttribute('data-theme', 'dark')
            body.setAttribute('data-theme', 'dark')
            html.classList.add('dark')
          } else {
            html.removeAttribute('data-theme')
            body.removeAttribute('data-theme')
            html.classList.remove('dark')
          }
        }
        set({ theme })
      },

      toggleTheme: () => {
        const current = get().theme
        get().setTheme(current === 'dark' ? 'light' : 'dark')
      },
    }),
    {
      name: 'teamp-storage',
      // projects/messages는 Firestore가 관리 — 나머지만 localStorage에 보관
      partialize: (state) => ({
        roomOrders:    state.roomOrders,
        dmRooms:       state.dmRooms,
        connects:      state.connects,
        notifications: state.notifications,
        invites:       state.invites,
        theme:         state.theme,
      }),
    }
  )
)
