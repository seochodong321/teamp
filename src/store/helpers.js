import { differenceInDays, parseISO, isAfter } from 'date-fns'
import { doc, runTransaction, collection, addDoc, serverTimestamp, getDocs, writeBatch, deleteDoc, query, where } from 'firebase/firestore'
import { ref as storageRef, listAll, deleteObject } from 'firebase/storage'
import { db, storage } from '../firebase.js'

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/

// 닉네임 유니크 선점 — usernames/{이름}(문서ID=소문자 닉네임)로 원자적 차지.
// Firestore가 문서 ID 유일성을 보장하므로 동시 신규 선점도 트랜잭션이 직렬화해 중복 불가.
// 추가로 기존 유저(이미 저장된 닉네임)도 query로 막아 백필 없이 안전. 실패 시 throw.
export const claimUsername = async (uid, username) => {
  const name = (username || '').replace(/^@/, '').toLowerCase()
  if (!USERNAME_RE.test(name)) throw new Error('invalid-username')
  // 1) 기존 유저가 이미 쓰는 닉네임인지 (미마이그레이션 데이터 대비)
  const q = await getDocs(query(collection(db, 'users'), where('username', '==', `@${name}`)))
  if (q.docs.some((d) => d.id !== uid)) throw new Error('username-taken')
  // 2) usernames/{name} 원자적 선점 — 이미 다른 uid면 거부
  await runTransaction(db, async (tx) => {
    const ref  = doc(db, 'usernames', name)
    const snap = await tx.get(ref)
    if (snap.exists()) {
      if (snap.data().uid !== uid) throw new Error('username-taken')
      return // 이미 내 것
    }
    tx.set(ref, { uid })
  })
  return `@${name}`
}

// 닉네임 변경 시 옛 이름 반환(다른 사람이 쓸 수 있게)
export const releaseUsername = async (uid, oldUsername) => {
  const name = (oldUsername || '').replace(/^@/, '').toLowerCase()
  if (!USERNAME_RE.test(name)) return
  try {
    await runTransaction(db, async (tx) => {
      const ref  = doc(db, 'usernames', name)
      const snap = await tx.get(ref)
      if (snap.exists() && snap.data().uid === uid) tx.delete(ref)
    })
  } catch { /* 실패해도 치명적 아님 */ }
}

// 프로젝트 완전 삭제 — 문서만 지우면 방 메시지·올린 파일이 고아로 남으므로 함께 비운다.
// (삭제는 '혼자인 프로젝트'에서만 일어나므로 보존할 '함께한 사람'이 없음 = 영구 삭제가 맞음)
export const deleteProjectDeep = async (project) => {
  if (!project) return
  for (const room of (project.rooms || [])) {
    // 1) 방 메시지 서브컬렉션 비우기 (배치 한도 500 대비 청크)
    try {
      const snap = await getDocs(collection(db, 'rooms', room.id, 'messages'))
      let batch = writeBatch(db), n = 0
      for (const d of snap.docs) {
        batch.delete(d.ref); n++
        if (n >= 450) { await batch.commit(); batch = writeBatch(db); n = 0 }
      }
      if (n > 0) await batch.commit()
    } catch (e) { console.error('[deleteProjectDeep] 메시지 삭제 실패:', room.id, e) }
    // 2) 방에 올린 파일(Storage) 정리 — best effort
    try {
      const listing = await listAll(storageRef(storage, `chat/${room.id}`))
      await Promise.all(listing.items.map((it) => deleteObject(it).catch(() => {})))
    } catch { /* 파일 없음/권한 등은 무시 */ }
  }
  // 3) 이 프로젝트로 올린 팀프매치 모집글 정리 — 안 지우면 죽은 프로젝트에 지원이 몰림
  try {
    const posts = await getDocs(query(collection(db, 'matchPosts'), where('projectId', '==', project.id)))
    await Promise.all(posts.docs.map((d) => deleteDoc(d.ref).catch(() => {})))
  } catch (e) { console.error('[deleteProjectDeep] 모집글 정리 실패:', e) }
  // 4) 프로젝트 문서 삭제
  await deleteDoc(doc(db, 'projects', project.id))
}

// 인앱 알림 1건 발행 — notifications 컬렉션에 쓰면 받는 사람의
// App.jsx onSnapshot이 종 알림 패널로 가져옴(크로스 디바이스). 빈 targetUserId면 무시.
export const notifyUser = async (targetUserId, { type, text, link, projectId } = {}) => {
  if (!targetUserId) return
  try {
    await addDoc(collection(db, 'notifications'), {
      targetUserId, type, text,
      ...(link ? { link } : {}),
      ...(projectId ? { projectId } : {}),
      read: false, createdAt: serverTimestamp(),
    })
  } catch (e) {
    console.error('[notifyUser] 알림 발행 실패:', e)
  }
}

