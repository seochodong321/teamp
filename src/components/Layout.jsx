import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import styles from './Layout.module.css'

export default function Layout() {
  const { projects, currentUser, logout, formatUnread } = useStore()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const active = projects.filter((p) => p.status === 'active')

  const handleLogout = async () => {
    await signOut(auth)
    logout()
    navigate('/login')
  }

  return (
    <div className={styles.shell}>
      {mobileOpen && <div className={styles.overlay} onClick={() => setMobileOpen(false)} />}

      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        {/* 로고 — 클릭하면 홈으로 */}
        <div className={styles.logo} onClick={() => { navigate('/home'); setMobileOpen(false) }} style={{ cursor: 'pointer' }}>
          <span className={styles.logoMark}>T</span>
          <span className={styles.logoText}>Teamp</span>
        </div>

        <nav className={styles.nav}>
          <NavLink to="/home"
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
            onClick={() => setMobileOpen(false)}>
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
                    onClick={() => setMobileOpen(false)}>
                    <span className={styles.navDot} style={{ background: p.rooms[0]?.color || 'var(--primary)' }} />
                    <span className={styles.navProjectName}>{p.name}</span>
                    {totalUnread > 0 && (
                      <span className={styles.navBadge}>{formatUnread(totalUnread)}</span>
                    )}
                  </NavLink>
                )
              })}
            </>
          )}

          <p className={styles.navSection}>메뉴</p>
          <NavLink to="/profile"
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
            onClick={() => setMobileOpen(false)}>
            <span className={styles.navIcon}>👤</span>
            <span>프로필</span>
          </NavLink>
        </nav>

        <button className={styles.createBtn} onClick={() => { navigate('/create'); setMobileOpen(false) }}>
          + 새 프로젝트
        </button>

        <div className={styles.userArea}>
          <div className={styles.userAvatar}>{currentUser?.name?.charAt(0) || '?'}</div>
          <div className={styles.userInfo}>
            <p className={styles.userName}>{currentUser?.name}</p>
            <p className={styles.userHandle}>{currentUser?.username}</p>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout} title="로그아웃">↩</button>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.mobileHeader}>
          <button className={styles.menuBtn} onClick={() => setMobileOpen(true)}>☰</button>
          <span className={styles.mobileLogo} onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>Teamp</span>
          <div style={{ width: 40 }} />
        </div>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}