import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import styles from './HomePage.module.css'

const CATEGORIES = ['학교', '동아리', '회사', '스터디', '기타']
const STEPS = ['기본 정보', '팀 구성', '초대']

export default function HomePage() {
  const navigate = useNavigate()
  const { projects, invites, acceptInvite, declineInvite, getProgress, getDday, isExpired, archiveProject, extendProject, createProject } = useStore()

  const active   = projects.filter((p) => p.status === 'active')
  const archived = projects.filter((p) => p.status === 'archived')

  // 팝업 모달 상태
  const [showModal, setShowModal] = useState(false)
  const [step, setStep]           = useState(0)
  const [name, setName]           = useState('')
  const [purpose, setPurpose]     = useState('')
  const [category, setCategory]   = useState('학교')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [roomNames, setRoomNames] = useState(['개발팀'])
  const [newRoom, setNewRoom]     = useState('')
  const [dateError, setDateError] = useState('')
  const [created, setCreated]     = useState(null)

  const today = new Date().toISOString().split('T')[0]

  // 연장 모달
  const [extendProjectId, setExtendProjectId] = useState(null)
  const [newEndDate, setNewEndDate]           = useState('')

  const openModal = () => { setShowModal(true); setStep(0); setName(''); setPurpose(''); setCategory('학교'); setStartDate(''); setEndDate(''); setRoomNames(['개발팀']); setNewRoom(''); setDateError(''); setCreated(null) }
  const closeModal = () => setShowModal(false)

  const goNext = () => {
    if (step === 0) {
      if (!name.trim() || !startDate || !endDate) { alert('프로젝트 이름, 시작일, 종료일을 입력해주세요.'); return }
      if (endDate < today) { setDateError('종료일이 오늘보다 이전이에요. 날짜를 다시 설정해주세요.'); return }
      setDateError('')
    }
    if (step === STEPS.length - 1) {
      const p = createProject({ name, purpose, category, startDate, endDate, roomNames })
      setCreated(p)
      setStep((s) => s + 1)
      return
    }
    setStep((s) => s + 1)
  }

  const addRoom = () => { if (!newRoom.trim()) return; setRoomNames((prev) => [...prev, newRoom.trim()]); setNewRoom('') }
  const removeRoom = (i) => setRoomNames((prev) => prev.filter((_, j) => j !== i))

  const handleExtend = (projectId) => { setExtendProjectId(projectId); setNewEndDate('') }
  const confirmExtend = () => { if (!newEndDate) return; extendProject(extendProjectId, newEndDate); setExtendProjectId(null) }

  return (
    <div className={styles.page}>

      {/* 연장 모달 */}
      {extendProjectId && (
        <div className={styles.backdrop} onClick={() => setExtendProjectId(null)}>
          <div className={styles.extendModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>기간 연장</h3>
            <p className={styles.modalDesc}>새로운 종료일을 선택해주세요</p>
            <input className={styles.modalDate} type="date" value={newEndDate} min={today} onChange={(e) => setNewEndDate(e.target.value)} />
            <div className={styles.modalBtns}>
              <button className={styles.modalCancel} onClick={() => setExtendProjectId(null)}>취소</button>
              <button className={styles.modalConfirm} onClick={confirmExtend} disabled={!newEndDate}>연장하기</button>
            </div>
          </div>
        </div>
      )}

      {/* 새 프로젝트 팝업 모달 */}
      {showModal && (
        <div className={styles.backdrop} onClick={closeModal}>
          <div className={styles.createModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.createModalHeader}>
              <h2 className={styles.createModalTitle}>
                {step < STEPS.length ? `새 프로젝트 — ${STEPS[step]}` : '완료!'}
              </h2>
              <button className={styles.closeBtn} onClick={closeModal}>✕</button>
            </div>

            {/* 스텝 인디케이터 */}
            {step < STEPS.length && (
              <div className={styles.stepRow}>
                {STEPS.map((_, i) => (
                  <div key={i} className={`${styles.stepDot} ${i === step ? styles.stepDotActive : ''} ${i < step ? styles.stepDotDone : ''}`} />
                ))}
              </div>
            )}

            <div className={styles.createModalBody}>

              {/* STEP 0 — 기본 정보 */}
              {step === 0 && (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>프로젝트 이름 *</label>
                    <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="예) 2025 졸업작품" autoFocus />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>목적 / 설명</label>
                    <textarea className={styles.textarea} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="어떤 프로젝트인지 간단히 적어주세요" rows={2} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>카테고리</label>
                    <div className={styles.chipRow}>
                      {CATEGORIES.map((c) => (
                        <button type="button" key={c} className={`${styles.chip} ${category === c ? styles.chipActive : ''}`} onClick={() => setCategory(c)}>{c}</button>
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
                  {dateError && <p className={styles.dateErrorMsg}>⚠️ {dateError}</p>}
                </>
              )}

              {/* STEP 1 — 팀 구성 */}
              {step === 1 && (
                <>
                  <div className={styles.defaultRooms}>
                    <p className={styles.defaultRoomsLabel}>기본 생성되는 채팅방</p>
                    <div className={styles.defaultRoomItem}>
                      <span className={styles.defaultRoomIcon} style={{ background: '#FAEEDA', color: '#854F0B' }}>💬</span>
                      <span>나와의 채팅</span>
                      <span className={styles.defaultRoomDesc}>나만 보는 메모 공간</span>
                    </div>
                    <div className={styles.defaultRoomItem}>
                      <span className={styles.defaultRoomIcon} style={{ background: '#EEEDFE', color: '#534AB7' }}>#전</span>
                      <span>전체</span>
                      <span className={styles.defaultRoomDesc}>모든 팀원이 참여하는 방</span>
                    </div>
                  </div>
                  <p className={styles.label} style={{ marginTop: 8 }}>추가할 팀 채팅방</p>
                  <div className={styles.roomList}>
                    {roomNames.map((r, i) => (
                      <div key={i} className={styles.roomItem}>
                        <span># {r}</span>
                        <button type="button" onClick={() => removeRoom(i)}>✕</button>
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

              {/* STEP 2 — 초대 */}
              {step === 2 && (
                <>
                  <div className={styles.linkBox}>
                    <span className={styles.linkText}>teamp.app/join/abc123</span>
                    <button type="button" className={styles.linkCopy} onClick={() => alert('링크가 복사됐어요!')}>복사</button>
                  </div>
                  <p className={styles.inviteHint}>💡 프로젝트 생성 후에도 언제든 초대할 수 있어요</p>
                </>
              )}

              {/* 완료 */}
              {step === STEPS.length && created && (
                <div className={styles.doneWrap}>
                  <div className={styles.doneIcon}>✓</div>
                  <p className={styles.doneTitle}>프로젝트가 만들어졌어요!</p>
                  <p className={styles.doneSub}>{created.name}</p>
                </div>
              )}
            </div>

            <div className={styles.createModalFooter}>
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
                    프로젝트 바로 가기 →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 페이지 헤더 */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>내 프로젝트</h1>
          <p className={styles.subtitle}>진행 중인 프로젝트를 확인하세요</p>
        </div>
        <button className={styles.createBtn} onClick={openModal}>+ 새 프로젝트</button>
      </div>

      {/* 초대 배너 */}
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

      {/* 진행 중 */}
      {active.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>진행 중 ({active.length})</h2>
          <div className={styles.grid}>
            {active.map((p) => {
              const progress = getProgress(p)
              const dday = getDday(p.endDate)
              const expired = isExpired(p.endDate)
              return (
                <div key={p.id} className={`${styles.card} ${expired ? styles.cardExpired : ''}`}>
                  {expired && (
                    <div className={styles.expiredBanner}>
                      기한이 만료됐어요
                      <div className={styles.expiredBtns}>
                        <button className={styles.expiredArchive} onClick={() => archiveProject(p.id)}>종료</button>
                        <button className={styles.expiredExtend} onClick={() => handleExtend(p.id)}>연장</button>
                      </div>
                    </div>
                  )}
                  <div className={styles.cardHeader}>
                    <div>
                      <span className={styles.cardCategory}>{p.category}</span>
                      <h3 className={styles.cardName}>{p.name}</h3>
                    </div>
                    <span className={`${styles.dday} ${dday === 'D-day' ? styles.ddayUrgent : dday === '기한 초과' ? styles.ddayExpired : ''}`}>{dday}</span>
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

      {/* 완료됨 */}
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