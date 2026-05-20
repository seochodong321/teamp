import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import styles from './ChatToastContainer.module.css'

const isMobile = () => window.innerWidth <= 768

export default function ChatToastContainer() {
  const { chatToasts, removeChatToast, clearChatToasts } = useStore()
  const navigate = useNavigate()
  const [closingIds, setClosingIds] = useState(new Set())
  const [mobile, setMobile] = useState(isMobile)

  useEffect(() => {
    const handler = () => setMobile(isMobile())
    window.addEventListener('resize', handler, { passive: true })
    return () => window.removeEventListener('resize', handler)
  }, [])

  const handleDismiss = (e, id) => {
    e.stopPropagation()
    setClosingIds((prev) => new Set([...prev, id]))
    setTimeout(() => {
      removeChatToast(id)
      setClosingIds((prev) => { const n = new Set(prev); n.delete(id); return n })
    }, 260)
  }

  const handleClick = (toast) => {
    removeChatToast(toast.id)
    if (toast.link) navigate(toast.link)
    else navigate(`/project/${toast.projectId}/chat/${toast.roomId}`)
  }

  const handleClearAll = () => {
    setClosingIds(new Set(chatToasts.map((t) => t.id)))
    setTimeout(() => {
      clearChatToasts()
      setClosingIds(new Set())
    }, 260)
  }

  if (!chatToasts.length) return null

  // 모바일: 가장 최신 토스트 1개만 표시
  const visibleToasts = mobile ? chatToasts.slice(-1) : [...chatToasts].reverse()

  return (
    <div className={styles.container}>
      {!mobile && chatToasts.length >= 2 && (
        <button className={styles.clearAll} onClick={handleClearAll}>
          전체 삭제 ✕
        </button>
      )}
      {visibleToasts.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toast} ${closingIds.has(toast.id) ? styles.toastClosing : ''}`}
          onClick={() => handleClick(toast)}
          role="button"
          tabIndex={0}
        >
          <div className={styles.toastInner}>
            <span className={styles.toastIcon}>{toast.icon || '💬'}</span>
            <div className={styles.toastBody}>
              <p className={styles.toastSender}>{toast.senderName}
                {toast.roomName && <span className={styles.toastRoom}> · {toast.roomName}</span>}
              </p>
              <p className={styles.toastText}>{toast.text}</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={(e) => handleDismiss(e, toast.id)}>✕</button>
        </div>
      ))}
    </div>
  )
}
