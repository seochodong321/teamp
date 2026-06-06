import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, arrayUnion,
  query, where, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { ROOM_COLORS, todayStr, notifyUser } from '../helpers.js'

export const createInviteSlice = (set, get) => ({
  invites: [],

  setInvites: (invites) => set({ invites }),

  acceptInvite: async (id) => {
    const { invites, currentUser, connects } = get()
    const invite = invites.find((i) => i.id === id)
    if (!invite || !currentUser) return

    try {
      const docSnap = await getDoc(doc(db, 'projects', invite.projectId))
      if (docSnap.exists()) {
        const project = { id: docSnap.id, ...docSnap.data() }
        if (!project.members.find((m) => m.id === currentUser.id)) {
          const allRoomId     = project.rooms.find((r) => r.name === '전체')?.id
          const personalDmId  = `room_dm_${project.id}_${currentUser.id}`
          const alreadyHasDm  = project.rooms.find((r) => r.id === personalDmId)
          const personalDm    = alreadyHasDm ? null : { id: personalDmId, name: '나와의 채팅', isDm: true, ownerId: currentUser.id, lastMessage: '나만 보는 메모 공간이에요', unread: 0, time: '', ...ROOM_COLORS[4] }
          const newMember     = { id: currentUser.id, name: currentUser.name, role: 'member', roomIds: [personalDmId, allRoomId].filter(Boolean), memo: '', affiliation: currentUser.affiliation || '', email: currentUser.email || '' }
          const updatePayload = { members: arrayUnion(newMember), memberIds: arrayUnion(currentUser.id) }
          if (personalDm) updatePayload.rooms = arrayUnion(personalDm)
          await updateDoc(doc(db, 'projects', project.id), updatePayload)
          if (allRoomId) {
            await addDoc(collection(db, 'rooms', allRoomId, 'messages'), { senderId: 'teampbot', senderName: '팀프봇', type: 'notify', text: `👋 ${currentUser.name}님이 팀에 합류했어요!`, time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }), createdAt: serverTimestamp() })
          }
          const newConnects = project.members.filter((m) => m.id !== currentUser.id && !connects.find((c) => c.id === m.id)).map((m) => ({ id: m.id, name: m.name, affiliation: m.affiliation || '', email: m.email || '', projectName: project.name, connectedAt: todayStr() }))
          if (newConnects.length > 0) set((s) => ({ connects: [...s.connects, ...newConnects] }))
          // 리더에게 합류 알림 — joinProjectByCode와 일관(배너 수락도 동일하게)
          if (project.leaderId && project.leaderId !== currentUser.id) {
            await notifyUser(project.leaderId, {
              type: 'join',
              text: `🎉 ${currentUser.name}님이 ${project.name}에 합류했어요`,
              link: `/project/${project.id}`,
              projectId: project.id,
            })
          }
        }
      }
    } catch (e) { console.error('초대 수락 오류:', e) }

    try {
      await updateDoc(doc(db, 'projectInvites', id), { status: 'accepted' })
    } catch (e) {
      console.error('[acceptInvite] 초대 상태 업데이트 실패:', e)
    }
    set((s) => ({ invites: s.invites.filter((i) => i.id !== id) }))
    return invite.projectId
  },

  declineInvite: async (id) => {
    try {
      await updateDoc(doc(db, 'projectInvites', id), { status: 'declined' })
    } catch (e) {
      console.error('[declineInvite] 초대 상태 업데이트 실패:', e)
    }
    set((s) => ({ invites: s.invites.filter((i) => i.id !== id) }))
  },

  sendProjectInvite: async (projectId, invitee) => {
    const { currentUser, projects } = get()
    if (!currentUser) return
    const project = projects.find((p) => p.id === projectId)
    if (!project) return

    // 이미 초대된 경우 방지
    try {
      const q = query(collection(db, 'projectInvites'), where('inviteeId', '==', invitee.id))
      const snap = await getDocs(q)
      const alreadySent = snap.docs.some((d) => {
        const data = d.data()
        return data.projectId === projectId && data.status === 'pending'
      })
      if (alreadySent) return { alreadySent: true }
    } catch (e) {
      console.error('[sendProjectInvite] 중복 체크 실패:', e)
    }

    const inviteDoc = {
      projectId, projectName: project.name,
      inviterId: currentUser.id, inviterName: currentUser.name,
      inviteeId: invitee.id, inviteeName: invitee.name,
      endDate: project.endDate || '', status: 'pending',
      createdAt: serverTimestamp(),
    }
    await addDoc(collection(db, 'projectInvites'), inviteDoc)
    // link:'/home' — 초대 수락/거절 배너가 홈에 떠서, 알림 클릭 시 그리로 이동
    await notifyUser(invitee.id, {
      type: 'projectInvite',
      text: `📨 ${currentUser.name}님이 "${project.name}"에 초대했어요`,
      link: '/home',
      projectId,
    })
    return { success: true }
  },

  getProjectByInviteCode: async (code) => {
    const local = get().projects.find((p) => p.inviteCode === code || p.id === code)
    if (local) return local
    try {
      const docSnap = await getDoc(doc(db, 'projects', code))
      if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() }
    } catch {}
    try {
      const q = query(collection(db, 'projects'), where('inviteCode', '==', code))
      const snap = await getDocs(q)
      if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() }
    } catch {}
    return null
  },

  joinProjectByCode: async (code, profileId = 'default', profileAffiliation = null) => {
    const { currentUser, connects } = get()
    if (!currentUser) return { success: false, message: '로그인이 필요해요.' }

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

    const allRoomId    = project.rooms.find((r) => r.name === '전체')?.id
    const personalDmId = `room_dm_${project.id}_${currentUser.id}`
    const alreadyHasDm = project.rooms.find((r) => r.id === personalDmId)
    const personalDm   = alreadyHasDm ? null : {
      id: personalDmId, name: '나와의 채팅', isDm: true, ownerId: currentUser.id,
      lastMessage: '나만 보는 메모 공간이에요', unread: 0, time: '', ...ROOM_COLORS[4],
    }
    const newMember  = {
      id: currentUser.id, name: currentUser.name, role: 'member',
      roomIds: [personalDmId, allRoomId].filter(Boolean),
      memo: '', affiliation: profileAffiliation ?? currentUser.affiliation ?? '',
      email: currentUser.email || '', profileId,
    }
    const joinPayload = { members: arrayUnion(newMember), memberIds: arrayUnion(currentUser.id) }
    if (personalDm) joinPayload.rooms = arrayUnion(personalDm)
    await updateDoc(doc(db, 'projects', project.id), joinPayload)

    if (allRoomId) {
      await addDoc(collection(db, 'rooms', allRoomId, 'messages'), {
        senderId: 'teampbot', senderName: '팀프봇', type: 'notify',
        text: `👋 ${currentUser.name}님이 팀에 합류했어요! 함께 해서 반가워요.`,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        createdAt: serverTimestamp(),
      })
    }

    if (project.leaderId && project.leaderId !== currentUser.id) {
      await notifyUser(project.leaderId, {
        type: 'join',
        text: `🎉 ${currentUser.name}님이 ${project.name}에 합류했어요`,
        link: `/project/${project.id}`,
        projectId: project.id,
      })
    }

    const newConnects = project.members
      .filter((m) => m.id !== currentUser.id && !connects.find((c) => c.id === m.id))
      .map((m) => ({ id: m.id, name: m.name, affiliation: m.affiliation || '', email: m.email || '', projectName: project.name, connectedAt: todayStr() }))
    if (newConnects.length > 0) set((s) => ({ connects: [...s.connects, ...newConnects] }))

    return { success: true, projectId: project.id }
  },
})
