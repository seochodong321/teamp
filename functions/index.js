/**
 * Teamp 알림 발송 — Firestore 트리거로 FCM 푸시를 보낸다.
 * 클라이언트는 토큰만 등록(users/{uid}.fcmToken); 실제 발송은 여기서 한다.
 *
 * 함수 A pushOnNotification: notifications/{id} 생성 → targetUserId에게 푸시
 *   (할 일 배정·DM·초대·생일·어드민·게시판·마일스톤 — notification 문서를 쓰는 모든 이벤트)
 * 함수 B pushOnChatMessage: rooms/{roomId}/messages/{msgId} 생성 → 방 멤버에게 푸시
 *   (일반 채팅 메시지. 발신자 제외. 벨 알림은 안 쌓고 푸시만)
 *
 * 배포: firebase deploy --only functions  (Blaze 요금제 필요)
 */
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'

initializeApp()
const db = getFirestore()
const REGION = 'asia-northeast3'
const ADMIN_EMAIL = 'seobomin524@gmail.com'
const STORAGE_BUCKET = 'teamp-7923c.firebasestorage.app' // 클라 업로드 버킷(공개 식별자)

// 유저 uid 목록 → 유효한 fcmToken 목록 (중복·빈 값 제거)
async function tokensFor(uids) {
  const ids = [...new Set(uids)].filter(Boolean)
  if (!ids.length) return []
  const snaps = await db.getAll(...ids.map((id) => db.doc(`users/${id}`)))
  return snaps.map((s) => s.get('fcmToken')).filter(Boolean)
}

