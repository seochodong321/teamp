import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import ProfileSelector from './ProfileSelector.jsx'
import { getDDayLabel, getPhaseBar } from '../utils/phases.js'
import styles from './CreateProjectModal.module.css'

const PHASE_INFO = {
  pre:     { icon: '🚀', name: '프리 단계',   hint: '시작일 전 준비 기간이에요. 팀원 초대·채팅방·마일스톤을 미리 세팅해보세요.' },
  project: { icon: '💼', name: '진행 중',     hint: '시작일이 오늘 이전이에요. 생성하면 바로 프로젝트 단계로 시작해요.' },
  post:    { icon: '📝', name: '포스트 단계', hint: '종료일이 이미 지났어요. 기록·회고 목적의 프로젝트로 생성돼요.' },
}

function PhasePreview({ start, end }) {
  if (!start) return null
  const today = new Date().toISOString().split('T')[0]
  const phase = today < start ? 'pre' : (!end || today <= end) ? 'project' : 'post'
  const info  = PHASE_INFO[phase]
  const proj  = { projectStartDate: start, projectEndDate: end }
  const lbl   = end ? getDDayLabel(proj) : null
  const bar   = end ? getPhaseBar(proj) : null
  return (
    <div className={styles.phaseCard}>
      <div className={styles.phaseCardTop}>
        <span className={`${styles.phaseBadge} ${styles[`phaseBadge_${phase}`]}`}>{info.icon} {info.name}</span>
        {lbl && <span className={styles.phaseCardDday}>{lbl.main}{lbl.sub ? ` · ${lbl.sub}` : ''}</span>}
      </div>
      {bar && (
        <div className={styles.phaseBarWrap}>
          <div className={styles.phaseBarTrack}>
            <div className={styles.phaseSegPre}  style={{ width: `${bar.prePct}%` }} />
            <div className={styles.phaseSegProj} style={{ width: `${bar.projPct}%` }} />
            <div className={styles.phaseSegPost} style={{ flex: 1 }} />
          </div>
          <span className={styles.todayMarker} style={{ left: `${bar.pos}%` }} />
        </div>
      )}
      <p className={styles.phaseCardHint}>{info.hint}</p>
    </div>
  )
}

const PRESET_CATEGORIES = ['학교', '회사', '스터디', '기타']
const EMOJI_OPTIONS = [
  '📁', '📚', '💼', '🎓', '🏫', '💡', '🚀', '🎯',
  '🎨', '🎬', '🎵', '⚽', '🏀', '🏃', '✈️', '🌱',
  '🍕', '☕', '🐶', '🐱', '🌸', '🌟', '🔥', '💎',
  '🎮', '📱', '💻', '🛠️', '📝', '📊', '🗓️', '🎉',
]
const STEPS = ['기본 정보', '팀 구성', '완료']

const FREE_PROJECT_LIMIT = 3

