import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import { FLOWER_TAGS } from '../constants.js'
import styles from './WrapupPage.module.css'

export default function WrapupPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { projects, currentUser, addReflection, addFeedback, checkAndArchive } = useStore()

  const project = projects.find((p) => p.id === projectId)
  const [wrapup, setWrapup] = useState(null)
  const [tab, setTab] = useState('overview')

  // 내 회고
  const [reflectionText, setReflectionText] = useState('')
  const [reflectionSaving, setReflectionSaving] = useState(false)

  // 피드백 — 태그 + 한 줄 메시지
  const [feedbackTarget, setFeedbackTarget] = useState(null)
  const [selectedTags, setSelectedTags] = useState([])
  const [tagComment, setTagComment] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [feedbackSaving, setFeedbackSaving] = useState(false)

  useEffect(() => {
    if (!project?.wrapupId) return
    const unsub = onSnapshot(doc(db, 'wrapups', project.wrapupId), (snap) => {
      if (snap.exists()) setWrapup({ id: snap.id, ...snap.data() })
    })
    return () => unsub()
  }, [project?.wrapupId])

  useEffect(() => {
    if (project?.status === 'collecting') checkAndArchive(projectId)
  }, [project?.status, projectId, checkAndArchive])

  useEffect(() => {
    if (!wrapup) return
    const mine = wrapup.reflections?.find((r) => r.userId === currentUser?.id)
    if (mine) setReflectionText(mine.text)
  }, [wrapup, currentUser?.id])

  if (!project) return <div className={styles.notFound}>프로젝트를 찾을 수 없어요</div>

  const isLeader     = project.members.find((m) => m.id === currentUser?.id)?.role === 'leader'
  const isMember     = project.members.some((m) => m.id === currentUser?.id)
  const isCollecting = project.status === 'collecting'
  const isArchived   = project.status === 'archived'

  const completionRate = wrapup
    ? wrapup.summary.totalTodos === 0
      ? 0
      : Math.round((wrapup.summary.completedTodos / wrapup.summary.totalTodos) * 100)
    : 0

  const myFeedbackTargets = wrapup
    ? project.members.filter((m) => m.id !== currentUser?.id)
    : []

  const getFeedbackFromMe = (toUserId) =>
    wrapup?.feedbacks?.find((f) => f.fromUserId === currentUser?.id && f.toUserId === toUserId)

  const fmtKorDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return `${d.getMonth() + 1}월 ${d.getDate()}일`
  }
  const fmtKorTime = (timeStr) => {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':').map(Number)
    return `${h >= 12 ? '오후' : '오전'} ${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, '0')}`
  }

  const getMyFeedbacksFor = (userId) =>
    wrapup?.feedbacks?.filter((f) => f.toUserId === userId) || []

  const handleReflectionSave = async () => {
    if (!reflectionText.trim()) return
    setReflectionSaving(true)
    try { await addReflection(wrapup.id, reflectionText.trim()) }
    finally { setReflectionSaving(false) }
  }

  const toggleTag = (id) =>
    setSelectedTags((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id])

  const handleFeedbackOpen = (member) => {
    const existing = getFeedbackFromMe(member.id)
    setFeedbackTarget(member)
    // 이전 태그 불러오기 (old format: positives array / new format: tags array)
    setSelectedTags(existing?.tags?.map((t) => t.id) || [])
    setTagComment(existing?.comment || '')
    setIsAnonymous(existing?.isAnonymous || false)
  }

  const handleFeedbackSubmit = async () => {
    if (!feedbackTarget || selectedTags.length === 0) return
    setFeedbackSaving(true)
    try {
      await addFeedback(wrapup.id, {
        toUserId: feedbackTarget.id,
        toUserName: feedbackTarget.name,
        tags: selectedTags.map((id) => FLOWER_TAGS.find((t) => t.id === id)),
        comment: tagComment.trim(),
        isAnonymous,
      })
      setFeedbackTarget(null)
    } finally {
      setFeedbackSaving(false)
    }
  }

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
        <div className={styles.headerSpacer} />
      </div>

      {/* 프로젝트 배너 — amber 톤 */}
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

      {isCollecting && project.feedbackDeadline && (
        <div className={styles.deadlineBanner}>
          📅 피드백 마감: <strong>{project.feedbackDeadline?.slice(0, 10)}</strong>
        </div>
      )}

      {/* 탭 — amber 활성 색상 */}
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
        {/* ── 요약 탭 — 문장형 ── */}
        {tab === 'overview' && (
          <div className={styles.overviewTab}>
            {!wrapup ? (
              <p className={styles.loadingText}>데이터를 불러오는 중...</p>
            ) : (
              <>
                <div className={styles.statSentences}>
                  <h3 className={styles.sectionTitle}>활동 요약</h3>

                  {wrapup.summary.totalMessages > 0 && (
                    <div className={styles.statLine}>
                      <span className={styles.statLineIcon}>💬</span>
                      <span className={styles.statLineText}>
                        총 <strong>{wrapup.summary.totalMessages}개</strong>의 메시지가 오갔어요
                      </span>
                    </div>
                  )}
                  {wrapup.summary.totalTodos > 0 && (
                    <div className={styles.statLine}>
                      <span className={styles.statLineIcon}>✅</span>
                      <span className={styles.statLineText}>
                        할 일 <strong>{wrapup.summary.totalTodos}개</strong> 중{' '}
                        <strong>{wrapup.summary.completedTodos || 0}개</strong>를 완료했어요
                        {' '}({completionRate}%)
                      </span>
                    </div>
                  )}
                  {wrapup.summary.totalFiles > 0 && (
                    <div className={styles.statLine}>
                      <span className={styles.statLineIcon}>📎</span>
                      <span className={styles.statLineText}>
                        파일 <strong>{wrapup.summary.totalFiles}개</strong>를 공유했어요
                      </span>
                    </div>
                  )}
                  {!wrapup.summary.totalMessages && !wrapup.summary.totalTodos && !wrapup.summary.totalFiles && (
                    <p className={styles.emptyText}>아직 집계된 활동이 없어요</p>
                  )}
                </div>

                {/* 마일스톤 여정 */}
                {(() => {
                  const milestones = project.milestones || []
                  const msDone    = milestones.filter((m) => m.status === 'done').length
                  const msDelayed = milestones.filter((m) => m.status === 'delayed').length
                  const MS_STATUS = { pending: '진행 중', done: '완료', delayed: '연기됨' }
                  if (milestones.length === 0) return null
                  return (
                    <div className={styles.milestoneSection}>
                      <h3 className={styles.sectionTitle}>🏁 마일스톤 여정</h3>
                      <div className={styles.msStats}>
                        <span className={styles.msStatItem}><strong>{milestones.length}</strong> 전체</span>
                        <span className={styles.msStatDivider}>·</span>
                        <span className={`${styles.msStatItem} ${styles.msStatDone}`}><strong>{msDone}</strong> 완료</span>
                        <span className={styles.msStatDivider}>·</span>
                        <span className={`${styles.msStatItem} ${styles.msStatDelayed}`}><strong>{msDelayed}</strong> 연기</span>
                      </div>
                      <div className={styles.msList}>
                        {milestones.map((ms) => (
                          <div key={ms.id} className={`${styles.msRow} ${styles[`msRow_${ms.status}`]}`}>
                            <span className={`${styles.msDot} ${styles[`msDot_${ms.status}`]}`} />
                            <div className={styles.msRowInfo}>
                              <span className={styles.msRowTitle}>{ms.title}</span>
                              {ms.targetDate && (
                                <span className={styles.msRowDate}>
                                  {ms.completedAt ? `완료 ${ms.completedAt.slice(0, 10)}` : `목표 ${ms.targetDate}`}
                                </span>
                              )}
                            </div>
                            <span className={`${styles.msBadge} ${styles[`msBadge_${ms.status}`]}`}>
                              {MS_STATUS[ms.status] || ms.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

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
            {/* 팀 인사이트 */}
            {wrapup && (
              wrapup.highlights?.mostActiveUserName ||
              wrapup.highlights?.busiestDay ||
              wrapup.highlights?.latestNightActivity ||
              wrapup.highlights?.activityTrend ||
              topKeywords.length > 0
            ) && (
              <div className={styles.insightSection}>
                <h3 className={styles.sectionTitle}>이번 프로젝트 돌아보기</h3>
                <div className={styles.insightGrid}>
                  {wrapup.highlights?.mostActiveUserName && (
                    <div className={styles.insightCard}>
                      <span className={styles.insightIcon}>🏆</span>
                      <p className={styles.insightLabel}>가장 활발한 팀원</p>
                      <p className={styles.insightValue}>{wrapup.highlights.mostActiveUserName}</p>
                    </div>
                  )}
                  {wrapup.highlights?.busiestDay && (
                    <div className={styles.insightCard}>
                      <span className={styles.insightIcon}>🔥</span>
                      <p className={styles.insightLabel}>가장 뜨거웠던 날</p>
                      <p className={styles.insightValue}>{fmtKorDate(wrapup.highlights.busiestDay.date)}</p>
                      <p className={styles.insightSub}>{wrapup.highlights.busiestDay.count}개 메시지</p>
                    </div>
                  )}
                  {wrapup.highlights?.latestNightActivity && (
                    <div className={styles.insightCard}>
                      <span className={styles.insightIcon}>🌙</span>
                      <p className={styles.insightLabel}>밤까지 활동한 날</p>
                      <p className={styles.insightValue}>{fmtKorDate(wrapup.highlights.latestNightActivity.date)}</p>
                      <p className={styles.insightSub}>{fmtKorTime(wrapup.highlights.latestNightActivity.time)}까지</p>
                    </div>
                  )}
                  {wrapup.highlights?.activityTrend && (
                    <div className={`${styles.insightCard} ${styles.insightCardWide}`}>
                      <span className={styles.insightIcon}>📈</span>
                      <p className={styles.insightLabel}>에너지 흐름</p>
                      <div className={styles.trendBar}>
                        {[
                          { label: '전반', val: wrapup.highlights.activityTrend.firstHalf, cls: styles.trendFill },
                          { label: '후반', val: wrapup.highlights.activityTrend.secondHalf, cls: `${styles.trendFill} ${styles.trendFillSecond}` },
                        ].map(({ label, val, cls }) => {
                          const total = Math.max(
                            wrapup.highlights.activityTrend.firstHalf + wrapup.highlights.activityTrend.secondHalf, 1
                          )
                          return (
                            <div key={label} className={styles.trendHalf}>
                              <span className={styles.trendHalfLabel}>{label}</span>
                              <div className={styles.trendTrack}>
                                <div className={cls} style={{ width: `${Math.round((val / total) * 100)}%` }} />
                              </div>
                              <span className={styles.trendCount}>{val}</span>
                            </div>
                          )
                        })}
                      </div>
                      {wrapup.highlights.activityTrend.firstHalf !== wrapup.highlights.activityTrend.secondHalf && (
                        <p className={styles.insightSub}>
                          {wrapup.highlights.activityTrend.secondHalf > wrapup.highlights.activityTrend.firstHalf
                            ? '후반으로 갈수록 더 활발해졌어요 🚀'
                            : '초반에 더 열정적으로 달렸어요 💪'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

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
                <h3 className={styles.sectionTitle}>팀원에게 꽃다발 보내기</h3>
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
                          {sent ? '✅ 수정' : '🌸 보내기'}
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
                if (!forMe.length) return <p className={styles.emptyText}>아직 받은 피드백이 없어요 🌱</p>
                return forMe.map((f, i) => (
                  <div key={i} className={styles.feedbackCard}>
                    <p className={styles.feedbackFrom}>
                      {f.isAnonymous ? '익명' : f.fromUserName}님이 보낸 꽃다발 🌸
                    </p>
                    {/* 신 포맷 — 태그 */}
                    {f.tags?.length > 0 && (
                      <div className={styles.tagDisplay}>
                        {f.tags.map((t, j) => (
                          <span key={j} className={styles.tagChip}>
                            {t.emoji} {t.label}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* 구 포맷 — 텍스트 리스트 하위호환 */}
                    {!f.tags && f.positives?.length > 0 && (
                      <div className={styles.feedbackSection}>
                        <span className={styles.feedbackSectionLabel}>👍 잘한 점</span>
                        <ul className={styles.feedbackList}>
                          {f.positives.map((p, j) => <li key={j}>{p}</li>)}
                        </ul>
                      </div>
                    )}
                    {f.comment && (
                      <p className={styles.feedbackComment}>"{f.comment}"</p>
                    )}
                  </div>
                ))
              })()}
            </div>
          </div>
        )}
      </div>

      {/* 피드백 작성 모달 — 태그 선택 UI */}
      {feedbackTarget && (
        <div className={styles.modalBackdrop} onClick={() => setFeedbackTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>
                  {feedbackTarget.name} 님에게 꽃다발을 건네세요 🌸
                </h3>
                <p className={styles.modalSubtitle}>여러 개 선택 가능해요</p>
              </div>
              <button className={styles.modalClose} onClick={() => setFeedbackTarget(null)}>✕</button>
            </div>

            <div className={styles.tagGrid}>
              {FLOWER_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  className={`${styles.tagBtn} ${selectedTags.includes(tag.id) ? styles.tagBtnActive : ''}`}
                  onClick={() => toggleTag(tag.id)}
                >
                  <span className={styles.tagEmoji}>{tag.emoji}</span>
                  <span className={styles.tagLabel}>{tag.label}</span>
                </button>
              ))}
            </div>

            <label className={styles.fieldLabel}>
              한 줄 메시지
              <span className={styles.fieldOptional}> (선택 · 최대 50자)</span>
            </label>
            <div className={styles.commentWrap}>
              <input
                className={styles.commentInput}
                value={tagComment}
                onChange={(e) => setTagComment(e.target.value.slice(0, 50))}
                placeholder="한 마디를 전해보세요"
                maxLength={50}
              />
              <span className={styles.charCount}>{tagComment.length}/50</span>
            </div>

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
                disabled={feedbackSaving || selectedTags.length === 0}
              >
                {feedbackSaving ? '전송 중...' : '꽃다발 전하기 🌸'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
