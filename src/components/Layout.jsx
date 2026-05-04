import React, { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import NotificationPanel from './NotificationPanel.jsx'
import SearchModal from './SearchModal.jsx'
import styles from './Layout.module.css'

export default function Layout() {
  const { projects, currentUser, logout, formatUnread, notifications } = useStore()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  // Cmd+K / Ctrl+K 단축키로 검색 열기
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const active = projects.filter((p) => p.status === 'active')
  const unreadCount = (notifications || []).filter((n) => !n.read).length

  const handleLogout = async () => {
    try { await signOut(auth) } catch {}
    logout()
    navigate('/login')
  }

  const close = () => setMobileOpen(false)

  return (
    <div className={styles.shell}>
      {mobileOpen && <div className={styles.overlay} onClick={close} />}

      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.logoRow}>
          <div className={styles.logo} onClick={() => { navigate('/home'); close() }}>
            <span className={styles.logoMark}>T</span>
            <span className={styles.logoText}>Teamp</span>
          </div>
          <div className={styles.logoActions}>
            <button className={styles.searchBtn} onClick={() => setShowSearch(true)} title="검색 (⌘K)">
              🔍
            </button>
            <button
              className={styles.notiBtn}
              onClick={() => setShowNotifications(true)}
              title="알림"
            >
              🔔
              {unreadCount > 0 && (
                <span className={styles.notiBadge}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <nav className={styles.nav}>
          <NavLink to="/home" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`} onClick={close}>
            <span className={styles.navIcon}>⊞</span>
            <span>홈</span>
          </NavLink>

          {active.length > 0 && (
            <>
              <p className={styles.navSection}>진행 중인 프로젝트</p>
              {active.map((p) => {
                const totalUnread = p.rooms.reduce((s, r) => s + (r.unread || 0), 0)
                return (
                  <NavLink key={p.id} to={`/project/${p.id}`}
                    className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
                    onClick={close}>
                    <span className={styles.navDot} style={{ background: p.rooms.find((r) => !r.isDm)?.color || 'var(--primary)' }} />
                    <span className={styles.navProjectName}>
                      {p.emoji && <span style={{ marginRight: 4 }}>{p.emoji}</span>}
                      {p.name}
                    </span>
                    {totalUnread > 0 && <span className={styles.navBadge}>{formatUnread(totalUnread)}</span>}
                  </NavLink>
                )
              })}
            </>
          )}

          <p className={styles.navSection}>메뉴</p>
          <NavLink to="/connect" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`} onClick={close}>
            <span className={styles.navIcon}>🔗</span>
            <span>팀프 커넥트</span>
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`} onClick={close}>
            <span className={styles.navIcon}>👤</span>
            <span>프로필</span>
          </NavLink>
        </nav>

        <button className={styles.createBtn} onClick={() => { navigate('/create'); close() }}>
          + 새 프로젝트
        </button>

        <div className={styles.userArea}>
          <div className={styles.userAvatar}>{currentUser?.name?.charAt(0) || '?'}</div>
          <div className={styles.userInfo}>
            <p className={styles.userName}>{currentUser?.name}</p>
            <p className={styles.userHandle}>{currentUser?.affiliation || currentUser?.username}</p>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout} title="로그아웃">↩</button>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.mobileHeader}>
          <button className={styles.menuBtn} onClick={() => setMobileOpen(true)}>☰</button>
          <span className={styles.mobileLogo} onClick={() => navigate('/home')}>Teamp</span>
          <button
            className={styles.mobileNotiBtn}
            onClick={() => setShowNotifications(true)}
          >
            🔔
            {unreadCount > 0 && <span className={styles.mobileNotiBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
        </div>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>

      <NotificationPanel
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
      <SearchModal
        open={showSearch}
        onClose={() => setShowSearch(false)}
      />
    </div>
  )
}