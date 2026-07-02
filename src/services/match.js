import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { todayStr } from '../store/helpers.js'

// 팀프 매치 데이터 계층 — 순수 데이터 작업만(알림·상태 갱신은 호출부 책임).
// 스토어 무의존: uid·차단목록은 인자로 받는다 (RN 재사용 경계).

// 내 지원 여부 — 지원자 PII는 본인전용 서브문서(matchPosts/{id}/applicants/{uid})
export async function fetchMyApplication(postId, uid) {
  const snap = await getDoc(doc(db, 'matchPosts', postId, 'applicants', uid))
  return snap.exists() ? snap.data() : null
}

// 모집글 전체 로드 — 기한 지난 내 open 글은 '마감' 전환(기록 보존), 차단 리더 제외,
// 내 글의 지원자는 서브컬렉션에서 로드(과도기: 옛 배열 병합). → { open, closedMine }
export async function fetchMatchPosts({ uid, blockedUsers = [] }) {
  const snap  = await getDocs(query(collection(db, 'matchPosts'), orderBy('createdAt', 'desc')))
  const today = todayStr()
  const validOpen   = []
  const validClosed = []

  await Promise.all(snap.docs.map(async (d) => {
    const data = { id: d.id, ...d.data() }
    const expired = data.deadline && data.deadline < today
    // 기한 지난 내 open 모집글은 삭제하지 않고 '마감'으로 전환해 보관(지원자 note 기록 보존)
    if (expired && data.status === 'open' && data.leaderId === uid) {
      try { await updateDoc(doc(db, 'matchPosts', d.id), { status: 'closed' }) } catch {}
      data.status = 'closed'
    }
    if (!data.deadline) return  // 기한 없는 비정상 글은 목록에서만 제외(삭제하지 않음)
    if (data.status === 'open' && !expired && !blockedUsers.includes(data.leaderId)) validOpen.push(data)
    if (data.status === 'closed' && data.leaderId === uid) validClosed.push(data)
  }))

  // 내 모집글의 지원자는 서브컬렉션(리더만 열람)에서 로드 — 과도기엔 옛 배열도 병합
  await Promise.all([...validOpen, ...validClosed]
    .filter((p) => p.leaderId === uid)
    .map(async (p) => {
      try {
        const aSnap = await getDocs(collection(db, 'matchPosts', p.id, 'applicants'))
        const merged = aSnap.docs.map((d) => d.data())
        ;(p.applicants || []).forEach((a) => { if (!merged.find((m) => m.userId === a.userId)) merged.push(a) })
        p.applicants = merged
      } catch { /* 못 읽으면 기존 값 유지 */ }
    }))

  return { open: validOpen.sort((a, b) => (b.deadline > a.deadline ? 1 : -1)), closedMine: validClosed }
}

export async function createMatchPost(payload) {
  await addDoc(collection(db, 'matchPosts'), { ...payload, applicantCount: 0, status: 'open', createdAt: serverTimestamp() })
}

// 지원 — 본인전용 서브문서에 저장(리더와 본인만 열람)
export async function applyToMatchPost(postId, uid, application) {
  await setDoc(doc(db, 'matchPosts', postId, 'applicants', uid), application)
}

// 지원 상태 변경(accepted·held) — 실패는 조용히(호출부 UX 흐름 유지)
export async function setApplicantStatus(postId, applicantUid, status) {
  await updateDoc(doc(db, 'matchPosts', postId, 'applicants', applicantUid), { status }).catch(() => {})
}

export async function closeMatchPost(postId) {
  await updateDoc(doc(db, 'matchPosts', postId), { status: 'closed' })
}
