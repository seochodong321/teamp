import React, { useState, useEffect } from 'react'
import { collection, query, orderBy, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import { Navigate } from 'react-router-dom'
import styles from './AdminPage.module.css'

const ADMIN_EMAILS = ['byond1318@gmail.com']

const TYPE_LABEL  = { project: '프로젝트', match: '매치 모집글', user: '유저 프로필' }
const REASON_LABEL = {
  illegal: '불법 콘텐츠',
  spam:    '스팸 / 홍보',
  false:   '허위 정보',
  hate:    '욕설 / 혐오 표현',
  other:   '기타',
}

export default function AdminPage() {
  const { currentUser } = useStore()
  const [reports, setReports]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('pending') // 'pending' | 'resolved' | 'all'

  const isAdmin = ADMIN_EMAILS.includes(currentUser?.email)
  if (!isAdmin) return <Navigate to="/home" replace />

  useEffect(() => { fetchReports() }, [])

  const fetchReports = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc')))
      setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (e) {
      console.error('신고 목록 조회 실패:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (reportId) => {
    await updateDoc(doc(db, 'reports', reportId), { status: 'resolved' })
    setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status: 'resolved' } : r))
  }

  const handleReopen = async (reportId) => {
    await updateDoc(doc(db, 'reports', reportId), { status: 'pending' })
    setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status: 'pending' } : r))
  }

  const filtered = reports.filter((r) => filter === 'all' || r.status === filter)
  const pendingCount = reports.filter((r) => r.status === 'pending').length

  const targetLink = (r) => {
    if (r.type === 'project') return `/project/${r.targetId}`
    if (r.type === 'user')    return `/u/${r.targetName}`
    return null
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>신고 관리</h1>
          <p className={styles.sub}>팀프 콘텐츠 신고 처리 · 관리자 전용</p>
        </div>
        <button className={styles.refreshBtn} onClick={fetchReports}>새로고침</button>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${filter === 'pending' ? styles.tabActive : ''}`}
          onClick={() => setFilter('pending')}>
          미처리 {pendingCount > 0 && <span className={styles.badge}>{pendingCount}</span>}
        </button>
        <button className={`${styles.tab} ${filter === 'resolved' ? styles.tabActive : ''}`}
          onClick={() => setFilter('resolved')}>처리 완료</button>
        <button className={`${styles.tab} ${filter === 'all' ? styles.tabActive : ''}`}
          onClick={() => setFilter('all')}>전체</button>
      </div>

      {loading ? (
        <p className={styles.empty}>불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <p className={styles.empty}>
          {filter === 'pending' ? '처리할 신고가 없어요 ✅' : '신고 내역이 없어요'}
        </p>
      ) : (
        <div className={styles.list}>
          {filtered.map((r) => {
            const link = targetLink(r)
            const createdAt = r.createdAt?.toDate?.()?.toLocaleDateString('ko-KR') || '-'
            return (
              <div key={r.id} className={`${styles.card} ${r.status === 'resolved' ? styles.cardResolved : ''}`}>
                <div className={styles.cardTop}>
                  <div className={styles.cardMeta}>
                    <span className={`${styles.typeBadge} ${styles['type_' + r.type]}`}>
                      {TYPE_LABEL[r.type] || r.type}
                    </span>
                    <span className={`${styles.reasonBadge}`}>{REASON_LABEL[r.reason] || r.reason}</span>
                    {r.status === 'resolved' && <span className={styles.resolvedBadge}>처리 완료</span>}
                  </div>
                  <span className={styles.date}>{createdAt}</span>
                </div>

                <div className={styles.cardBody}>
                  <p className={styles.targetName}>
                    <strong>대상:</strong> {r.targetName}
                    {link && (
                      <a href={link} target="_blank" rel="noopener noreferrer" className={styles.targetLink}>
                        → 바로가기
                      </a>
                    )}
                  </p>
                  <p className={styles.reporter}><strong>신고자:</strong> {r.reporterName}</p>
                  {r.detail && <p className={styles.detail}>"{r.detail}"</p>}
                </div>

                <div className={styles.cardActions}>
                  {r.status === 'pending' ? (
                    <button className={styles.resolveBtn} onClick={() => handleResolve(r.id)}>처리 완료로 표시</button>
                  ) : (
                    <button className={styles.reopenBtn} onClick={() => handleReopen(r.id)}>미처리로 되돌리기</button>
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
