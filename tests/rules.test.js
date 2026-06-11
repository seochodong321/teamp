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
