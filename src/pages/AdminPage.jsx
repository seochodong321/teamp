import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  collection, query, orderBy, getDocs, getDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, limit, where, writeBatch, addDoc,
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

// ─── 통계 대시보드 탭 ─────────────────────────────────────────
function StatCard({ label, value, sub }) {
  return (
    <div className={styles.statCard}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>{value.toLocaleString()}</p>
      {sub && <p className={styles.statSub}>{sub}</p>}
    </div>
  )
}

function StatsTab() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchStats = async () => {
      setLoading(true)
      try {
        const [userSnap, projectSnap, matchSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'projects')),
          getDocs(query(collection(db, 'matchPosts'), orderBy('createdAt', 'desc'), limit(500))),
        ])
        if (cancelled) return

        const users    = userSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        const projects = projectSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        const matches  = matchSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

        const toDate = (v) => {
          if (!v) return null
          if (typeof v.toDate === 'function') return v.toDate()
          return new Date(v)
        }

        const now = new Date()
        const thisMonthUsers = users.filter((u) => {
          const d = toDate(u.createdAt)
          return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        }).length

        const monthly = Array.from({ length: 6 }, (_, i) => {
          const target = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
          const count = users.filter((u) => {
            const d = toDate(u.createdAt)
            return d && d.getMonth() === target.getMonth() && d.getFullYear() === target.getFullYear()
          }).length
          return { label: `${target.getMonth() + 1}월`, count }
        })

        setStats({
          totalUsers:     users.length,
          thisMonthUsers,
          totalProjects:  projects.filter((p) => !p.isTutorial).length,
          activeProjects: projects.filter((p) => p.status === 'active' && !p.isTutorial).length,
          totalMatches:   matches.length,
          openMatches:    matches.filter((m) => m.status === 'open').length,
          monthly,
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchStats()
    return () => { cancelled = true }
  }, [])

  if (loading) return <p className={styles.empty}>통계 불러오는 중...</p>
  if (!stats)  return null

  const maxMonthly = Math.max(...stats.monthly.map((m) => m.count), 1)

  return (
    <div className={styles.tabContent}>
      <div className={styles.statsGrid}>
        <StatCard label="총 유저" value={stats.totalUsers} sub={`이번 달 +${stats.thisMonthUsers}`} />
        <StatCard label="총 프로젝트" value={stats.totalProjects} sub={`활성 ${stats.activeProjects}개`} />
        <StatCard label="매치 모집" value={stats.totalMatches} sub={`모집 중 ${stats.openMatches}개`} />
      </div>

      <div className={styles.chartCard}>
        <p className={styles.chartTitle}>월별 신규 가입자 (최근 6개월)</p>
        <div className={styles.barChart}>
          {stats.monthly.map((m, i) => (
            <div key={i} className={styles.barCol}>
              <span className={styles.barValue}>{m.count || ''}</span>
              <div className={styles.barTrack}>
                <div className={styles.bar} style={{ height: `${(m.count / maxMonthly) * 100}%` }} />
              </div>
              <span className={styles.barLabel}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── 전체공지 탭 ──────────────────────────────────────────────
function AnnouncementTab({ currentUser }) {
  const [subject, setSubject] = useState('')
  const [body,    setBody]    = useState('')
  const [sending, setSending] = useState(false)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState(null)

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return
    setSending(true)
    setResult(null)
    setError(null)
    try {
      const usersSnap = await getDocs(collection(db, 'users'))
      const targets = usersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.id !== currentUser.id)

      const now = new Date()
      const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      const CHUNK = 400
      let sent = 0

      for (let i = 0; i < targets.length; i += CHUNK) {
        const batch = writeBatch(db)
        targets.slice(i, i + CHUNK).forEach((user) => {
          const ref = doc(collection(db, 'notes'))
          batch.set(ref, {
            fromUid:      currentUser.id,
            fromName:     '📢 팀프 공식',
            fromUsername: '@teamp',
            toUid:        user.id,
            toName:       user.name || '유저',
            toUsername:   user.username || '',
            subject,
            participants: [user.id],
            messages: [{ senderUid: currentUser.id, senderName: '📢 팀프 공식', text: body, time: timeStr }],
            read:         { [user.id]: false },
            isAnnouncement: true,
            createdAt:    serverTimestamp(),
            lastMessageAt: serverTimestamp(),
          })
          sent++
        })
        await batch.commit()
      }
      setResult(sent)
      setSubject('')
      setBody('')
    } catch (err) {
      setError(err?.message || '발송 중 오류가 발생했어요.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.announceWrap}>
        <p className={styles.announceDesc}>모든 유저의 쪽지함으로 공지가 발송됩니다.</p>
        <input
          className={styles.searchInput}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="제목..."
        />
        <textarea
          className={styles.announceBody}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="내용을 입력하세요..."
          rows={6}
        />
        {error  && <p className={styles.tabError}>{error}</p>}
        {result != null && <p className={styles.announceSuccess}>✅ {result}명에게 발송 완료</p>}
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={sending || !subject.trim() || !body.trim()}
        >
          {sending ? '발송 중...' : '📢 전체 발송'}
        </button>
      </div>
    </div>
  )
}

// ─── 신고 관리 탭 ─────────────────────────────────────────────
const REPORT_FILTERS = [['pending', '미처리'], ['resolved', '처리 완료'], ['all', '전체']]

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

  const handleUpdateStatus = async (reportId, status) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { status })
      setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status } : r))
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
        {REPORT_FILTERS.map(([v, label]) => (
          <button key={v} className={`${styles.subTab} ${filter === v ? styles.subTabActive : ''}`} onClick={() => setFilter(v)}>
            {label}
            {v === 'pending' && pendingCount > 0 && <span className={styles.badge}>{pendingCount}</span>}
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
                    <button className={styles.dangerBtn} onClick={() => onDeleteProject(r.targetId, r.targetName, r.id,
                      () => setReports((prev) => prev.map((x) => x.id === r.id ? { ...x, status: 'resolved' } : x)))}>프로젝트 삭제</button>
                  )}
                  {r.type === 'match' && (
                    <button className={styles.dangerBtn} onClick={() => onDeleteMatch(r.targetId, r.targetName, r.id,
                      () => setReports((prev) => prev.map((x) => x.id === r.id ? { ...x, status: 'resolved' } : x)))}>모집글 삭제</button>
                  )}
                  {r.type === 'user' && (
                    <button className={styles.dangerBtn} onClick={() => onBlockUser(r.targetId, r.targetName, null, r.id)}>유저 블락</button>
                  )}
                  {r.status === 'pending' ? (
                    <button className={styles.resolveBtn} onClick={() => handleUpdateStatus(r.id, 'resolved')}>처리 완료</button>
                  ) : (
                    <button className={styles.reopenBtn} onClick={() => handleUpdateStatus(r.id, 'pending')}>미처리로</button>
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
  const [projects, setProjects]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [showTutorial, setShowTutorial] = useState(false)

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

  const tutorialCount = projects.filter((p) => p.isTutorial).length
  const filtered = projects
    .filter((p) => showTutorial || !p.isTutorial)
    .filter((p) => !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search))

  return (
    <div className={styles.tabContent}>
      <div className={styles.subTabRow}>
        <input className={styles.searchInput} style={{ flex: 1 }} value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="프로젝트명 또는 ID 검색..." />
        <button
          className={`${styles.subTab} ${showTutorial ? styles.subTabActive : ''}`}
          onClick={() => setShowTutorial((v) => !v)}
        >
          튜토리얼 {tutorialCount > 0 && <span className={styles.badge}>{tutorialCount}</span>}
        </button>
        <button className={styles.refreshBtn} onClick={fetchProjects}>↻</button>
      </div>
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
                <button className={styles.dangerBtn} onClick={() => onDeleteProject(p.id, p.name, null,
                  () => setProjects((prev) => prev.filter((x) => x.id !== p.id)))}>삭제</button>
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
function MatchTab({ onDeleteMatch, onCloseMatch }) {
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
                {p.status === 'open' && (
                  <button className={styles.warnBtn} onClick={() => onCloseMatch(p.id, p.title,
                    () => setPosts((prev) => prev.map((x) => x.id === p.id ? { ...x, status: 'closed' } : x)))}>강제 마감</button>
                )}
                {p.status === 'closed' && <span className={styles.closedTag}>마감됨</span>}
                <button className={styles.dangerBtn} onClick={() => onDeleteMatch(p.id, p.title, null,
                  () => setPosts((prev) => prev.filter((x) => x.id !== p.id)))}>삭제</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className={styles.empty}>검색 결과가 없어요</p>}
        </div>
      )}
    </div>
  )
}

