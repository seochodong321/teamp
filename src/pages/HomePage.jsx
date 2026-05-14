import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { getCoverStyle } from '../constants.js'
import { getGreeting } from '../greetings.js'
import styles from './HomePage.module.css'

const CATEGORIES = ['학교', '회사', '스터디', '기타']

function getCardBadge(p) {
  const now   = new Date()
  const today = now.toISOString().split('T')[0]
  const { startDate, endDate } = p

  if (startDate && today < startDate) {
    const diff = Math.round((new Date(startDate + 'T00:00:00') - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000)
    return { text: `D-${diff}`, cls: 'ddayBefore' }
  }
  if (startDate && today === startDate) return { text: 'D-DAY', cls: 'ddayStart' }
  if (endDate && today > endDate)        return { text: '기한 초과', cls: 'ddayOver' }
  if (endDate) {
    const diff = Math.round((new Date(endDate + 'T00:00:00') - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000)
    if (diff === 0) return { text: 'D-DAY', cls: 'ddayUrgent' }
    if (diff <= 7)  return { text: `D-${diff}`, cls: 'ddayWarning' }
  }
  return { text: '진행중', cls: 'ddayNormal' }
}
function relativeTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000)        return '방금'
  if (diff < 3600000)      return `${Math.floor(diff / 60000)}분 전`
  if (diff < 86400000)     return `${Math.floor(diff / 3600000)}시간 전`
  if (diff < 172800000)    return '어제'
  return `${Math.floor(diff / 86400000)}일 전`
}

const STEPS = ['기본 정보', '팀 구성']
const EMOJI_OPTIONS = [
  '📁', '📚', '💼', '🎓', '🏫', '💡', '🚀', '🎯',
  '🎨', '🎬', '🎵', '⚽', '🏀', '🏃', '✈️', '🌱',
  '🍕', '☕', '🐶', '🐱', '🌸', '🌟', '🔥', '💎',
  '🎮', '📱', '💻', '🛠️', '📝', '📊', '🗓️', '🎉',
]

