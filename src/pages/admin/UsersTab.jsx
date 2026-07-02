import React, { useState, useEffect, useCallback } from 'react'
import { collection, doc, getDocs, limit, orderBy, query, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { SELECTABLE_PLANS } from './adminShared.jsx'
import styles from '../AdminPage.module.css'

const PLAN_META = {
  free:    { label: 'Free',    color: '#6B7280', bg: '#F3F4F6' },
  student: { label: 'Student', color: '#059669', bg: '#D1FAE5' },
  pro:     { label: 'Pro',     color: '#534AB7', bg: '#EEF2FF' },
  team:    { label: 'Team',    color: '#0D9488', bg: '#CCFBF1' },
  admin:   { label: 'Admin',   color: '#DC2626', bg: '#FEE2E2' },
}

// ─── 유저 관리 탭 ────────────────────────────────────────────

export default function UsersTab({ onBlockUser, onUnblockUser, onDeleteUser, onToggleAdmin, isBootstrap, logAdmin }) {
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