const PLAN_META = {
  free:  { label: 'Free',  color: '#6B7280', bg: '#F3F4F6' },
  pro:   { label: 'Pro',   color: '#534AB7', bg: '#EEF2FF' },
  team:  { label: 'Team',  color: '#0D9488', bg: '#CCFBF1' },
  admin: { label: 'Admin', color: '#DC2626', bg: '#FEE2E2' },
}

// ─── 유저 관리 탭 ────────────────────────────────────────────
function UsersTab({ onBlockUser, onUnblockUser }) {
  const [users, setUsers]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [planLoading, setPlanLoading] = useState(null)

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

  const handleUnblock = (uid, name) => {
    onUnblockUser(uid, name, () => {
      setUsers((prev) => prev.map((u) => u.id === uid ? { ...u, banned: false } : u))
    })
  }

  const changePlan = async (uid, newPlan) => {
    setPlanLoading(uid)
    try {
      await updateDoc(doc(db, 'users', uid), { plan: newPlan })
      setUsers((prev) => prev.map((u) => u.id === uid ? { ...u, plan: newPlan } : u))
    } finally {
      setPlanLoading(null)
    }
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
          {filtered.map((u) => {
            const plan = u.plan || 'free'
            const pm = PLAN_META[plan] || PLAN_META.free
            return (
              <div key={u.id} className={`${styles.card} ${u.banned ? styles.cardBanned : ''}`}>
                <div className={styles.cardTop}>
                  <div className={styles.cardMeta}>
                    <span className={`${styles.typeBadge} ${styles.type_user}`}>유저</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: pm.bg, color: pm.color }}>{pm.label}</span>
                    {u.banned && <span className={styles.bannedBadge}>블락됨</span>}
                  </div>
                  <span className={styles.date}>{u.createdAt?.toDate?.()?.toLocaleDateString('ko-KR') || (typeof u.createdAt === 'string' ? u.createdAt.slice(0, 10) : '-')}</span>
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
                  {/* 플랜 변경 */}
                  <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                    {Object.entries(PLAN_META).map(([key, meta]) => (
                      <button
                        key={key}
                        disabled={plan === key || planLoading === u.id}
                        onClick={() => changePlan(u.id, key)}
                        style={{
                          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                          background: plan === key ? meta.bg : 'var(--bg-secondary)',
                          color: plan === key ? meta.color : 'var(--text-tertiary)',
                          border: `1px solid ${plan === key ? meta.color : 'var(--border)'}`,
                          cursor: plan === key ? 'default' : 'pointer',
                          opacity: planLoading === u.id ? 0.5 : 1,
                        }}
                      >{meta.label}</button>
                    ))}
                  </div>
                  {/* 블락 */}
                  {u.banned ? (
                    <button className={styles.unblockBtn} onClick={() => handleUnblock(u.id, u.name)}>블락 해제</button>
                  ) : (
                    <button className={styles.dangerBtn} onClick={() => onBlockUser(u.id, u.name, () => {
                      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, banned: true, bannedAt: { toDate: () => new Date() } } : x))
                    })}>블락</button>
                  )}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && <p className={styles.empty}>검색 결과가 없어요</p>}
        </div>
      )}
    </div>
  )
}

