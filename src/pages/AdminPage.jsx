import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  collection, query, orderBy, getDocs, getDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, limit, where, writeBatch, addDoc,
} from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import { deleteProjectDeep } from '../store/helpers.js'
import { Navigate } from 'react-router-dom'
import styles from './AdminPage.module.css'

const ADMIN_EMAILS = ['seobomin524@gmail.com']

const TYPE_LABEL = { project: '프로젝트', match: '매치 모집글', user: '유저 프로필', note: '쪽지' }
const REASON_LABEL = {
  illegal: '불법 콘텐츠', spam: '스팸 / 홍보', false: '허위 정보',
  hate: '욕설 / 혐오 표현', other: '기타',
}
const LOG_ACTION = {
  block: '🚫 블락', unblock: '✅ 블락 해제', 'delete-user': '🗑️ 유저 탈퇴',
  plan: '💳 요금제 변경', 'delete-project': '📁 프로젝트 삭제',
  'delete-match': '🤝 모집글 삭제', 'close-match': '🤝 모집 마감',
  promote: '🛡️ 어드민 승급', demote: '🔻 어드민 해제',
}
const SELECTABLE_PLANS = ['free', 'student', 'pro', 'team']  // 'admin'은 요금제 아님(권한 토글로 분리)
const PLAN_KO = { free: '무료', student: '학생', pro: '프로', team: '팀' }
const tsMs  = (ts) => ts?.toMillis ? ts.toMillis() : (ts?.seconds ? ts.seconds * 1000 : 0)
const fmtTs = (ts) => {
  const ms = tsMs(ts)
  if (!ms) return '-'
  return new Date(ms).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
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
                  {r.type === 'note' && (
                    <>
                      <p className={styles.reporter}><strong>발신:</strong> {r.noteFromName} → <strong>수신:</strong> {r.noteToName}</p>
                      {r.noteContent && <p className={styles.noteContent}>{r.noteContent}</p>}
                    </>
                  )}
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
                  {r.type === 'note' && r.noteFromUid && (
                    <button className={styles.dangerBtn} onClick={() => onBlockUser(r.noteFromUid, r.noteFromName, null, r.id)}>발신자 블락</button>
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
                    () => setPosts((prev) => prev.map((x) => x.id === p.id ? { ...x, status: 'closed' } : x)))}>마감 처리</button>
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
  free:    { label: 'Free',    color: '#6B7280', bg: '#F3F4F6' },
  student: { label: 'Student', color: '#059669', bg: '#D1FAE5' },
  pro:     { label: 'Pro',     color: '#534AB7', bg: '#EEF2FF' },
  team:    { label: 'Team',    color: '#0D9488', bg: '#CCFBF1' },
  admin:   { label: 'Admin',   color: '#DC2626', bg: '#FEE2E2' },
}

