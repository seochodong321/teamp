import React, { useState, useEffect, useCallback } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../firebase.js'
import styles from '../AdminPage.module.css'

export default function ProjectsTab({ onDeleteProject }) {
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
