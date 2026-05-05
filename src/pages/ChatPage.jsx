import React, { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { arrayUnion, collection, doc, onSnapshot, orderBy, query, writeBatch } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import styles from './ChatPage.module.css'

export default function ChatPage() {
  const { projectId, roomId } = useParams()
  const navigate = useNavigate()
  const { projects, messages, currentUser, sendMessage, sendFile, sendPoll, votePoll, markAsRead, dmRooms, dmRoomList, setRoomMessages, leaveDmRoom } = useStore()

  const project = projects.find((p) => p.id === projectId)

  // 일반 채팅방 or DM 방 (dmRooms 캐시 → dmRoomList Firestore 순서로 탐색)
  const dmRoom = Object.values(dmRooms).find((r) => r.id === roomId)
    || dmRoomList.find((r) => r.id === roomId)
    || null
  const room = project?.rooms.find((r) => r.id === roomId) || dmRoom

  const roomMessages = messages[roomId] || []
  const [text, setText]           = useState('')
  const [mode, setMode]           = useState('text') // 'text' | 'poll'
  const [pollQ, setPollQ]         = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [showToolbar, setShowToolbar] = useState(false)
  const [lightbox, setLightbox]   = useState(null)

  const isComposing = useRef(false)
  const bottomRef   = useRef(null)
  const fileRef     = useRef(null)

  // 채팅방 진입 시 Firestore 메시지 실시간 구독
  useEffect(() => {
    const q = query(
      collection(db, 'rooms', roomId, 'messages'),
      orderBy('createdAt', 'asc')
    )
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      setRoomMessages(roomId, msgs)
    })
    return () => unsub()
  }, [roomId, setRoomMessages])

  // 새 메시지 도착 시 스크롤 + 읽음 처리
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    markAsRead(roomId)
  }, [roomMessages.length, roomId, markAsRead])

  // 내가 읽지 않은 메시지에 readBy 추가 (배치 처리)
  useEffect(() => {
    if (!currentUser?.id) return
    const unread = roomMessages.filter(
      (m) => m.id && m.senderId !== currentUser.id && !(m.readBy || []).includes(currentUser.id)
    )
    if (!unread.length) return
    const batch = writeBatch(db)
    unread.slice(-30).forEach((m) => {
      batch.update(doc(db, 'rooms', roomId, 'messages', m.id), { readBy: arrayUnion(currentUser.id) })
    })
    batch.commit().catch(() => {})
  }, [roomMessages, roomId, currentUser?.id])

  if (!room) return <div className={styles.notFound}>채팅방을 찾을 수 없어요</div>

  const isDm = !!dmRoom
  const roomName = isDm
    ? (() => {
        const otherId = (dmRoom?.participants || []).find((id) => id !== currentUser.id)
        return dmRoom?.participantNames?.[otherId] || '1:1 대화'
      })()
    : room?.name
  const backLabel = isDm ? '← 뒤로' : `← ${project?.name || ''}`
  const backPath  = isDm ? `/project/${dmRoom?.projectId || projectId}` : `/project/${projectId}`

  const handleSend = () => {
    if (!text.trim()) return
    sendMessage(roomId, text.trim())
    setText('')
    // 전송 버튼 펄스 효과
    setSendPulse(true)
    setTimeout(() => setSendPulse(false), 400)
  }

  const [sendPulseActive, setSendPulse] = useState(false)
  const [showLeave, setShowLeave]       = useState(false)
  const [leaving, setLeaving]           = useState(false)

  const handleLeaveDm = async () => {
    // 상태 변경 전에 목적지 결정 — 마무리된 프로젝트면 홈으로
    const linkedProject = projects.find((p) => p.id === (dmRoom?.projectId || projectId))
    const destination = linkedProject?.status === 'active'
      ? `/project/${linkedProject.id}`
      : '/home'

    // 먼저 이동 후 정리 — 타이밍 문제(흰 화면) 방지
    navigate(destination)
    setShowLeave(false)
    try {
      await leaveDmRoom(roomId)
    } catch (e) {
      console.error('DM 나가기 오류:', e)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing.current) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    sendFile(roomId, file)
    e.target.value = ''
    setShowToolbar(false)
  }

  const handlePollSend = () => {
    const valid = pollOptions.filter((o) => o.trim())
    if (!pollQ.trim() || valid.length < 2) return
    sendPoll(roomId, pollQ.trim(), valid)
    setPollQ(''); setPollOptions(['', '']); setMode('text'); setShowToolbar(false)
  }

  const ROLE_LABEL = { leader: '👑', 'sub-leader': '⭐', member: '' }

  return (
    <div className={styles.page}>
      {lightbox && (
        <div className={styles.lightbox} onClick={() => setLightbox(null)}>
          <img src={lightbox.url} alt={lightbox.name} className={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
          <div className={styles.lightboxBar} onClick={(e) => e.stopPropagation()}>
            <span className={styles.lightboxName}>{lightbox.name}</span>
            <a href={lightbox.url} download={lightbox.name} target="_blank" rel="noreferrer" className={styles.lightboxDown}>⬇ 다운로드</a>
            <button className={styles.lightboxClose} onClick={() => setLightbox(null)}>✕</button>
          </div>
        </div>
      )}
      {/* DM 나가기 확인 모달 */}
      {showLeave && (
        <div className={styles.leaveBackdrop} onClick={() => setShowLeave(false)}>
          <div className={styles.leaveModal} onClick={(e) => e.stopPropagation()}>
            <p className={styles.leaveTitle}>대화방을 나갈까요?</p>
            <p className={styles.leaveDesc}>내 메시지가 모두 삭제되고, 상대방에게 퇴장 알림이 전송돼요.</p>
            <div className={styles.leaveBtns}>
              <button className={styles.leaveCancelBtn} onClick={() => setShowLeave(false)}>취소</button>
              <button className={styles.leaveConfirmBtn} disabled={leaving} onClick={handleLeaveDm}>
                {leaving ? '처리 중...' : '나가기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate(backPath)}>{backLabel}</button>
        <div className={styles.headerCenter}>
          <span className={styles.roomName}>{isDm ? `💬 ${roomName}` : `# ${roomName}`}</span>
          {!isDm && project && (
            <span className={styles.roomMeta}>
              {project.members.filter((m) =>
                m.role === 'leader' || m.role === 'sub-leader' ||
                m.roomIds.includes(roomId)
              ).length}명
            </span>
          )}
        </div>
        {isDm
          ? <button className={styles.dmLeaveBtn} onClick={() => setShowLeave(true)}>나가기</button>
          : <div style={{ width: 80 }} />
        }
      </div>

      {/* 메시지 목록 */}
      <div className={styles.messages}>
        {roomMessages.length === 0 ? (
          <div className={styles.emptyMessages}>
            <div className={styles.emptyIcon}>{isDm ? '💬' : '#'}</div>
            <p className={styles.emptyTitle}>{isDm ? `${roomName}와의 대화` : `# ${roomName}`}</p>
            <p className={styles.emptySub}>아직 메시지가 없어요. 첫 번째 메시지를 보내보세요!</p>
          </div>
        ) : (
          <div className={styles.dateDivider}><span>오늘</span></div>
        )}

        {roomMessages.map((msg) => {
          const isMine   = msg.senderId === currentUser.id
          const isSystem = msg.senderId === 'system'
          const member   = project?.members.find((m) => m.id === msg.senderId)

          // 시스템 알림
          if (isSystem || msg.type === 'notify') {
            return (
              <div key={msg.id} className={styles.systemMsg}>
                <span>{msg.text}</span>
              </div>
            )
          }

          // 이미지
          if (msg.type === 'image') {
            const readCount = (msg.readBy || []).filter((id) => id !== msg.senderId).length
            return (
              <div key={msg.id} className={`${styles.row} ${isMine ? styles.rowMine : ''}`}>
                {!isMine && <div className={styles.avatar}>{msg.senderName.charAt(0)}</div>}
                <div className={styles.bubbleWrap}>
                  {!isMine && (
                    <span className={styles.sender}>
                      {msg.senderName}
                      {member && ROLE_LABEL[member.role] && <span className={styles.roleTag}>{ROLE_LABEL[member.role]}</span>}
                    </span>
                  )}
                  <img
                    src={msg.fileUrl} alt={msg.text}
                    className={styles.chatImg}
                    onClick={() => setLightbox({ url: msg.fileUrl, name: msg.text })}
                  />
                  <div className={styles.timeRow}>
                    {isMine && readCount > 0 && <span className={styles.readReceipt}>읽음 {readCount}</span>}
                    <span className={styles.time}>{msg.time}</span>
                  </div>
                </div>
              </div>
            )
          }

          // 파일
          if (msg.type === 'file') {
            const readCount = (msg.readBy || []).filter((id) => id !== msg.senderId).length
            return (
              <div key={msg.id} className={`${styles.row} ${isMine ? styles.rowMine : ''}`}>
                {!isMine && <div className={styles.avatar}>{msg.senderName.charAt(0)}</div>}
                <div className={styles.bubbleWrap}>
                  {!isMine && (
                    <span className={styles.sender}>
                      {msg.senderName}
                      {member && ROLE_LABEL[member.role] && <span className={styles.roleTag}>{ROLE_LABEL[member.role]}</span>}
                    </span>
                  )}
                  <div className={`${styles.fileBubble} ${isMine ? styles.fileBubbleMine : ''}`}>
                    <span>📎</span>
                    <span className={styles.fileName}>{msg.text}</span>
                  </div>
                  <div className={styles.timeRow}>
                    {isMine && readCount > 0 && <span className={styles.readReceipt}>읽음 {readCount}</span>}
                    <span className={styles.time}>{msg.time}</span>
                  </div>
                </div>
              </div>
            )
          }

          // 투표
          if (msg.type === 'poll') {
            const total = msg.options.reduce((s, o) => s + o.votes.length, 0)
            return (
              <div key={msg.id} className={styles.pollWrap}>
                {!isMine && <div className={styles.avatar}>{msg.senderName.charAt(0)}</div>}
                <div className={styles.pollCard}>
                  <div className={styles.pollHeader}>
                    {!isMine && <span className={styles.pollAuthor}>{msg.senderName}</span>}
                    <span className={styles.pollBadge}>📊 투표</span>
                  </div>
                  <p className={styles.pollQuestion}>{msg.text}</p>
                  <div className={styles.pollOptions}>
                    {msg.options.map((opt) => {
                      const pct   = total === 0 ? 0 : Math.round((opt.votes.length / total) * 100)
                      const voted = opt.votes.includes(currentUser.id)
                      return (
                        <button key={opt.id}
                          className={`${styles.pollOption} ${voted ? styles.pollOptionVoted : ''}`}
                          onClick={() => votePoll(roomId, msg.id, opt.id)}>
                          <div className={styles.pollBar} style={{ width: `${pct}%` }} />
                          <span className={styles.pollOptLabel}>{opt.label}</span>
                          <span className={styles.pollOptPct}>{pct}%</span>
                        </button>
                      )
                    })}
                  </div>
                  <p className={styles.pollTotal}>총 {total}명 참여</p>
                </div>
              </div>
            )
          }

          // 일반 텍스트
          const readCount = (msg.readBy || []).filter((id) => id !== msg.senderId).length
          return (
            <div key={msg.id} className={`${styles.row} ${isMine ? styles.rowMine : ''}`}>
              {!isMine && <div className={styles.avatar}>{msg.senderName.charAt(0)}</div>}
              <div className={styles.bubbleWrap}>
                {!isMine && (
                  <span className={styles.sender}>
                    {msg.senderName}
                    {member && ROLE_LABEL[member.role] && <span className={styles.roleTag}>{ROLE_LABEL[member.role]}</span>}
                  </span>
                )}
                <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleOther}`}>
                  {msg.text}
                </div>
                <div className={styles.timeRow}>
                  {isMine && readCount > 0 && <span className={styles.readReceipt}>읽음 {readCount}</span>}
                  <span className={styles.time}>{msg.time}</span>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* 투표 만들기 */}
      {mode === 'poll' && (
        <div className={styles.pollMaker}>
          <div className={styles.pollMakerHeader}>
            <span className={styles.pollMakerTitle}>투표 만들기</span>
            <button onClick={() => setMode('text')}>✕</button>
          </div>
          <input className={styles.pollMakerInput} value={pollQ}
            onChange={(e) => setPollQ(e.target.value)} placeholder="질문을 입력하세요" />
          {pollOptions.map((opt, i) => (
            <div key={i} className={styles.pollOptRow}>
              <input className={styles.pollMakerInput} value={opt}
                onChange={(e) => { const o = [...pollOptions]; o[i] = e.target.value; setPollOptions(o) }}
                placeholder={`선택지 ${i + 1}`} />
              {pollOptions.length > 2 && (
                <button onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}>✕</button>
              )}
            </div>
          ))}
          {pollOptions.length < 5 && (
            <button className={styles.addOptBtn} onClick={() => setPollOptions([...pollOptions, ''])}>+ 선택지 추가</button>
          )}
          <button className={styles.pollSendBtn} onClick={handlePollSend}>투표 등록</button>
        </div>
      )}

      {/* 입력창 */}
      <div className={styles.inputArea}>
        <div className={styles.toolbarWrap}>
          <button
            className={`${styles.toolBtn} ${showToolbar ? styles.toolBtnActive : ''}`}
            onClick={() => setShowToolbar(!showToolbar)}>+</button>
          {showToolbar && (
            <div className={styles.toolMenu}>
              <button className={styles.toolItem} onClick={() => { fileRef.current.click(); setShowToolbar(false) }}>
                📎 파일 공유
              </button>
              <button className={styles.toolItem} onClick={() => { setMode('poll'); setShowToolbar(false) }}>
                📊 투표 만들기
              </button>
            </div>
          )}
        </div>
        <textarea
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          onCompositionStart={() => { isComposing.current = true }}
          onCompositionEnd={() => { isComposing.current = false }}
          placeholder="메시지 입력... (Enter 전송 / Shift+Enter 줄바꿈)"
          rows={1}
        />
        <button
          className={`${styles.sendBtn} ${!text.trim() ? styles.sendBtnOff : ''} ${sendPulseActive ? styles.sendBtnPulse : ''}`}
          onClick={handleSend} disabled={!text.trim()}>↑</button>
        <input ref={fileRef} type="file" accept="image/*,*/*" style={{ display: 'none' }} onChange={handleFile} />
      </div>
    </div>
  )
}