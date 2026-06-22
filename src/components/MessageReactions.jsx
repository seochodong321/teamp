import React, { useState } from 'react'
import styles from './MessageReactions.module.css'

// 가벼운 이모지 응답 — 대답 애매할 때 한 번 탭. 점수·순위 아님(따뜻한 응답).
export const REACTIONS = [
  { key: 'thanks', emoji: '🙏', label: '고마워' },
  { key: 'ok',     emoji: '👍', label: '알겠어' },
  { key: 'good',   emoji: '😊', label: '좋아' },
]

// canReact = 받은 메시지(내가 보낸 게 아님)일 때만 반응 추가/토글 가능.
// 내 메시지엔 받은 반응을 '표시'만 하고 추가 버튼·토글은 숨긴다.
export default function MessageReactions({ reactions = {}, myId, canReact = false, onToggle, mine = false }) {
  const [picking, setPicking] = useState(false)
  const active = REACTIONS.filter((r) => (reactions[r.key] || []).length > 0)
  if (!active.length && !canReact) return null

  return (
    <div className={`${styles.row} ${mine ? styles.rowMine : ''}`}>
      {active.map((r) => {
        const users = reactions[r.key] || []
        const reacted = myId && users.includes(myId)
        if (!canReact) {
          return (
            <span key={r.key} className={styles.chip}>
              <span>{r.emoji}</span><span className={styles.count}>{users.length}</span>
            </span>
          )
        }
        return (
          <button key={r.key} type="button"
            className={`${styles.chip} ${reacted ? styles.chipOn : ''}`}
            onClick={() => onToggle(r.key)} title={r.label}>
            <span>{r.emoji}</span><span className={styles.count}>{users.length}</span>
          </button>
        )
      })}
      {canReact && (
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
