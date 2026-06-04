import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { auth, db, requestNotificationPermission } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import { useShallow } from 'zustand/react/shallow'
import NotificationPanel from './NotificationPanel.jsx'
import SearchModal from './SearchModal.jsx'
import CreateProjectModal from './CreateProjectModal.jsx'
import MobileMenuSheet from './MobileMenuSheet.jsx'
import ChatToastContainer from './ChatToastContainer.jsx'
import ErrorToastContainer from './ErrorToastContainer.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import InstallPrompt from './InstallPrompt.jsx'
import styles from './Layout.module.css'
import TeampMark from './TeampMark.jsx'

export default function Layout() {
  // 항상 떠있는 컴포넌트 — 필요한 필드만 shallow 구독해 무관한 스토어 변경(메시지 등)엔 리렌더 안 함
  const { projects, currentUser, logout, formatUnread, notifications, dmRoomList, mutedProjects, toggleMuteProject, dmUnreadCounts, theme, toggleTheme, matchPostCount, matchSeenCount } = useStore(
    useShallow((s) => ({
      projects: s.projects, currentUser: s.currentUser, logout: s.logout, formatUnread: s.formatUnread,
      notifications: s.notifications, dmRoomList: s.dmRoomList, mutedProjects: s.mutedProjects,
      toggleMuteProject: s.toggleMuteProject, dmUnreadCounts: s.dmUnreadCounts, theme: s.theme,
      toggleTheme: s.toggleTheme, matchPostCount: s.matchPostCount, matchSeenCount: s.matchSeenCount,
    }))
  )
  const navigate  = useNavigate()
  const location  = useLocation()
  const [mobileOpen, setMobileOpen]           = useState(false)
  const [showMobileMenu, setShowMobileMenu]   = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSearch, setShowSearch]           = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [collapsedProjects, setCollapsedProjects] = useState({})
  const [noteUnread, setNoteUnread]           = useState(0)

  const navRef = useRef(null)

  const toggleCollapse = (projectId) =>
    setCollapsedProjects((s) => ({ ...s, [projectId]: !s[projectId] }))

  // 알림 권한 — 로그인 후 시스템 프롬프트를 바로(1회) 요청.
  // 커스텀 배너 없이 한 번만 묻는다. 거부/무응답 시 ProfilePage 알림 섹션에서 재설정.
  useEffect(() => {
    if (!currentUser?.id) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return
    if (localStorage.getItem('teamp-noti-asked')) return
    localStorage.setItem('teamp-noti-asked', '1')
    requestNotificationPermission().then((token) => {
      if (token) updateDoc(doc(db, 'users', currentUser.id), { fcmToken: token }).catch(() => {})
    }).catch(() => {})
  }, [currentUser?.id])

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
    if (mobileOpen && navRef.current) navRef.current.scrollTop = 0
  }, [mobileOpen])

  // 쪽지 미읽음 카운트 (탭바 배지용)
  // notes는 recipientId가 없고 participants/toUid 구조 — participants로 쿼리 후 내가 받은·안 읽은·안 숨긴 것만 카운트
  useEffect(() => {
    if (!currentUser?.id) return
    const unsub = onSnapshot(
      query(collection(db, 'notes'), where('participants', 'array-contains', currentUser.id)),
      (snap) => {
        const uid = currentUser.id
        setNoteUnread(snap.docs.filter((d) => {
          const n = d.data()
          return n.toUid === uid && !n.read?.[uid] && !(n.hiddenBy || []).includes(uid)
        }).length)
      },
      () => {}
    )
    return unsub
  }, [currentUser?.id])

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

  const isChatPage = /\/project\/[^/]+\/chat\/[^/]+/.test(location.pathname)

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
        {/* 채팅 페이지는 ChatPage 자체 헤더(뒤로·방이름·인원)를 쓰므로 모바일 헤더 숨김 */}
        {!isChatPage && (
          <div className={styles.mobileHeader}>
            <button className={styles.menuBtn} onClick={() => setShowSearch(true)}>🔍</button>

            {pageTitle
              ? <span className={styles.mobilePageTitle}>{pageTitle}</span>
              : <span className={styles.mobileLogo} onClick={() => navigate('/home')}>Teamp</span>
            }

            <button className={styles.mobileNotiBtn} onClick={() => setShowNotifications(true)}>
              ✦
              {unreadCount > 0 && <span className={styles.mobileNotiBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
          </div>
        )}

        <InstallPrompt />

        <div id="page-content" className={styles.content}>
          <Outlet />
        </div>

        {/* ── 하단 푸터 (데스크탑 전용) ── */}
        <footer className={styles.footer}>
          <span className={styles.footerLegal}>
            팀프&nbsp;·&nbsp;기여와 관계의 기록&nbsp;·&nbsp;문의 support@teamp.kr
          </span>
          <span className={styles.footerRight}>
            <NavLink to="/terms" className={styles.footerLink}>이용약관</NavLink>
            <span className={styles.footerDot}>·</span>
            <NavLink to="/privacy" className={styles.footerLink}>개인정보처리방침</NavLink>
            <span className={styles.footerDot}>·</span>
            <span>© 2026 Teamp. All rights reserved.</span>
          </span>
        </footer>

        {/* ── 모바일 하단 탭바 — 채팅 페이지에서는 숨김 ── */}
        <nav className={`${styles.mobileTabBar} ${isChatPage ? styles.mobileTabBarHidden : ''}`}>
          {/* 홈 */}
          <NavLink to="/home" className={({ isActive }) => `${styles.mobileTab} ${isActive ? styles.mobileTabActive : ''}`}>
            <svg className={styles.mobileTabIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span className={styles.mobileTabLabel}>홈</span>
          </NavLink>

          {/* 커넥트 */}
          <NavLink to="/connect" className={({ isActive }) => `${styles.mobileTab} ${isActive ? styles.mobileTabActive : ''}`}>
            <svg className={styles.mobileTabIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
            </svg>
            <span className={styles.mobileTabLabel}>커넥트</span>
          </NavLink>

          {/* 쪽지 */}
          <NavLink to="/messages" className={({ isActive }) => `${styles.mobileTab} ${isActive ? styles.mobileTabActive : ''}`}>
            {noteUnread > 0 && <span className={styles.mobileTabBadge}>{noteUnread > 9 ? '9+' : noteUnread}</span>}
            <svg className={styles.mobileTabIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <span className={styles.mobileTabLabel}>쪽지</span>
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

          {/* 전체메뉴 */}
          <button
            className={`${styles.mobileTab} ${showMobileMenu ? styles.mobileTabActive : ''}`}
            onClick={() => setShowMobileMenu(true)}>
            <svg className={styles.mobileTabIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
            <span className={styles.mobileTabLabel}>전체메뉴</span>
          </button>
        </nav>
      </main>

      <NotificationPanel open={showNotifications} onClose={() => setShowNotifications(false)} />
      <SearchModal open={showSearch} onClose={() => setShowSearch(false)} />
      {showCreateModal && <CreateProjectModal onClose={() => setShowCreateModal(false)} />}
      {showMobileMenu && (
        <MobileMenuSheet
          onClose={() => setShowMobileMenu(false)}
          onCreateProject={() => { setShowCreateModal(true) }}
        />
      )}
      <ChatToastContainer />
      <ErrorToastContainer />
      <ConfirmDialog />
    </div>
  )
}
