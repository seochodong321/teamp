import { arrayRemove, arrayUnion, doc, updateDoc, writeBatch } from 'firebase/firestore'
import { deleteUser } from 'firebase/auth'
import { db, auth } from '../../firebase.js'
import { deleteProjectDeep } from '../helpers.js'

export const createAuthSlice = (set, get) => ({
  isLoggedIn: false,
  currentUser: null,
  needsUsernameSetup: false,
  blockedUsers: [],
  connects: [],
  profiles: [],

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
      plan: extra.plan || 'free',
    }
    // 다른 유저가 로그인하면 이전 유저 데이터 초기화
    const prevUid = get().currentUser?.id
    const userChanged = prevUid && prevUid !== uid
    set({
      isLoggedIn: true,
      currentUser: user,
      blockedUsers: extra.blockedUsers || [],
      profiles: extra.profiles || [],
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
    profiles: [],
  }),

  // ── 서브 프로필 관리 ──
  addSubProfile: async (profile) => {
    const { currentUser, profiles } = get()
    const newProfile = { ...profile, id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, isDefault: false }
    const updated = [...profiles, newProfile]
    set({ profiles: updated })
    if (currentUser?.id) {
      try { await updateDoc(doc(db, 'users', currentUser.id), { profiles: updated }) } catch {}
    }
    return newProfile
  },

  updateSubProfile: async (id, patch) => {
    const { currentUser, profiles } = get()
    const updated = profiles.map((p) => p.id === id ? { ...p, ...patch } : p)
    set({ profiles: updated })
    if (currentUser?.id) {
      try { await updateDoc(doc(db, 'users', currentUser.id), { profiles: updated }) } catch {}
    }
  },

  deleteSubProfile: async (id) => {
    const { currentUser, profiles } = get()
    const updated = profiles.filter((p) => p.id !== id)
    set({ profiles: updated })
    if (currentUser?.id) {
      try { await updateDoc(doc(db, 'users', currentUser.id), { profiles: updated }) } catch {}
    }
  },

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
    const { currentUser } = get()
    if (!targetId || get().blockedUsers.includes(targetId)) return
    set((s) => ({ blockedUsers: [...s.blockedUsers, targetId] }))
    if (currentUser?.id) {
      await updateDoc(doc(db, 'users', currentUser.id), { blockedUsers: arrayUnion(targetId) })
    }
  },

  unblockUser: async (targetId) => {
    const { currentUser } = get()
    set((s) => ({ blockedUsers: s.blockedUsers.filter((id) => id !== targetId) }))
    if (currentUser?.id) {
      await updateDoc(doc(db, 'users', currentUser.id), { blockedUsers: arrayRemove(targetId) })
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

  deleteAccount: async () => {
    const { currentUser, projects, logout } = get()
    if (!currentUser) return
    const uid = currentUser.id
    const batch = writeBatch(db)
    const soloProjects = []

    for (const project of (projects || [])) {
      if (!project.memberIds?.includes(uid)) continue

      const otherMembers    = (project.members   || []).filter((m) => m.id !== uid)
      const otherMemberIds  = (project.memberIds || []).filter((id) => id !== uid)

      if (otherMembers.length === 0) {
        // 혼자인 프로젝트 — 메시지·파일까지 완전 삭제 (배치 커밋 후 처리)
        soloProjects.push(project)
      } else {
        // 탈퇴자의 PII는 지우되, 함께한 명단(formerMembers)엔 남겨 랩업에서 증발하지 않게
        const leaving = (project.members || []).find((m) => m.id === uid)
        const former  = (project.formerMembers || []).filter((m) => m.id !== uid)
        if (leaving) former.push({ id: leaving.id, name: leaving.name, role: leaving.role, affiliation: leaving.affiliation || '', leftAt: new Date().toISOString(), leftReason: 'deleted' })
        const updates = { memberIds: otherMemberIds, members: otherMembers, formerMembers: former }
        if (project.leaderId === uid) {
          // 부리더 → 첫 번째 멤버 순으로 리더 이전
          const newLeader = otherMembers.find((m) => m.role === 'sub-leader') || otherMembers[0]
          updates.leaderId = newLeader.id
          updates.members  = otherMembers.map((m) =>
            m.id === newLeader.id ? { ...m, role: 'leader' } : m
          )
        }
        batch.update(doc(db, 'projects', project.id), updates)
      }
    }

    // 유저 문서 삭제
    batch.delete(doc(db, 'users', uid))
    await batch.commit()

    // 혼자인 프로젝트는 메시지·파일까지 완전 삭제 (고아 데이터 방지)
    for (const p of soloProjects) {
      try { await deleteProjectDeep(p) } catch (e) { console.error('[deleteAccount] 프로젝트 완전 삭제 실패:', e) }
    }

    // Firebase Auth 계정 삭제 (최근 로그인이 오래됐으면 실패할 수 있음)
    try {
      if (auth.currentUser) await deleteUser(auth.currentUser)
    } catch (e) {
      if (e.code === 'auth/requires-recent-login') {
        const err = new Error('재로그인 후 다시 시도해주세요.')
        err.code = 'requires-recent-login'
        throw err
      }
      // Auth 삭제 실패해도 Firestore 데이터는 이미 삭제됨 — 로그아웃으로 처리
    }

    logout()
  },
})
