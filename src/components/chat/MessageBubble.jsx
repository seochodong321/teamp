import React from 'react'
import MessageReactions from '../MessageReactions.jsx'
import styles from '../../pages/ChatPage.module.css'

function linkify(text) {
  if (!text || typeof text !== 'string') return text
  const parts = text.split(/(https?:\/\/[^\s]+)/)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1
      ? <a key={i} href={part} target="_blank" rel="noreferrer noopener" className={styles.msgLink}>{part}</a>
      : part
  )
}

function ChatImage({ src, alt, className, onClick }) {
  const [broken, setBroken] = React.useState(false)
  if (broken) return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 12, color: 'var(--text-tertiary)', cursor: 'default' }}>
      🖼️ <span>이미지를 불러올 수 없어요</span>
    </div>
  )
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" onError={() => setBroken(true)} onClick={onClick} />
}

// 텍스트·이미지·파일 말풍선 — 래퍼(아바타·이름·시간·읽음·반응)는 동일, 내용물만 타입 분기.
// 그룹핑·날짜 구분선 등 흐름 계산은 ChatPage 루프 소유.
export default function MessageBubble({ msg, isMine, isGrouped, avatarEl, nameEl, timeEl, readCount, myId, onToggleReaction, onImageClick }) {
  return (
    <div className={`${styles.row} ${isMine ? styles.rowMine : ''} ${isGrouped ? styles.rowGrouped : ''}`}>
      {avatarEl}
      <div className={styles.bubbleWrap}>
        {nameEl}
        {msg.type === 'image' ? (
          <ChatImage src={msg.fileUrl} alt={msg.text} className={styles.chatImg} onClick={onImageClick} />
        ) : msg.type === 'file' ? (
          <div className={`${styles.fileBubble} ${isMine ? styles.fileBubbleMine : ''}`}>
            <span>📎</span>
            <span className={styles.fileName}>{msg.text}</span>
          </div>
        ) : (
          <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleOther}`}>
            {linkify(msg.text)}
          </div>
        )}
        {(timeEl || (isMine && readCount > 0)) && (
          <div className={styles.timeRow}>
            {isMine && readCount > 0 && <span className={styles.readReceipt}>읽음 {readCount}</span>}
            {timeEl}
          </div>
        )}
        <MessageReactions reactions={msg.reactions} myId={myId} canReact={!isMine} mine={isMine} onToggle={onToggleReaction} />
      </div>
    </div>
  )
}
