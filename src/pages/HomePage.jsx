import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import styles from './HomePage.module.css'

const CATEGORIES = ['학교', '회사', '스터디', '기타']
const STEPS = ['기본 정보', '팀 구성', '초대']

export default function HomePage() {
  const navigate = useNavigate()
  const { projects, invites, acceptInvite, declineInvite, getProgress, getDday, isExpired, archiveProject, extendProject, createProject } = useStore()

  const active   = projects.filter((p) => p.status === 'active')
  const archived = projects.filter((p) => p.status === 'archived')

  // ── 새 프로젝트 모달 ──
  const [showModal, setShowModal] = useState(false)
  const [step, setStep]           = useState(0)
  const [pName, setPName]         = useState('')
  const [purpose, setPurpose]     = useState('')
  const [category, setCategory]   = useState('학교')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [roomNames, setRoomNames] = useState(['개발팀'])
  const [newRoom, setNewRoom]     = useState('')
  const [dateError, setDateError] = useState('')
  const [created, setCreated]     = useState(null)

  // ── 연장 모달 ──
  const [extendId, setExtendId]   = useState(null)
  const [newEndDate, setNewEndDate] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const openModal = () => {
    setShowModal(true); setStep(0); setPName(''); setPurpose('')
    setCategory('학교'); setStartDate(''); setEndDate('')
    setRoomNames(['개발팀']); setNewRoom(''); setDateError(''); setCreated(null)
  }
  const closeModal = () => setShowModal(false)

  const goNext = () => {
    if (step === 0) {
      if (!pName.trim() || !startDate || !endDate) { alert('프로젝트 이름, 시작일, 종료일을 입력해주세요.'); return }
      if (endDate < today) { setDateError('종료일이 오늘보다 이전이에요. 다시 설정해주세요.'); return }
      setDateError('')
    }
    if (step === STEPS.length - 1) {
      const p = createProject({ name: pName, purpose, category, startDate, endDate, roomNames })
      setCreated(p)
    }
    setStep((s) => s + 1)
  }

  const addRoom = () => {
    if (!newRoom.trim()) return
    setRoomNames((prev) => [...prev, newRoom.trim()])
    setNewRoom('')
  }

  return (
    <div className={styles.page}>

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
              {step === 0 && (
                <>
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
                        <button key={c} type="button" className={`${styles.chip} ${category === c ? styles.chipActive : ''}`} onClick={() => setCategory(c)}>{c}</button>
                      ))}
                    </div>
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
                  {dateError && <p className={styles.dateError}>⚠️ {dateError}</p>}
                </>
              )}

              {step === 1 && (
                <>
                  <div className={styles.defaultRooms}>
                    <p className={styles.defaultRoomsLabel}>기본 생성되는 채팅방</p>
                    <div className={styles.defaultRoomItem}>
                      <span className={styles.defaultRoomBadge} style={{ background: '#FAEEDA', color: '#854F0B' }}>💬</span>
                      <div><p className={styles.defaultRoomName}>나와의 채팅</p><p className={styles.defaultRoomDesc}>나만 보는 메모 공간</p></div>
                    </div>
                    <div className={styles.defaultRoomItem}>
                      <span className={styles.defaultRoomBadge} style={{ background: '#EEEDFE', color: '#534AB7' }}>#전</span>
                      <div><p className={styles.defaultRoomName}>전체</p><p className={styles.defaultRoomDesc}>모든 팀원이 참여하는 방</p></div>
                    </div>
                  </div>
                  <p className={styles.label}>추가 팀 채팅방</p>
                  <div className={styles.roomList}>
                    {roomNames.map((r, i) => (
                      <div key={i} className={styles.roomItem}>
                        <span className={styles.roomItemText}># {r}</span>
                        <button type="button" className={styles.roomRemove} onClick={() => setRoomNames((p) => p.filter((_, j) => j !== i))}>✕</button>
                      </div>
                    ))}
                  </div>
                  <div className={styles.addRoomRow}>
                    <input className={styles.input} value={newRoom} onChange={(e) => setNewRoom(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} placeholder="팀 채팅방 이름" />
                    <button type="button" className={styles.addRoomBtn} onClick={addRoom}>추가</button>
                  </div>
                  <p className={styles.roomHint}>💡 팀 채팅방은 언제든 추가할 수 있어요!</p>
                </>
              )}

              {step === 2 && (
                <>
                  <p className={styles.label}>초대 링크</p>
                  <div className={styles.linkBox}>
                    <span className={styles.linkText}>teamp.app/join/abc123</span>
                    <button type="button" className={styles.linkCopy} onClick={() => alert('링크가 복사됐어요!')}>복사</button>
                  </div>
                  <p className={styles.inviteHint}>💡 프로젝트 생성 후에도 언제든 초대할 수 있어요</p>
                </>
              )}

              {step === STEPS.length && created && (
                <div className={styles.doneWrap}>
                  <div className={styles.doneIcon}>✓</div>
                  <p className={styles.doneTitle}>프로젝트가 만들어졌어요!</p>
                  <p className={styles.doneName}>{created.name}</p>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              {step > 0 && step < STEPS.length && (
                <button className={styles.prevBtn} onClick={() => setStep((s) => s - 1)}>← 이전</button>
              )}
              <div style={{ flex: 1 }} />
              {step < STEPS.length && (
                <button className={styles.nextBtn} onClick={goNext}>
                  {step === STEPS.length - 1 ? '완료하기' : '다음 →'}
                </button>
              )}
              {step === STEPS.length && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={styles.prevBtn} onClick={closeModal}>닫기</button>
                  <button className={styles.nextBtn} onClick={() => { closeModal(); navigate(`/project/${created.id}`) }}>
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
            <input className={styles.input} type="date" value={newEndDate} min={today} onChange={(e) => setNewEndDate(e.target.value)} />
            <div className={styles.modalFooter} style={{ paddingTop: 12 }}>
              <button className={styles.prevBtn} onClick={() => setExtendId(null)}>취소</button>
              <div style={{ flex: 1 }} />
              <button className={styles.nextBtn} disabled={!newEndDate} onClick={() => { extendProject(extendId, newEndDate); setExtendId(null) }}>연장하기</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 페이지 헤더 ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>내 프로젝트</h1>
          <p className={styles.subtitle}>진행 중인 프로젝트를 확인하세요</p>
        </div>
        <button className={styles.createBtn} onClick={openModal}>+ 새 프로젝트</button>
      </div>

      {/* ── 초대 배너 ── */}
      {invites.map((invite) => (
        <div key={invite.id} className={styles.inviteBanner}>
          <div className={styles.inviteInfo}>
            <span className={styles.inviteDot} />
            <div>
              <p className={styles.inviteTitle}>초대가 도착했어요</p>
              <p className={styles.inviteSub}><strong>{invite.projectName}</strong> · {invite.fromName} 님 · ~ {invite.endDate}</p>
            </div>
          </div>
          <div className={styles.inviteBtns}>
            <button className={styles.btnAccept} onClick={() => acceptInvite(invite.id)}>참여하기</button>
            <button className={styles.btnDecline} onClick={() => declineInvite(invite.id)}>거절하기</button>
          </div>
        </div>
      ))}

      {/* ── 진행 중 ── */}
      {active.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>진행 중 ({active.length})</h2>
          <div className={styles.grid}>
            {active.map((p) => {
              const progress = getProgress(p)
              const dday     = getDday(p.endDate)
              const expired  = isExpired(p.endDate)
              return (
                <div key={p.id} className={`${styles.card} ${expired ? styles.cardExpired : ''}`}>
                  {expired && (
                    <div className={styles.expiredBanner}>
                      <span>기한이 만료됐어요</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className={styles.expiredArchive} onClick={() => archiveProject(p.id)}>종료</button>
                        <button className={styles.expiredExtend}  onClick={() => { setExtendId(p.id); setNewEndDate('') }}>연장</button>
                      </div>
                    </div>
                  )}
                  <div className={styles.cardHeader}>
                    <div>
                      <span className={styles.cardCategory}>{p.category}</span>
                      <h3 className={styles.cardName}>{p.name}</h3>
                    </div>
                    <span className={`${styles.dday} ${dday === 'D-day' ? styles.ddayUrgent : dday === '기한 초과' ? styles.ddayOver : ''}`}>{dday}</span>
                  </div>
                  <p className={styles.cardPurpose}>{p.purpose}</p>
                  <div className={styles.cardProgress}>
                    <div className={styles.progressInfo}>
                      <span className={styles.progressLabel}>기간 진행률</span>
                      <span className={styles.progressValue}>{progress}%</span>
                    </div>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${progress}%`, background: progress >= 80 ? '#E24B4A' : progress >= 60 ? '#BA7517' : 'var(--primary)' }} />
                    </div>
                  </div>
                  <div className={styles.cardFooter}>
                    <div className={styles.memberAvatars}>
                      {p.members.slice(0, 4).map((m, i) => (
                        <div key={m.id} className={styles.avatar} style={{ zIndex: 4 - i }}>{m.name.charAt(0)}</div>
                      ))}
                      {p.members.length > 4 && <div className={styles.avatarMore}>+{p.members.length - 4}</div>}
                    </div>
                    <button className={styles.enterBtn} onClick={() => navigate(`/project/${p.id}`)}>입장하기 →</button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── 완료됨 ── */}
      {archived.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>완료됨 ({archived.length})</h2>
          <div className={styles.grid}>
            {archived.map((p) => (
              <div key={p.id} className={`${styles.card} ${styles.cardArchived}`}>
                <div className={styles.cardHeader}>
                  <div>
                    <span className={styles.cardCategory}>{p.category}</span>
                    <h3 className={styles.cardName}>{p.name}</h3>
                  </div>
                  <span className={styles.archivedBadge}>완료</span>
                </div>
                <p className={styles.cardPurpose}>{p.purpose}</p>
                <p className={styles.cardDate}>~ {p.endDate}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {projects.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>아직 프로젝트가 없어요</p>
          <p className={styles.emptySub}>새 프로젝트를 만들어보세요</p>
          <button className={styles.emptyBtn} onClick={openModal}>+ 프로젝트 만들기</button>
        </div>
      )}
    </div>
  )
}