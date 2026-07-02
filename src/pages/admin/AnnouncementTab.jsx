import React, { useState } from 'react'
import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase.js'
import styles from '../AdminPage.module.css'

export default function AnnouncementTab({ currentUser }) {
  const [subject, setSubject] = useState('')
  const [body,    setBody]    = useState('')
  const [sending, setSending] = useState(false)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState(null)

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return
    setSending(true)
    setResult(null)
    setError(null)
    try {
      const usersSnap = await getDocs(collection(db, 'users'))
      const targets = usersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.id !== currentUser.id)

      const now = new Date()
      const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      const CHUNK = 400
      let sent = 0

      for (let i = 0; i < targets.length; i += CHUNK) {
        const batch = writeBatch(db)
        targets.slice(i, i + CHUNK).forEach((user) => {
          const ref = doc(collection(db, 'notes'))
          batch.set(ref, {
            fromUid:      currentUser.id,
            fromName:     '📢 팀프 공식',
            fromUsername: '@teamp',
            toUid:        user.id,
            toName:       user.name || '유저',
            toUsername:   user.username || '',
            subject,
            participants: [user.id],
            messages: [{ senderUid: currentUser.id, senderName: '📢 팀프 공식', text: body, time: timeStr }],
            read:         { [user.id]: false },
            isAnnouncement: true,
            createdAt:    serverTimestamp(),
            lastMessageAt: serverTimestamp(),
          })
          sent++
        })
        await batch.commit()
      }
      setResult(sent)
      setSubject('')
      setBody('')
    } catch (err) {
      setError(err?.message || '발송 중 오류가 발생했어요.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.announceWrap}>
        <p className={styles.announceDesc}>모든 유저의 쪽지함으로 공지가 발송됩니다.</p>
        <input
          className={styles.searchInput}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="제목..."
        />
        <textarea
          className={styles.announceBody}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="내용을 입력하세요..."
          rows={6}
        />
        {error  && <p className={styles.tabError}>{error}</p>}
        {result != null && <p className={styles.announceSuccess}>✅ {result}명에게 발송 완료</p>}
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={sending || !subject.trim() || !body.trim()}
        >
          {sending ? '발송 중...' : '📢 전체 발송'}
        </button>
      </div>
    </div>
  )
}


