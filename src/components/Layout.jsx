import React, { useEffect, useMemo, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { doc, updateDoc } from 'firebase/firestore'
import { auth, db, requestNotificationPermission } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import NotificationPanel from './NotificationPanel.jsx'
import SearchModal from './SearchModal.jsx'
import CreateProjectModal from './CreateProjectModal.jsx'
import ChatToastContainer from './ChatToastContainer.jsx'
import ErrorToastContainer from './ErrorToastContainer.jsx'
import styles from './Layout.module.css'

export default function Layout() {
  const { projects, currentUser, logout, formatUnread, notifications, dmRoomList, mutedProjects, toggleMuteProject, dmUnreadCounts, theme, toggleTheme } = useStore()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [mobileOpen, setMobileOpen]           = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSearch, setShowSearch]           = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [collapsedProjects, setCollapsedProjects] = useState({}) // { [projectId]: true }

  const toggleCollapse = (projectId) =>
    setCollapsedProjects((s) => ({ ...s, [projectId]: !s[projectId] }))

  // 알림 권한 배너
  const [showNotiPrompt, setShowNotiPrompt] = useState(
    () => typeof Notification !== 'undefined'
      && Notification.permission === 'default'
      && !localStorage.getItem('teamp-noti-dismissed')
  )
  const handleAllowNoti = async () => {
    // 허용·거부 어느 쪽이든 다시 묻지 않도록 먼저 기록
    localStorage.setItem('teamp-noti-dismissed', '1')
    setShowNotiPrompt(false)
    const token = await requestNotificationPermission()
    if (token && currentUser?.id) {
      updateDoc(doc(db, 'users', currentUser.id), { fcmToken: token }).catch(() => {})
    }
  }
  const dismissNotiPrompt = () => {
    localStorage.setItem('teamp-noti-dismissed', '1')
    setShowNotiPrompt(false)
  }

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

  const active      = useMemo(() => projects.filter((p) => p.status === 'active'), [projects])
  const unreadCount = useMemo(() => (notifications || []).filter((n) => !n.read).length, [notifications])

  const handleLogout = async () => {
    try { await signOut(auth) } catch {}
    logout()
    navigate('/login')
  }

  const close = () => setMobileOpen(false)

  const openCreate = () => { setShowCreateModal(true); close() }

  // 현재 경로가 해당 prefix로 시작하는지 확인
  const isAt = (prefix) => location.pathname.startsWith(prefix)

  return (
    <div className={styles.shell}>
      {mobileOpen && <div className={styles.overlay} onClick={close} />}

      {/* ── 사이드바 (데스크탑 / 모바일 드로어) ── */}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.logoRow}>
          <div className={styles.logo} onClick={() => { navigate('/home'); close() }}>
            <span className={styles.logoMark}>T</span>
            <span className={styles.logoText}>Teamp</span>
          </div>
          <div className={styles.logoActions}>
            <button className={styles.searchBtn} onClick={() => setShowSearch(true)} title="검색 (⌘K)">🔍</button>
            <button className={styles.themeBtn} onClick={toggleTheme} title={theme === 'dark' ? '라이트 모드' : '다크 모드'}>
              {theme === 'dark' ? '☀︎' : '◑'}
            </button>
            <button className={styles.notiBtn} onClick={() => setShowNotifications(true)} title="알림">
              ✦
              {unreadCount > 0 && <span className={styles.notiBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
          </div>
        </div>

        <nav className={styles.nav}>
          <NavLink to="/home" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`} onClick={close}>
            <span className={styles.navIcon}>⊞</span>
            <span>홈</span>
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`} onClick={close}>
            <span className={styles.navIcon}>👤</span><span>내 프로필</span>
          </NavLink>

          {active.length > 0 && (
            <>
              <p className={styles.navSection}>진행 중인 프로젝트</p>
              {active.map((p) => {
                const muted = mutedProjects.includes(p.id)
                const chatRooms = p.rooms.filter((r) => !r.isDm)
                const totalUnread = chatRooms.reduce((s, r) => s + (r.unread || 0), 0)
                const isCollapsed = collapsedProjects[p.id] ?? true
                return (
                  <div key={p.id}>
                    <div className={styles.projectNavRow}>
                      {/* 접힘 토글 버튼 */}
                      <button
                        className={styles.collapseBtn}
                        onClick={() => toggleCollapse(p.id)}
                        title={isCollapsed ? '펼치기' : '접기'}>
                        <span className={`${styles.collapseIcon} ${isCollapsed ? styles.collapseIconClosed : ''}`}>›</span>
                      </button>
                      <NavLink to={`/project/${p.id}`}
                        className={({ isActive }) => `${styles.navItem} ${styles.navItemFlex} ${isActive ? styles.navActive : ''}`}
                        onClick={close}>
                        <span className={styles.navProjectName}>
                          {p.emoji && <span style={{ marginRight: 4 }}>{p.emoji}</span>}
                          {p.name}
                        </span>
                        {/* 접혔을 때만 총 미읽음 표시 */}
                        {isCollapsed && totalUnread > 0 && !muted && (
                          <>
                            {totalUnread > 99 && <span className={styles.navBadgePlus}>+</span>}
                            <span className={styles.navBadge}>{totalUnread > 99 ? 99 : totalUnread}</span>
                          </>
                        )}
                      </NavLink>
                      <button
                        className={`${styles.muteBtn} ${muted ? styles.muteBtnOn : ''}`}
                        onClick={() => toggleMuteProject(p.id)}
                        title={muted ? '알림 켜기' : '알림 끄기'}>
                        {muted ? '○' : '●'}
                      </button>
                    </div>
                    {!isCollapsed && chatRooms.map((room) => (
                      <NavLink key={room.id} to={`/project/${p.id}/chat/${room.id}`}
                        className={({ isActive }) => `${styles.navItem} ${styles.roomNavItem} ${isActive ? styles.navActive : ''}`}
                        onClick={close}>
                        <span className={styles.roomHash}>#</span>
                        <span className={styles.navProjectName}>{room.name}</span>
                        {room.unread > 0 && !muted && (
                          <>
                            {room.unread > 99 && <span className={styles.navBadgePlus}>+</span>}
                            <span className={styles.navBadge}>{room.unread > 99 ? 99 : room.unread}</span>
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )
              })}
            </>
          )}

          {dmRoomList.length > 0 && (
            <>
              <p className={styles.navSection}>채팅</p>
              {dmRoomList.map((room) => {
                const contactName = Object.entries(room.participantNames || {})
                  .find(([id]) => id !== currentUser?.id)?.[1] || '?'
                const dmUnread = dmUnreadCounts?.[room.id] || 0
                return (
                  <NavLink key={room.id} to={`/project/${room.projectId}/chat/${room.id}`}
                    className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
                    onClick={close}>
                    <div className={styles.dmAvatar}>{contactName.charAt(0)}</div>
                    <span className={styles.navProjectName}>{contactName}</span>
                    {dmUnread > 0 && (
                      <>
                        {dmUnread > 99 && <span className={styles.navBadgePlus}>+</span>}
                        <span className={styles.navBadge}>{dmUnread > 99 ? 99 : dmUnread}</span>
                      </>
                    )}
                  </NavLink>
                )
              })}
            </>
          )}

          <p className={styles.navSection}>메뉴</p>
          <NavLink to="/match" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`} onClick={close}>
            <span className={styles.navIcon}>🤝</span><span>팀프 매치</span>
          </NavLink>
          <NavLink to="/connect" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`} onClick={close}>
            <span className={styles.navIcon}>🔗</span><span>팀프 커넥트</span>
          </NavLink>
          <NavLink to="/help" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`} onClick={close}>
            <span className={styles.navIcon}>❓</span><span>도움말</span>
          </NavLink>
        </nav>

        <button className={styles.createBtn} onClick={openCreate}>+ 새 프로젝트</button>

        <div className={styles.userArea}>
          {currentUser?.photoURL
            ? <img className={styles.userAvatarImg} src={currentUser.photoURL} alt={currentUser.name} />
            : <div className={styles.userAvatar}>{currentUser?.name?.charAt(0) || '?'}</div>
          }
          <div className={styles.userInfo}>
            <p className={styles.userName}>{currentUser?.name}</p>
            <p className={styles.userHandle}>{currentUser?.affiliation || currentUser?.username}</p>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout} title="로그아웃">↩</button>
        </div>
      </aside>

      {/* ── 메인 컨텐츠 ── */}
      <main className={styles.main}>
        <div className={styles.mobileHeader}>
          <button className={styles.menuBtn} onClick={() => setMobileOpen(true)}>☰</button>
          <span className={styles.mobileLogo} onClick={() => navigate('/home')}>Teamp</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className={styles.mobileSearchBtn} onClick={() => setShowSearch(true)}>🔍</button>
            <button className={styles.mobileSearchBtn} onClick={toggleTheme} title={theme === 'dark' ? '라이트 모드' : '다크 모드'}>
              {theme === 'dark' ? '☀︎' : '◑'}
            </button>
            <button className={styles.mobileNotiBtn} onClick={() => setShowNotifications(true)}>
              ✦
              {unreadCount > 0 && <span className={styles.mobileNotiBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
          </div>
        </div>

        {showNotiPrompt && (
          <div className={styles.notiPrompt}>
            <span className={styles.notiPromptIcon}>🔔</span>
            <span className={styles.notiPromptText}>새 메시지·할 일 알림을 받을까요?</span>
            <button className={styles.notiPromptAllow} onClick={handleAllowNoti}>허용</button>
            <button className={styles.notiPromptDismiss} onClick={dismissNotiPrompt}>✕</button>
          </div>
        )}

        <div className={styles.content}>
          <Outlet />
        </div>

        {/* ── 모바일 하단 탭바 ── */}
        <nav className={styles.mobileTabBar}>
          <NavLink to="/home" className={`${styles.mobileTab} ${isAt('/home') ? styles.mobileTabActive : ''}`}>
            <span className={styles.mobileTabIcon}>🏠</span>
            <span className={styles.mobileTabLabel}>홈</span>
          </NavLink>
          <button
            className={`${styles.mobileTab} ${(isAt('/project') && location.pathname.includes('/chat')) ? styles.mobileTabActive : ''}`}
            onClick={() => {
              const first = dmRoomList[0]
              if (first) navigate(`/project/${first.projectId}/chat/${first.id}`)
              else setMobileOpen(true)
            }}
          >
            <span className={styles.mobileTabIcon}>💬</span>
            {(() => {
              const totalDmUnread = Object.values(dmUnreadCounts || {}).reduce((s, n) => s + n, 0)
              return totalDmUnread > 0 ? (
                <span className={styles.mobileTabBadge}>{totalDmUnread > 9 ? '9+' : totalDmUnread}</span>
              ) : null
            })()}
            <span className={styles.mobileTabLabel}>채팅</span>
          </button>
          <button className={`${styles.mobileTab}`} onClick={() => setShowNotifications(true)}>
            <span className={styles.mobileTabIcon}>🔔</span>
            {unreadCount > 0 && (
              <span className={styles.mobileTabBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
            <span className={styles.mobileTabLabel}>알림</span>
          </button>
          <NavLink to="/profile" className={`${styles.mobileTab} ${isAt('/profile') ? styles.mobileTabActive : ''}`}>
            <span className={styles.mobileTabIcon}>👤</span>
            <span className={styles.mobileTabLabel}>프로필</span>
          </NavLink>
        </nav>
      </main>

      <NotificationPanel open={showNotifications} onClose={() => setShowNotifications(false)} />
      <SearchModal open={showSearch} onClose={() => setShowSearch(false)} />
      {showCreateModal && <CreateProjectModal onClose={() => setShowCreateModal(false)} />}
      <ChatToastContainer />
      <ErrorToastContainer />
    </div>
  )
}
