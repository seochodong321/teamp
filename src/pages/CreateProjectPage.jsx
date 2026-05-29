import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, FREE_PROJECT_LIMIT, countOwnedProjects } from '../store/useStore.js'
import ProfileSelector from '../components/ProfileSelector.jsx'
import { getDDayLabel, getPhaseBar } from '../utils/phases.js'
import styles from './CreateProjectPage.module.css'

const PRESET_CATEGORIES = ['학교', '회사', '스터디', '기타']
const STEPS = ['기본 정보', '팀 구성', '완료']
const EMOJI_OPTIONS = [
  '📁', '📚', '💼', '🎓', '🏫', '💡', '🚀', '🎯',
  '🎨', '🎬', '🎵', '⚽', '🏀', '🏃', '✈️', '🌱',
  '🍕', '☕', '🐶', '🐱', '🌸', '🌟', '🔥', '💎',
  '🎮', '📱', '💻', '🛠️', '📝', '📊', '🗓️', '🎉',
]

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

export default function CreateProjectPage() {
  const navigate = useNavigate()
  const createProject = useStore((s) => s.createProject)
  const profiles      = useStore((s) => s.profiles)
  const showError     = useStore((s) => s.showError)
  const projects      = useStore((s) => s.projects)
  const currentUser   = useStore((s) => s.currentUser)

  const ownedCount      = countOwnedProjects(projects, currentUser?.id)
  const isPaidPlan      = ['pro', 'team', 'admin', 'student'].includes(currentUser?.plan)
  const isLimitReached  = !isPaidPlan && ownedCount >= FREE_PROJECT_LIMIT

  if (isLimitReached) return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEF3C7', color: '#D97706', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔒</div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>프로젝트 한도에 도달했어요</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
        무료 플랜은 최대 {FREE_PROJECT_LIMIT}개 프로젝트를 보유할 수 있어요.<br />
        현재 <strong>{ownedCount}개</strong> 보유 중
      </p>
      <button onClick={() => navigate('/profile')} style={{ padding: '10px 20px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)' }}>프로젝트 관리 →</button>
      <button onClick={() => navigate('/pricing')} style={{ padding: '10px 20px', background: 'var(--primary)', color: 'white', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>요금제 보기 →</button>
    </div>
  )

  const [step, setStep]           = useState(0)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showProfileSel, setShowProfileSel] = useState(false)
  const [emoji, setEmoji]         = useState('')
  const [name, setName]           = useState('')
  const [purpose, setPurpose]     = useState('')
  const [category, setCategory]   = useState('학교')
  const [customCategory, setCustomCategory] = useState('')
  const [projectStartDate, setProjectStartDate] = useState('')
  const [projectEndDate, setProjectEndDate]     = useState('')
  const [endTime, setEndTime]     = useState('')
  const [showEndTime, setShowEndTime] = useState(false)
  const [roomNames, setRoomNames] = useState(['개발팀'])
  const [newRoom, setNewRoom]     = useState('')
  const [created, setCreated]     = useState(null)
  const [dateError, setDateError] = useState('')
  const [loading, setLoading]     = useState(false)

  const finalCategory = category === '기타' ? (customCategory.trim() || '기타') : category

  const goNext = async () => {
    if (step === 0) {
      if (!emoji) { showError('프로젝트를 표현할 이모지를 골라주세요!'); return }
      if (!name.trim() || !projectStartDate || !projectEndDate) { showError('프로젝트 이름, 시작일, 종료일을 입력해주세요.'); return }
      if (projectStartDate && projectEndDate && projectEndDate < projectStartDate) { setDateError('종료일은 시작일보다 늦어야 해요.'); return }
      setDateError('')
    }
    if (step === 1) {
      // 서브 프로필이 있으면 선택 먼저
      if (profiles.length > 0) { setShowProfileSel(true); return }
      await doCreate('default', null)
      return
    }
    setStep((s) => s + 1)
  }

  const doCreate = async (profileId, affiliation) => {
    setShowProfileSel(false)
    setLoading(true)
    try {
      const p = await createProject({
        name, emoji, purpose, category: finalCategory,
        projectStartDate, projectEndDate, endTime: endTime || null, roomNames,
        profileId, affiliation,
      })
      setCreated(p)
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  const addRoom = () => { if (!newRoom.trim()) return; setRoomNames((prev) => [...prev, newRoom.trim()]); setNewRoom('') }
  const handleRoomKeyDown = (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); addRoom() } }
  const removeRoom = (i) => setRoomNames((prev) => prev.filter((_, j) => j !== i))
  const appOrigin  = import.meta.env.VITE_APP_URL || window.location.origin
  const inviteLink = created ? `${appOrigin}/join/${created.id}` : ''

  return (
    <>
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.stepBar}>
          {STEPS.map((label, i) => (
            <div key={i} className={styles.stepItem}>
              <div className={`${styles.stepCircle} ${i < step ? styles.stepDone : ''} ${i === step ? styles.stepActive : ''}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`${styles.stepLabel} ${i === step ? styles.stepLabelActive : ''}`}>{label}</span>
              {i < STEPS.length - 1 && <div className={`${styles.stepLine} ${i < step ? styles.stepLineDone : ''}`} />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className={styles.form}>
            <h2 className={styles.formTitle}>기본 정보</h2>

            <div className={styles.field}>
              <label className={styles.label}>프로젝트 이모지 * <span className={styles.labelHint}>(필수)</span></label>
              <div className={styles.emojiPreview}>
                {emoji
                  ? <span className={styles.emojiBig}>{emoji}</span>
                  : <span className={styles.emojiPlaceholder}>아래에서 골라주세요</span>}
              </div>
              <div className={styles.emojiGrid}>
                {EMOJI_OPTIONS.map((em) => (
                  <button type="button" key={em}
                    onClick={() => setEmoji(em)}
                    className={`${styles.emojiBtn} ${emoji === em ? styles.emojiBtnActive : ''}`}>
                    {em}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>프로젝트 이름 *</label>
              <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="예) 2026 졸업작품" />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>목적 / 설명</label>
              <textarea className={styles.textarea} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="어떤 프로젝트인지 간단히 적어주세요" rows={3} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>카테고리</label>
              <div className={styles.chipRow}>
                {PRESET_CATEGORIES.map((c) => (
                  <button type="button" key={c} className={`${styles.chip} ${category === c ? styles.chipActive : ''}`} onClick={() => setCategory(c)}>{c}</button>
                ))}
              </div>
              {category === '기타' && (
                <input className={styles.input} style={{ marginTop: 8 }} value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="카테고리를 직접 입력하세요" />
              )}
            </div>

            <div className={styles.dateRow}>
              <div className={styles.field}>
                <label className={styles.label}>프로젝트 시작일 ⭐</label>
                <input className={styles.input} type="date" value={projectStartDate} onChange={(e) => { setProjectStartDate(e.target.value); setDateError('') }} />
                <p className={styles.fieldHint}>시작일 전까지는 '프리' 단계로 자동 설정돼요.</p>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>프로젝트 종료일 *</label>
                <input className={`${styles.input} ${dateError ? styles.inputError : ''}`} type="date" value={projectEndDate} onChange={(e) => { setProjectEndDate(e.target.value); setDateError('') }} />
                <label className={styles.timeToggle}>
                  <input type="checkbox" checked={showEndTime} onChange={(e) => { setShowEndTime(e.target.checked); if (!e.target.checked) setEndTime('') }} />
                  <span>종료 시간도 지정할게요</span>
                </label>
                {showEndTime && (
                  <input className={styles.input} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                )}
              </div>
            </div>
            <PhasePreview start={projectStartDate} end={projectEndDate} />
            {dateError && <p className={styles.dateErrorMsg}>⚠️ {dateError}</p>}
          </div>
        )}

        {step === 1 && (
          <div className={styles.form}>
            <h2 className={styles.formTitle}>팀 구성</h2>
            <p className={styles.formDesc}>프로젝트 안에 만들 팀 채팅방을 설정하세요</p>
            <div className={styles.defaultRooms}>
              <p className={styles.defaultRoomsLabel}>기본 생성되는 채팅방</p>
              <div className={styles.defaultRoomItem}>
                <span className={styles.defaultRoomIcon} style={{ background: '#FAEEDA', color: '#854F0B' }}>💬</span>
                <span className={styles.defaultRoomName}>나와의 채팅</span>
                <span className={styles.defaultRoomDesc}>나만 보는 메모 공간</span>
              </div>
              <div className={styles.defaultRoomItem}>
                <span className={styles.defaultRoomIcon} style={{ background: '#EEEDFE', color: '#534AB7' }}>#전</span>
                <span className={styles.defaultRoomName}>전체</span>
                <span className={styles.defaultRoomDesc}>모든 팀원이 참여하는 방</span>
              </div>
            </div>
            <p className={styles.addRoomLabel}>추가할 팀 채팅방</p>
            <div className={styles.roomList}>
              {roomNames.map((r, i) => (
                <div key={i} className={styles.roomItem}>
                  <span className={styles.roomItemText}># {r}</span>
                  <button type="button" className={styles.removeRoom} onClick={() => removeRoom(i)}>✕</button>
                </div>
              ))}
            </div>
            <div className={styles.addRoomRow}>
              <input className={styles.input} value={newRoom} onChange={(e) => setNewRoom(e.target.value)} onKeyDown={handleRoomKeyDown} placeholder="팀 채팅방 이름 입력 (Enter로 추가)" />
              <button type="button" className={styles.addRoomBtn} onClick={addRoom}>추가</button>
            </div>
            <div className={styles.roomHint}>💡 팀 채팅방은 언제든 추가할 수 있어요!</div>
          </div>
        )}

        {step === 2 && created && (
          <div className={styles.done}>
            <div className={styles.doneIcon}>✓</div>
            <h2 className={styles.doneTitle}>프로젝트가 만들어졌어요!</h2>
            <p className={styles.doneSub}>팀원들에게 초대 링크를 공유해보세요</p>
            <div className={styles.linkBoxDone}>
              <span className={styles.linkText}>{inviteLink}</span>
              <button type="button" className={styles.linkCopy} onClick={() => { navigator.clipboard.writeText(inviteLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000) }}>{linkCopied ? '✓ 복사됨' : '복사'}</button>
            </div>
            <div className={styles.summary}>
              {[
                ['프로젝트명', `${emoji} ${created.name}`],
                ['카테고리', finalCategory],
                ['기간', `${created.projectStartDate || created.startDate} ~ ${created.projectEndDate || created.endDate}${endTime ? ` ${endTime}` : ''}`],
                ['채팅방', `${created.rooms.length}개`],
              ].map(([k, v]) => (
                <div key={k} className={styles.summaryRow}>
                  <span className={styles.summaryKey}>{k}</span>
                  <span className={styles.summaryVal}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.footer}>
          {step > 0 && step < 2 && <button type="button" className={styles.prevBtn} onClick={() => setStep((s) => s - 1)}>← 이전</button>}
          <div style={{ flex: 1 }} />
          {step < 2 && <button type="button" className={styles.nextBtn} onClick={goNext} disabled={loading}>{loading ? '생성 중...' : step === 1 ? '완료하기' : '다음 →'}</button>}
          {step === 2 && (
            <div className={styles.doneButtons}>
              <button type="button" className={styles.prevBtn} onClick={() => navigate('/home')}>홈으로</button>
              <button type="button" className={styles.nextBtn} onClick={() => navigate(`/project/${created.id}`)}>프로젝트 바로 가기 →</button>
            </div>
          )}
        </div>
      </div>
    </div>

    {showProfileSel && (
      <ProfileSelector
        title="어떤 프로필로 프로젝트를 만들까요?"
        onSelect={(p) => doCreate(p.id, p.affiliation)}
        onClose={() => setShowProfileSel(false)}
      />
    )}
    </>
  )
}
