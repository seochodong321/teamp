import { collection, doc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase.js'
import { USERNAME_RE } from '../store/helpers.js'
import { resizeImage } from '../utils/image.js'

// 프로필 데이터 계층 — 원자적 작업만. 닉네임 선점/롤백·에러 UX 등
// 오케스트레이션은 호출부(ProfilePage) 책임.

// 닉네임 사용 중 여부 (@ 없이 raw로 받음)
export async function isUsernameTaken(username) {
  const snap = await getDocs(query(collection(db, 'users'), where('username', '==', `@${username}`)))
  return !snap.empty
}

// 사용 중일 때 빈 후보 제안 — _·1·2·연도 접미사 순으로 첫 빈 것
export async function suggestFreeUsername(base) {
  for (const s of ['_', '1', '2', String(new Date().getFullYear()).slice(2)]) {
    const candidate = `${base}${s}`.slice(0, 20)
    if (USERNAME_RE.test(candidate) && !(await isUsernameTaken(candidate))) return candidate
  }
  return ''
}

export async function updateUserDoc(uid, fields) {
  await updateDoc(doc(db, 'users', uid), fields)
}

// 참여 중인 프로젝트들의 members[] 스냅샷 동기화(이름·소속·사진 등) —
// 사진 업로드·프로필 저장에 2벌 중복돼 있던 배치를 통합
export async function syncMemberSnapshots(uid, myProjects, patch) {
  if (!myProjects.length) return
  const batch = writeBatch(db)
  myProjects.forEach((p) => {
    batch.update(doc(db, 'projects', p.id), {
      members: p.members.map((m) => (m.id === uid ? { ...m, ...patch } : m)),
    })
  })
  await batch.commit()
}

// 아바타 업로드 — 최대 72px 표시라 320px JPEG로 축소(저장·다운로드 비용 절감) → URL 반환
export async function uploadAvatar(uid, file) {
  const resized = await resizeImage(file, { maxSize: 320, quality: 0.85 })
  const sRef = storageRef(storage, `users/${uid}/avatar.jpg`)
  await uploadBytes(sRef, resized)
  const url = await getDownloadURL(sRef)
  await updateDoc(doc(db, 'users', uid), { photoURL: url })
  return url
}
