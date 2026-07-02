import React, { useState, useEffect } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { TYPE_LABEL, REASON_LABEL, LOG_ACTION, PLAN_KO, tsMs, fmtTs } from './adminShared.jsx'
import styles from '../AdminPage.module.css'

export default function LogsTab() {
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
