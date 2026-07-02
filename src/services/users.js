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

// 닉네임으로 유저 조회 — @프리픽스 우선, 레거시(@ 없는 저장값) 폴백. 없으면 null.
// (MessagesPage 수신자 검색·PublicProfilePage에 2벌 중복이던 쿼리 통합)
export async function fetchUserByUsername(username) {
  const val = username.trim().toLowerCase().replace(/^@/, '')
  if (!val) return null
  let snap = await getDocs(query(collection(db, 'users'), where('username', '==', `@${val}`)))
  if (snap.empty) snap = await getDocs(query(collection(db, 'users'), where('username', '==', val)))
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
}

// 유저가 속한 프로젝트 전체(튜토리얼 제외, 시작일 내림차순) — 공개 여부는 호출부가 필터
export async function fetchMemberProjects(uid) {
  const snap = await getDocs(query(collection(db, 'projects'), where('memberIds', 'array-contains', uid)))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => !p.isTutorial)
    .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))
}

// 유저가 속한 공개 프로젝트 목록 — 팀프폴리오/프로필 모달 공용. (MembersTab·MatchPage 공용)
export async function fetchPublicProjects(uid) {
  return (await fetchMemberProjects(uid)).filter((p) => p.isPublic)
}
