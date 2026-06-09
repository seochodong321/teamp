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
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { getAuth } from 'firebase-admin/auth'

initializeApp()
const db = getFirestore()
const REGION = 'asia-northeast3'
const ADMIN_EMAIL = 'seobomin524@gmail.com'

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

// ── 함수 C: 어드민 유저 완전 삭제 (Firebase Auth + Firestore) ──────
// 클라에선 다른 유저의 Auth를 못 지우므로 Admin SDK로 처리. 어드민 이메일만 호출 가능.
export const adminDeleteUser = onCall({ region: REGION }, async (request) => {
  if (request.auth?.token?.email !== ADMIN_EMAIL) {
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

  // 3) users 문서 삭제
  await db.collection('users').doc(uid).delete().catch(() => {})

  // 4) Firebase Auth 계정 삭제
  let authDeleted = true
  try { await getAuth().deleteUser(uid) } catch { authDeleted = false }

  return { ok: true, authDeleted }
})
