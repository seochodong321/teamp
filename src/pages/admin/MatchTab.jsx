import React, { useState, useEffect } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase.js'
import styles from '../AdminPage.module.css'

export default function MatchTab({ onDeleteMatch, onCloseMatch }) {
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
