import React, { useState } from 'react'
import styles from './MessageReactions.module.css'

// 가벼운 이모지 응답 — 대답 애매할 때 한 번 탭. 점수·순위 아님(따뜻한 응답).
export const REACTIONS = [
  { key: 'thanks', emoji: '🙏', label: '고마워' },
  { key: 'ok',     emoji: '👍', label: '알겠어' },
  { key: 'good',   emoji: '😊', label: '좋아' },
]

export default function MessageReactions({ reactions = {}, myId, onToggle, mine = false }) {
  const [picking, setPicking] = useState(false)
  const active = REACTIONS.filter((r) => (reactions[r.key] || []).length > 0)
  if (!active.length && !myId) return null

  return (
    <div className={`${styles.row} ${mine ? styles.rowMine : ''}`}>
      {active.map((r) => {
        const users = reactions[r.key] || []
        const reacted = myId && users.includes(myId)
        return (
          <button key={r.key} type="button"
            className={`${styles.chip} ${reacted ? styles.chipOn : ''}`}
            onClick={() => onToggle(r.key)} title={r.label}>
            <span>{r.emoji}</span><span className={styles.count}>{users.length}</span>
          </button>
        )
      })}
      {myId && (
        <div className={styles.addWrap}>
          <button type="button" className={styles.addBtn} onClick={() => setPicking((p) => !p)} aria-label="이모지 반응 달기">
            🙂<span className={styles.plus}>+</span>
          </button>
          {picking && (
            <>
              <div className={styles.backdrop} onClick={() => setPicking(false)} />
              <div className={styles.picker}>
                {REACTIONS.map((r) => (
                  <button key={r.key} type="button" className={styles.pickerBtn}
                    onClick={() => { onToggle(r.key); setPicking(false) }} title={r.label}>
                    {r.emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
