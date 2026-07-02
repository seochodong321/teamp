import React, { useState, useEffect } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { StatCard } from './adminShared.jsx'
import styles from '../AdminPage.module.css'

export default function StatsTab() {
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