// ─── 메인 AdminPage ───────────────────────────────────────────
export default function AdminPage() {
  const { currentUser } = useStore()
  const [activeTab, setActiveTab] = useState('stats')
  const { ask, dialog } = useAdminConfirm()

  const isAdmin = ADMIN_EMAILS.includes(currentUser?.email)
  if (!isAdmin) return <Navigate to="/home" replace />

  // ── 액션: 프로젝트 삭제
  const handleDeleteProject = (projectId, name, reportId, onSuccess) => {
    ask(`"${name}" 프로젝트를 삭제할까요? 되돌릴 수 없어요.`, async () => {
      const snap = await getDoc(doc(db, 'projects', projectId))
      const memberIds = snap.exists()
        ? (snap.data().memberIds || (snap.data().members || []).map((m) => m.id))
        : []
      await deleteDoc(doc(db, 'projects', projectId))
      if (reportId) await updateDoc(doc(db, 'reports', reportId), { status: 'resolved', resolvedAt: serverTimestamp() })
      await Promise.all(memberIds.map((uid) =>
        addDoc(collection(db, 'notifications'), {
          targetUserId: uid, type: 'admin', read: false,
          text: `🛡️ 관리자에 의해 "${name}" 프로젝트가 삭제되었습니다.`,
          link: '/help', createdAt: serverTimestamp(),
        })
      ))
      onSuccess?.()
    })
  }

  // ── 액션: 매치 모집글 삭제
  const handleDeleteMatch = (postId, title, reportId, onSuccess) => {
    ask(`"${title}" 모집글을 삭제할까요?`, async () => {
      const snap = await getDoc(doc(db, 'matchPosts', postId))
      const leaderId = snap.exists() ? snap.data().leaderId : null
      await deleteDoc(doc(db, 'matchPosts', postId))
      if (reportId) await updateDoc(doc(db, 'reports', reportId), { status: 'resolved', resolvedAt: serverTimestamp() })
      if (leaderId) {
        await addDoc(collection(db, 'notifications'), {
          targetUserId: leaderId, type: 'admin', read: false,
          text: `🛡️ 관리자에 의해 "${title}" 모집글이 삭제되었습니다.`,
          link: '/help', createdAt: serverTimestamp(),
        })
      }
      onSuccess?.()
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

  // ── 액션: 매치 강제 마감
  const handleCloseMatch = (postId, title, onSuccess) => {
    ask(`"${title}" 모집글을 강제 마감할까요? 기존 지원자는 유지되고 새 지원은 받지 않아요.`, async () => {
      const snap = await getDoc(doc(db, 'matchPosts', postId))
      const leaderId = snap.exists() ? snap.data().leaderId : null
      await updateDoc(doc(db, 'matchPosts', postId), { status: 'closed' })
      if (leaderId) {
        await addDoc(collection(db, 'notifications'), {
          targetUserId: leaderId, type: 'admin', read: false,
          text: `🛡️ 관리자에 의해 "${title}" 모집글이 강제 마감되었습니다.`,
          link: '/help', createdAt: serverTimestamp(),
        })
      }
      onSuccess?.()
    })
  }

  // ── 액션: 유저 블락 해제
  const handleUnblockUser = (uid, name, onSuccess) => {
    ask(`"${name}" 계정의 블락을 해제할까요?`, async () => {
      await updateDoc(doc(db, 'users', uid), { banned: false, bannedAt: null })
      onSuccess?.()
    })
  }

  const TABS = [
    ['stats',    '📊 통계'],
    ['reports',  '🚩 신고 관리'],
    ['projects', '📁 프로젝트'],
    ['match',    '🤝 매치 모집글'],
    ['users',    '👤 유저'],
    ['announce', '📢 공지'],
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

      {activeTab === 'stats'    && <StatsTab />}
      {activeTab === 'reports'  && (
        <ReportsTab
          onDeleteProject={handleDeleteProject}
          onDeleteMatch={handleDeleteMatch}
          onBlockUser={handleBlockUser}
        />
      )}
      {activeTab === 'projects' && <ProjectsTab onDeleteProject={handleDeleteProject} />}
      {activeTab === 'match'    && <MatchTab    onDeleteMatch={handleDeleteMatch} onCloseMatch={handleCloseMatch} />}
      {activeTab === 'users'    && <UsersTab    onBlockUser={handleBlockUser} onUnblockUser={handleUnblockUser} />}
      {activeTab === 'announce' && <AnnouncementTab currentUser={currentUser} />}

      {dialog}
    </div>
  )
}
