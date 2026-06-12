// Firestore 보안 규칙 테스트 — 에뮬레이터 필요(Java). `npm run test:rules`로 실행.
// 핵심 보안 불변식: 자가 권한상승 차단 · 어드민 전용 읽기 · 닉네임 유일성 선점.
import { readFileSync } from 'node:fs'
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore'

const BOOTSTRAP = 'seobomin524@gmail.com'
let testEnv

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'teamp-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})
afterAll(async () => { await testEnv.cleanup() })
beforeEach(async () => { await testEnv.clearFirestore() })

const as   = (uid, email) => testEnv.authenticatedContext(uid, email ? { email } : {}).firestore()
const seed = (fn) => testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()))

describe('users — 자가 권한상승 차단', () => {
  it('본인은 자기 isAdmin 설정 불가', async () => {
    await seed((db) => setDoc(doc(db, 'users/u1'), { name: 'A', plan: 'free' }))
    await assertFails(updateDoc(doc(as('u1', 'a@x.com'), 'users/u1'), { isAdmin: true }))
  })
  it('본인 plan은 student로만 변경 가능 (pro/admin 불가)', async () => {
    await seed((db) => setDoc(doc(db, 'users/u1'), { name: 'A', plan: 'free' }))
    const db = as('u1', 'a@x.com')
    await assertSucceeds(updateDoc(doc(db, 'users/u1'), { plan: 'student' }))
    await assertFails(updateDoc(doc(db, 'users/u1'), { plan: 'pro' }))
    await assertFails(updateDoc(doc(db, 'users/u1'), { plan: 'admin' }))
  })
  it('꽃다발 집계는 자가 위조 불가 (서버 함수 전용 필드)', async () => {
    await seed((db) => setDoc(doc(db, 'users/u1'), { name: 'A', plan: 'free' }))
    const db = as('u1', 'a@x.com')
    await assertFails(updateDoc(doc(db, 'users/u1'), { flowerTagSummary: { trust: 999 } }))
    await assertFails(updateDoc(doc(db, 'users/u1'), { flowerSenderUids: ['x', 'y', 'z'] }))
    await assertFails(updateDoc(doc(db, 'users/u1'), { flowerSenderCount: 999 }))
    // 일반 프로필 필드는 여전히 OK
    await assertSucceeds(updateDoc(doc(db, 'users/u1'), { oneliner: '안녕하세요' }))
  })
})

describe('어드민 권한 부여 — 부트스트랩만', () => {
  it('비어드민은 타인 isAdmin 변경 불가, 부트스트랩은 가능', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users/target'), { name: 'T', plan: 'free' })
      await setDoc(doc(db, 'users/normal'), { name: 'N', plan: 'free' })
    })
    await assertFails(updateDoc(doc(as('normal', 'n@x.com'), 'users/target'), { isAdmin: true }))
    await assertSucceeds(updateDoc(doc(as('boot', BOOTSTRAP), 'users/target'), { isAdmin: true }))
  })
  it('승급된 어드민: 다른 필드는 OK, isAdmin 변경(승급)은 불가', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users/promoted'), { name: 'P', plan: 'free', isAdmin: true })
      await setDoc(doc(db, 'users/target'), { name: 'T', plan: 'free' })
    })
    const promoted = as('promoted', 'p@x.com')
    await assertSucceeds(updateDoc(doc(promoted, 'users/target'), { banned: true }))
    await assertFails(updateDoc(doc(promoted, 'users/target'), { isAdmin: true }))
  })
})

describe('reports / adminLogs — 어드민만', () => {
  it('비어드민은 reports 읽기 불가, 부트스트랩은 가능', async () => {
    await seed((db) => setDoc(doc(db, 'reports/r1'), { reporterId: 'x', reason: 'spam', detail: '' }))
    await assertFails(getDoc(doc(as('u1', 'u@x.com'), 'reports/r1')))
    await assertSucceeds(getDoc(doc(as('boot', BOOTSTRAP), 'reports/r1')))
  })
  it('비어드민은 adminLogs 읽기·쓰기 불가, 어드민은 생성 가능', async () => {
    const u = as('u1', 'u@x.com')
    await assertFails(getDoc(doc(u, 'adminLogs/l1')))
    await assertFails(setDoc(doc(u, 'adminLogs/l1'), { type: 'block' }))
    await assertSucceeds(setDoc(doc(as('boot', BOOTSTRAP), 'adminLogs/l2'), { type: 'block', actorEmail: BOOTSTRAP }))
  })
})

