import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import styles from './CreateProjectPage.module.css'

const PRESET_CATEGORIES = ['학교', '회사', '스터디', '기타']
const STEPS = ['기본 정보', '팀 구성', '초대', '완료']
const EMOJI_OPTIONS = [
  '📁', '📚', '💼', '🎓', '🏫', '💡', '🚀', '🎯',
  '🎨', '🎬', '🎵', '⚽', '🏀', '🏃', '✈️', '🌱',
  '🍕', '☕', '🐶', '🐱', '🌸', '🌟', '🔥', '💎',
  '🎮', '📱', '💻', '🛠️', '📝', '📊', '🗓️', '🎉',
]

export default function CreateProjectPage() {
  const navigate = useNavigate()
  const createProject = useStore((s) => s.createProject)

  const [step, setStep]           = useState(0)
  const [emoji, setEmoji]         = useState('')
  const [name, setName]           = useState('')
  const [purpose, setPurpose]     = useState('')
  const [category, setCategory]   = useState('학교')
  const [customCategory, setCustomCategory] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [roomNames, setRoomNames] = useState(['개발팀'])
  const [newRoom, setNewRoom]     = useState('')
  const [created, setCreated]     = useState(null)
  const [dateError, setDateError] = useState('')

  const today = new Date().toISOString().split('T')[0]
  const finalCategory = category === '기타' ? (customCategory.trim() || '기타') : category

  const goNext = async () => {
    if (step === 0) {
      if (!emoji) { alert('프로젝트를 표현할 이모지를 골라주세요!'); return }
      if (!name.trim() || !startDate || !endDate) { alert('프로젝트 이름, 시작일, 종료일을 입력해주세요.'); return }
      if (endDate < today) { setDateError('종료일이 오늘보다 이전이에요. 날짜를 다시 설정해주세요.'); return }
      setDateError('')
    }
    if (step === 2) {
      const p = await createProject({ name, emoji, purpose, category: finalCategory, startDate, endDate, roomNames })
      setCreated(p)
    }
    setStep((s) => s + 1)
  }

  const addRoom = () => { if (!newRoom.trim()) return; setRoomNames((prev) => [...prev, newRoom.trim()]); setNewRoom('') }
  const handleRoomKeyDown = (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); addRoom() } }
  const removeRoom = (i) => setRoomNames((prev) => prev.filter((_, j) => j !== i))
  const inviteLink = created ? `${window.location.origin}/join/${created.id}` : ''

  return (
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
              <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="예) 2025 졸업작품" />
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
                <label className={styles.label}>시작일 *</label>
                <input className={styles.input} type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setDateError('') }} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>종료일 *</label>
                <input className={`${styles.input} ${dateError ? styles.inputError : ''}`} type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setDateError('') }} />
              </div>
            </div>
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

        {step === 2 && (
          <div className={styles.form}>
            <h2 className={styles.formTitle}>팀원 초대</h2>
            <p className={styles.formDesc}>링크를 공유하면 상대방이 참여 여부를 직접 선택해요</p>
            <div className={styles.linkBox}>
              <span className={styles.linkText}>{inviteLink || '프로젝트 생성 후 링크가 생성돼요'}</span>
              {inviteLink && (
                <button type="button" className={styles.linkCopy} onClick={() => { navigator.clipboard.writeText(inviteLink); alert('초대 링크가 복사됐어요!') }}>복사</button>
              )}
            </div>
            <div className={styles.inviteNote}><span>💡</span><p>프로젝트 생성 후 채팅방에서도 언제든 초대할 수 있어요</p></div>
          </div>
        )}

        {step === 3 && created && (
          <div className={styles.done}>
            <div className={styles.doneIcon}>✓</div>
            <h2 className={styles.doneTitle}>프로젝트가 만들어졌어요!</h2>
            <p className={styles.doneSub}>팀원들에게 초대 링크를 공유해보세요</p>
            <div className={styles.linkBoxDone}>
              <span className={styles.linkText}>{`${window.location.origin}/join/${created.id}`}</span>
              <button type="button" className={styles.linkCopy} onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/join/${created.id}`); alert('초대 링크가 복사됐어요!') }}>복사</button>
            </div>
            <div className={styles.summary}>
              {[
                ['프로젝트명', `${emoji} ${created.name}`],
                ['카테고리', finalCategory],
                ['기간', `${created.startDate} ~ ${created.endDate}`],
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
          {step > 0 && step < 3 && <button type="button" className={styles.prevBtn} onClick={() => setStep((s) => s - 1)}>← 이전</button>}
          <div style={{ flex: 1 }} />
          {step < 3 && <button type="button" className={styles.nextBtn} onClick={goNext}>{step === 2 ? '완료하기' : '다음 →'}</button>}
          {step === 3 && (
            <div className={styles.doneButtons}>
              <button type="button" className={styles.prevBtn} onClick={() => navigate('/home')}>홈으로</button>
              <button type="button" className={styles.nextBtn} onClick={() => navigate(`/project/${created.id}`)}>프로젝트 바로 가기 →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