// 토큰들로 발송 + 만료 토큰 정리
async function pushTo(tokens, { title, body, link }) {
  const valid = [...new Set(tokens)].filter(Boolean)
  if (!valid.length) return
  const res = await getMessaging().sendEachForMulticast({
    tokens: valid,
    notification: { title, body },
    data: { link: link || '/' },
    webpush: {
      fcmOptions: { link: link || '/' },
      notification: { icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' },
    },
  })
  // 등록 해제된 토큰은 DB에서 제거 (다음 발송 실패 방지)
  const stale = []
  res.responses.forEach((r, i) => {
    const code = r.error?.code
    if (code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token') stale.push(valid[i])
  })
  if (stale.length) {
    const users = await db.collection('users').where('fcmToken', 'in', stale.slice(0, 10)).get()
    await Promise.all(users.docs.map((d) => d.ref.update({ fcmToken: null }).catch(() => {})))
  }
}

const preview = (m) =>
  m.type === 'image' ? '📷 사진' : m.type === 'file' ? '📎 파일'
  : m.type === 'poll' ? '📊 투표' : (m.text || '').slice(0, 80)

// ── 함수 A: 인앱 알림 문서 → 푸시 ──────────────────────────────
export const pushOnNotification = onDocumentCreated(
  { document: 'notifications/{id}', region: REGION },
  async (event) => {
    const n = event.data?.data()
    if (!n?.targetUserId || !n.text) return
    const tokens = await tokensFor([n.targetUserId])
    await pushTo(tokens, { title: 'Teamp', body: n.text, link: n.link })
  }
)

// ── 함수 B: 채팅 메시지 → 방 멤버에게 푸시 ─────────────────────
export const pushOnChatMessage = onDocumentCreated(
  { document: 'rooms/{roomId}/messages/{msgId}', region: REGION },
  async (event) => {
    const { roomId } = event.params
    const m = event.data?.data()
    if (!m) return
    // 시스템·봇·알림성 메시지는 푸시 안 함
    if (m.senderId === 'system' || m.senderId === 'teampbot' || m.type === 'notify') return

    let recipients = []
    let roomName = ''

    // 1) DM 방인지 확인 (dmRooms 문서 id == roomId)
    const dmSnap = await db.doc(`dmRooms/${roomId}`).get()
    if (dmSnap.exists) {
      const dm = dmSnap.data()
      const left = dm.left || []
      recipients = (dm.participants || []).filter((id) => id !== m.senderId && !left.includes(id))
      roomName = m.senderName || 'DM'
    } else if (m.projectId) {
      // 2) 프로젝트 방 — 해당 방을 볼 수 있는 멤버 (리더·부리더 전체 / 멤버는 roomIds 포함)
      const projSnap = await db.doc(`projects/${m.projectId}`).get()
      if (!projSnap.exists) return
      const proj = projSnap.data()
      const room = (proj.rooms || []).find((r) => r.id === roomId)
      roomName = room?.name ? `# ${room.name}` : proj.name
      recipients = (proj.members || [])
        .filter((mem) => {
          if (mem.id === m.senderId) return false
          if (mem.role === 'leader' || mem.role === 'sub-leader') return true
          return (mem.roomIds || []).includes(roomId)
        })
        .map((mem) => mem.id)
    } else {
      return // 방 정보를 못 찾음
    }

    const tokens = await tokensFor(recipients)
    await pushTo(tokens, {
      title: roomName || 'Teamp',
      body: `${m.senderName || '누군가'}: ${preview(m)}`,
      link: m.projectId ? `/project/${m.projectId}/chat/${roomId}` : '/home',
    })
  }
)

// ── 함수 D: 랩업 피드백 → 받는 사람 users 문서에 꽃다발 집계 캐싱 ──────
// 클라는 타인 users 문서를 못 쓰므로(보안 규칙) 집계는 서버가 한다.
// before/after의 feedbacks를 (from→to) 키로 diff해 태그 increment 델타만 적용.
export const aggregateFlowerFeedback = onDocumentWritten(
  { document: 'wrapups/{wrapupId}', region: REGION },
  async (event) => {
    const after = event.data?.after
    if (!after?.exists) return // 랩업 삭제 — 기록 보존 철학상 이미 받은 꽃은 회수하지 않음
    const beforeFb = event.data.before?.data()?.feedbacks || []
    const afterFb  = after.data().feedbacks || []
    if (!beforeFb.length && !afterFb.length) return

    const key  = (f) => `${f.fromUserId}→${f.toUserId}`
    const prev = new Map(beforeFb.map((f) => [key(f), f]))
    const next = new Map(afterFb.map((f) => [key(f), f]))

    const deltas = new Map() // toUserId → { tags: Map(tagId→±n), senders: Set }
    const bucket = (uid) => {
      if (!deltas.has(uid)) deltas.set(uid, { tags: new Map(), senders: new Set() })
      return deltas.get(uid)
    }
    next.forEach((f, k) => {
      const old = prev.get(k)
      const b = bucket(f.toUserId)
      const oldTags = new Set((old?.tags || []).map((t) => t.id))
      const newTags = new Set((f.tags || []).map((t) => t.id))
      newTags.forEach((id) => { if (!oldTags.has(id)) b.tags.set(id, (b.tags.get(id) || 0) + 1) })
      oldTags.forEach((id) => { if (!newTags.has(id)) b.tags.set(id, (b.tags.get(id) || 0) - 1) })
      if (!old) b.senders.add(f.fromUserId)
    })
    prev.forEach((f, k) => { // 삭제된 피드백 — 태그 회수
      if (next.has(k)) return
      const b = bucket(f.toUserId)
      ;(f.tags || []).forEach((t) => b.tags.set(t.id, (b.tags.get(t.id) || 0) - 1))
    })

    const writes = []
    deltas.forEach(({ tags, senders }, toUserId) => {
      const upd = {}
      tags.forEach((d, id) => { if (d !== 0) upd[`flowerTagSummary.${id}`] = FieldValue.increment(d) })
      if (senders.size) upd.flowerSenderUids = FieldValue.arrayUnion(...senders)
      if (Object.keys(upd).length) {
        writes.push(db.doc(`users/${toUserId}`).update(upd).catch(() => {})) // 탈퇴 등으로 문서 없으면 무시
      }
    })
    await Promise.all(writes)
  }
)

// ── 함수 E: 학생 인증 → plan='student' (서버 권한) ──────────────
// 클라가 users.plan을 직접 못 쓰게 규칙으로 막고(자가 결제 우회 차단),
// 학교 이메일 도메인 검증을 서버에서 수행해 plan을 부여한다(Admin SDK가 규칙 우회).
// ⚠️ 이메일 "소유" 증명은 아직 없음(타이핑한 도메인만 확인) — 추후 OTP로 강화 가능.
const STUDENT_DOMAINS = ['.ac.kr', '.edu', '.ac.jp', '.ac.uk', '.edu.au']
export const verifyStudent = onCall({ region: REGION }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', '로그인이 필요해요.')
  const email = String(request.data?.email || '').trim().toLowerCase()
  if (!email || !STUDENT_DOMAINS.some((d) => email.endsWith(d))) {
    throw new HttpsError('invalid-argument', '학교 이메일(.ac.kr, .edu 등)만 인증할 수 있어요.')
  }
  await db.doc(`users/${request.auth.uid}`).set({
    plan: 'student',
    studentEmail: email,
    studentVerifiedAt: new Date().toISOString(),
  }, { merge: true })
  return { ok: true, plan: 'student' }
})

// 컬렉션 청크 삭제 (배치 500 한도 대비)
async function deleteCollection(colRef, batchSize = 400) {
  while (true) {
    const snap = await colRef.limit(batchSize).get()
    if (snap.empty) break
    const batch = db.batch()
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
    if (snap.size < batchSize) break
  }
}

// 호출자가 어드민인지 — 부트스트랩 이메일 또는 승급된 유저(users.isAdmin == true)
async function isCallerAdmin(auth) {
  if (!auth?.uid) return false
  if (auth.token?.email === ADMIN_EMAIL) return true
  const snap = await db.collection('users').doc(auth.uid).get()
  return snap.exists && snap.data()?.isAdmin === true
}

// ── 함수 C: 어드민 유저 완전 삭제 (Firebase Auth + Firestore) ──────
// 클라에선 다른 유저의 Auth를 못 지우므로 Admin SDK로 처리. 어드민(루트·승급)만 호출 가능.
export const adminDeleteUser = onCall({ region: REGION }, async (request) => {
  if (!(await isCallerAdmin(request.auth))) {
    throw new HttpsError('permission-denied', '관리자만 사용할 수 있어요.')
  }
  const uid = request.data?.uid
  if (!uid) throw new HttpsError('invalid-argument', 'uid가 필요해요.')
  if (uid === request.auth.uid) {
    throw new HttpsError('failed-precondition', '본인 계정은 여기서 삭제할 수 없어요.')
  }

  // 1) 참여 프로젝트 정리 — 혼자인 건 메시지까지 완전 삭제, 아니면 명단에서 빼고 formerMembers 보존
  const projSnap = await db.collection('projects').where('memberIds', 'array-contains', uid).get()
  for (const pd of projSnap.docs) {
    const p = pd.data()
    const leaving = (p.members || []).find((m) => m.id === uid)
    const others  = (p.members || []).filter((m) => m.id !== uid)
    if (others.length === 0) {
      for (const room of (p.rooms || [])) {
        await deleteCollection(db.collection('rooms').doc(room.id).collection('messages'))
        // 방에 올린 Storage 파일 정리 (클라 deleteProjectDeep과 동일) — best-effort
        try { await getStorage().bucket(STORAGE_BUCKET).deleteFiles({ prefix: `chat/${room.id}/` }) } catch { /* 없거나 권한 — 무시 */ }
        // 방 메타(rooms/{id}) 정리 — 메시지 접근 검증용 문서
        await db.doc(`rooms/${room.id}`).delete().catch(() => {})
      }
      await pd.ref.delete()
    } else {
      const former = (p.formerMembers || []).filter((m) => m.id !== uid)
      if (leaving) former.push({ id: leaving.id, name: leaving.name, role: leaving.role, affiliation: leaving.affiliation || '', leftAt: new Date().toISOString(), leftReason: 'deleted' })
      const updates = { memberIds: others.map((m) => m.id), members: others, formerMembers: former }
      if (p.leaderId === uid) {
        const newLeader = others.find((m) => m.role === 'sub-leader') || others[0]
        updates.leaderId = newLeader.id
        updates.members  = others.map((m) => m.id === newLeader.id ? { ...m, role: 'leader' } : m)
      }
      await pd.ref.update(updates)
    }
  }

  // 2) 이 유저가 올린 매치 모집글 삭제 (죽은 모집글 방지)
  const mpSnap = await db.collection('matchPosts').where('leaderId', '==', uid).get()
  await Promise.all(mpSnap.docs.map((d) => d.ref.delete().catch(() => {})))

  // 3) users 문서 + 본인전용 PII 서브문서 삭제
  await db.doc(`users/${uid}/private/self`).delete().catch(() => {})
  await db.collection('users').doc(uid).delete().catch(() => {})

  // 4) Firebase Auth 계정 삭제
  let authDeleted = true
  try { await getAuth().deleteUser(uid) } catch { authDeleted = false }

  return { ok: true, authDeleted }
})

// ── 함수 F: PII 1회 마이그레이션 — 본문서의 phone·blockedUsers를 본인전용 서브문서로 이전 ──
// C1: users 본문서는 인증 유저 전체가 읽으므로(username→uid 열거로 대량 덤프 가능) PII를 두면 안 됨.
// 어드민이 1회 트리거: 서브문서(users/{uid}/private/self)로 복사 후 본문서에서 삭제.
// ※ 클라이언트가 새 버전(서브문서 읽기)으로 배포된 뒤 실행할 것.
export const migratePiiToPrivate = onCall({ region: REGION }, async (request) => {
  if (!(await isCallerAdmin(request.auth))) {
    throw new HttpsError('permission-denied', '관리자만 사용할 수 있어요.')
  }
  let scanned = 0, moved = 0, last = null
  while (true) {
    let q = db.collection('users').orderBy('__name__').limit(300)
    if (last) q = q.startAfter(last)
    const snap = await q.get()
    if (snap.empty) break
    for (const d of snap.docs) {
      scanned++
      const data = d.data()
      const priv = {}, clear = {}
      if (data.phone !== undefined)        { priv.phone = data.phone;               clear.phone = FieldValue.delete() }
      if (data.blockedUsers !== undefined) { priv.blockedUsers = data.blockedUsers; clear.blockedUsers = FieldValue.delete() }
      if (!Object.keys(priv).length) continue
      await db.doc(`users/${d.id}/private/self`).set(priv, { merge: true })
      await d.ref.update(clear)
      moved++
    }
    last = snap.docs[snap.docs.length - 1]
    if (snap.size < 300) break
  }
  return { ok: true, scanned, moved }
})
