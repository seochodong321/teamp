import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  collection, addDoc, query, where, onSnapshot,
  updateDoc, doc, getDocs, serverTimestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import { notifyUser } from '../store/helpers.js'
import ReportModal from '../components/ReportModal.jsx'
import styles from './MessagesPage.module.css'

function formatDate(seconds) {
  if (!seconds) return ''
  return new Date(seconds * 1000).toLocaleDateString('ko-KR', {
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function MessagesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { currentUser, showError, showConfirm } = useStore()

  const composeMode = searchParams.get('compose') === '1'
  const initTo      = searchParams.get('to') || ''
  const matchId     = searchParams.get('matchId') || ''
  const matchTitle  = searchParams.get('matchTitle') || ''

  const [notes, setNotes]   = useState([])
  const [selected, setSelected] = useState(null)
  const [tab, setTab]       = useState('received')
  const [loading, setLoading] = useState(true)

  // 쪽지 쓰기
  const [showCompose, setShowCompose] = useState(composeMode)
  const [toInput, setToInput]   = useState(initTo)
  const [toUid, setToUid]       = useState(null)
  const [toName, setToName]     = useState('')
  const [toStatus, setToStatus] = useState('idle')
  const [subject, setSubject]   = useState(matchTitle ? `[매치 문의] ${matchTitle}` : '')
  const [body, setBody]         = useState('')
  const [sending, setSending]   = useState(false)

  // 답장
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying]   = useState(false)

  // 신고
  const [reportNote, setReportNote] = useState(null)

  // 쪽지 목록 실시간 구독
  useEffect(() => {
    if (!currentUser?.id) return
    const q = query(
      collection(db, 'notes'),
      where('participants', 'array-contains', currentUser.id)
    )
    const unsub = onSnapshot(q, (snap) => {
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.lastMessageAt?.seconds || 0) - (a.lastMessageAt?.seconds || 0))
      setNotes(sorted)
      setLoading(false)
    }, (err) => {
      console.error('[notes] 구독 실패:', err)
      setLoading(false)
    })
    return () => unsub()
  }, [currentUser?.id])

  // 초기 to 입력이 있으면 자동 검색
  useEffect(() => {
    if (initTo) lookupUsername(initTo)
  }, [])

  // 열려 있는 쪽지를 notes 실시간 업데이트에 따라 갱신
  useEffect(() => {
    if (!selected) return
    const updated = notes.find((n) => n.id === selected.id)
    if (updated) setSelected(updated)
  }, [notes])

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
    setShowReply(false)
    setReplyText('')
    markRead(note)
  }

  const lookupUsername = async (raw) => {
    const val = raw.trim().toLowerCase().replace(/^@/, '')
    if (!val) { setToUid(null); setToStatus('idle'); return }
    setToStatus('checking')
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('username', '==', `@${val}`)))
      if (!snap.empty) {
        const docId = snap.docs[0].id
        const d     = snap.docs[0].data()
        if (docId === currentUser.id) { setToStatus('notfound'); setToUid(null); return }
        setToUid(docId)
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
      await notifyUser(toUid, {
        type: 'note',
        text: `✉️ ${currentUser.name}님이 쪽지를 보냈어요: ${subject.trim() || '(제목 없음)'}`,
        link: '/messages',
      })
      setShowCompose(false)
      setToInput(''); setToUid(null); setToName(''); setToStatus('idle')
      setSubject(''); setBody('')
      navigate('/messages', { replace: true })
    } catch {
      showError('전송에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setSending(false)
    }
  }

  const handleReply = async () => {
    if (!selected || !replyText.trim()) return
    setReplying(true)
    const otherUid = selected.fromUid === currentUser.id ? selected.toUid : selected.fromUid
    try {
      await updateDoc(doc(db, 'notes', selected.id), {
        messages: arrayUnion({
          senderUid: currentUser.id,
          senderName: currentUser.name,
          text: replyText.trim(),
          time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        }),
        lastMessageAt: serverTimestamp(),
        [`read.${otherUid}`]: false,
        [`read.${currentUser.id}`]: true,
        // 상대가 이 쪽지를 삭제(hiddenBy)했어도 새 답장이 오면 다시 보이게
        hiddenBy: arrayRemove(otherUid),
      })
      await notifyUser(otherUid, {
        type: 'note',
        text: `✉️ ${currentUser.name}님이 쪽지에 답장했어요: ${selected.subject || ''}`,
        link: '/messages',
      })
      setReplyText('')
      setShowReply(false)
    } catch {
      showError('답장 전송에 실패했어요.')
    } finally {
      setReplying(false)
    }
  }

  // 내 쪽지함에서 삭제 — 상대방 쪽엔 남는 소프트 삭제(hiddenBy)
  const handleDelete = async (note) => {
    if (!await showConfirm('이 쪽지를 삭제할까요?\n내 쪽지함에서만 사라지고 상대방에게는 그대로 남아요.')) return
    try {
      await updateDoc(doc(db, 'notes', note.id), { hiddenBy: arrayUnion(currentUser.id) })
      setSelected(null)
    } catch {
      showError('삭제에 실패했어요. 잠시 후 다시 시도해주세요.')
    }
  }

  const openReport = (note) => {
    const content = (note.messages || []).map((m) => `${m.senderName}: ${m.text}`).join('\n').slice(0, 1000)
    setReportNote({
      targetId: note.id,
      targetName: `쪽지: ${note.subject}`,
      extra: {
        noteFromUid:  note.fromUid,
        noteFromName: note.fromName,
        noteToName:   note.toName,
        noteSubject:  note.subject,
        noteContent:  content,
      },
    })
  }

  // 숨김 처리한 쪽지는 내 목록에서 제외
  const visibleAll    = notes.filter((n) => !(n.hiddenBy || []).includes(currentUser.id))
  const receivedNotes = visibleAll.filter((n) => n.toUid === currentUser.id)
  const sentNotes     = visibleAll.filter((n) => n.fromUid === currentUser.id)
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
          ✏️ 쪽지 쓰기
        </button>
      </div>

      <div className={`${styles.layout} ${(selected || showCompose) ? styles.layoutDetail : ''}`}>
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
              const hasReplies = (note.messages?.length || 0) > 1
              return (
                <div key={note.id}
                  className={`${styles.noteCard} ${selected?.id === note.id ? styles.noteCardActive : ''} ${isUnread ? styles.noteUnread : ''}`}
                  onClick={() => selectNote(note)}>
                  <div className={styles.noteCardTop}>
                    <span className={styles.noteCardIcon}>{isUnread ? '📩' : '📄'}</span>
                    <span className={styles.notePeer}>
                      {tab === 'received' ? note.fromUsername || note.fromName : note.toUsername || note.toName}
                    </span>
                    {isUnread && <span className={styles.unreadDot} />}
                  </div>
                  <p className={styles.noteSubject}>{note.subject}</p>
                  {note.matchTitle && (
                    <span className={styles.matchBadge}>🤝 {note.matchTitle}</span>
                  )}
                  <div className={styles.noteCardBottom}>
                    {lastMsg && <p className={styles.notePreview}>{lastMsg.text}</p>}
                    {hasReplies && <span className={styles.replyCount}>↩ {note.messages.length - 1}</span>}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* 상세 / 작성 패널 */}
        <div className={styles.detailPanel}>
          <button className={styles.mobileBackBtn} onClick={() => { setSelected(null); setShowCompose(false) }}>
            ← 목록으로
          </button>
          {showCompose ? (
            /* ── 쪽지 작성 ── */
            <div className={styles.composeWrap}>
              <div className={styles.composeHeader}>
                <span className={styles.composeIcon}>✏️</span>
                <h3 className={styles.composeTitle}>새 쪽지 작성</h3>
              </div>

              <div className={styles.composePaper}>
                <div className={styles.composeRow}>
                  <span className={styles.composeRowLabel}>보내는 이</span>
                  <span className={styles.composeRowValue}>{currentUser.username || currentUser.name}</span>
                </div>
                <div className={styles.composeDivider} />

                <div className={styles.composeRow}>
                  <span className={styles.composeRowLabel}>받는 이</span>
                  <div className={styles.composeRowInput} style={{ position: 'relative' }}>
                    <input className={styles.composeInlineInput}
                      value={toInput}
                      onChange={(e) => { setToInput(e.target.value); lookupUsername(e.target.value) }}
                      placeholder="@username"
                    />
                    {toStatus === 'found'    && <span className={styles.toFound}>✓ {toName}</span>}
                    {toStatus === 'notfound' && <span className={styles.toNotFound}>찾을 수 없어요</span>}
                    {toStatus === 'checking' && <span className={styles.toChecking}>검색 중…</span>}
                  </div>
                </div>
                <div className={styles.composeDivider} />

                <div className={styles.composeRow}>
                  <span className={styles.composeRowLabel}>제목</span>
                  <div className={styles.composeRowInput}>
                    <input className={styles.composeInlineInput} value={subject}
                      onChange={(e) => setSubject(e.target.value)} placeholder="제목을 입력하세요" />
                  </div>
                </div>

                {matchTitle && (
                  <div className={styles.matchContext}>
                    🤝 <strong>{matchTitle}</strong> 모집글 관련 문의입니다
                  </div>
                )}

                <div className={styles.composeBodyArea}>
                  <textarea className={styles.composeTextarea} value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="전달할 내용을 적어주세요..." rows={8} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className={styles.cancelBtn}
                  onClick={() => { setShowCompose(false); navigate('/messages', { replace: true }) }}>
                  취소
                </button>
                <button className={styles.sendBtn}
                  disabled={!toUid || !body.trim() || sending}
                  onClick={handleSend}>
                  {sending ? '전송 중...' : '✉️ 쪽지 보내기'}
                </button>
              </div>
            </div>

          ) : selected ? (
            /* ── 쪽지 읽기 ── */
            <div className={styles.noteView}>
              <div className={styles.noteViewMeta}>
                <p className={styles.noteViewSubject}>{selected.subject}</p>
                {selected.matchTitle && (
                  <span className={styles.matchBadge}>🤝 {selected.matchTitle}</span>
                )}
                <div className={styles.noteViewPeers}>
                  <span className={styles.metaLabel}>보낸 이</span>
                  <span className={styles.metaValue}>{selected.fromUsername || selected.fromName}</span>
                  <span className={styles.metaArrow}>→</span>
                  <span className={styles.metaLabel}>받는 이</span>
                  <span className={styles.metaValue}>{selected.toUsername || selected.toName}</span>
                  {selected.createdAt?.seconds && (
                    <>
                      <span className={styles.metaSep}>·</span>
                      <span className={styles.metaDate}>{formatDate(selected.createdAt.seconds)}</span>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.noteScrollArea}>
                {(selected.messages || []).map((msg, i) => {
                  const isMine = msg.senderUid === currentUser.id
                  return (
                    <div key={i} className={styles.noteBlock}>
                      <div className={styles.noteBlockMeta}>
                        <span className={styles.noteBlockSender}>
                          {isMine ? `나 (${currentUser.username || currentUser.name})` : `${msg.senderName}`}
                          {i > 0 && <span className={styles.replyTag}>↩ 답장</span>}
                        </span>
                        <span className={styles.noteBlockTime}>{msg.time}</span>
                      </div>
                      <div className={`${styles.noteBlockContent} ${isMine ? styles.noteBlockMine : ''}`}>
                        <p className={styles.noteBlockText}>{msg.text}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 답장 영역 */}
              {showReply ? (
                <div className={styles.replyArea}>
                  <p className={styles.replyLabel}>↩ 답장 쓰기</p>
                  <textarea className={styles.replyInput} value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="답장을 적어주세요..." rows={4}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className={styles.cancelBtn} onClick={() => { setShowReply(false); setReplyText('') }}>취소</button>
                    <button className={styles.sendBtn} disabled={!replyText.trim() || replying}
                      onClick={handleReply}>
                      {replying ? '전송 중...' : '↩ 답장 보내기'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.replyBarRow}>
                  <button className={styles.replyBarBtn} onClick={() => setShowReply(true)}>
                    ↩ 답장하기
                  </button>
                  <div className={styles.noteActionsRight}>
                    {selected.fromUid !== currentUser.id && (
                      <button className={styles.noteActionBtn} onClick={() => openReport(selected)}>🚩 신고</button>
                    )}
                    <button className={`${styles.noteActionBtn} ${styles.noteDeleteBtn}`} onClick={() => handleDelete(selected)}>🗑 삭제</button>
                  </div>
                </div>
              )}
            </div>

          ) : (
            <div className={styles.detailEmpty}>
              <p className={styles.detailEmptyIcon}>📭</p>
              <p>쪽지를 선택하거나 새로 작성해보세요</p>
            </div>
          )}
        </div>
      </div>

      {reportNote && (
        <ReportModal
          type="note"
          targetId={reportNote.targetId}
          targetName={reportNote.targetName}
          extra={reportNote.extra}
          onClose={() => setReportNote(null)}
        />
      )}
    </div>
  )
}
