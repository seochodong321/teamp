import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  collection, query, orderBy, getDocs, updateDoc, deleteDoc, doc,
  serverTimestamp, limit, where,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import { Navigate } from 'react-router-dom'
import styles from './AdminPage.module.css'

const ADMIN_EMAILS = ['seobomin524@gmail.com']

const TYPE_LABEL = { project: '프로젝트', match: '매치 모집글', user: '유저 프로필' }
const REASON_LABEL = {
  illegal: '불법 콘텐츠', spam: '스팸 / 홍보', false: '허위 정보',
  hate: '욕설 / 혐오 표현', other: '기타',
}

function useAdminConfirm() {
  const [state, setState] = useState(null) // { message, onConfirm, error, loading }

  const ask = useCallback((message, onConfirm) => {
    setState({ message, onConfirm, error: null, loading: false })
  }, [])

  const dismiss = useCallback(() => setState(null), [])

  const handleOk = useCallback(async () => {
    if (!state) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      await state.onConfirm()
      setState(null)
    } catch (err) {
      const msg = err?.code === 'permission-denied'
        ? '권한이 없어요. Firestore 규칙을 확인해주세요.'
        : (err?.message || '오류가 발생했어요.')
      setState((s) => ({ ...s, loading: false, error: msg }))
    }
  }, [state])

  const dialog = state ? createPortal(
    <div className={styles.confirmBackdrop} onClick={dismiss}>
      <div className={styles.confirmBox} onClick={(e) => e.stopPropagation()}>
        <p className={styles.confirmMsg}>{state.message}</p>
        {state.error && <p className={styles.confirmError}>{state.error}</p>}
        <div className={styles.confirmBtns}>
          <button className={styles.confirmCancel} onClick={dismiss} disabled={state.loading}>취소</button>
          <button className={styles.confirmOk} onClick={handleOk} disabled={state.loading}>
            {state.loading ? '처리 중...' : '확인'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return { ask, dialog }
}

// ─── 신고 관리 탭 ────────────────────────────────────────────
function ReportsTab({ onDeleteProject, onDeleteMatch, onBlockUser }) {
  const [reports, setReports]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('pending')
  const [actionError, setActionError] = useState(null)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc')))
      setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReports() }, [fetchReports])

  const handleResolve = async (reportId) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { status: 'resolved' })
      setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status: 'resolved' } : r))
      setActionError(null)
    } catch (err) {
      setActionError(err?.code === 'permission-denied' ? '권한이 없어요.' : (err?.message || '오류'))
    }
  }
  const handleReopen = async (reportId) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { status: 'pending' })
      setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status: 'pending' } : r))
      setActionError(null)
    } catch (err) {
      setActionError(err?.code === 'permission-denied' ? '권한이 없어요.' : (err?.message || '오류'))
    }
  }

  const filtered = filter === 'all' ? reports : reports.filter((r) => r.status === filter)
  const pendingCount = reports.filter((r) => r.status === 'pending').length

  const targetLink = (r) => {
    if (r.type === 'project') return `/project/${r.targetId}`
    if (r.type === 'user')    return `/u/${r.targetName}`
    return null
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.subTabRow}>
        {[['pending', `미처리`, pendingCount], ['resolved', '처리 완료', null], ['all', '전체', null]].map(([v, label, count]) => (
          <button key={v} className={`${styles.subTab} ${filter === v ? styles.subTabActive : ''}`} onClick={() => setFilter(v)}>
            {label}
            {count > 0 && <span className={styles.badge}>{count}</span>}
          </button>
        ))}
        <button className={styles.refreshBtn} onClick={fetchReports}>↻</button>
      </div>
      {actionError && <p className={styles.tabError}>{actionError}</p>}

      {loading ? <p className={styles.empty}>불러오는 중...</p> : filtered.length === 0 ? (
        <p className={styles.empty}>{filter === 'pending' ? '처리할 신고가 없어요 ✅' : '신고 내역이 없어요'}</p>
      ) : (
        <div className={styles.list}>
          {filtered.map((r) => {
            const link = targetLink(r)
            const createdAt = r.createdAt?.toDate?.()?.toLocaleDateString('ko-KR') || '-'
            return (
              <div key={r.id} className={`${styles.card} ${r.status === 'resolved' ? styles.cardResolved : ''}`}>
                <div className={styles.cardTop}>
                  <div className={styles.cardMeta}>
                    <span className={`${styles.typeBadge} ${styles['type_' + r.type]}`}>{TYPE_LABEL[r.type] || r.type}</span>
                    <span className={styles.reasonBadge}>{REASON_LABEL[r.reason] || r.reason}</span>
                    {r.status === 'resolved' && <span className={styles.resolvedBadge}>처리 완료</span>}
                  </div>
                  <span className={styles.date}>{createdAt}</span>
                </div>
                <div className={styles.cardBody}>
                  <p className={styles.targetName}>
                    <strong>대상:</strong> {r.targetName}
                    {link && <a href={link} target="_blank" rel="noopener noreferrer" className={styles.targetLink}>→ 바로가기</a>}
                  </p>
                  <p className={styles.reporter}><strong>신고자:</strong> {r.reporterName}</p>
                  {r.detail && <p className={styles.detail}>"{r.detail}"</p>}
                </div>
                <div className={styles.cardActions}>
                  {r.type === 'project' && (
                    <button className={styles.dangerBtn} onClick={() => onDeleteProject(r.targetId, r.targetName, r.id)}>프로젝트 삭제</button>
                  )}
                  {r.type === 'match' && (
                    <button className={styles.dangerBtn} onClick={() => onDeleteMatch(r.targetId, r.targetName, r.id)}>모집글 삭제</button>
                  )}
                  {r.type === 'user' && (
                    <button className={styles.dangerBtn} onClick={() => onBlockUser(r.targetId, r.targetName, null, r.id)}>유저 블락</button>
                  )}
                  {r.status === 'pending' ? (
                    <button className={styles.resolveBtn} onClick={() => handleResolve(r.id)}>처리 완료</button>
                  ) : (
                    <button className={styles.reopenBtn} onClick={() => handleReopen(r.id)}>미처리로</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── 프로젝트 관리 탭 ────────────────────────────────────────
function ProjectsTab({ onDeleteProject }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'projects'))
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      setProjects(sorted)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const filtered = search
    ? projects.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search))
    : projects

  return (
    <div className={styles.tabContent}>
      <input className={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="프로젝트명 또는 ID 검색..." />
      {loading ? <p className={styles.empty}>불러오는 중...</p> : (
        <div className={styles.list}>
          {filtered.map((p) => (
            <div key={p.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardMeta}>
                  <span className={`${styles.typeBadge} ${styles.type_project}`}>프로젝트</span>
                  <span className={styles.reasonBadge}>{p.status === 'archived' ? '완료' : p.status === 'active' ? '진행 중' : p.status}</span>
                  {p.isTutorial && <span className={styles.tutorialBadge}>튜토리얼</span>}
                </div>
                <span className={styles.date}>{p.createdAt?.toDate?.()?.toLocaleDateString('ko-KR') || '-'}</span>
              </div>
              <div className={styles.cardBody}>
                <p className={styles.targetName}>
                  <strong>{p.emoji} {p.name}</strong>
                  <a href={`/project/${p.id}`} target="_blank" rel="noopener noreferrer" className={styles.targetLink}>→ 바로가기</a>
                </p>
                <p className={styles.reporter}>멤버 {p.members?.length || 0}명 · {p.category || '카테고리 없음'}</p>
                {p.purpose && <p className={styles.detail}>{p.purpose}</p>}
              </div>
              <div className={styles.cardActions}>
                <button className={styles.dangerBtn} onClick={() => onDeleteProject(p.id, p.name)}>삭제</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className={styles.empty}>검색 결과가 없어요</p>}
        </div>
      )}
    </div>
  )
}

// ─── 매치 관리 탭 ────────────────────────────────────────────
function MatchTab({ onDeleteMatch }) {
  const [posts, setPosts]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const snap = await getDocs(query(collection(db, 'matchPosts'), orderBy('createdAt', 'desc'), limit(200)))
        setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  const filtered = search
    ? posts.filter((p) => p.title?.toLowerCase().includes(search.toLowerCase()) || p.leaderName?.includes(search))
    : posts

  return (
    <div className={styles.tabContent}>
      <input className={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="제목 또는 리더명 검색..." />
      {loading ? <p className={styles.empty}>불러오는 중...</p> : (
        <div className={styles.list}>
          {filtered.map((p) => (
            <div key={p.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardMeta}>
                  <span className={`${styles.typeBadge} ${styles.type_match}`}>매치 모집글</span>
                  <span className={styles.reasonBadge}>{p.status === 'closed' ? '마감' : '모집 중'}</span>
                </div>
                <span className={styles.date}>{p.createdAt?.toDate?.()?.toLocaleDateString('ko-KR') || '-'}</span>
              </div>
              <div className={styles.cardBody}>
                <p className={styles.targetName}><strong>{p.title}</strong></p>
                <p className={styles.reporter}>리더: {p.leaderName} · {p.projectName}</p>
                {p.skills?.length > 0 && <p className={styles.detail}>{p.skills.join(', ')}</p>}
              </div>
              <div className={styles.cardActions}>
                <button className={styles.dangerBtn} onClick={() => onDeleteMatch(p.id, p.title)}>삭제</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className={styles.empty}>검색 결과가 없어요</p>}
        </div>
      )}
    </div>
  )
}

// ─── 유저 관리 탭 ────────────────────────────────────────────
function UsersTab({ onBlockUser, onUnblockUser }) {
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(300)))
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleUnblock = async (uid) => {
    await onUnblockUser(uid)
    setUsers((prev) => prev.map((u) => u.id === uid ? { ...u, banned: false } : u))
  }

  const filtered = search
    ? users.filter((u) => u.name?.includes(search) || u.email?.includes(search) || u.username?.includes(search))
    : users

  return (
    <div className={styles.tabContent}>
      <div className={styles.subTabRow}>
        <input className={styles.searchInput} style={{ flex: 1 }} value={search}
          onChange={(e) => setSearch(e.target.value)} placeholder="이름, 이메일, 유저명 검색..." />
        <button className={styles.refreshBtn} onClick={fetchUsers}>↻</button>
      </div>
      {loading ? <p className={styles.empty}>불러오는 중...</p> : (
        <div className={styles.list}>
          {filtered.map((u) => (
            <div key={u.id} className={`${styles.card} ${u.banned ? styles.cardBanned : ''}`}>
              <div className={styles.cardTop}>
                <div className={styles.cardMeta}>
                  <span className={`${styles.typeBadge} ${styles.type_user}`}>유저</span>
                  {u.banned && <span className={styles.bannedBadge}>블락됨</span>}
                </div>
                <span className={styles.date}>{u.createdAt?.toDate?.()?.toLocaleDateString('ko-KR') || '-'}</span>
              </div>
              <div className={styles.cardBody}>
                <p className={styles.targetName}>
                  <strong>{u.name}</strong>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{u.username}</span>
                  {u.username && (
                    <a href={`/u/${(u.username || '').replace('@', '')}`} target="_blank" rel="noopener noreferrer" className={styles.targetLink}>→ 프로필</a>
                  )}
                </p>
                <p className={styles.reporter}>{u.email} {u.affiliation && `· ${u.affiliation}`}</p>
              </div>
              {u.banned && u.bannedAt && (
                <p className={styles.bannedAt}>
                  블락일: {u.bannedAt?.toDate?.()?.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) || '-'}
                </p>
              )}
              <div className={styles.cardActions}>
                {u.banned ? (
                  <button className={styles.unblockBtn} onClick={() => handleUnblock(u.id)}>블락 해제</button>
                ) : (
                  <button className={styles.dangerBtn} onClick={() => onBlockUser(u.id, u.name, () => {
                    setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, banned: true, bannedAt: { toDate: () => new Date() } } : x))
                  })}>블락</button>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className={styles.empty}>검색 결과가 없어요</p>}
        </div>
      )}
    </div>
  )
}

// ─── 메인 AdminPage ───────────────────────────────────────────
export default function AdminPage() {
  const { currentUser } = useStore()
  const [activeTab, setActiveTab] = useState('reports')
  const { ask, dialog } = useAdminConfirm()

  const isAdmin = ADMIN_EMAILS.includes(currentUser?.email)
  if (!isAdmin) return <Navigate to="/home" replace />

  // ── 액션: 프로젝트 삭제
  const handleDeleteProject = (projectId, name, reportId) => {
    ask(`"${name}" 프로젝트를 삭제할까요? 되돌릴 수 없어요.`, async () => {
      await deleteDoc(doc(db, 'projects', projectId))
      if (reportId) await updateDoc(doc(db, 'reports', reportId), { status: 'resolved', resolvedAt: serverTimestamp() })
    })
  }

  // ── 액션: 매치 모집글 삭제
  const handleDeleteMatch = (postId, title, reportId) => {
    ask(`"${title}" 모집글을 삭제할까요?`, async () => {
      await deleteDoc(doc(db, 'matchPosts', postId))
      if (reportId) await updateDoc(doc(db, 'reports', reportId), { status: 'resolved', resolvedAt: serverTimestamp() })
    })
  }

  // ── 액션: 유저 블락
  const handleBlockUser = (uid, name, onSuccess, reportId) => {
    ask(`"${name}" 계정을 블락할까요? 해당 유저는 로그인할 수 없게 돼요.`, async () => {
      await updateDoc(doc(db, 'users', uid), { banned: true, bannedAt: serverTimestamp() })
      if (reportId) await updateDoc(doc(db, 'reports', reportId), { status: 'resolved', resolvedAt: serverTimestamp() })
      onSuccess?.()
    })
  }

  // ── 액션: 유저 블락 해제
  const handleUnblockUser = (uid) => {
    updateDoc(doc(db, 'users', uid), { banned: false, bannedAt: null })
  }

  const TABS = [
    ['reports',  '🚩 신고 관리'],
    ['projects', '📁 프로젝트'],
    ['match',    '🤝 매치 모집글'],
    ['users',    '👤 유저'],
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>🛡️ 팀프 마스터</h1>
          <p className={styles.sub}>Teamp Admin · {currentUser?.email}</p>
        </div>
      </div>

      <div className={styles.mainTabs}>
        {TABS.map(([key, label]) => (
          <button key={key} className={`${styles.mainTab} ${activeTab === key ? styles.mainTabActive : ''}`}
            onClick={() => setActiveTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'reports' && (
        <ReportsTab
          onDeleteProject={handleDeleteProject}
          onDeleteMatch={handleDeleteMatch}
          onBlockUser={handleBlockUser}
        />
      )}
      {activeTab === 'projects' && <ProjectsTab onDeleteProject={handleDeleteProject} />}
      {activeTab === 'match'    && <MatchTab    onDeleteMatch={handleDeleteMatch} />}
      {activeTab === 'users'    && <UsersTab    onBlockUser={handleBlockUser} onUnblockUser={handleUnblockUser} />}

      {dialog}
    </div>
  )
}
