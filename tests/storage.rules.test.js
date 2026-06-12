// Storage 보안 규칙 테스트 — firestore + storage 에뮬레이터 둘 다 필요.
// `npm run test:storage`로 실행. 커버 이미지/채팅 파일은 멤버·방 접근 자격자만.
import { readFileSync } from 'node:fs'
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'
import { ref, uploadBytes, getBytes } from 'firebase/storage'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) // 작은 이미지 바이트
const IMG = { contentType: 'image/png' }
let testEnv

beforeAll(async () => {
  // 교차 서비스 읽기(Storage→Firestore)가 같은 프로젝트 파티션을 보도록
  // 에뮬레이터 실행 프로젝트(demo-teamp)와 projectId를 일치시킨다.
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-teamp',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  })
})
afterAll(async () => { await testEnv.cleanup() })
beforeEach(async () => { await testEnv.clearFirestore(); await testEnv.clearStorage() })

const st = (uid) => testEnv.authenticatedContext(uid, {}).storage()
const seedFs = (fn) => testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()))

describe('Storage — 프로젝트 커버: 멤버만 쓰기', () => {
  beforeEach(() => seedFs((db) => setDoc(doc(db, 'projects/p1'), { memberIds: ['a'], leaderId: 'a' })))
  it('멤버는 커버 업로드 OK, 비멤버는 차단(디페이스 방지)', async () => {
    await assertSucceeds(uploadBytes(ref(st('a'), 'projects/p1/cover.jpg'), PNG, IMG))
    await assertFails(uploadBytes(ref(st('intruder'), 'projects/p1/cover.jpg'), PNG, IMG))
  })
})

describe('Storage — 채팅 파일: 방 접근 자격자만', () => {
  beforeEach(() => seedFs(async (db) => {
    await setDoc(doc(db, 'dmRooms/dm1'), { participants: ['a', 'b'] })
    await setDoc(doc(db, 'projects/p1'), { memberIds: ['a', 'b'], leaderId: 'a' })
    await setDoc(doc(db, 'rooms/r1'), { projectId: 'p1' })
  }))
  it('DM 파일: 참가자 OK / 제3자 차단 (결정론적 id여도 안전)', async () => {
    await assertSucceeds(uploadBytes(ref(st('a'), 'chat/dm1/photo.jpg'), PNG, IMG))
    await assertFails(uploadBytes(ref(st('c'), 'chat/dm1/photo.jpg'), PNG, IMG))
  })
  it('프로젝트 방 파일: 멤버 OK / 비멤버 차단', async () => {
    await assertSucceeds(uploadBytes(ref(st('b'), 'chat/r1/doc.pdf'), PNG))
    await assertFails(uploadBytes(ref(st('c'), 'chat/r1/doc.pdf'), PNG))
  })
  it('레거시 방(메타 없음): 인증 유저 허용 — 임시 fallback', async () => {
    await assertSucceeds(uploadBytes(ref(st('anyone'), 'chat/legacy_room/x.jpg'), PNG, IMG))
  })
})

describe('Storage — 아바타: 본인만 쓰기', () => {
  it('본인 OK / 타인 차단', async () => {
    await assertSucceeds(uploadBytes(ref(st('a'), 'users/a/avatar.jpg'), PNG, IMG))
    await assertFails(uploadBytes(ref(st('b'), 'users/a/avatar.jpg'), PNG, IMG))
  })
})
