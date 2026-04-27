import React, { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import styles from './ChatPage.module.css'

export default function ChatPage() {
  const { projectId, roomId } = useParams()
  const navigate = useNavigate()
  const { projects, messages, currentUser, sendMessage, sendFile, sendPoll, votePoll, markAsRead } = useStore()

  const project = projects.find((p) => p.id === projectId)
  const room = project?.rooms.find((r) => r.id === roomId)
  const roomMessages = messages[roomId] || []

  const [text, setText] = useState('')
  const [mode, setMode] = useState('text')
  const [pollQ, setPollQ] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [showToolbar, setShowToolbar] = useState(false)

  // ✅ 한글 조합 중 여부를 추적
  const isComposing = useRef(false)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    markAsRead(roomId)
  }, [roomMessages.length])

  if (!project || !room) return <div className={styles.notFound}>채팅방을 찾을 수 없어요</div>

  const handleSend = () => {
    if (!text.trim()) return
    sendMessage(roomId, text.trim())
    setText('')
  }

  const handleKeyDown = (e) => {
    // ✅ 한글 조합 중이면 Enter 무시 (중복 전송 방지)
    if (e.key === 'Enter' && !e.shiftKey && !isComposing.current) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    sendFile(roomId, file.name)
    e.target.value = ''
    setShowToolbar(false)
  }

  const handlePollSend = () => {
    const validOptions = pollOptions.filter((o) => o.trim())
    if (!pollQ.trim() || validOptions.length < 2) return
    sendPoll(roomId, pollQ.trim(), validOptions)
    setPollQ('')
    setPollOptions(['', ''])
    setMode('text')
    setShowToolbar(false)
  }

  const ROLE_LABEL = { leader: '👑 리더', 'sub-leader': '⭐ 부리더', member: '팀원' }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate(`/project/${projectId}`)}>
          ← {project.name}
        </button>
        <div className={styles.headerCenter}>
          <span className={styles.roomName}># {room.name}</span>
          <span className={styles.roomMemberCount}>
            {project.members.filter((m) => m.roomIds.includes(roomId) || m.role === 'leader' || m.role === 'sub-leader').length}명
          </span>
        </div>
      </div>

      <div className={styles.messages}>
        <div className={styles.dateDivider}><span>오늘</span></div>

        {roomMessages.map((msg) => {
          const isMine = msg.senderId === currentUser.id
          const member = project.members.find((m) => m.id === msg.senderId)

          if (msg.type === 'file') {
            return (
              <div key={msg.id} className={`${styles.row} ${isMine ? styles.rowMine : ''}`}>
                {!isMine && <div className={styles.avatar}>{msg.senderName.charAt(0)}</div>}
                <div className={styles.bubbleWrap}>
                  {!isMine && (
                    <span className={styles.sender}>
                      {msg.senderName}
                      {member && <span className={styles.roleTag}>{ROLE_LABEL[member.role]}</span>}
                    </span>
                  )}
                  <div className={`${styles.fileBubble} ${isMine ? styles.fileBubbleMine : ''}`}>
                    <span className={styles.fileIcon}>📎</span>
                    <span className={styles.fileName}>{msg.text}</span>
                  </div>
                  <span className={styles.time}>{msg.time}</span>
                </div>
              </div>
            )
          }

          if (msg.type === 'poll') {
            const total = msg.options.reduce((s, o) => s + o.votes.length, 0)
            return (
              <div key={msg.id} className={styles.pollWrap}>
                {!isMine && <div className={styles.avatar}>{msg.senderName.charAt(0)}</div>}
                <div className={styles.pollCard}>
                  <div className={styles.pollHeader}>
                    {!isMine && <span className={styles.pollAuthor}>{msg.senderName}</span>}
                    <span className={styles.pollLabel}>투표</span>
                  </div>
                  <p className={styles.pollQuestion}>{msg.text}</p>
                  <div className={styles.pollOptions}>
                    {msg.options.map((opt) => {
                      const pct = total === 0 ? 0 : Math.round((opt.votes.length / total) * 100)
                      const voted = opt.votes.includes(currentUser.id)
                      return (
                        <button key={opt.id}
                          className={`${styles.pollOption} ${voted ? styles.pollOptionVoted : ''}`}
                          onClick={() => votePoll(roomId, msg.id, opt.id)}>
                          <div className={styles.pollOptionBar} style={{ width: `${pct}%` }} />
                          <span className={styles.pollOptionLabel}>{opt.label}</span>
                          <span className={styles.pollOptionPct}>{pct}%</span>
                        </button>
                      )
                    })}
                  </div>
                  <p className={styles.pollTotal}>총 {total}명 참여</p>
                </div>
              </div>
            )
          }

          return (
            <div key={msg.id} className={`${styles.row} ${isMine ? styles.rowMine : ''}`}>
              {!isMine && <div className={styles.avatar}>{msg.senderName.charAt(0)}</div>}
              <div className={styles.bubbleWrap}>
                {!isMine && (
                  <span className={styles.sender}>
                    {msg.senderName}
                    {member && <span className={styles.roleTag}>{ROLE_LABEL[member.role]}</span>}
                  </span>
                )}
                <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleOther}`}>
                  {msg.text}
                </div>
                <span className={styles.time}>{msg.time}</span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* 투표 만들기 UI */}
      {mode === 'poll' && (
        <div className={styles.pollMaker}>
          <div className={styles.pollMakerHeader}>
            <span className={styles.pollMakerTitle}>투표 만들기</span>
            <button onClick={() => setMode('text')} className={styles.pollMakerClose}>✕</button>
          </div>
          <input className={styles.pollMakerInput} value={pollQ} onChange={(e) => setPollQ(e.target.value)}
            placeholder="질문을 입력하세요" />
          {pollOptions.map((opt, i) => (
            <div key={i} className={styles.pollOptionRow}>
              <input className={styles.pollMakerInput} value={opt}
                onChange={(e) => { const o = [...pollOptions]; o[i] = e.target.value; setPollOptions(o) }}
                placeholder={`선택지 ${i + 1}`} />
              {pollOptions.length > 2 && (
                <button onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))} className={styles.removeOpt}>✕</button>
              )}
            </div>
          ))}
          {pollOptions.length < 5 && (
            <button className={styles.addOpt} onClick={() => setPollOptions([...pollOptions, ''])}>+ 선택지 추가</button>
          )}
          <button className={styles.pollSendBtn} onClick={handlePollSend}>투표 등록</button>
        </div>
      )}

      {/* 입력창 */}
      <div className={styles.inputArea}>
        <div className={styles.toolbar}>
          <button className={`${styles.toolBtn} ${showToolbar ? styles.toolBtnActive : ''}`}
            onClick={() => setShowToolbar(!showToolbar)}>+</button>
          {showToolbar && (
            <div className={styles.toolMenu}>
              <button className={styles.toolMenuItem} onClick={() => { fileRef.current.click(); setShowToolbar(false) }}>
                📎 파일 공유
              </button>
              <button className={styles.toolMenuItem} onClick={() => { setMode('poll'); setShowToolbar(false) }}>
                📊 투표 만들기
              </button>
            </div>
          )}
        </div>
        <textarea
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { isComposing.current = true }}
          onCompositionEnd={() => { isComposing.current = false }}
          placeholder="메시지 입력... (Enter 전송, Shift+Enter 줄바꿈)"
          rows={1}
        />
        <button
          className={`${styles.sendBtn} ${!text.trim() ? styles.sendBtnOff : ''}`}
          onClick={handleSend}
          disabled={!text.trim()}
        >↑</button>
        <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFile} />
      </div>
    </div>
  )
}