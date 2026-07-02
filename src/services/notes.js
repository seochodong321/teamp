import {
  addDoc, arrayRemove, arrayUnion, collection, doc, onSnapshot,
  query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore'
import { db } from '../firebase.js'

// 쪽지(notes) 데이터 계층 — 알림·토스트는 호출부(MessagesPage) 책임.

// 내 쪽지 실시간 구독 — 최신 메시지 순 정렬. 반환값은 unsubscribe.
export function subscribeMyNotes(uid, onNotes, onError) {
  const q = query(collection(db, 'notes'), where('participants', 'array-contains', uid))
  return onSnapshot(q, (snap) => {
    onNotes(snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.lastMessageAt?.seconds || 0) - (a.lastMessageAt?.seconds || 0)))
  }, onError)
}

// 읽음 처리 — 실패는 조용히(읽음표시는 부가 기능)
export async function markNoteRead(noteId, uid) {
  await updateDoc(doc(db, 'notes', noteId), { [`read.${uid}`]: true }).catch(() => {})
}

export async function createNote(payload) {
  await addDoc(collection(db, 'notes'), {
    ...payload,
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
  })
}

// 답장 — 상대가 삭제(hiddenBy)했어도 새 답장이 오면 다시 보이게
export async function replyToNote(noteId, { message, uid, otherUid }) {
  await updateDoc(doc(db, 'notes', noteId), {
    messages: arrayUnion(message),
    lastMessageAt: serverTimestamp(),
    [`read.${otherUid}`]: false,
    [`read.${uid}`]: true,
    hiddenBy: arrayRemove(otherUid),
  })
}

// 내 쪽지함에서만 삭제 — 상대방 쪽엔 남는 소프트 삭제
export async function hideNote(noteId, uid) {
  await updateDoc(doc(db, 'notes', noteId), { hiddenBy: arrayUnion(uid) })
}