// ─── 유저 관리 탭 ────────────────────────────────────────────
function UsersTab({ onBlockUser, onUnblockUser, onDeleteUser, onToggleAdmin, isBootstrap, logAdmin }) {
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

  const handleDelete = (uid, name) => {
    onDeleteUser(uid, name, () => {
      setUsers((prev) => prev.filter((u) => u.id !== uid))
    })
  }

  const handleToggleAdmin = (uid, name, makeAdmin) => {
    onToggleAdmin(uid, name, makeAdmin, () => {
      setUsers((prev) => prev.map((u) => u.id === uid ? { ...u, isAdmin: makeAdmin } : u))
    })
  }

  const changePlan = async (uid, newPlan) => {
    const target = users.find((u) => u.id === uid)
    const before = target?.plan || 'free'
    if (before === newPlan) return
    setPlanLoading(uid)
    try {
      await updateDoc(doc(db, 'users', uid), { plan: newPlan })
      setUsers((prev) => prev.map((u) => u.id === uid ? { ...u, plan: newPlan } : u))
      logAdmin?.({ type: 'plan', targetId: uid, targetName: target?.name || '', before, after: newPlan })
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
                    {u.isAdmin && <span className={styles.adminBadge}>🛡️ 어드민</span>}
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
                    {SELECTABLE_PLANS.map((key) => [key, PLAN_META[key]]).map(([key, meta]) => (
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
                  <button className={styles.deleteUserBtn} onClick={() => handleDelete(u.id, u.name)}>탈퇴 처리</button>
                  {isBootstrap && (
                    <button className={styles.adminToggleBtn} onClick={() => handleToggleAdmin(u.id, u.name, !u.isAdmin)}>
                      {u.isAdmin ? '🔻 어드민 해제' : '🛡️ 어드민 승급'}
                    </button>
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

// ─── 로그 탭 ─────────────────────────────────────────────────
// 신고(reports) + 어드민 활동(adminLogs)을 시각순 한 표로
function LogsTab() {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const [logSnap, repSnap] = await Promise.all([
          getDocs(query(collection(db, 'adminLogs'), orderBy('createdAt', 'desc'), limit(200))),
          getDocs(query(collection(db, 'reports'),   orderBy('createdAt', 'desc'), limit(200))),
        ])
        const logs = logSnap.docs.map((d) => {
          const x = d.data()
          return {
            id: `l_${d.id}`, ts: x.createdAt, actor: x.actorEmail || '관리자',
            action: LOG_ACTION[x.type] || x.type,
            target: x.targetName || x.targetId || '-',
            detail: x.type === 'plan' ? `${PLAN_KO[x.before] || x.before} → ${PLAN_KO[x.after] || x.after}` : '',
          }
        })
        const reps = repSnap.docs.map((d) => {
          const x = d.data()
          return {
            id: `r_${d.id}`, ts: x.createdAt, actor: x.reporterName || '익명',
            action: '🚩 신고', target: x.targetName || '-',
            detail: `${TYPE_LABEL[x.type] || x.type} · ${REASON_LABEL[x.reason] || x.reason}${x.status === 'resolved' ? ' · 처리됨' : ''}`,
          }
        })
        setRows([...logs, ...reps].sort((a, b) => tsMs(b.ts) - tsMs(a.ts)))
      } finally { setLoading(false) }
    })()
  }, [])

  if (loading) return <p className={styles.empty}>불러오는 중...</p>
  if (rows.length === 0) return <p className={styles.empty}>아직 기록된 로그가 없어요</p>

  return (
    <div className={styles.logWrap}>
      <p className={styles.logHint}>신고·블락·탈퇴·요금제 변경 등 운영 활동 (최근 200건씩)</p>
      <div className={styles.logScroll}>
        <table className={styles.logTable}>
          <thead>
            <tr><th>시각</th><th>행위자</th><th>액션</th><th>대상</th><th>상세</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={styles.logTime}>{fmtTs(r.ts)}</td>
                <td className={styles.logActor}>{r.actor}</td>
                <td className={styles.logAction}>{r.action}</td>
                <td>{r.target}</td>
                <td className={styles.logDetail}>{r.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── 메인 AdminPage ───────────────────────────────────────────
export default function AdminPage() {
  const { currentUser, showError } = useStore()
  const [activeTab, setActiveTab] = useState('stats')
  const [pendingReports, setPendingReports] = useState(0)
  const [migrating, setMigrating] = useState(false) // PII 마이그레이션(C1) 진행중 — 훅은 최상단
  const { ask, dialog } = useAdminConfirm()

  const isBootstrap = ADMIN_EMAILS.includes(currentUser?.email)  // 루트 — 승급/강등 권한
  const isAdmin = isBootstrap || currentUser?.isAdmin === true   // 어드민 = 루트 또는 승급된 유저

  // 대기 중인 신고 수 — 열자마자 처리할 일이 있는지 한눈에
  useEffect(() => {
    if (!isAdmin) return
    getDocs(query(collection(db, 'reports'), where('status', '==', 'pending')))
      .then((snap) => setPendingReports(snap.size))
      .catch(() => {})
  }, [isAdmin])

  if (!isAdmin) return <Navigate to="/home" replace />

  // 어드민 활동 로그 1건 기록 (append-only 감사 로그)
  const logAdmin = (entry) =>
    addDoc(collection(db, 'adminLogs'), {
      actorEmail: currentUser?.email || '',
      ...entry,
      createdAt: serverTimestamp(),
    }).catch(() => {})

  // ── 액션: 프로젝트 삭제
  const handleDeleteProject = (projectId, name, reportId, onSuccess) => {
    ask(`"${name}" 프로젝트를 삭제할까요? 되돌릴 수 없어요.`, async () => {
      const snap = await getDoc(doc(db, 'projects', projectId))
      const memberIds = snap.exists()
        ? (snap.data().memberIds || (snap.data().members || []).map((m) => m.id))
        : []
      if (snap.exists()) await deleteProjectDeep({ id: projectId, ...snap.data() })  // 메시지·파일까지 완전 삭제
      if (reportId) await updateDoc(doc(db, 'reports', reportId), { status: 'resolved', resolvedAt: serverTimestamp() })
      await Promise.all(memberIds.map((uid) =>
        addDoc(collection(db, 'notifications'), {
          targetUserId: uid, type: 'admin', read: false,
          fromUserId: currentUser.id, // 발신자 본인 검증 (보안 규칙)
          text: `🛡️ 관리자에 의해 "${name}" 프로젝트가 삭제되었습니다.`,
          link: '/help', createdAt: serverTimestamp(),
        })
      ))
      logAdmin({ type: 'delete-project', targetId: projectId, targetName: name })
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
          fromUserId: currentUser.id, // 발신자 본인 검증 (보안 규칙)
          text: `🛡️ 관리자에 의해 "${title}" 모집글이 삭제되었습니다.`,
          link: '/help', createdAt: serverTimestamp(),
        })
      }
      logAdmin({ type: 'delete-match', targetId: postId, targetName: title })
      onSuccess?.()
    })
  }

  // ── 액션: 유저 블락
  const handleBlockUser = (uid, name, onSuccess, reportId) => {
    ask(`"${name}" 계정을 블락할까요? 해당 유저는 로그인할 수 없게 돼요.`, async () => {
      await updateDoc(doc(db, 'users', uid), { banned: true, bannedAt: serverTimestamp() })
      if (reportId) await updateDoc(doc(db, 'reports', reportId), { status: 'resolved', resolvedAt: serverTimestamp() })
      logAdmin({ type: 'block', targetId: uid, targetName: name })
      onSuccess?.()
    })
  }

  // ── 액션: 매치 강제 마감
  const handleCloseMatch = (postId, title, onSuccess) => {
    ask(`"${title}" 모집글을 마감 처리할까요? 기존 지원자는 유지되고 새 지원은 받지 않아요.`, async () => {
      const snap = await getDoc(doc(db, 'matchPosts', postId))
      const leaderId = snap.exists() ? snap.data().leaderId : null
      await updateDoc(doc(db, 'matchPosts', postId), { status: 'closed' })
      if (leaderId) {
        await addDoc(collection(db, 'notifications'), {
          targetUserId: leaderId, type: 'admin', read: false,
          fromUserId: currentUser.id, // 발신자 본인 검증 (보안 규칙)
          text: `🛡️ 관리자에 의해 "${title}" 모집글이 마감 처리되었습니다.`,
          link: '/help', createdAt: serverTimestamp(),
        })
      }
      logAdmin({ type: 'close-match', targetId: postId, targetName: title })
      onSuccess?.()
    })
  }

  // ── 액션: 유저 블락 해제
  const handleUnblockUser = (uid, name, onSuccess) => {
    ask(`"${name}" 계정의 블락을 해제할까요?`, async () => {
      await updateDoc(doc(db, 'users', uid), { banned: false, bannedAt: null })
      logAdmin({ type: 'unblock', targetId: uid, targetName: name })
      onSuccess?.()
    })
  }

  // ── 액션: 유저 완전 삭제 (Auth + Firestore) — Cloud Function 호출
  const handleDeleteUser = (uid, name, onSuccess) => {
    ask(`"${name}" 계정을 완전히 삭제할까요?\nFirebase 인증·프로필·데이터가 모두 사라지고 되돌릴 수 없어요.`, async () => {
      try {
        const call = httpsCallable(getFunctions(getApp(), 'asia-northeast3'), 'adminDeleteUser')
        const res = await call({ uid })
        if (res?.data?.authDeleted === false) {
          showError('데이터는 삭제했지만 인증 계정은 이미 없거나 삭제하지 못했어요.')
        }
        logAdmin({ type: 'delete-user', targetId: uid, targetName: name })
        onSuccess?.()
      } catch (e) {
        console.error('[adminDeleteUser]', e)
        showError(`삭제에 실패했어요: ${e?.message || '알 수 없는 오류'} (함수 배포가 필요할 수 있어요)`)
      }
    })
  }

  // ── 액션: PII 1회 마이그레이션 (C1) — 본문서 phone·blockedUsers → 본인전용 서브문서
  const handleMigratePii = () => {
    ask('전체 유저의 전화번호·차단목록을 본인전용 영역으로 이전하고 공개 문서에서 삭제할까요?\n새 클라이언트 배포(푸시) 후 1회 실행하세요. 여러 번 눌러도 안전해요.', async () => {
      setMigrating(true)
      try {
        const call = httpsCallable(getFunctions(getApp(), 'asia-northeast3'), 'migratePiiToPrivate')
        const res = await call()
        window.alert(`완료 — ${res?.data?.moved ?? 0}명 이전 / ${res?.data?.scanned ?? 0}명 검사`)
        logAdmin({ type: 'migrate-pii', targetName: `${res?.data?.moved ?? 0}명` })
      } catch (e) {
        console.error('[migratePiiToPrivate]', e)
        showError(`마이그레이션 실패: ${e?.message || '알 수 없는 오류'}`)
      } finally {
        setMigrating(false)
      }
    })
  }

  // ── 액션: 방 권한 1회 마이그레이션 (Task A) — leaderIds + 개별방 memberIds 백필
  const handleMigrateRooms = () => {
    ask('기존 프로젝트에 방별 접근권한(leaderIds·개별방 memberIds)을 채울까요?\n새 클라이언트 배포 후 1회 실행. 여러 번 눌러도 안전해요.', async () => {
      setMigrating(true)
      try {
        const call = httpsCallable(getFunctions(getApp(), 'asia-northeast3'), 'migrateRoomAccess')
        const res = await call()
        window.alert(`완료 — 프로젝트 ${res?.data?.projects ?? 0} / 개별방 ${res?.data?.rooms ?? 0}`)
        logAdmin({ type: 'migrate-rooms', targetName: `${res?.data?.projects ?? 0}개 프로젝트` })
      } catch (e) {
        console.error('[migrateRoomAccess]', e)
        showError(`마이그레이션 실패: ${e?.message || '알 수 없는 오류'}`)
      } finally {
        setMigrating(false)
      }
    })
  }

  // ── 액션: 어드민 권한 부여/해제 (부트스트랩만 — 규칙도 동일하게 강제)
  const handleToggleAdmin = (uid, name, makeAdmin, onSuccess) => {
    ask(`"${name}" 님을 ${makeAdmin ? '어드민으로 승급할까요? 다른 유저를 관리할 수 있게 돼요.' : '어드민에서 해제할까요?'}`, async () => {
      try {
        await updateDoc(doc(db, 'users', uid), { isAdmin: makeAdmin })
        logAdmin({ type: makeAdmin ? 'promote' : 'demote', targetId: uid, targetName: name })
        onSuccess?.()
      } catch (e) {
        console.error('[toggleAdmin]', e)
        showError('권한 변경에 실패했어요.')
      }
    })
  }

  const TABS = [
    ['stats',    '📊 통계'],
    ['reports',  '🚩 신고'],
    ['projects', '📁 프로젝트'],
    ['match',    '🤝 매치'],
    ['users',    '👤 유저'],
    ['logs',     '📜 로그'],
    ['announce', '📢 공지'],
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>🛡️ 팀프 마스터</h1>
          <p className={styles.sub}>Teamp Admin · {currentUser?.email}</p>
        </div>
        {pendingReports > 0 && (
          <button className={styles.pendingPill} onClick={() => setActiveTab('reports')}>
            🚩 처리할 신고 {pendingReports}건 →
          </button>
        )}
      </div>

      <div className={styles.mainTabs}>
        {TABS.map(([key, label]) => (
          <button key={key} className={`${styles.mainTab} ${activeTab === key ? styles.mainTabActive : ''}`}
            onClick={() => setActiveTab(key)}>
            {label}
            {key === 'reports' && pendingReports > 0 && (
              <span className={styles.tabBadge}>{pendingReports > 9 ? '9+' : pendingReports}</span>
            )}
          </button>
        ))}
      </div>

      {isBootstrap && activeTab === 'stats' && (
        <div style={{ margin: '12px 0', padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-secondary)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            🔒 개인정보 격리(C1) — 전화번호·차단목록을 본인전용 영역으로 1회 이전. 클라이언트 배포 후 한 번 실행하세요.
          </div>
          <button onClick={handleMigratePii} disabled={migrating}
            style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: migrating ? 'default' : 'pointer' }}>
            {migrating ? '이전 중…' : 'PII 마이그레이션 실행'}
          </button>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '12px 0 8px' }}>
            🚪 방 권한(Task A) — 기존 프로젝트에 방별 접근권한 백필. 클라이언트 배포 후 한 번 실행하세요.
          </div>
          <button onClick={handleMigrateRooms} disabled={migrating}
            style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: migrating ? 'default' : 'pointer' }}>
            {migrating ? '이전 중…' : '방 권한 마이그레이션 실행'}
          </button>
        </div>
      )}
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
      {activeTab === 'users'    && <UsersTab    onBlockUser={handleBlockUser} onUnblockUser={handleUnblockUser} onDeleteUser={handleDeleteUser} onToggleAdmin={handleToggleAdmin} isBootstrap={isBootstrap} logAdmin={logAdmin} />}
      {activeTab === 'logs'     && <LogsTab />}
      {activeTab === 'announce' && <AnnouncementTab currentUser={currentUser} />}

      {dialog}
    </div>
  )
}
