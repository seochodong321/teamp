import React from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import styles from './MobileMenuSheet.module.css'

export default function MobileMenuSheet({ onClose, onCreateProject }) {
  const navigate = useNavigate()
  const {
    projects, currentUser, logout, theme, toggleTheme,
    matchPostCount, matchSeenCount, mutedProjects,
  } = useStore()

  const active = projects.filter((p) => p.status === 'active')
  const matchHasNew = matchPostCount > matchSeenCount

  const handleLogout = async () => {
    onClose()
    try { await signOut(auth) } catch { try { await signOut(auth) } catch {} }
    logout()
    navigate('/login')
  }

  const go = (path) => { navigate(path); onClose() }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.sheet}>
        <div className={styles.handle} />

        <div className={styles.header}>
          <div className={styles.userRow} onClick={() => go('/profile')}>
            <div className={styles.avatar}>
              {currentUser?.photoURL
                ? <img src={currentUser.photoURL} alt="" className={styles.avatarImg} />
                : <span>{currentUser?.name?.charAt(0) || '?'}</span>}
            </div>
            <div className={styles.userInfo}>
              <p className={styles.userName}>{currentUser?.name}</p>
              <p className={styles.userSub}>{currentUser?.affiliation || currentUser?.username || ''}</p>
            </div>
            <span className={styles.arrow}>›</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <button className={styles.createBtn} onClick={() => { onCreateProject(); onClose() }}>
          + 새 프로젝트
        </button>

        <div className={styles.scrollArea}>
          {active.length > 0 && (
            <section className={styles.section}>
              <p className={styles.sectionLabel}>진행 중인 프로젝트</p>
              {active.map((p) => {
                const muted = mutedProjects.includes(p.id)
                const totalUnread = (p.rooms || [])
                  .filter((r) => !r.isDm)
                  .reduce((s, r) => s + (r.unread || 0), 0)
                return (
                  <button key={p.id} className={styles.menuItem} onClick={() => go(`/project/${p.id}`)}>
                    <span className={styles.menuEmoji}>{p.emoji || '📁'}</span>
                    <span className={styles.menuName}>{p.name}</span>
                    {totalUnread > 0 && !muted && (
                      <span className={styles.badge}>{totalUnread > 99 ? '99+' : totalUnread}</span>
                    )}
                    <span className={styles.menuArrow}>›</span>
                  </button>
                )
              })}
            </section>
          )}

          <section className={styles.section}>
            <p className={styles.sectionLabel}>메뉴</p>
            <button className={styles.menuItem} onClick={() => go('/match')}>
              <span className={styles.menuEmoji}>🤝</span>
              <span className={styles.menuName}>팀프 매치</span>
              {matchHasNew && <span className={styles.badgeNew}>N</span>}
              <span className={styles.menuArrow}>›</span>
            </button>
            <button className={styles.menuItem} onClick={() => go('/profile')}>
              <span className={styles.menuEmoji}>👤</span>
              <span className={styles.menuName}>내 프로필</span>
              <span className={styles.menuArrow}>›</span>
            </button>
            <button className={styles.menuItem} onClick={() => go('/help')}>
              <span className={styles.menuEmoji}>❓</span>
              <span className={styles.menuName}>도움말</span>
              <span className={styles.menuArrow}>›</span>
            </button>
          </section>

          <section className={styles.section}>
            <p className={styles.sectionLabel}>설정</p>
            <button className={styles.menuItem} onClick={toggleTheme}>
              <span className={styles.menuEmoji}>{theme === 'dark' ? '☀︎' : '◑'}</span>
              <span className={styles.menuName}>{theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}</span>
            </button>
            <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={handleLogout}>
              <span className={styles.menuEmoji}>↩</span>
              <span className={styles.menuName}>로그아웃</span>
            </button>
          </section>
        </div>
      </div>
    </>
  )
}