describe('rooms 메시지 — 방 접근 자격 검증', () => {
  const seedDmAndProject = () => seed(async (db) => {
    // DM: a·b 참가
    await setDoc(doc(db, 'dmRooms/dm1'), { participants: ['a', 'b'] })
    // 프로젝트 p1 (멤버 a·b) + 방 메타 r1 + 나와의채팅 self1(주인 a)
    await setDoc(doc(db, 'projects/p1'), { memberIds: ['a', 'b'], leaderId: 'a' })
    await setDoc(doc(db, 'rooms/r1'), { projectId: 'p1' })
    await setDoc(doc(db, 'rooms/self1'), { projectId: 'p1', ownerId: 'a' })
    // 기존 메시지 (읽기 검증용)
    await setDoc(doc(db, 'rooms/dm1/messages/m1'), { senderId: 'a', text: 'hi' })
    await setDoc(doc(db, 'rooms/r1/messages/m1'), { senderId: 'a', text: 'hello' })
    await setDoc(doc(db, 'rooms/self1/messages/m1'), { senderId: 'a', text: 'memo' })
  })

  it('DM: 참가자는 읽기/쓰기 OK, 제3자는 차단 (결정론적 ID여도 안전)', async () => {
    await seedDmAndProject()
    const a = as('a', 'a@x.com'), c = as('c', 'c@x.com')
    await assertSucceeds(getDoc(doc(a, 'rooms/dm1/messages/m1')))
    await assertSucceeds(setDoc(doc(a, 'rooms/dm1/messages/m2'), { senderId: 'a', text: 'yo' }))
    await assertFails(getDoc(doc(c, 'rooms/dm1/messages/m1')))
    await assertFails(setDoc(doc(c, 'rooms/dm1/messages/mx'), { senderId: 'c', text: '침입' }))
  })
  it('프로젝트 방: 멤버 OK, 비멤버 차단', async () => {
    await seedDmAndProject()
    const b = as('b', 'b@x.com'), c = as('c', 'c@x.com')
    await assertSucceeds(getDoc(doc(b, 'rooms/r1/messages/m1')))
    await assertSucceeds(setDoc(doc(b, 'rooms/r1/messages/m2'), { senderId: 'b', text: 'ok' }))
    await assertFails(getDoc(doc(c, 'rooms/r1/messages/m1')))
  })
  it('나와의 채팅: 같은 프로젝트 멤버여도 주인 외 차단', async () => {
    await seedDmAndProject()
    await assertSucceeds(getDoc(doc(as('a', 'a@x.com'), 'rooms/self1/messages/m1')))
    await assertFails(getDoc(doc(as('b', 'b@x.com'), 'rooms/self1/messages/m1')))
  })
  it('발신자 위조 차단 — senderId는 본인 또는 시스템/봇만', async () => {
    await seedDmAndProject()
    const b = as('b', 'b@x.com')
    await assertFails(setDoc(doc(b, 'rooms/r1/messages/spoof'), { senderId: 'a', text: '사칭' }))
    await assertSucceeds(setDoc(doc(b, 'rooms/r1/messages/sys'), { senderId: 'system', text: '안내' }))
  })
  it('레거시 방(메타 없음): 인증 유저 허용 — 임시 fallback 문서화', async () => {
    const u = as('u1', 'u@x.com')
    await assertSucceeds(setDoc(doc(u, 'rooms/legacy_room/messages/m1'), { senderId: 'u1', text: 'ok' }))
  })

  it('방 메타: 멤버만 생성 가능, 비멤버 차단', async () => {
    await seed((db) => setDoc(doc(db, 'projects/p2'), { memberIds: ['a'], leaderId: 'a' }))
    await assertSucceeds(setDoc(doc(as('a', 'a@x.com'), 'rooms/newroom'), { projectId: 'p2' }))
    await assertFails(setDoc(doc(as('c', 'c@x.com'), 'rooms/newroom2'), { projectId: 'p2' }))
  })
})

describe('notifications — 발신자 검증 + 링크 피싱 차단', () => {
  it('fromUserId=본인 OK / 타인 사칭 차단 / fromUserId 없으면 차단', async () => {
    const u = as('u1', 'u@x.com')
    await assertSucceeds(setDoc(doc(u, 'notifications/n1'), { targetUserId: 'other', fromUserId: 'u1', text: 'hi', read: false }))
    await assertFails(setDoc(doc(u, 'notifications/n2'), { targetUserId: 'other', fromUserId: 'someone-else', text: '사칭', read: false }))
    await assertFails(setDoc(doc(u, 'notifications/n3'), { targetUserId: 'other', text: 'fromUserId 누락', read: false }))
  })
  it('link은 앱 내부 상대경로만 — 외부/프로토콜상대 링크 차단', async () => {
    const u = as('u1', 'u@x.com')
    const noti = (link) => ({ targetUserId: 'other', fromUserId: 'u1', text: 'x', read: false, link })
    await assertSucceeds(setDoc(doc(u, 'notifications/ok1'), noti('/home')))
    await assertSucceeds(setDoc(doc(u, 'notifications/ok2'), noti('/project/p1?tab=board')))
    await assertFails(setDoc(doc(u, 'notifications/bad1'), noti('https://evil.example')))
    await assertFails(setDoc(doc(u, 'notifications/bad2'), noti('//evil.example')))
    await assertFails(setDoc(doc(u, 'notifications/bad3'), noti('javascript:alert(1)')))
  })
})

