import React, { useEffect, useMemo, useRef, useState } from 'react'
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
import ConfirmDialog from './ConfirmDialog.jsx'
import styles from './Layout.module.css'
import TeampMark from './TeampMark.jsx'

export default function Layout() {
  const { projects, currentUser, logout, formatUnread, notifications, dmRoomList, mutedProjects, toggleMuteProject, dmUnreadCounts, theme, toggleTheme, matchPostCount, matchSeenCount } = useStore()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [mobileOpen, setMobileOpen]           = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSearch, setShowSearch]           = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [collapsedProjects, setCollapsedProjects] = useState({}) // { [projectId]: true }

  const navRef = useRef(null)

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

  // 모바일 사이드바 열릴 때 nav 항상 맨 위로
  useEffect(() => {
    if (mobileOpen && navRef.current) {
      navRef.current.scrollTop = 0
    }
  }, [mobileOpen])

  const active         = useMemo(() => projects.filter((p) => p.status === 'active'), [projects])
  const unreadCount    = useMemo(() => (notifications || []).filter((n) => !n.read).length, [notifications])
  const totalDmUnread  = useMemo(() => Object.values(dmUnreadCounts || {}).reduce((a, b) => a + b, 0), [dmUnreadCounts])
  const matchHasNew    = matchPostCount > matchSeenCount

  // 모바일 헤더 페이지 타이틀
  const pageTitle = useMemo(() => {
    const p = location.pathname
    if (p === '/home')     return null
    if (p === '/profile')  return '내 프로필'
    if (p === '/match')    return '팀프 매치'
    if (p === '/calendar') return '통합 캘린더'
    if (p === '/messages') return '쪽지함'
    if (p === '/connect')  return '팀프 커넥트'
    if (p === '/help')     return '도움말'
    if (p === '/create')   return '새 프로젝트'
    const chatMatch = p.match(/^\/project\/([^/]+)\/chat\/([^/]+)/)
    if (chatMatch) {
      const proj = projects.find((x) => x.id === chatMatch[1])
      const room = proj?.rooms?.find((r) => r.id === chatMatch[2])
      return room?.name || proj?.name || '채팅'
    }
    const projMatch = p.match(/^\/project\/([^/]+)/)
    if (projMatch) return projects.find((x) => x.id === projMatch[1])?.name || '프로젝트'
    return null
  }, [location.pathname, projects])

  const handleLogout = async () => {
    // signOut 실패 시 한 번 재시도 — stale 세션이 남으면 Google 로그인 오작동
    try { await signOut(auth) } catch { try { await signOut(auth) } catch {} }
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
            <TeampMark size={26} />
            <span className={styles.logoText}>Teamp</span>
          </div>
          <div className={styles.logoActions}>
            <button className={styles.searchBtn} onClick={() => setShowSearch(true)} title="검색 (⌘K)">🔍</button>
            <button className={styles.notiBtn} onClick={() => setShowNotifications(true)} title="알림">
              ✦
              {unreadCount > 0 && <span className={styles.notiBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
          </div>
        </div>

        <nav className={styles.nav} ref={navRef}>
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
                const myProjRole = p.members?.find((m) => m.id === currentUser?.id)?.role
                const leaderCount = p.members?.filter((m) => m.role === 'leader').length || 0
                const roleIcon = myProjRole === 'leader'
                  ? (leaderCount > 1 ? '🌟' : '👑')
                  : myProjRole === 'sub-leader' ? '⭐' : null
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
                          {roleIcon && <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.75 }}>{roleIcon}</span>}
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

          <>
            <p className={styles.navSection}>메뉴</p>
            <NavLink to="/match" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`} onClick={close}>
              <span className={styles.navIcon}>🤝</span>
              <span style={{ flex: 1 }}>팀프 매치</span>
              {matchHasNew && <span className={styles.navMenuBadge}>N</span>}
            </NavLink>
            <NavLink to="/connect" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`} onClick={close}>
              <span className={styles.navIcon}>🔗</span><span>팀프 커넥트</span>
            </NavLink>
            <NavLink to="/calendar" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`} onClick={close}>
              <span className={styles.navIcon}>📆</span><span>통합 캘린더</span>
            </NavLink>
            <NavLink to="/messages" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`} onClick={close}>
              <span className={styles.navIcon}>✉️</span>
              <span style={{ flex: 1 }}>쪽지함</span>
              {totalDmUnread > 0 && (
                <span className={styles.navBadge}>{totalDmUnread > 99 ? 99 : totalDmUnread}</span>
              )}
            </NavLink>
          </>
          <NavLink to="/help" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`} onClick={close}>
            <span className={styles.navIcon}>❓</span><span>도움말</span>
          </NavLink>
        </nav>

        <button className={styles.createBtn} onClick={openCreate}>+ 새 프로젝트</button>

        <div className={styles.userArea}>
          <div className={styles.userAreaLeft} onClick={() => { navigate('/profile'); close() }} title="내 프로필">
            {currentUser?.photoURL
              ? <img className={styles.userAvatarImg} src={currentUser.photoURL} alt={currentUser.name} />
              : <div className={styles.userAvatar}>{currentUser?.name?.charAt(0) || '?'}</div>
            }
            <div className={styles.userInfo}>
              <p className={styles.userName}>{currentUser?.name}</p>
              <p className={styles.userHandle}>{currentUser?.affiliation || currentUser?.username}</p>
            </div>
          </div>
          <div className={styles.userAreaActions}>
            <button className={styles.themeBtn} onClick={toggleTheme} title={theme === 'dark' ? '라이트 모드' : '다크 모드'}>
              {theme === 'dark' ? '☀︎' : '◑'}
            </button>
            <button className={styles.logoutBtn} onClick={handleLogout} title="로그아웃">↩</button>
          </div>
        </div>
      </aside>

      {/* ── 메인 컨텐츠 ── */}
      <main className={styles.main}>
        <div className={styles.mobileHeader}>
          {/* 햄버거 — 항상 표시 (어떤 페이지에서도 사이드바 접근 가능) */}
          <button className={styles.menuBtn} onClick={() => setMobileOpen(true)}>☰</button>

          {/* 중앙: 홈이면 로고, 상세 페이지면 페이지명 */}
          {pageTitle
            ? <span className={styles.mobilePageTitle}>{pageTitle}</span>
            : <span className={styles.mobileLogo} onClick={() => navigate('/home')}>Teamp</span>
          }

          {/* 우측: 알림 버튼만 */}
          <button className={styles.mobileNotiBtn} onClick={() => setShowNotifications(true)}>
            ✦
            {unreadCount > 0 && <span className={styles.mobileNotiBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
        </div>

        {showNotiPrompt && (
          <div className={styles.notiPrompt}>
            <span className={styles.notiPromptIcon}>🔔</span>
            <span className={styles.notiPromptText}>새 메시지·할 일 알림을 받을까요?</span>
            <button className={styles.notiPromptAllow} onClick={handleAllowNoti}>허용</button>
            <button className={styles.notiPromptDismiss} onClick={dismissNotiPrompt}>✕</button>
          </div>
        )}

        <div id="page-content" className={styles.content}>
          <Outlet />
        </div>

        {/* ── 하단 푸터 (데스크탑 전용) ── */}
        <footer className={styles.footer}>
          <span className={styles.footerLegal}>
            상호: 팀프&nbsp;·&nbsp;대표자: 서보민&nbsp;·&nbsp;사업자등록번호: 미등록&nbsp;·&nbsp;이메일: support@teamp.kr
          </span>
          <span className={styles.footerRight}>
            <NavLink to="/terms" className={styles.footerLink}>이용약관</NavLink>
            <span className={styles.footerDot}>·</span>
            <NavLink to="/privacy" className={styles.footerLink}>개인정보처리방침</NavLink>
            <span className={styles.footerDot}>·</span>
            <span>© 2026 Teamp. All rights reserved.</span>
          </span>
        </footer>

        {/* ── 모바일 하단 탭바 ── */}
        <nav className={styles.mobileTabBar}>
          {/* 홈 */}
          <NavLink to="/home" className={({ isActive }) => `${styles.mobileTab} ${isActive ? styles.mobileTabActive : ''}`}>
            <svg className={styles.mobileTabIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span className={styles.mobileTabLabel}>홈</span>
          </NavLink>

          {/* 매치 */}
          <NavLink to="/match" className={({ isActive }) => `${styles.mobileTab} ${isActive ? styles.mobileTabActive : ''}`}>
            <svg className={styles.mobileTabIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
            <span className={styles.mobileTabLabel}>매치</span>
          </NavLink>

          {/* 캘린더 */}
          <NavLink to="/calendar" className={({ isActive }) => `${styles.mobileTab} ${isActive ? styles.mobileTabActive : ''}`}>
            <svg className={styles.mobileTabIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span className={styles.mobileTabLabel}>캘린더</span>
          </NavLink>

          {/* + FAB */}
          <button className={styles.mobileTabFab} onClick={openCreate} aria-label="새 프로젝트">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>

          {/* 알림 */}
          <button className={styles.mobileTab} onClick={() => setShowNotifications(true)}>
            {unreadCount > 0 && <span className={styles.mobileTabBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
            <svg className={styles.mobileTabIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            <span className={styles.mobileTabLabel}>알림</span>
          </button>

          {/* 나 */}
          <NavLink to="/profile" className={({ isActive }) => `${styles.mobileTab} ${isActive ? styles.mobileTabActive : ''}`}>
            <svg className={styles.mobileTabIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span className={styles.mobileTabLabel}>나</span>
          </NavLink>
        </nav>
      </main>

      <NotificationPanel open={showNotifications} onClose={() => setShowNotifications(false)} />
      <SearchModal open={showSearch} onClose={() => setShowSearch(false)} />
      {showCreateModal && <CreateProjectModal onClose={() => setShowCreateModal(false)} />}
      <ChatToastContainer />
      <ErrorToastContainer />
      <ConfirmDialog />
    </div>
  )
}
