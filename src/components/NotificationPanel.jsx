import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import styles from './NotificationPanel.module.css'

const TYPE_ICONS = {
  welcome: '🎉',
  announcement: '📢',
  post: '📋',
  message: '💬',
  todo: '✅',
  event: '📅',
  invite: '👋',
  projectInvite: '📨',
  join: '🎉',
  mention: '🔔',
  dm: '💬',
  note: '✉️',
  comment: '💬',
  apply: '🙋',
  flower: '🌷',
  milestone: '🏁',
  birthday: '🎂',
  push: '🔔',
  system: '🔔',
  admin:  '🛡️',
}

function timeAgo(timestamp) {
  const diff = Date.now() - timestamp
  const min = Math.floor(diff / 60000)
  const hour = Math.floor(diff / 3600000)
  const day = Math.floor(diff / 86400000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  if (hour < 24) return `${hour}시간 전`
  if (day < 7) return `${day}일 전`
  return new Date(timestamp).toLocaleDateString('ko-KR')
}

export default function NotificationPanel({ open, onClose }) {
  const navigate = useNavigate()
  const { notifications, markNotificationRead, markAllNotificationsRead, removeNotification, clearAllNotifications, showConfirm } = useStore()

  if (!open) return null

  const handleClick = (noti) => {
    markNotificationRead(noti.id)
    if (noti.link) navigate(noti.link)
    onClose()
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.title}>알림</h2>
            {unreadCount > 0 && <span className={styles.unreadBadge}>{unreadCount}</span>}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {notifications.length > 0 && (
          <div className={styles.actions}>
            {unreadCount > 0 && (
              <button className={styles.actionBtn} onClick={markAllNotificationsRead}>
                모두 읽음 처리
              </button>
            )}
            <button className={styles.actionBtnDanger} onClick={async () => {
              if (await showConfirm('모든 알림을 삭제할까요?')) clearAllNotifications()
            }}>
              전체 삭제
            </button>
          </div>
        )}

        <div className={styles.list}>
          {notifications.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🔔</div>
              <p className={styles.emptyTitle}>알림이 없어요</p>
              <p className={styles.emptySub}>새로운 소식이 있으면 알려드릴게요</p>
            </div>
          ) : (
            notifications.map((noti) => (
              <div
                key={noti.id}
                className={`${styles.item} ${!noti.read ? styles.itemUnread : ''}`}
                onClick={() => handleClick(noti)}
              >
                <div className={styles.itemIcon}>{TYPE_ICONS[noti.type] || '🔔'}</div>
                <div className={styles.itemBody}>
                  <p className={styles.itemTitle}>{noti.title || noti.text}</p>
                  {noti.message && <p className={styles.itemMessage}>{noti.message}</p>}
                  <p className={styles.itemTime}>{timeAgo(noti.createdAt)}</p>
                </div>
                {!noti.read && <span className={styles.dot} />}
                <button className={styles.deleteBtn}
                  onClick={(e) => { e.stopPropagation(); removeNotification(noti.id) }}>
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
