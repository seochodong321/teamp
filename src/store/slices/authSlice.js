import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase.js'

export const createAuthSlice = (set, get) => ({
  isLoggedIn: false,
  currentUser: null,
  needsUsernameSetup: false,
  blockedUsers: [],
  connects: [],

  login: (name, email, uid, extra = {}) => {
    const rawUsername = extra.username || `@${(email || 'user').split('@')[0]}`
    const username = rawUsername.startsWith('@') ? rawUsername : `@${rawUsername}`
    const user = {
      id: uid || 'user_me',
      name: name || '사용자',
      username,
      bio: '',
      oneliner: extra.oneliner || '',
      email: email || '',
      affiliation: extra.affiliation || '',
      phone: extra.phone || '',
      birthday: extra.birthday || '',
      photoURL: extra.photoURL || null,
    }
    // 다른 유저가 로그인하면 이전 유저 데이터 초기화
    const prevUid = get().currentUser?.id
    const userChanged = prevUid && prevUid !== uid
    set({
      isLoggedIn: true,
      currentUser: user,
      blockedUsers: extra.blockedUsers || [],
      ...(userChanged ? {
        projects: [], invites: [], notifications: [], connects: [],
        messages: {}, dmRooms: {}, dmRoomList: [], dmUnreadCounts: {},
      } : {}),
    })
  },

  logout: () => set({
    isLoggedIn: false, currentUser: null, needsUsernameSetup: false,
    projects: [], messages: {}, roomOrders: {}, dmRooms: {}, dmRoomList: [],
    connects: [], invites: [], notifications: [], chatToasts: [], dmUnreadCounts: {}, blockedUsers: [],
  }),

  setNeedsUsernameSetup: (v) => set({ needsUsernameSetup: v }),

  updateProfile: async (updates) => {
    const { currentUser } = get()
    set((s) => ({ currentUser: { ...s.currentUser, ...updates } }))
    try {
      await updateDoc(doc(db, 'users', currentUser.id), updates)
    } catch (e) {
      console.error('프로필 Firestore 업데이트 실패:', e)
    }
  },

  blockUser: async (targetId) => {
    const { currentUser, blockedUsers } = get()
    if (!targetId || blockedUsers.includes(targetId)) return
    const updated = [...blockedUsers, targetId]
    set({ blockedUsers: updated })
    if (currentUser?.id) {
      await updateDoc(doc(db, 'users', currentUser.id), { blockedUsers: updated })
    }
  },

  unblockUser: async (targetId) => {
    const { currentUser, blockedUsers } = get()
    const updated = blockedUsers.filter((id) => id !== targetId)
    set({ blockedUsers: updated })
    if (currentUser?.id) {
      await updateDoc(doc(db, 'users', currentUser.id), { blockedUsers: updated })
    }
  },

  removeConnect: (userId) =>
    set((s) => ({ connects: s.connects.filter((c) => c.id !== userId) })),

  addConnectsFromProject: (projectId) => {
    const { projects, currentUser, connects } = get()
    const project = projects.find((p) => p.id === projectId)
    if (!project) return
    const existingIds = new Set(connects.map((c) => c.id))
    const newConnects = project.members
      .filter((m) => m.id !== currentUser.id && !existingIds.has(m.id))
      .map((m) => ({ id: m.id, name: m.name, affiliation: m.affiliation || '', email: m.email || '', projectName: project.name, connectedAt: new Date().toISOString().split('T')[0] }))
    if (newConnects.length > 0) set((s) => ({ connects: [...s.connects, ...newConnects] }))
  },

  updateMyMemo: (projectId, memo) => {
    const { currentUser } = get()
    get().updateMemberMemo(projectId, currentUser.id, memo)
  },
})
