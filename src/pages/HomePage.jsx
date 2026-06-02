import React, { useState, useMemo, useLayoutEffect, useCallback, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { getCoverStyle } from '../constants.js'
import { getGreeting } from '../greetings.js'
import { getDDayLabel, getPhaseBar } from '../utils/phases.js'
import { relativeTime } from '../utils/dateUtils.js'
import CreateProjectModal from '../components/CreateProjectModal.jsx'
import styles from './HomePage.module.css'

const ITEM_ICON = { todo: '✅', event: '📅', milestone: '🏁' }


export default function HomePage() {
  const navigate = useNavigate()
  const {
    projects, currentUser, invites, notifications,
    acceptInvite, declineInvite,
    getProgress, isExpired,
    archiveProject, extendProject,
    hiddenProjects, hideProject,
    pinnedId, setPinnedId,
  } = useStore()

  // 홈 카드 활동 감지 — localStorage에 마지막 클릭 시각 저장
  const [homeSeen, setHomeSeen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hp_seen') || '{}') } catch { return {} }
  })

  // 읽지 않은 알림이 있는 프로젝트 ID 집합
  const unreadSet = useMemo(() => {
    const s = new Set()
    notifications.forEach((n) => { if (!n.read && n.projectId) s.add(n.projectId) })
    return s
  }, [notifications])

  // 프로젝트에 새 활동이 있는지 — 읽지 않은 알림 OR 24h 내 새 메시지/활동
  const hasBuzz = useCallback((p) => {
    if (unreadSet.has(p.id)) return true
    const room = p.rooms?.find((r) => r.name === '전체' && !r.isDm)
      || p.rooms?.find((r) => !r.isDm && r.lastMessageAt)
    const lastAt = p.lastActivityAt || room?.lastMessageAt
    if (!lastAt) return false
    if (Date.now() - new Date(lastAt).getTime() > 24 * 3600000) return false
    const seen = homeSeen[p.id]
    return !seen || new Date(lastAt) > new Date(seen)
  }, [unreadSet, homeSeen])

  // 카드 클릭 → "봤다" 기록 후 이동
  const handleCardNav = useCallback((p) => {
    setHomeSeen((prev) => {
      const next = { ...prev, [p.id]: new Date().toISOString() }
      localStorage.setItem('hp_seen', JSON.stringify(next))
      return next
    })
    navigate(`/project/${p.id}`)
  }, [navigate])

  const active          = useMemo(() => projects.filter((p) => p.status === 'active'),     [projects])
  const collecting      = useMemo(() => projects.filter((p) => p.status === 'collecting'), [projects])
  const archived        = useMemo(() => projects.filter((p) => p.status === 'archived'),   [projects])
  const visibleArchived = useMemo(() => archived.filter((p) => !hiddenProjects.includes(p.id)), [archived, hiddenProjects])

  const todaySummary = useMemo(() => {
    const myId = currentUser?.id
    const t  = new Date().toISOString().split('T')[0]
    const tm = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    const items = []
    for (const p of active) {
      const base = { pName: p.name, pEmoji: p.emoji, pId: p.id }
      for (const todo of p.todos || []) {
        if (todo.status === 'done') continue
        const tAssignees = Array.isArray(todo.assignees) ? todo.assignees : (todo.assignee ? [todo.assignee] : [])
        // 나한테 배정된 것 또는 미배정만 표시
        if (tAssignees.length > 0 && !tAssignees.includes(myId)) continue
        // 담당자 이름 표시 (나 → '나', 다른 사람 → 이름)
        const allNames = tAssignees.map(id =>
          id === myId ? '나' : (p.members?.find(m => m.id === id)?.name || '')
        ).filter(Boolean)
        const push = (day) => items.push({ ...base, type: 'todo', label: todo.title, day, allNames })
        if (todo.dueDate === t)  push('today')
        if (todo.dueDate === tm) push('tomorrow')
      }
      for (const ev of p.events || []) {
        if (ev.date === t)  items.push({ ...base, type: 'event', label: ev.title, day: 'today' })
        if (ev.date === tm) items.push({ ...base, type: 'event', label: ev.title, day: 'tomorrow' })
      }
      for (const ms of p.milestones || []) {
        if (ms.status === 'done') continue
        if (ms.targetDate === t)  items.push({ ...base, type: 'milestone', label: ms.title, day: 'today' })
        if (ms.targetDate === tm) items.push({ ...base, type: 'milestone', label: ms.title, day: 'tomorrow' })
      }
    }
    return items
  }, [active, currentUser?.id])

  // 홈에서만 .content padding-top 제거 → sticky 헤더가 최상단에 바로 붙게
  useLayoutEffect(() => {
    const el = document.getElementById('page-content')
    if (!el) return
    el.style.paddingTop = '0px'
    return () => { el.style.paddingTop = '' }
  }, [])

  const [showModal, setShowModal]           = useState(false)
  const [showPinPicker, setShowPinPicker]   = useState(false)

  // PWA 단축아이콘 '새 프로젝트'(/home?new=1) → 생성 모달 자동 오픈
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowModal(true)
      searchParams.delete('new')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const [showCollecting, setShowCollecting] = useState(true)
  const [showArchived, setShowArchived]     = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [extendId, setExtendId]             = useState(null)
  const [newEndDate, setNewEndDate]         = useState('')

  const today = new Date().toISOString().split('T')[0]

  const setPinned = (id) => { setPinnedId(id || null); setShowPinPicker(false) }

  return (
    <>

      {showModal && <CreateProjectModal onClose={() => setShowModal(false)} />}

      {/* ── 연장 모달 ── */}
      {extendId && (
        <div className={styles.backdrop} onClick={() => setExtendId(null)}>
          <div className={styles.extendModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>기간 연장</h3>
            <p className={styles.extendDesc}>새로운 종료일을 선택해주세요</p>
            <input className={styles.input} type="date" value={newEndDate} min={today}
              onChange={(e) => setNewEndDate(e.target.value)} />
            <div className={styles.modalFooter} style={{ paddingTop: 4, border: 'none' }}>
              <button className={styles.prevBtn} onClick={() => setExtendId(null)}>취소</button>
              <div style={{ flex: 1 }} />
              <button className={styles.nextBtn} disabled={!newEndDate}
                onClick={() => { extendProject(extendId, newEndDate); setExtendId(null) }}>
                연장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 모달 ── */}
      {confirmDeleteId && (
        <div className={styles.backdrop} onClick={() => setConfirmDeleteId(null)}>
          <div className={styles.extendModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>프로젝트 삭제</h3>
            <p className={styles.extendDesc}>내 목록에서 삭제할까요?<br />삭제 후에는 되돌릴 수 없습니다.</p>
            <div className={styles.modalFooter} style={{ paddingTop: 4, border: 'none' }}>
              <button className={styles.prevBtn} onClick={() => setConfirmDeleteId(null)}>취소</button>
              <div style={{ flex: 1 }} />
              <button className={styles.deleteConfirmBtn}
                onClick={() => { hideProject(confirmDeleteId); setConfirmDeleteId(null) }}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 페이지 헤더 (sticky) ── */}
      {(() => {
        const totalActive = active.length
        const totalCollecting = collecting.length
        const pinned = active.find((p) => p.id === pinnedId) || null
        const pinnedBadge = pinned ? getDDayLabel(pinned) : null
        const today = new Date()
        const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`
        const weekday = ['일', '월', '화', '수', '목', '금', '토'][today.getDay()]
        const greeting = getGreeting(currentUser?.birthday)

        return (
          <div className={styles.stickyHeader}>
            <div className={styles.pageHeader}>
              <div>
                <div className={styles.heroEyebrow}>{dateStr} · {weekday}요일</div>
                <h1 className={styles.title}>
                  {greeting.before}<em>{currentUser?.name || '게스트'}</em>{greeting.after}
                </h1>
                <p className={styles.subtitle}>
                  <span><b>{totalActive}개</b> 진행 중</span>
                  <span className={styles.dot}>·</span>
                  <span><b>{totalCollecting}개</b> 수집 중</span>
                  {pinned && (
                    <>
                      <span className={styles.dot}>·</span>
                      <span>대표 <b>{pinned.name}</b></span>
                    </>
                  )}
                </p>
              </div>
              <button className={styles.createBtn} onClick={() => setShowModal(true)}>새 프로젝트</button>
            </div>

            {active.length > 0 && (
              <div className={styles.todayStrip}>
                <div className={`${styles.todayCell} ${styles.todayCellFeature}`}>
                  <div className={styles.todayLabelRow}>
                    <span className={styles.todayLabel}>대표 프로젝트</span>
                    <button className={styles.pinSetBtn} onClick={() => setShowPinPicker((v) => !v)}>⚙</button>
                  </div>
                  {showPinPicker && (
                    <div className={styles.pinPicker}>
                      {active.length === 0
                        ? <span className={styles.pinPickerEmpty}>진행 중인 프로젝트 없음</span>
                        : active.map((p) => (
                          <button key={p.id} className={`${styles.pinPickerItem} ${p.id === pinnedId ? styles.pinPickerActive : ''}`}
                            onClick={() => setPinned(p.id)}>
                            {p.emoji && <span>{p.emoji}</span>}
                            <span>{p.name}</span>
                          </button>
                        ))
                      }
                      {pinnedId && <button className={styles.pinPickerClear} onClick={() => setPinned(null)}>설정 해제</button>}
                    </div>
                  )}
                  {!showPinPicker && (pinned ? (
                    <div className={styles.todayFeature} style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/project/${pinned.id}`)}>
                      {pinned.emoji && <div className={styles.todayFeatureEmoji}>{pinned.emoji}</div>}
                      <div className={styles.todayFeatureBody}>
                        <div className={styles.todayFeatureName}>{pinned.name}</div>
                        <div className={styles.todayFeatureMeta}>~ {pinned.endDate}</div>
                      </div>
                      <span className={`${styles.todayPill} ${styles[pinnedBadge.cls] || ''}`}>{pinnedBadge.main}</span>
                    </div>
                  ) : (
                    <button className={styles.todayFeatureMeta} style={{ textDecoration: 'underline', cursor: 'pointer' }}
                      onClick={() => setShowPinPicker(true)}>⚙ 대표 프로젝트 설정하기</button>
                  ))}
                </div>
                <div className={styles.todayCell}>
                  <span className={styles.todayLabel}>진행 중</span>
                  <div className={styles.todayRow}>
                    <span className={styles.todayBig}>{totalActive}</span>
                    <span className={styles.todayUnit}>프로젝트</span>
                  </div>
                  <div className={styles.todayLine}>
                    리드 <b>{active.filter((p) => p.leaderId === currentUser?.id).length}</b> · 멤버 <b>{active.filter((p) => p.leaderId !== currentUser?.id).length}</b>
                  </div>
                </div>
                <div className={styles.todayCell}>
                  <span className={styles.todayLabel}>수집 중</span>
                  <div className={styles.todayRow}>
                    <span className={styles.todayBig}>{totalCollecting}</span>
                    <span className={styles.todayUnit}>피드백</span>
                  </div>
                  <div className={styles.todayLine}>응답 대기 중인 프로젝트</div>
                </div>
                <div className={styles.todayCell}>
                  <span className={styles.todayLabel}>완료됨</span>
                  <div className={styles.todayRow}>
                    <span className={styles.todayBig}>{visibleArchived.length}</span>
                    <span className={styles.todayUnit}>아카이브</span>
                  </div>
                  <div className={styles.todayLine}>회고 가능한 프로젝트</div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      <div className={styles.page}>

      {/* ── 초대 배너 ── */}
      {invites.map((invite) => (
        <div key={invite.id} className={styles.inviteBanner}>
          <div className={styles.inviteInfo}>
            <span className={styles.inviteDot} />
            <div>
              <p className={styles.inviteTitle}>초대가 도착했어요</p>
              <p className={styles.inviteSub}>
                <strong>{invite.projectName}</strong> · {invite.inviterName || invite.fromName} 님 · ~ {invite.endDate}
              </p>
            </div>
          </div>
          <div className={styles.inviteBtns}>
            <button className={styles.btnAccept} onClick={async () => {
              const projectId = await acceptInvite(invite.id)
              if (projectId) navigate(`/project/${projectId}`)
            }}>참여하기</button>
            <button className={styles.btnDecline} onClick={() => declineInvite(invite.id)}>거절하기</button>
          </div>
        </div>
      ))}

      {/* ── 오늘·내일 일정 요약 ── */}
      {todaySummary.length > 0 && (
        <div className={styles.summaryCard}>
          <div className={styles.summaryCardHead}>
            <span className={styles.summaryCardTitle}>📅 나만의 알림</span>
            <button className={styles.summaryCardLink} onClick={() => navigate('/calendar')}>전체 캘린더 →</button>
          </div>
          {todaySummary.slice(0, 5).map((item, i) => (
            <div key={i} className={styles.summaryRow} onClick={() => navigate(`/project/${item.pId}`)}>
              <span className={styles.summaryRowIcon}>{ITEM_ICON[item.type]}</span>
              <span className={styles.summaryRowLabel}>{item.label}</span>
              {item.allNames?.length > 0 && (
                <span className={styles.summaryAssignee}>{item.allNames.join(' · ')}</span>
              )}
              <span className={styles.summaryRowProject}>{item.pEmoji} {item.pName}</span>
              <span className={`${styles.summaryDayBadge} ${item.day === 'today' ? styles.summaryDayToday : styles.summaryDayTomorrow}`}>
                {item.day === 'today' ? '오늘' : '내일'}
              </span>
            </div>
          ))}
          {todaySummary.length > 5 && (
            <button className={styles.summaryMore} onClick={() => navigate('/calendar')}>
              +{todaySummary.length - 5}개 더 보기
            </button>
          )}
        </div>
      )}

      {active.length === 0 && (archived.length > 0 || collecting.length > 0) && (
        <div className={styles.noActiveWrap}>
          <div className={styles.noActiveBanner}>
            <span className={styles.noActiveBannerEmoji}>🌱</span>
            <div className={styles.noActiveBannerBody}>
              <p className={styles.noActiveBannerTitle}>
                {visibleArchived.length > 0
                  ? `${visibleArchived.length}개 프로젝트를 완주했어요!`
                  : '새로운 여정을 시작할 시간이에요'}
              </p>
              <p className={styles.noActiveBannerSub}>다음 팀과 어떤 도전을 함께할까요?</p>
            </div>
            <button className={styles.noActiveCreateBtn} onClick={() => setShowModal(true)}>
              새 프로젝트
            </button>
          </div>
          <div className={styles.noActiveLinks}>
            <button className={styles.noActiveLinkItem} onClick={() => navigate('/connect')}>
              <span className={styles.noActiveLinkIcon}>🔗</span>
              <span className={styles.noActiveLinkLabel}>커넥트</span>
              <span className={styles.noActiveLinkSub}>새 팀원 찾기</span>
            </button>
            <button className={styles.noActiveLinkItem} onClick={() => navigate('/match')}>
              <span className={styles.noActiveLinkIcon}>🤝</span>
              <span className={styles.noActiveLinkLabel}>매치</span>
              <span className={styles.noActiveLinkSub}>팀에 합류하기</span>
            </button>
            <button className={styles.noActiveLinkItem} onClick={() => { if (currentUser?.username) navigate(`/u/${currentUser.username}`) }}>
              <span className={styles.noActiveLinkIcon}>🌿</span>
              <span className={styles.noActiveLinkLabel}>팀프폴리오</span>
              <span className={styles.noActiveLinkSub}>내 기록 보기</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 진행 중 ── */}
      {active.length > 0 && (() => {
        const myId = currentUser?.id
        const leaderActive = active.filter((p) => p.leaderId === myId)
        const memberActive = active.filter((p) => p.leaderId !== myId)
        const showGroups = leaderActive.length > 0 && memberActive.length > 0

        const renderCard = (p) => {
          const progress  = getProgress(p)
          const badge     = getDDayLabel(p)
          const phaseBar  = getPhaseBar(p)
          const expired   = isExpired(p.endDate)
          const isLeader = p.leaderId === myId
          const buzz     = hasBuzz(p)
          const todayStr = new Date().toISOString().split('T')[0]

          const activeRoom = p.rooms?.find((r) => r.name === '전체' && !r.isDm)
            || p.rooms?.find((r) => !r.isDm && r.lastMessage)
          const lastMsg  = activeRoom?.lastMessage || ''
          const lastTime = activeRoom?.lastMessageAt
            ? relativeTime(activeRoom.lastMessageAt)
            : (activeRoom?.time || '')

          // 7일 이내 메시지가 있으면 active
          const isRecentlyActive = activeRoom?.lastMessageAt
            && Date.now() - new Date(activeRoom.lastMessageAt).getTime() < 7 * 86400000

          const pendingTodos = (p.todos || []).filter((t) => {
            if (t.status === 'done') return false
            // 내가 담당인 것만 (assignees 배열 또는 구 assignee 필드 모두 지원)
            const tAssignees = Array.isArray(t.assignees) ? t.assignees : (t.assignee ? [t.assignee] : [])
            return tAssignees.length === 0 || tAssignees.includes(myId)
          })
          const todayTodoCount = pendingTodos.length

          const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
          const tomorrowEvent = p.events?.find((e) => e.date === tomorrow)
          const hasPreview = lastMsg || todayTodoCount > 0 || tomorrowEvent

          return (
            <div key={p.id} className={`${styles.card} ${expired ? styles.cardExpired : ''} ${p.coverImage ? styles.cardHasCover : ''} ${isRecentlyActive ? styles.cardActive : styles.cardInactive} ${buzz ? styles.cardBuzz : ''}`}
              onClick={() => handleCardNav(p)}>
              {/* 커버 이미지 썸네일 — 설정된 경우만 표시 */}
              {p.coverImage && (
                <div className={styles.cardCover} style={getCoverStyle(p)}>
                </div>
              )}
              {expired && isLeader && (
                <div className={styles.expiredBanner} onClick={(e) => e.stopPropagation()}>
                  <span>기한이 만료됐어요</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className={styles.expiredArchive}
                      onClick={() => navigate(`/project/${p.id}`)}>마무리하기</button>
                    <button className={styles.expiredExtend}
                      onClick={() => { setExtendId(p.id); setNewEndDate('') }}>연장</button>
                  </div>
                </div>
              )}
              <div className={styles.cardHeader}>
                <div>
                  <span className={styles.cardCategory}>{p.category}</span>
                  <h3 className={styles.cardName}>
                    {/* 커버가 없을 때만 이모지를 이름 앞에 표시 */}
                    {p.emoji && <span className={`${styles.cardEmoji} ${buzz ? styles.emojiPop : ''}`}>{p.emoji}</span>}
                    {p.name}
                  </h3>
                </div>
                <div className={styles.cardHeaderRight}>
                  <span className={`${styles.dday} ${styles[badge.cls] || ''}`}>
                    {badge.main}
                    {badge.sub && <span className={styles.ddaySub}>{badge.sub}</span>}
                  </span>
                  {buzz && <span className={styles.activityDot} />}
                </div>
              </div>
              {p.purpose && <p className={styles.cardPurpose}>{p.purpose}</p>}

              {hasPreview && (
                <div className={styles.cardPreview} onClick={(e) => e.stopPropagation()}>
                  {lastMsg && (
                    <div className={styles.cardPreviewMsg}
                      onClick={() => activeRoom && navigate(`/project/${p.id}/chat/${activeRoom.id}`)}>
                      <span className={styles.cardPreviewIcon}>💬</span>
                      <span className={styles.cardPreviewText}>{lastMsg}</span>
                      {lastTime && <span className={styles.cardPreviewTime}>{lastTime}</span>}
                    </div>
                  )}
                  {todayTodoCount > 0 && (
                    <div className={styles.cardPreviewTodo}
                      onClick={() => navigate(`/project/${p.id}?tab=todo`)}>
                      <span className={styles.cardPreviewIcon}>✅</span>
                      <span className={styles.cardPreviewText}>남은 할 일 {todayTodoCount}개</span>
                    </div>
                  )}
                  {tomorrowEvent && (
                    <div className={styles.cardPreviewTodo}
                      onClick={() => navigate(`/project/${p.id}?tab=calendar`)}>
                      <span className={styles.cardPreviewIcon}>📅</span>
                      <span className={styles.cardPreviewText}>내일 — {tomorrowEvent.title}</span>
                    </div>
                  )}
                </div>
              )}

              <div className={styles.cardProgress}>
                {phaseBar ? (
                  <div className={styles.phaseBar}>
                    <div className={styles.phaseBarTrack}>
                      <div className={styles.phaseSegPre}  style={{ width: `${phaseBar.prePct}%` }} />
                      <div className={styles.phaseSegProj} style={{ width: `${phaseBar.projPct}%` }} />
                      <div className={styles.phaseSegPost} style={{ flex: 1 }} />
                    </div>
                    <span className={styles.todayDot} style={{ left: `${phaseBar.pos}%` }} />
                  </div>
                ) : (
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>
              <div className={styles.cardFooter} onClick={(e) => e.stopPropagation()}>
                <div className={styles.memberAvatars}>
                  {p.members.slice(0, 4).map((m, i) => (
                    <div key={m.id} className={styles.avatarOuter} style={{ zIndex: 4 - i, marginLeft: i === 0 ? 0 : -6 }}>
                      <div className={styles.avatar}>{m.name.charAt(0)}</div>
                    </div>
                  ))}
                  {p.members.length > 4 && (
                    <div className={styles.avatarMore}>+{p.members.length - 4}</div>
                  )}
                </div>
                <button className={styles.enterBtn} onClick={() => navigate(`/project/${p.id}`)}>
                  입장하기
                </button>
              </div>
            </div>
          )
        }

        return (
          <section>
            <h2 className={styles.sectionTitle}>진행 중 ({active.length})</h2>
            {showGroups ? (
              <>
                <p className={styles.groupLabel}>👑 내가 리더인 프로젝트</p>
                <div className={styles.grid}>{leaderActive.map(renderCard)}</div>
                <p className={styles.groupLabel} style={{ marginTop: 20 }}>팀원으로 참여 중</p>
                <div className={styles.grid}>{memberActive.map(renderCard)}</div>
              </>
            ) : (
              <div className={styles.grid}>{active.map(renderCard)}</div>
            )}
          </section>
        )
      })()}

      {/* ── 피드백 수집 중 ── */}
      {collecting.length > 0 && (
        <section>
          <div className={styles.archivedHeader}>
            <h2 className={styles.sectionTitle}>회고 진행 중 ({collecting.length})</h2>
            <button className={styles.archivedToggle} onClick={() => setShowCollecting((v) => !v)}
              title={showCollecting ? '목록 접기' : '목록 펼치기'}>
              {showCollecting ? '접기 ∧' : '펼치기 ∨'}
            </button>
          </div>
          {showCollecting && (
            <div className={styles.grid}>
              {collecting.map((p) => (
                <div key={p.id} className={`${styles.card} ${styles.cardCollecting}`}
                  onClick={() => navigate(`/project/${p.id}/wrapup`)} style={{ cursor: 'pointer' }}>
                  <div className={styles.cardHeader}>
                    <div>
                      <span className={styles.cardCategory}>{p.category}</span>
                      <h3 className={styles.cardName}>
                        {p.emoji && <span style={{ marginRight: 6 }}>{p.emoji}</span>}
                        {p.name}
                      </h3>
                    </div>
                    <span className={styles.collectingBadge}>📬 수집 중</span>
                  </div>
                  <p className={styles.cardPurpose}>{p.purpose}</p>
                  {p.feedbackDeadline && (
                    <p className={styles.cardDate}>마감: {p.feedbackDeadline?.slice(0, 10)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── 완료됨 ── */}
      {visibleArchived.length > 0 && (
        <section>
          <div className={styles.archivedHeader}>
            <h2 className={styles.sectionTitle}>
              완료됨 ({visibleArchived.length})
            </h2>
            <button className={styles.archivedToggle} onClick={() => setShowArchived((v) => !v)}
              title={showArchived ? '목록 접기' : '목록 펼치기'}>
              {showArchived ? '접기 ∧' : '펼치기 ∨'}
            </button>
          </div>
          {showArchived && (
            <div className={styles.grid}>
              {visibleArchived.map((p) => (
                <div key={p.id} className={`${styles.card} ${styles.cardArchived}`}
                  onClick={() => p.wrapupId ? navigate(`/project/${p.id}/wrapup`) : navigate(`/project/${p.id}`)}
                  style={{ cursor: 'pointer', position: 'relative' }}>
                  <div className={styles.cardHeader}>
                    <div>
                      <span className={styles.cardCategory}>{p.category}</span>
                      <h3 className={styles.cardName}>
                        {p.emoji && <span style={{ marginRight: 6 }}>{p.emoji}</span>}
                        {p.name}
                      </h3>
                    </div>
                    <span className={styles.archivedBadge}>✅ 완료</span>
                  </div>
                  <p className={styles.cardPurpose}>{p.purpose}</p>
                  <p className={styles.cardDate}>~ {p.endDate}</p>
                  <div className={styles.archivedCardFooter} onClick={(e) => e.stopPropagation()}>
                    <button
                      className={styles.deleteBtn}
                      title="내 목록에서 삭제"
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(p.id) }}>
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {projects.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🚀</div>
          <p className={styles.emptyTitle}>첫 번째 프로젝트를 시작해보세요</p>
          <p className={styles.emptySub}>팀을 만들고, 함께 만들고, 기록으로 남기세요</p>
          <button className={styles.emptyBtn} onClick={() => setShowModal(true)}>+ 새 프로젝트 만들기</button>
          <p className={styles.emptyHint}>초대 링크를 받았나요? 링크를 직접 열어 합류하세요</p>
        </div>
      )}
      </div>

    </>
  )
}