export function calcProgress(startDate, endDate) {
  const now   = new Date()
  const start = parseISO(startDate)
  const end   = parseISO(endDate)
  const total   = differenceInDays(end, start)
  const elapsed = differenceInDays(now, start)
  if (elapsed <= 0) return 0
  if (elapsed >= total) return 100
  return Math.round((elapsed / total) * 100)
}

export function formatUnread(n) {
  if (!n || n <= 0) return 0
  if (n > 99) return '+99'
  return n
}

export const ROOM_COLORS = [
  { color: '#534AB7', colorBg: '#EEEDFE' },
  { color: '#0F6E56', colorBg: '#E1F5EE' },
  { color: '#993C1D', colorBg: '#FAECE7' },
  { color: '#185FA5', colorBg: '#E6F1FB' },
  { color: '#854F0B', colorBg: '#FAEEDA' },
]

export const todayStr = () => new Date().toISOString().split('T')[0]

// 이번 주 월요일 키 (YYYY-MM-DD) — 주간 목표 식별용
export const getWeekKey = (base = new Date()) => {
  const monday = new Date(base)
  monday.setDate(base.getDate() - ((base.getDay() + 6) % 7))
  return monday.toISOString().split('T')[0]
}

export const txProject = async (projectId, updater) => {
  const ref = doc(db, 'projects', projectId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('프로젝트를 찾을 수 없어요')
    tx.update(ref, updater(snap.data()))
  })
}

export const txMessage = async (roomId, msgId, updater) => {
  const ref = doc(db, 'rooms', roomId, 'messages', msgId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('메시지를 찾을 수 없어요')
    tx.update(ref, updater(snap.data()))
  })
}

export const makeTutorialProject = (myId, myName, myUsername) => {
  const today = todayStr()
  const now   = new Date().toISOString()
  const projId = `proj_tutorial_${myId}`
  const dmId   = `tut_dm_${myId}`
  const allId  = `tut_all_${myId}`
  const devId  = `tut_dev_${myId}`
  const handle = myUsername || `@${myName}`
  return {
    id: projId,
    name: '📖 Teamp 사용방법',
    purpose: 'Teamp의 주요 기능을 직접 체험해보세요!',
    category: '튜토리얼',
    startDate: today, endDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), status: 'active',
    leaderId: myId, isTutorial: true,
    inviteCode: `tutorial_${myId}`,
    memberIds: [myId],
    members: [
      { id: myId, name: myName, role: 'leader', roomIds: [dmId, allId, devId], memo: '', affiliation: '', email: '' },
      { id: 'teamp_bot', name: 'Teamp 봇', role: 'member', roomIds: [allId, devId], memo: '', affiliation: 'Teamp', email: 'hello@teamp.app' },
    ],
    rooms: [
      { id: dmId,  name: '나와의 채팅', lastMessage: '메모처럼 혼자 쓸 수 있어요', unread: 0, time: '', lastMessageAt: null, ...ROOM_COLORS[4], isDm: true, ownerId: myId },
      { id: allId, name: '전체',        lastMessage: 'Teamp에 오신 걸 환영해요 👋', unread: 2, time: '방금', lastMessageAt: new Date().toISOString(), ...ROOM_COLORS[0] },
      { id: devId, name: '개발팀',      lastMessage: '팀별 채팅방 예시예요',          unread: 0, time: '', lastMessageAt: null, ...ROOM_COLORS[1] },
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
    milestones: [
      {
        id: 'tut_ms_1',
        title: `${handle} 팀프 가입`,
        description: 'Teamp 서비스에 처음 가입했어요. 기여와 관계의 기록이 시작됩니다.',
        targetDate: today, status: 'done', completedAt: now, createdAt: now, createdBy: 'teamp_bot',
        history: [
          { action: 'created',   at: now, by: 'teamp_bot', byName: 'Teamp 봇', note: '' },
          { action: 'completed', at: now, by: 'teamp_bot', byName: 'Teamp 봇', note: '첫 가입 완료 🎉' },
        ],
      },
      {
        id: 'tut_ms_2',
        title: `${handle} '📖 Teamp 사용방법' 프로젝트 참여`,
        description: '첫 프로젝트에 참여했어요. 채팅·할 일·마일스톤을 직접 체험해보세요!',
        targetDate: today, status: 'done', completedAt: now, createdAt: now, createdBy: 'teamp_bot',
        history: [
          { action: 'created',   at: now, by: 'teamp_bot', byName: 'Teamp 봇', note: '' },
          { action: 'completed', at: now, by: 'teamp_bot', byName: 'Teamp 봇', note: '프로젝트 첫 참여 완료 🚀' },
        ],
      },
    ],
    isPublic: false,
  }
}

export const makeTutorialMessages = (myId) => ({
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
