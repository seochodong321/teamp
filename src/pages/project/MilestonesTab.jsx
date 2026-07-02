import React, { useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { useShallow } from 'zustand/react/shallow'
import { MS_STATUS } from '../../constants.js'
import styles from '../ProjectPage.module.css'

const MS_HISTORY_LABEL = { created: '생성', completed: '완료', reopened: '재개', delayed: '연기', modified: '수정' }

export default function MilestonesTab({ project, canInvite }) {
  const { addMilestone, updateMilestone, deleteMilestone, showConfirm } = useStore(useShallow((s) => ({ addMilestone: s.addMilestone, updateMilestone: s.updateMilestone, deleteMilestone: s.deleteMilestone, showConfirm: s.showConfirm })))
  const milestones = project.milestones || []

  const [showMsForm, setShowMsForm]   = useState(false)
  const [msTitle, setMsTitle]         = useState('')
  const [msDesc, setMsDesc]           = useState('')
  const [msDate, setMsDate]           = useState('')
  const [msSubmitting, setMsSubmitting] = useState(false)

  const handleAddMilestone = async () => {
    if (!msTitle.trim() || msSubmitting) return
    setMsSubmitting(true)
    try {
      await addMilestone(project.id, { title: msTitle.trim(), description: msDesc.trim(), targetDate: msDate })
      setShowMsForm(false); setMsTitle(''); setMsDesc(''); setMsDate('')
    } finally {
      setMsSubmitting(false)
    }
  }

  const handleCompleteMilestone = (msId) =>
    updateMilestone(project.id, msId, { action: 'completed', status: 'done', completedAt: new Date().toISOString() })
  const handleReopenMilestone = (msId) =>
    updateMilestone(project.id, msId, { action: 'reopened', status: 'pending', completedAt: null })
  const handleDelayMilestone  = (msId) =>
    updateMilestone(project.id, msId, { action: 'delayed', status: 'delayed' })
  const handleDeleteMilestone = async (msId) => {
    if (await showConfirm('마일스톤을 삭제할까요?')) deleteMilestone(project.id, msId)
  }

  return (
    <div className={styles.section}>
      {canInvite && (
        <div className={styles.msAddWrap}>
          {!showMsForm ? (
            <button className={styles.msAddTrigger} onClick={() => setShowMsForm(true)}>
              + 마일스톤 추가
            </button>
          ) : (
            <div className={styles.msFormCard}>
              <input
                className={styles.msFormInput}
                placeholder="마일스톤 제목 (예: MVP 로그인 완료)"
                value={msTitle}
                onChange={(e) => setMsTitle(e.target.value)}
                autoFocus
              />
              <div className={styles.msFormRow}>
                <input className={styles.msFormDate} type="date" value={msDate} onChange={(e) => setMsDate(e.target.value)} />
                <textarea className={styles.msFormDesc} placeholder="설명 (선택사항)" value={msDesc} onChange={(e) => setMsDesc(e.target.value)} rows={2} />
              </div>
              <div className={styles.msFormBtns}>
                <button className={styles.msFormCancel} onClick={() => { setShowMsForm(false); setMsTitle(''); setMsDesc(''); setMsDate('') }}>취소</button>
                <button className={styles.msFormSubmit} disabled={!msTitle.trim() || msSubmitting} onClick={handleAddMilestone}>
                  {msSubmitting ? '추가 중...' : '추가'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {milestones.length === 0 ? (
        <div className={styles.msEmpty}>
          <span className={styles.msEmptyIcon}>🌱</span>
          <p className={styles.msEmptyTitle}>아직 마일스톤이 없어요</p>
          <p className={styles.msEmptySub}>프로젝트의 주요 목표를 마일스톤으로 기록하면<br/>성장 과정을 한눈에 돌아볼 수 있어요</p>
        </div>
      ) : (
        <div className={styles.timeline}>
          <div className={styles.timelineLine} />
          {milestones.map((ms, i) => {
            const isLeft = i % 2 === 0
            return (
              <div key={ms.id} className={`${styles.timelineItem} ${isLeft ? styles.timelineLeft : styles.timelineRight}`}>
                <div className={`${styles.msCard} ${ms.status === 'done' ? styles.msCardDone : ms.status === 'delayed' ? styles.msCardDelayed : ''}`}>
                  <div className={styles.msCardTop}>
                    <span className={`${styles.msStatusDot} ${styles[`msStatus_${ms.status}`]}`} />
                    <span className={styles.msCardTitle}>{ms.title}</span>
                    <span className={`${styles.msStatusBadge} ${styles[`msBadge_${ms.status}`]}`}>{MS_STATUS[ms.status] || ms.status}</span>
                    {canInvite && (
                      <div className={styles.msCardActions}>
                        {ms.status === 'pending' && (
                          <>
                            <button className={styles.msCompleteBtn} onClick={() => handleCompleteMilestone(ms.id)} title="완료 처리">✓</button>
                            <button className={styles.msDelayBtn} onClick={() => handleDelayMilestone(ms.id)} title="연기">⏸</button>
                          </>
                        )}
                        {ms.status === 'delayed' && (
                          <button className={styles.msReopenBtn} onClick={() => handleReopenMilestone(ms.id)} title="재개">▶</button>
                        )}
                        {ms.status === 'done' && (
                          <button className={styles.msReopenBtn} onClick={() => handleReopenMilestone(ms.id)} title="재개">↩</button>
                        )}
                        <button className={styles.msDeleteBtn} onClick={() => handleDeleteMilestone(ms.id)} title="삭제">×</button>
                      </div>
                    )}
                  </div>
                  {ms.targetDate && (
                    <span className={styles.msDate}>
                      {ms.completedAt ? `완료: ${ms.completedAt.slice(0, 10)}` : `목표: ${ms.targetDate}`}
                    </span>
                  )}
                  {ms.description && <p className={styles.msDescription}>{ms.description}</p>}
                  {ms.history && ms.history.length > 1 && (
                    <div className={styles.msHistory}>
                      {ms.history.slice(1).map((h, j) => (
                        <div key={j} className={styles.msHistoryItem}>
                          <span className={styles.msHistoryTag}>{MS_HISTORY_LABEL[h.action] || h.action}</span>
                          <span className={styles.msHistoryBy}>{h.byName}</span>
                          {h.note && <span className={styles.msHistoryNote}>· {h.note}</span>}
                          <span className={styles.msHistoryAt}>{h.at.slice(0, 10)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className={`${styles.timelineDot} ${ms.status === 'done' ? styles.timelineDotDone : ms.status === 'delayed' ? styles.timelineDotDelayed : ''}`} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