describe('projects — 권한 상승 차단 + 합류 복구', () => {
  const seedProject = () => seed((db) => setDoc(doc(db, 'projects/p1'), {
    memberIds: ['leader', 'm2'], leaderId: 'leader', isPublic: false,
    members: [{ id: 'leader', role: 'leader' }, { id: 'm2', role: 'member' }],
    todos: [], announcements: [],
  }))

  it('일반 멤버는 협업 필드(todos)는 수정 OK', async () => {
    await seedProject()
    await assertSucceeds(updateDoc(doc(as('m2', 'm@x.com'), 'projects/p1'), { todos: [{ id: 't1', text: '할 일' }] }))
  })
  it('일반 멤버는 leaderId 자가 변경 불가 (리더 탈취 차단)', async () => {
    await seedProject()
    await assertFails(updateDoc(doc(as('m2', 'm@x.com'), 'projects/p1'), { leaderId: 'm2' }))
  })
  it('일반 멤버는 isPublic 강제 공개 불가', async () => {
    await seedProject()
    await assertFails(updateDoc(doc(as('m2', 'm@x.com'), 'projects/p1'), { isPublic: true }))
  })
  it('일반 멤버는 isTutorial 조작(한도 우회) 불가', async () => {
    await seedProject()
    await assertFails(updateDoc(doc(as('m2', 'm@x.com'), 'projects/p1'), { isTutorial: true }))
  })
  it('리더는 권한 필드 변경 가능 (공동리더 위임 등)', async () => {
    await seedProject()
    await assertSucceeds(updateDoc(doc(as('leader', 'l@x.com'), 'projects/p1'), { leaderId: 'm2' }))
    await seedProject()
    await assertSucceeds(updateDoc(doc(as('leader', 'l@x.com'), 'projects/p1'), { isPublic: true }))
  })
  it('비멤버 합류: 본인을 명단에 추가하는 update는 허용 (초대 수락·코드 참여 복구)', async () => {
    await seedProject()
    const joiner = as('newguy', 'n@x.com')
    await assertSucceeds(updateDoc(doc(joiner, 'projects/p1'), {
      memberIds: ['leader', 'm2', 'newguy'],
      members: [{ id: 'leader', role: 'leader' }, { id: 'm2', role: 'member' }, { id: 'newguy', role: 'member' }],
    }))
  })
  it('합류하면서 권한 필드를 같이 건드리면 차단', async () => {
    await seedProject()
    const joiner = as('newguy', 'n@x.com')
    await assertFails(updateDoc(doc(joiner, 'projects/p1'), {
      memberIds: ['leader', 'm2', 'newguy'], leaderId: 'newguy',
    }))
  })
  it('생성은 본인이 리더여야 함 (타인 명의 프로젝트 생성 차단)', async () => {
    const u = as('u1', 'u@x.com')
    await assertSucceeds(setDoc(doc(u, 'projects/np1'), { memberIds: ['u1'], leaderId: 'u1', members: [{ id: 'u1', role: 'leader' }] }))
    await assertFails(setDoc(doc(u, 'projects/np2'), { memberIds: ['u1'], leaderId: 'someone-else', members: [] }))
  })
  it('멤버 자가 탈퇴(memberIds에서 본인 제거)는 허용', async () => {
    await seedProject()
    await assertSucceeds(updateDoc(doc(as('m2', 'm@x.com'), 'projects/p1'), {
      memberIds: ['leader'], members: [{ id: 'leader', role: 'leader' }],
    }))
  })
})

describe('wrapups — 피드백 원문은 멤버만', () => {
  it('멤버 읽기 OK / 비멤버 차단 / 어드민 OK', async () => {
    await seed((db) => setDoc(doc(db, 'wrapups/w1'), {
      memberIds: ['a', 'b'], leaderId: 'a', feedbacks: [{ fromUserId: 'a', toUserId: 'b', comment: '고마웠어' }],
    }))
    await assertSucceeds(getDoc(doc(as('a', 'a@x.com'), 'wrapups/w1')))
    await assertFails(getDoc(doc(as('c', 'c@x.com'), 'wrapups/w1')))
    await assertSucceeds(getDoc(doc(as('boot', BOOTSTRAP), 'wrapups/w1')))
  })
})

describe('usernames — 닉네임 유일성 선점', () => {
  it('본인 uid로 선점 OK / 이미 있으면 덮어쓰기 불가 / 남의 것 삭제 불가', async () => {
    await assertSucceeds(setDoc(doc(as('userA', 'a@x.com'), 'usernames/minsu'), { uid: 'userA' }))
    await assertFails(setDoc(doc(as('userB', 'b@x.com'), 'usernames/minsu'), { uid: 'userB' }))
    await assertFails(deleteDoc(doc(as('userB', 'b@x.com'), 'usernames/minsu')))
    await assertSucceeds(deleteDoc(doc(as('userA', 'a@x.com'), 'usernames/minsu')))
  })
  it('자기 uid 아닌 값으로는 선점 불가', async () => {
    await assertFails(setDoc(doc(as('userA', 'a@x.com'), 'usernames/foo'), { uid: 'someoneElse' }))
  })
})
