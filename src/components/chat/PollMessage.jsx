import React from 'react'
import styles from '../../pages/ChatPage.module.css'

// 투표 퍼센트 — 바닥값 배분 후 나머지를 소수부 큰 순으로 +1 (합계 정확히 100)
function calcPollPcts(options, total) {
  if (total === 0) return options.map(() => 0)
  const raw    = options.map((o) => (o.votes.length / total) * 100)
  const floors = raw.map(Math.floor)
  const rem    = 100 - floors.reduce((a, b) => a + b, 0)
  raw.map((r, i) => ({ d: r - floors[i], i }))
    .sort((a, b) => b.d - a.d)
    .slice(0, rem)
    .forEach(({ i }) => { floors[i]++ })
  return floors
}

// 투표 말풍선 — 옵션 탭으로 투표/취소(onVote), 실시간 퍼센트 바
export default function PollMessage({ msg, isMine, isDm, isGrouped, avatarEl, avStyle, senderName, currentUserId, onVote }) {
  const total = msg.options.reduce((s, o) => s + o.votes.length, 0)
  const pcts  = calcPollPcts(msg.options, total)
  return (
    <div className={`${styles.pollWrap} ${isGrouped ? styles.rowGrouped : ''}`}>
      {avatarEl}
      <div className={styles.pollCard}>
        <div className={styles.pollHeader}>
          {!isMine && !isDm && <span className={styles.pollAuthor} style={{ color: avStyle.text }}>{senderName}</span>}
          <span className={styles.pollBadge}>📊 투표</span>
        </div>
        <p className={styles.pollQuestion}>{msg.text}</p>
        <div className={styles.pollOptions}>
          {msg.options.map((opt, oi) => {
            const pct   = pcts[oi]
            const voted = opt.votes.includes(currentUserId)
            return (
              <button key={opt.id}
                className={`${styles.pollOption} ${voted ? styles.pollOptionVoted : ''}`}
                onClick={() => onVote(opt.id)}>
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