export default function CreateProjectModal({ onClose }) {
  const navigate = useNavigate()
  const { createProject, profiles, projects, currentUser, showError, showSuccess } = useStore((s) => ({
    createProject: s.createProject, profiles: s.profiles, projects: s.projects,
    currentUser: s.currentUser, showError: s.showError, showSuccess: s.showSuccess,
  }))

  const ownedCount = projects.filter((p) => p.leaderId === currentUser?.id).length
  const isLimitReached = ownedCount >= FREE_PROJECT_LIMIT

  const [step, setStep]                     = useState(0)
  const [emoji, setEmoji]                   = useState('')
  const [name, setName]                     = useState('')
  const [purpose, setPurpose]               = useState('')
  const [category, setCategory]             = useState('학교')
  const [customCategory, setCustomCategory] = useState('')
  const [projectStartDate, setProjectStartDate] = useState('')
  const [projectEndDate, setProjectEndDate]     = useState('')
  const [endTime, setEndTime]               = useState('')
  const [showEndTime, setShowEndTime]       = useState(false)
  const [roomNames, setRoomNames]           = useState([])
  const [newRoom, setNewRoom]               = useState('')
  const [created, setCreated]               = useState(null)
  const [dateError, setDateError]           = useState('')
  const [loading, setLoading]               = useState(false)
  const [linkCopied, setLinkCopied]         = useState(false)
  const [showProfileSel, setShowProfileSel] = useState(false)
  const [pendingData, setPendingData]       = useState(null)

  const finalCategory = category === '기타' ? (customCategory.trim() || '기타') : category

  const goNext = async () => {
    if (step === 0) {
      if (!emoji) { showError('이모지를 골라주세요!'); return }
      if (!name.trim() || !projectStartDate || !projectEndDate) { showError('이름, 시작일, 종료일을 입력해주세요.'); return }
      if (projectStartDate && projectEndDate && projectEndDate < projectStartDate) { setDateError('종료일은 시작일보다 늦어야 해요.'); return }
      setDateError('')
    }
    if (step === 1) {
      const data = { name, emoji, purpose, category: finalCategory, projectStartDate, projectEndDate, endTime: endTime || null, roomNames }
      if (profiles.length > 0) { setPendingData(data); setShowProfileSel(true); return }
      await doCreate(data, 'default', null)
      return
    }
    setStep((s) => s + 1)
  }

  const doCreate = async (data, profileId, affiliation) => {
    setShowProfileSel(false); setPendingData(null)
    setLoading(true)
    try {
      const p = await createProject({ ...data, profileId, affiliation })
      setCreated(p)
      setStep(2)
    } finally { setLoading(false) }
  }

  const addRoom = () => { if (!newRoom.trim()) return; setRoomNames((prev) => [...prev, newRoom.trim()]); setNewRoom('') }
  const removeRoom = (i) => setRoomNames((prev) => prev.filter((_, j) => j !== i))
  const appOrigin = import.meta.env.VITE_APP_URL || window.location.origin
  const inviteLink = created ? `${appOrigin}/join/${created.id}` : ''

  if (isLimitReached) return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div style={{ flex: 1 }} />
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          <div className={styles.done}>
            <div className={styles.doneIcon} style={{ background: '#FEF3C7', color: '#D97706' }}>🔒</div>
            <h2 className={styles.doneTitle}>프로젝트 한도에 도달했어요</h2>
            <p className={styles.doneSub}>
              무료 플랜은 최대 {FREE_PROJECT_LIMIT}개 프로젝트를 보유할 수 있어요.<br />
              현재 <strong>{ownedCount}개</strong> 보유 중 (진행 중 + 완료됨 합산)
            </p>
            <div className={styles.limitOptions}>
              <div className={styles.limitOption}>
                <p className={styles.limitOptionLabel}>기존 프로젝트 삭제</p>
                <p className={styles.limitOptionDesc}>완료된 프로젝트를 삭제하면 슬롯이 돌아와요</p>
                <button className={styles.prevBtn} onClick={() => { onClose(); navigate('/profile') }}>프로젝트 관리 →</button>
              </div>
              <div className={styles.limitDivider}>또는</div>
              <div className={styles.limitOption}>
                <p className={styles.limitOptionLabel}>Pro 플랜으로 업그레이드</p>
                <p className={styles.limitOptionDesc}>프로젝트 10개, 팀원 20명, 무제한 채팅 히스토리</p>
                <button className={styles.nextBtn} onClick={() => { onClose(); navigate('/pricing') }}>요금제 보기 →</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div className={styles.backdrop} onClick={() => { if (step < 2) onClose() }}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          {/* 헤더 */}
          <div className={styles.modalHeader}>
            <div className={styles.stepBar}>
              {STEPS.map((label, i) => (
                <React.Fragment key={i}>
                  <div className={styles.stepItem}>
                    <div className={`${styles.stepCircle} ${i < step ? styles.stepDone : ''} ${i === step ? styles.stepActive : ''}`}>
                      {i < step ? '✓' : i + 1}
                    </div>
                    <span className={`${styles.stepLabel} ${i === step ? styles.stepLabelActive : ''}`}>{label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={`${styles.stepLine} ${i < step ? styles.stepLineDone : ''}`} />}
                </React.Fragment>
              ))}
            </div>
            {/* 모바일: 헤더에 이전/다음 버튼 표시 */}
            {step < 2 && (
              <div className={styles.headerActions}>
                {step > 0 && <button className={styles.headerPrevBtn} onClick={() => setStep((s) => s - 1)}>←</button>}
                <button className={styles.headerNextBtn} onClick={goNext} disabled={loading}>
                  {loading ? '…' : step === 1 ? '완료' : '다음'}
                </button>
              </div>
            )}
            {step < 2 && <button className={styles.closeBtn} onClick={onClose}>✕</button>}
          </div>

          {/* 바디 */}
          <div className={styles.body}>
            {step === 0 && (
              <div className={styles.form}>
                <div className={styles.field}>
                  <label className={styles.label}>이모지 *</label>
                  <div className={styles.emojiPreview}>
                    {emoji ? <span className={styles.emojiBig}>{emoji}</span>
                      : <span className={styles.emojiPlaceholder}>아래에서 골라주세요</span>}
                  </div>
                  <div className={styles.emojiGrid}>
                    {EMOJI_OPTIONS.map((em) => (
                      <button type="button" key={em}
                        className={`${styles.emojiBtn} ${emoji === em ? styles.emojiBtnActive : ''}`}
                        onClick={() => setEmoji(em)}>{em}</button>
                    ))}
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>프로젝트 이름 *</label>
                  <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="예) 2026 졸업작품" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>목적 / 설명</label>
                  <textarea className={styles.textarea} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="어떤 프로젝트인지 간단히 적어주세요" rows={2} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>카테고리</label>
                  <div className={styles.chipRow}>
                    {PRESET_CATEGORIES.map((c) => (
                      <button type="button" key={c} className={`${styles.chip} ${category === c ? styles.chipActive : ''}`} onClick={() => setCategory(c)}>{c}</button>
                    ))}
                  </div>
                  {category === '기타' && (
                    <input className={styles.input} style={{ marginTop: 8 }} value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="카테고리를 직접 입력" />
                  )}
                </div>
                <div className={styles.dateRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>프로젝트 시작일 ⭐</label>
                    <input className={styles.input} type="date" value={projectStartDate} onChange={(e) => { setProjectStartDate(e.target.value); setDateError('') }} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>프로젝트 종료일 *</label>
                    <input className={`${styles.input} ${dateError ? styles.inputError : ''}`} type="date" value={projectEndDate} onChange={(e) => { setProjectEndDate(e.target.value); setDateError('') }} />
                    <label className={styles.timeToggle}>
                      <input type="checkbox" checked={showEndTime} onChange={(e) => { setShowEndTime(e.target.checked); if (!e.target.checked) setEndTime('') }} />
                      <span>종료 시간도 지정할게요</span>
                    </label>
                    {showEndTime && <input className={styles.input} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />}
                  </div>
                </div>
                <PhasePreview start={projectStartDate} end={projectEndDate} />
                {dateError && <p className={styles.dateError}>⚠️ {dateError}</p>}
              </div>
            )}

            {step === 1 && (
              <div className={styles.form}>
                <div className={styles.defaultRooms}>
                  <p className={styles.defaultRoomsLabel}>기본 채팅방</p>
                  <div className={styles.defaultRoomItem}><span className={styles.roomIcon} style={{ background: '#FAEEDA', color: '#854F0B' }}>💬</span><span>나와의 채팅</span></div>
                  <div className={styles.defaultRoomItem}><span className={styles.roomIcon} style={{ background: '#EEEDFE', color: '#534AB7' }}>#전</span><span>전체</span></div>
                </div>
                <p className={styles.label}>추가할 채팅방</p>
                <div className={styles.roomList}>
                  {roomNames.map((r, i) => (
                    <div key={i} className={styles.roomItem}>
                      <span># {r}</span>
                      <button type="button" className={styles.removeRoom} onClick={() => removeRoom(i)}>✕</button>
                    </div>
                  ))}
                </div>
                <div className={styles.addRoomRow}>
                  <input className={styles.input} value={newRoom} onChange={(e) => setNewRoom(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addRoom() } }}
                    placeholder="팀별로 채팅방을 만들어보세요" />
                  <button type="button" className={styles.addRoomBtn} onClick={addRoom}>추가</button>
                </div>
              </div>
            )}

            {step === 2 && created && (
              <div className={styles.done}>
                <div className={styles.doneIcon}>✓</div>
                <h2 className={styles.doneTitle}>프로젝트가 만들어졌어요!</h2>
                <p className={styles.doneSub}>초대 링크를 복사해 팀원들에게 공유하세요</p>
                <div className={styles.linkBox}>
                  <span className={styles.linkText}>{inviteLink}</span>
                  <button className={styles.linkCopy} onClick={() => { navigator.clipboard.writeText(inviteLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000) }}>{linkCopied ? '✓ 복사됨' : '복사'}</button>
                </div>
                <div className={styles.summary}>
                  {[['프로젝트명', `${emoji} ${created.name}`], ['기간', `${created.projectStartDate || created.startDate} ~ ${created.projectEndDate || created.endDate}`], ['채팅방', `${created.rooms.length}개`]].map(([k, v]) => (
                    <div key={k} className={styles.summaryRow}>
                      <span className={styles.summaryKey}>{k}</span>
                      <span className={styles.summaryVal}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 푸터 */}
          <div className={styles.footer}>
            {/* step 0/1 이전/다음 — 모바일에서는 헤더 버튼으로 대체되므로 숨김 */}
            {step > 0 && step < 2 && <button className={`${styles.prevBtn} ${styles.footerNavBtn}`} onClick={() => setStep((s) => s - 1)}>← 이전</button>}
            <div style={{ flex: 1 }} />
            {step < 2 && (
              <button className={`${styles.nextBtn} ${styles.footerNavBtn}`} onClick={goNext} disabled={loading}>
                {loading ? '생성 중...' : step === 1 ? '완료하기' : '다음 →'}
              </button>
            )}
            {step === 2 && (
              <>
                <button className={styles.prevBtn} onClick={() => { onClose(); navigate('/home') }}>홈으로</button>
                <button className={styles.nextBtn} onClick={() => { onClose(); navigate(`/project/${created.id}`) }}>바로 가기 →</button>
              </>
            )}
          </div>
        </div>
      </div>

      {showProfileSel && pendingData && (
        <ProfileSelector
          onSelect={(p) => doCreate(pendingData, p.id, p.affiliation)}
          onClose={() => { setShowProfileSel(false); setPendingData(null) }}
        />
      )}
    </>
  )
}
