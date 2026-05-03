import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import styles from './WrapupPage.module.css'

export default function WrapupPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { projects, currentUser, addReflection, addFeedback, checkAndArchive } = useStore()

  const project = projects.find((p) => p.id === projectId)
  const [wrapup, setWrapup] = useState(null)
  const [tab, setTab] = useState('overview') // 'overview' | 'reflection' | 'feedback'

  // 내 회고 입력
  const [reflectionText, setReflectionText] = useState('')
  const [reflectionSaving, setReflectionSaving] = useState(false)

  // 피드백 작성 대상
  const [feedbackTarget, setFeedbackTarget] = useState(null)
  const [positives, setPositives] = useState([''])
  const [improvements, setImprovements] = useState([''])
  const [feedbackComment, setFeedbackComment] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [feedbackSaving, setFeedbackSaving] = useState(false)

  // wrapup 실시간 구독
  useEffect(() => {
    if (!project?.wrapupId) return
    const unsub = onSnapshot(doc(db, 'wrapups', project.wrapupId), (snap) => {
      if (snap.exists()) setWrapup({ id: snap.id, ...snap.data() })
    })
    return () => unsub()
  }, [project?.wrapupId])

  // 피드백 수집 마감 체크
  useEffect(() => {
    if (project?.status === 'collecting') {
      checkAndArchive(projectId)
    }
  }, [project?.status, projectId, checkAndArchive])

  // 내 기존 회고 불러오기
  useEffect(() => {
    if (!wrapup) return
    const mine = wrapup.reflections?.find((r) => r.userId === currentUser?.id)
    if (mine) setReflectionText(mine.text)
  }, [wrapup, currentUser?.id])

  if (!project) return <div className={styles.notFound}>프로젝트를 찾을 수 없어요</div>

  const isLeader = project.members.find((m) => m.id === currentUser?.id)?.role === 'leader'
  const isMember = project.members.some((m) => m.id === currentUser?.id)
  const isCollecting = project.status === 'collecting'
  const isArchived = project.status === 'archived'
  const feedbackDeadline = project.feedbackDeadline

  const myFeedbackTargets = wrapup
    ? project.members.filter((m) => m.id !== currentUser?.id)
    : []

  const getFeedbackFromMe = (toUserId) =>
    wrapup?.feedbacks?.find((f) => f.fromUserId === currentUser?.id && f.toUserId === toUserId)

  const getMyFeedbacksFor = (toUserId) =>
    wrapup?.feedbacks?.filter((f) => f.toUserId === toUserId) || []

  const handleReflectionSave = async () => {
    if (!reflectionText.trim()) return
    setReflectionSaving(true)
    try {
      await addReflection(wrapup.id, reflectionText.trim())
    } finally {
      setReflectionSaving(false)
    }
  }

  const handleFeedbackOpen = (member) => {
    const existing = getFeedbackFromMe(member.id)
    setFeedbackTarget(member)
    setPositives(existing?.positives?.length ? existing.positives : [''])
    setImprovements(existing?.improvements?.length ? existing.improvements : [''])
    setFeedbackComment(existing?.comment || '')
    setIsAnonymous(existing?.isAnonymous || false)
  }

  const handleFeedbackSubmit = async () => {
    if (!feedbackTarget) return
    const validPos = positives.filter((p) => p.trim())
    const validImp = improvements.filter((i) => i.trim())
    if (!validPos.length && !validImp.length) return
    setFeedbackSaving(true)
    try {
      await addFeedback(wrapup.id, {
        toUserId: feedbackTarget.id,
        toUserName: feedbackTarget.name,
        positives: validPos,
        improvements: validImp,
        comment: feedbackComment.trim(),
        isAnonymous,
      })
      setFeedbackTarget(null)
    } finally {
      setFeedbackSaving(false)
    }
  }

  const completionRate = wrapup
    ? wrapup.summary.totalTodos === 0
      ? 0
      : Math.round((wrapup.summary.completedTodos / wrapup.summary.totalTodos) * 100)
    : 0

  return (
    <div className={styles.page}>
      {/* 헤더 */}
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate(`/project/${projectId}`)}>
          ← {project.name}
        </button>
        <div className={styles.headerCenter}>
          <span className={styles.title}>🏁 프로젝트 마무리</span>
        </div>
        <div style={{ width: 80 }} />
      </div>

      {/* 프로젝트 배너 */}
      <div className={styles.banner}>
        <span className={styles.bannerEmoji}>{project.emoji || '📁'}</span>
        <div className={styles.bannerInfo}>
          <h2 className={styles.bannerName}>{project.name}</h2>
          <p className={styles.bannerMeta}>
            {project.startDate} ~ {project.endDate} · 팀원 {project.members.length}명
          </p>
        </div>
        <div className={`${styles.statusBadge} ${isArchived ? styles.statusArchived : styles.statusCollecting}`}>
          {isArchived ? '✅ 완료' : '📬 피드백 수집 중'}
        </div>
      </div>

      {isCollecting && feedbackDeadline && (
        <div className={styles.deadlineBanner}>
          📅 피드백 마감: <strong>{feedbackDeadline}</strong>
        </div>
      )}

      {/* 탭 */}
      <div className={styles.tabs}>
        {['overview', 'reflection', 'feedback'].map((t) => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'overview' ? '📊 요약' : t === 'reflection' ? '💬 회고' : '⭐ 피드백'}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {/* ── 요약 탭 ── */}
        {tab === 'overview' && (
          <div className={styles.overviewTab}>
            {!wrapup ? (
              <p className={styles.loadingText}>데이터를 불러오는 중...</p>
            ) : (
              <>
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{wrapup.summary.totalMessages}</span>
                    <span className={styles.statLabel}>총 메시지</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{wrapup.summary.totalTodos}</span>
                    <span className={styles.statLabel}>할 일</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={`${styles.statNum} ${styles.statGreen}`}>{completionRate}%</span>
                    <span className={styles.statLabel}>완료율</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{wrapup.summary.totalFiles}</span>
                    <span className={styles.statLabel}>파일 공유</span>
                  </div>
                </div>

                {wrapup.highlights?.mostActiveUserName && (
                  <div className={styles.highlight}>
                    <div className={styles.highlightItem}>
                      <span className={styles.highlightIcon}>🏆</span>
                      <div>
                        <p className={styles.highlightLabel}>가장 활발한 팀원</p>
                        <p className={styles.highlightName}>{wrapup.highlights.mostActiveUserName}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className={styles.memberSection}>
                  <h3 className={styles.sectionTitle}>팀원</h3>
                  {wrapup.members.map((m) => (
                    <div key={m.userId} className={styles.memberRow}>
                      <div className={styles.memberAvatar}>{m.name.charAt(0)}</div>
                      <span className={styles.memberName}>{m.name}</span>
                      <span className={styles.memberRole}>
                        {m.role === 'leader' ? '👑 리더' : m.role === 'sub-leader' ? '⭐ 부리더' : '팀원'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── 회고 탭 ── */}
        {tab === 'reflection' && (
          <div className={styles.reflectionTab}>
            {isMember && (
              <div className={styles.myReflection}>
                <h3 className={styles.sectionTitle}>내 회고 작성</h3>
                <textarea
                  className={styles.reflectionInput}
                  value={reflectionText}
                  onChange={(e) => setReflectionText(e.target.value)}
                  placeholder="이번 프로젝트에서 배운 점, 아쉬운 점, 느낀 점을 자유롭게 적어보세요"
                  rows={5}
                />
                <button
                  className={styles.saveBtn}
                  onClick={handleReflectionSave}
                  disabled={!reflectionText.trim() || reflectionSaving}
                >
                  {reflectionSaving ? '저장 중...' : '저장하기'}
                </button>
              </div>
            )}

            <div className={styles.reflectionList}>
              <h3 className={styles.sectionTitle}>팀원 회고 ({wrapup?.reflections?.length || 0})</h3>
              {!wrapup?.reflections?.length ? (
                <p className={styles.emptyText}>아직 작성된 회고가 없어요</p>
              ) : (
                wrapup.reflections.map((r, i) => (
                  <div key={i} className={styles.reflectionCard}>
                    <div className={styles.reflectionMeta}>
                      <div className={styles.memberAvatar}>{r.name.charAt(0)}</div>
                      <span className={styles.reflectionAuthor}>{r.name}</span>
                      <span className={styles.reflectionDate}>{r.createdAt?.slice(0, 10)}</span>
                    </div>
                    <p className={styles.reflectionText}>{r.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── 피드백 탭 ── */}
        {tab === 'feedback' && (
          <div className={styles.feedbackTab}>
            {isMember && (isCollecting || isArchived) && (
              <>
                <h3 className={styles.sectionTitle}>팀원에게 피드백 보내기</h3>
                <div className={styles.feedbackTargets}>
                  {myFeedbackTargets.map((m) => {
                    const sent = getFeedbackFromMe(m.id)
                    return (
                      <div key={m.id} className={styles.feedbackTargetRow}>
                        <div className={styles.memberAvatar}>{m.name.charAt(0)}</div>
                        <span className={styles.memberName}>{m.name}</span>
                        <button
                          className={`${styles.feedbackBtn} ${sent ? styles.feedbackBtnDone : ''}`}
                          onClick={() => handleFeedbackOpen(m)}
                        >
                          {sent ? '✅ 수정' : '피드백 쓰기'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            <div className={styles.myFeedbacksSection}>
              <h3 className={styles.sectionTitle}>나에 대한 피드백</h3>
              {(() => {
                const forMe = getMyFeedbacksFor(currentUser?.id)
                if (!forMe.length) return <p className={styles.emptyText}>아직 받은 피드백이 없어요</p>
                return forMe.map((f, i) => (
                  <div key={i} className={styles.feedbackCard}>
                    <p className={styles.feedbackFrom}>
                      {f.isAnonymous ? '익명' : f.fromUserName} → {f.toUserName}
                    </p>
                    {f.positives?.length > 0 && (
                      <div className={styles.feedbackSection}>
                        <span className={styles.feedbackSectionLabel}>👍 잘한 점</span>
                        <ul className={styles.feedbackList}>
                          {f.positives.map((p, j) => <li key={j}>{p}</li>)}
                        </ul>
                      </div>
                    )}
                    {f.improvements?.length > 0 && (
                      <div className={styles.feedbackSection}>
                        <span className={styles.feedbackSectionLabel}>💡 개선할 점</span>
                        <ul className={styles.feedbackList}>
                          {f.improvements.map((p, j) => <li key={j}>{p}</li>)}
                        </ul>
                      </div>
                    )}
                    {f.comment && <p className={styles.feedbackComment}>{f.comment}</p>}
                  </div>
                ))
              })()}
            </div>
          </div>
        )}
      </div>

      {/* 피드백 작성 모달 */}
      {feedbackTarget && (
        <div className={styles.modalBackdrop} onClick={() => setFeedbackTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{feedbackTarget.name}에게 피드백</h3>
              <button className={styles.modalClose} onClick={() => setFeedbackTarget(null)}>✕</button>
            </div>

            <label className={styles.fieldLabel}>👍 잘한 점</label>
            {positives.map((p, i) => (
              <div key={i} className={styles.listInputRow}>
                <input
                  className={styles.listInput}
                  value={p}
                  onChange={(e) => { const a = [...positives]; a[i] = e.target.value; setPositives(a) }}
                  placeholder={`잘한 점 ${i + 1}`}
                />
                {positives.length > 1 && (
                  <button onClick={() => setPositives(positives.filter((_, j) => j !== i))}>✕</button>
                )}
              </div>
            ))}
            {positives.length < 5 && (
              <button className={styles.addItemBtn} onClick={() => setPositives([...positives, ''])}>+ 추가</button>
            )}

            <label className={styles.fieldLabel}>💡 개선할 점</label>
            {improvements.map((p, i) => (
              <div key={i} className={styles.listInputRow}>
                <input
                  className={styles.listInput}
                  value={p}
                  onChange={(e) => { const a = [...improvements]; a[i] = e.target.value; setImprovements(a) }}
                  placeholder={`개선할 점 ${i + 1}`}
                />
                {improvements.length > 1 && (
                  <button onClick={() => setImprovements(improvements.filter((_, j) => j !== i))}>✕</button>
                )}
              </div>
            ))}
            {improvements.length < 5 && (
              <button className={styles.addItemBtn} onClick={() => setImprovements([...improvements, ''])}>+ 추가</button>
            )}

            <label className={styles.fieldLabel}>한 마디 (선택)</label>
            <textarea
              className={styles.commentInput}
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              placeholder="자유롭게 한 마디 남겨주세요"
              rows={3}
            />

            <label className={styles.anonRow}>
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
              />
              <span>익명으로 보내기</span>
            </label>

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setFeedbackTarget(null)}>취소</button>
              <button
                className={styles.submitBtn}
                onClick={handleFeedbackSubmit}
                disabled={feedbackSaving}
              >
                {feedbackSaving ? '전송 중...' : '피드백 보내기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
