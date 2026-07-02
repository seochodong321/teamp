import React, { useState, useEffect, useCallback } from 'react'
import { collection, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { TYPE_LABEL, REASON_LABEL } from './adminShared.jsx'
import styles from '../AdminPage.module.css'

const REPORT_FILTERS = [['pending', '미처리'], ['resolved', '처리 완료'], ['all', '전체']]

export default function ReportsTab({ onDeleteProject, onDeleteMatch, onBlockUser }) {
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
