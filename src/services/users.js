import { collection, doc, getDoc, getDocFromServer, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase.js'

// 유저 프로필 조회 — 서버 강제(오프라인 캐시의 옛 프로필 방지), 실패 시 캐시 폴백.
// 문서 없으면 null (호출부가 '없음'과 '빈 값'을 구분할 수 있게).
// MembersTab·ChatPage·ConnectPage·MatchPage에 4벌 중복돼 있던 것을 통합.
export async function fetchUserProfile(uid) {
  const ref = doc(db, 'users', uid)
  const snap = await getDocFromServer(ref).catch(() => getDoc(ref))
  return snap.exists() ? snap.data() : null
}

// 유저가 속한 공개 프로젝트 목록 — 팀프폴리오/프로필 모달 공용.
// isPublic && !isTutorial, 시작일 내림차순. (MembersTab·MatchPage 중복 통합)
export async function fetchPublicProjects(uid) {
  const snap = await getDocs(query(collection(db, 'projects'), where('memberIds', 'array-contains', uid)))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.isPublic && !p.isTutorial)
    .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))
}