export default function HomePage() {
  const navigate = useNavigate()
  const {
    projects, currentUser, invites,
    acceptInvite, declineInvite,
    getProgress, isExpired,
    archiveProject, extendProject, createProject,
    hiddenProjects, hideProject,
    pinnedId, setPinnedId,
  } = useStore()

  const active     = useMemo(() => projects.filter((p) => p.status === 'active'),     [projects])
  const collecting = useMemo(() => projects.filter((p) => p.status === 'collecting'), [projects])
  const archived   = useMemo(() => projects.filter((p) => p.status === 'archived'),   [projects])

  // ── 새 프로젝트 모달 상태 ──
  const [showModal, setShowModal] = useState(false)
  const [step, setStep]           = useState(0)
  const [emoji, setEmoji]         = useState('')
  const [pName, setPName]         = useState('')
  const [purpose, setPurpose]     = useState('')
  const [category, setCategory]   = useState('학교')
  const [customCategory, setCustomCategory] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [endTime, setEndTime]     = useState('')
  const [showEndTime, setShowEndTime] = useState(false)
  const [roomNames, setRoomNames] = useState(['개발팀'])
  const [newRoom, setNewRoom]     = useState('')
  const [dateError, setDateError] = useState('')

  // 대표 프로젝트 (Zustand persist)
  const [showPinPicker, setShowPinPicker] = useState(false)

  const setPinned = (id) => {
    setPinnedId(id || null)
    setShowPinPicker(false)
  }
  const [created, setCreated]     = useState(null)
  const [loading, setLoading]     = useState(false)

  // ── 섹션 접기 ──
  const [showCollecting, setShowCollecting] = useState(true)
  const [showArchived, setShowArchived]     = useState(false)

  // ── 삭제 확인 모달 ──
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // ── 연장 모달 ──
  const [extendId, setExtendId]     = useState(null)
  const [newEndDate, setNewEndDate] = useState('')

  const today = new Date().toISOString().split('T')[0]
  const finalCategory = category === '기타' ? (customCategory.trim() || '기타') : category

  const openModal = () => {
    setEmoji(''); setPName(''); setPurpose(''); setCategory('학교'); setCustomCategory('')
    setStartDate(''); setEndDate(''); setEndTime(''); setShowEndTime(false)
    setRoomNames(['개발팀']); setNewRoom(''); setDateError('')
    setCreated(null); setStep(0); setLoading(false)
    setShowModal(true)
  }

  const closeModal = () => setShowModal(false)

  const goNext = async () => {
    if (step === 0) {
      if (!emoji) { alert('프로젝트를 표현할 이모지를 골라주세요!'); return }
      if (!pName.trim() || !startDate || !endDate) { alert('프로젝트 이름, 시작일, 종료일을 입력해주세요.'); return }
      if (endDate < today) { setDateError('종료일이 오늘보다 이전이에요. 다시 설정해주세요.'); return }
      if (startDate && endDate && endDate < startDate) { setDateError('종료일은 시작일보다 늦어야 해요.'); return }
      setDateError('')
    }
    if (step === STEPS.length - 1) {
      setLoading(true)
      try {
        const p = await createProject({
          name: pName, emoji, purpose, category: finalCategory,
          startDate, endDate, endTime: endTime || null, roomNames,
        })
        setCreated(p)
        setStep((s) => s + 1)
      } finally {
        setLoading(false)
      }
      return
    }
    setStep((s) => s + 1)
  }

  const addRoom = () => {
    if (!newRoom.trim()) return
    setRoomNames((prev) => [...prev, newRoom.trim()])
    setNewRoom('')
  }

  const appOrigin  = import.meta.env.VITE_APP_URL || window.location.origin
  const inviteLink = created ? `${appOrigin}/join/${created.id}` : ''

  return (
    <>

      {/* ── 새 프로젝트 팝업 모달 ── */}
      {showModal && (
        <div className={styles.backdrop} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {step < STEPS.length ? `새 프로젝트 — ${STEPS[step]}` : '🎉 완료!'}
              </h2>
              <button className={styles.closeBtn} onClick={closeModal}>✕</button>
            </div>

            {step < STEPS.length && (
              <div className={styles.stepRow}>
                {STEPS.map((_, i) => (
                  <div key={i} className={`${styles.stepDot} ${i === step ? styles.stepDotActive : ''} ${i < step ? styles.stepDotDone : ''}`} />
                ))}
              </div>
            )}

            <div className={styles.modalBody}>

              {/* STEP 0 — 기본 정보 */}
              {step === 0 && (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      프로젝트 이모지 * <span style={{ fontSize: 11, color: '#9E9E9E', fontWeight: 400 }}>(필수)</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 56, background: '#EEEDFE', borderRadius: 10, border: '1px solid #E4E4E4', marginBottom: 8 }}>
                      {emoji
                        ? <span style={{ fontSize: 32 }}>{emoji}</span>
                        : <span style={{ fontSize: 12, color: '#9E9E9E' }}>아래에서 골라주세요</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
                      {EMOJI_OPTIONS.map((em) => (
                        <button type="button" key={em}
                          onClick={() => setEmoji(em)}
                          style={{
                            aspectRatio: '1', fontSize: 16, borderRadius: 6,
                            border: emoji === em ? '2px solid #534AB7' : '1px solid #E4E4E4',
                            background: emoji === em ? '#EEEDFE' : '#FFFFFF',
                            cursor: 'pointer', padding: 0, transition: 'all 0.15s',
                          }}>
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>프로젝트 이름 *</label>
                    <input className={styles.input} value={pName} onChange={(e) => setPName(e.target.value)} placeholder="예) 2025 졸업작품" autoFocus />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>목적 / 설명</label>
                    <textarea className={styles.textarea} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="어떤 프로젝트인지 간단히 적어주세요" rows={2} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>카테고리</label>
                    <div className={styles.chipRow}>
                      {CATEGORIES.map((c) => (
                        <button key={c} type="button"
                          className={`${styles.chip} ${category === c ? styles.chipActive : ''}`}
                          onClick={() => setCategory(c)}>{c}</button>
                      ))}
                    </div>
                    {category === '기타' && (
                      <input className={styles.input} style={{ marginTop: 8 }} value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="카테고리를 직접 입력하세요 (예: 동아리, 연구팀)" />
                    )}
                  </div>
                  <div className={styles.dateRow}>
                    <div className={styles.field}>
                      <label className={styles.label}>시작일 *</label>
                      <input className={styles.input} type="date" value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); setDateError('') }} />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>종료일 *</label>
                      <input className={`${styles.input} ${dateError ? styles.inputError : ''}`}
                        type="date" value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); setDateError('') }} />
                    </div>
                  </div>
                  {dateError && <p className={styles.dateError}>⚠️ {dateError}</p>}
                  <div className={styles.field}>
                    <label className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      종료 시간
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 400, fontSize: 11, color: '#9E9E9E', cursor: 'pointer' }}>
                        <input type="checkbox" checked={showEndTime} onChange={(e) => { setShowEndTime(e.target.checked); if (!e.target.checked) setEndTime('') }} style={{ width: 12, height: 12 }} />
                        시간도 지정할게요
                      </label>
                    </label>
                    {showEndTime && (
                      <input className={styles.input} type="time" value={endTime}
                        onChange={(e) => setEndTime(e.target.value)} />
                    )}
                  </div>
                </>
              )}

              {/* STEP 1 — 팀 구성 */}
              {step === 1 && (
                <>
                  <div className={styles.defaultRooms}>
                    <p className={styles.defaultRoomsLabel}>기본 생성되는 채팅방</p>
                    <div className={styles.defaultRoomItem}>
                      <span className={styles.defaultRoomBadge} style={{ background: '#FAEEDA', color: '#854F0B' }}>💬</span>
                      <div>
                        <p className={styles.defaultRoomName}>나와의 채팅</p>
                        <p className={styles.defaultRoomDesc}>나만 보는 메모 공간</p>
                      </div>
                    </div>
                    <div className={styles.defaultRoomItem}>
                      <span className={styles.defaultRoomBadge} style={{ background: '#EEEDFE', color: '#534AB7' }}>#전</span>
                      <div>
                        <p className={styles.defaultRoomName}>전체</p>
                        <p className={styles.defaultRoomDesc}>모든 팀원이 참여하는 방</p>
                      </div>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>추가 팀 채팅방</label>
                    <div className={styles.roomList}>
                      {roomNames.map((r, i) => (
                        <div key={i} className={styles.roomItem}>
                          <span># {r}</span>
                          <button type="button" className={styles.roomRemove}
                            onClick={() => setRoomNames((p) => p.filter((_, j) => j !== i))}>✕</button>
                        </div>
                      ))}
                    </div>
                    <div className={styles.addRoomRow}>
                      <input className={styles.input} value={newRoom}
                        onChange={(e) => setNewRoom(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                            e.preventDefault()
                            if (newRoom.trim()) addRoom()
                          }
                        }}
                        placeholder="팀 채팅방 이름 (Enter로 추가)" />
                      <button type="button" className={styles.addRoomBtn} onClick={addRoom}>추가</button>
                    </div>
                  </div>
                  <p className={styles.roomHint}>💡 팀 채팅방은 언제든 추가할 수 있어요!</p>
                </>
              )}

              {/* 완료 — 초대 링크 */}
              {step === STEPS.length && created && (
                <div className={styles.doneWrap}>
                  <div className={styles.doneIcon}>✓</div>
                  <p className={styles.doneTitle}>프로젝트가 만들어졌어요!</p>
                  <p className={styles.doneSub}>{emoji} {created.name}</p>
                  <p className={styles.inviteHint}>팀원에게 초대 링크를 공유해보세요</p>
                  <div className={styles.linkBox} style={{ marginTop: 4, width: '100%' }}>
                    <span className={styles.linkText}>{inviteLink}</span>
                    <button type="button" className={styles.linkCopy}
                      onClick={() => { navigator.clipboard.writeText(inviteLink); alert('초대 링크가 복사됐어요!') }}>복사</button>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              {step > 0 && step < STEPS.length && (
                <button className={styles.prevBtn} onClick={() => setStep((s) => s - 1)}>← 이전</button>
              )}
              <div style={{ flex: 1 }} />
              {step < STEPS.length && (
                <button className={styles.nextBtn} onClick={goNext} disabled={loading}>
                  {loading ? '생성 중...' : step === STEPS.length - 1 ? '완료하기' : '다음 →'}
                </button>
              )}
              {step === STEPS.length && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={styles.prevBtn} onClick={closeModal}>닫기</button>
                  <button className={styles.nextBtn}
                    onClick={() => { closeModal(); navigate(`/project/${created.id}`) }}>
                    프로젝트로 →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
        const pinnedBadge = pinned ? getCardBadge(pinned) : null
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
              <button className={styles.createBtn} onClick={openModal}>새 프로젝트</button>
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
                      <span className={`${styles.todayPill} ${styles[pinnedBadge.cls] || ''}`}>{pinnedBadge.text}</span>
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
                    <span className={styles.todayBig}>{archived.filter((p) => !hiddenProjects.includes(p.id)).length}</span>
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

      {/* ── 진행 중 ── */}
      {active.length > 0 && (() => {
        const myId = currentUser?.id
        const leaderActive = active.filter((p) => p.leaderId === myId)
        const memberActive = active.filter((p) => p.leaderId !== myId)
        const showGroups = leaderActive.length > 0 && memberActive.length > 0

        const renderCard = (p) => {
          const progress = getProgress(p)
          const badge    = getCardBadge(p)
          const expired  = isExpired(p.endDate)
          const isLeader = p.leaderId === myId
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
            <div key={p.id} className={`${styles.card} ${expired ? styles.cardExpired : ''} ${p.coverImage ? styles.cardHasCover : ''} ${isRecentlyActive ? styles.cardActive : styles.cardInactive}`}
              onClick={() => navigate(`/project/${p.id}`)} style={{ cursor: 'pointer' }}>
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
                    {p.emoji && <span style={{ marginRight: 6 }}>{p.emoji}</span>}
                    {p.name}
                  </h3>
                </div>
                <span className={`${styles.dday} ${styles[badge.cls] || ''}`}>
                  {badge.text}
                </span>
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
                <div className={styles.progressInfo}>
                  <span className={styles.progressLabel}>기간 진행률</span>
                  <span className={styles.progressValue}>{progress}%</span>
                </div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill}
                    style={{ width: `${progress}%`, background: progress >= 80 ? '#E24B4A' : progress >= 60 ? '#BA7517' : 'var(--primary)' }} />
                </div>
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
            <h2 className={styles.sectionTitle}>피드백 수집 중 ({collecting.length})</h2>
            <button className={styles.archivedToggle} onClick={() => setShowCollecting((v) => !v)}>
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
      {archived.filter((p) => !hiddenProjects.includes(p.id)).length > 0 && (
        <section>
          <div className={styles.archivedHeader}>
            <h2 className={styles.sectionTitle}>
              완료됨 ({archived.filter((p) => !hiddenProjects.includes(p.id)).length})
            </h2>
            <button className={styles.archivedToggle} onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? '접기 ∧' : '펼치기 ∨'}
            </button>
          </div>
          {showArchived && (
            <div className={styles.grid}>
              {archived.filter((p) => !hiddenProjects.includes(p.id)).map((p) => (
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
          <p className={styles.emptySub}>기여와 관계의 기록, 지금 시작해보세요</p>
          <button className={styles.emptyBtn} onClick={openModal}>+ 새 프로젝트 만들기</button>
        </div>
      )}
      </div>
    </>
  )
}
