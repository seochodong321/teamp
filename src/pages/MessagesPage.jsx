import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  collection, addDoc, query, where, orderBy, onSnapshot,
  updateDoc, doc, getDocs, serverTimestamp, arrayUnion,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import styles from './MessagesPage.module.css'

export default function MessagesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { currentUser, showError } = useStore()

  const composeMode = searchParams.get('compose') === '1'
  const initTo      = searchParams.get('to') || ''
  const matchId     = searchParams.get('matchId') || ''
  const matchTitle  = searchParams.get('matchTitle') || ''

  const [notes, setNotes]   = useState([])
  const [selected, setSelected] = useState(null)
  const [tab, setTab]       = useState('received') // received | sent
  const [loading, setLoading] = useState(true)

  // 쪽지 쓰기
  const [showCompose, setShowCompose] = useState(composeMode)
  const [toInput, setToInput]   = useState(initTo)
  const [toUid, setToUid]       = useState(null)
  const [toName, setToName]     = useState('')
  const [toStatus, setToStatus] = useState('idle') // idle | checking | found | notfound
  const [subject, setSubject]   = useState(matchTitle ? `[매치 문의] ${matchTitle}` : '')
  const [body, setBody]         = useState('')
  const [sending, setSending]   = useState(false)

  // 답장
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying]   = useState(false)

  // 쪽지 목록 실시간 구독
  useEffect(() => {
    if (!currentUser?.id) return
    const q = query(
      collection(db, 'notes'),
      where('participants', 'array-contains', currentUser.id),
      orderBy('lastMessageAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return () => unsub()
  }, [currentUser?.id])

  // 초기 to 입력이 있으면 자동 검색
  useEffect(() => {
    if (initTo) lookupUsername(initTo)
  }, [])

  // 쪽지 읽음 처리
  const markRead = async (note) => {
    if (!note.read?.[currentUser.id]) {
      await updateDoc(doc(db, 'notes', note.id), {
        [`read.${currentUser.id}`]: true,
      }).catch(() => {})
    }
  }

  const selectNote = (note) => {
    setSelected(note)
    setShowCompose(false)
    markRead(note)
  }

  const lookupUsername = async (raw) => {
    const val = raw.trim().toLowerCase().replace(/^@/, '')
    if (!val) { setToUid(null); setToStatus('idle'); return }
    setToStatus('checking')
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('username', '==', `@${val}`)))
      if (!snap.empty) {
        const d = snap.docs[0].data()
        if (d.uid === currentUser.id) { setToStatus('notfound'); setToUid(null); return }
        setToUid(d.uid)
        setToName(d.name)
        setToStatus('found')
      } else {
        setToUid(null); setToStatus('notfound')
      }
    } catch { setToUid(null); setToStatus('idle') }
  }

  const handleSend = async () => {
    if (!toUid || !body.trim()) return
    setSending(true)
    try {
      await addDoc(collection(db, 'notes'), {
        participants: [currentUser.id, toUid],
        fromUid: currentUser.id,
        fromName: currentUser.name,
        fromUsername: currentUser.username,
        toUid,
        toName,
        toUsername: toInput.startsWith('@') ? toInput : `@${toInput}`,
        subject: subject.trim() || '(제목 없음)',
        matchId: matchId || null,
        matchTitle: matchTitle || null,
        messages: [{
          senderUid: currentUser.id,
          senderName: currentUser.name,
          text: body.trim(),
          time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        }],
        createdAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        read: { [currentUser.id]: true, [toUid]: false },
      })
      setShowCompose(false)
      setToInput(''); setToUid(null); setToName(''); setToStatus('idle')
      setSubject(''); setBody('')
      navigate('/messages', { replace: true })
    } catch (e) {
      showError('전송에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setSending(false)
    }
  }

  const handleReply = async () => {
    if (!selected || !replyText.trim()) return
    setReplying(true)
    try {
      await updateDoc(doc(db, 'notes', selected.id), {
        messages: arrayUnion({
          senderUid: currentUser.id,
          senderName: currentUser.name,
          text: replyText.trim(),
          time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        }),
        lastMessageAt: serverTimestamp(),
        [`read.${selected.fromUid === currentUser.id ? selected.toUid : selected.fromUid}`]: false,
        [`read.${currentUser.id}`]: true,
      })
      setReplyText('')
    } catch {
      showError('답장 전송에 실패했어요.')
    } finally {
      setReplying(false)
    }
  }

  const receivedNotes = notes.filter((n) => n.toUid === currentUser.id)
  const sentNotes     = notes.filter((n) => n.fromUid === currentUser.id)
  const visibleNotes  = tab === 'received' ? receivedNotes : sentNotes
  const unreadCount   = receivedNotes.filter((n) => !n.read?.[currentUser.id]).length

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>쪽지함 ✉️</h1>
          <p className={styles.subtitle}>@아이디로 상대방에게 쪽지를 보낼 수 있어요</p>
        </div>
        <button className={styles.composeBtn} onClick={() => { setShowCompose(true); setSelected(null) }}>
          + 쪽지 쓰기
        </button>
      </div>

      <div className={styles.layout}>
        {/* 목록 패널 */}
        <div className={styles.listPanel}>
          <div className={styles.tabRow}>
            <button className={`${styles.tabBtn} ${tab === 'received' ? styles.tabActive : ''}`}
              onClick={() => setTab('received')}>
              받은 쪽지 {unreadCount > 0 && <span className={styles.unreadBadge}>{unreadCount}</span>}
            </button>
            <button className={`${styles.tabBtn} ${tab === 'sent' ? styles.tabActive : ''}`}
              onClick={() => setTab('sent')}>보낸 쪽지</button>
          </div>

          {loading ? (
            <p className={styles.empty}>불러오는 중...</p>
          ) : visibleNotes.length === 0 ? (
            <div className={styles.emptyWrap}>
              <p className={styles.emptyIcon}>✉️</p>
              <p className={styles.emptyText}>{tab === 'received' ? '받은 쪽지가 없어요' : '보낸 쪽지가 없어요'}</p>
            </div>
          ) : (
            visibleNotes.map((note) => {
              const isUnread = tab === 'received' && !note.read?.[currentUser.id]
              const lastMsg = note.messages?.[note.messages.length - 1]
              return (
                <div key={note.id}
                  className={`${styles.noteCard} ${selected?.id === note.id ? styles.noteCardActive : ''} ${isUnread ? styles.noteUnread : ''}`}
                  onClick={() => selectNote(note)}>
                  <div className={styles.noteCardTop}>
                    <span className={styles.notePeer}>
                      {tab === 'received' ? note.fromUsername || note.fromName : note.toUsername || note.toName}
                    </span>
                    {isUnread && <span className={styles.unreadDot} />}
                  </div>
                  <p className={styles.noteSubject}>{note.subject}</p>
                  {note.matchTitle && (
                    <span className={styles.matchBadge}>🤝 {note.matchTitle}</span>
                  )}
                  {lastMsg && (
                    <p className={styles.notePreview}>{lastMsg.text}</p>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* 상세 / 작성 패널 */}
        <div className={styles.detailPanel}>
          {showCompose ? (
            <div className={styles.composeWrap}>
              <h3 className={styles.composeTitle}>쪽지 쓰기</h3>

              <div className={styles.composeField}>
                <label className={styles.composeLabel}>받는 사람 (@아이디)</label>
                <div style={{ position: 'relative' }}>
                  <input className={styles.composeInput}
                    value={toInput}
                    onChange={(e) => { setToInput(e.target.value); lookupUsername(e.target.value) }}
                    placeholder="@username"
                  />
                  {toStatus === 'found'    && <span className={styles.toFound}>✓ {toName}</span>}
                  {toStatus === 'notfound' && <span className={styles.toNotFound}>찾을 수 없어요</span>}
                  {toStatus === 'checking' && <span className={styles.toChecking}>검색 중…</span>}
                </div>
              </div>

              <div className={styles.composeField}>
                <label className={styles.composeLabel}>제목</label>
                <input className={styles.composeInput} value={subject}
                  onChange={(e) => setSubject(e.target.value)} placeholder="제목을 입력하세요" />
              </div>

              {matchTitle && (
                <div className={styles.matchContext}>
                  🤝 <strong>{matchTitle}</strong> 모집글 관련 문의입니다
                </div>
              )}

              <div className={styles.composeField}>
                <label className={styles.composeLabel}>내용</label>
                <textarea className={styles.composeTextarea} value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="전달할 내용을 입력하세요" rows={7} />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className={styles.cancelBtn} onClick={() => { setShowCompose(false); navigate('/messages', { replace: true }) }}>취소</button>
                <button className={styles.sendBtn}
                  disabled={!toUid || !body.trim() || sending}
                  onClick={handleSend}>
                  {sending ? '전송 중...' : '전송하기'}
                </button>
              </div>
            </div>
          ) : selected ? (
            <div className={styles.threadWrap}>
              <div className={styles.threadHeader}>
                <div>
                  <p className={styles.threadSubject}>{selected.subject}</p>
                  {selected.matchTitle && (
                    <span className={styles.matchBadge}>🤝 {selected.matchTitle}</span>
                  )}
                  <p className={styles.threadPeers}>
                    {selected.fromUsername} → {selected.toUsername}
                  </p>
                </div>
              </div>
              <div className={styles.messages}>
                {(selected.messages || []).map((msg, i) => {
                  const isMine = msg.senderUid === currentUser.id
                  return (
                    <div key={i} className={`${styles.msgRow} ${isMine ? styles.msgRowMine : ''}`}>
                      {!isMine && (
                        <div className={styles.msgAvatar}>{msg.senderName.charAt(0)}</div>
                      )}
                      <div className={styles.msgBubble}>
                        {!isMine && <p className={styles.msgSender}>{msg.senderName}</p>}
                        <p className={styles.msgText}>{msg.text}</p>
                        <span className={styles.msgTime}>{msg.time}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className={styles.replyArea}>
                <textarea className={styles.replyInput} value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="답장을 입력하세요" rows={3} />
                <button className={styles.sendBtn} disabled={!replyText.trim() || replying}
                  onClick={handleReply}>
                  {replying ? '전송 중...' : '답장'}
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.detailEmpty}>
              <p>쪽지를 선택하거나 새로 작성해보세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
