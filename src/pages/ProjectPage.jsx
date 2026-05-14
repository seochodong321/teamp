import React, { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import { getCoverStyle, COVER_PRESETS } from '../constants.js'
import CalendarInline from '../components/CalendarInline.jsx'
import TodoBoard from '../components/TodoBoard.jsx'
import styles from './ProjectPage.module.css'

const ROLE_LABEL = { leader: '👑 리더', 'sub-leader': '⭐ 부리더', member: '팀원' }

export default function ProjectPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const {
    projects, currentUser, connects,
    addAnnouncement, deleteAnnouncement,
    getProgress, getDday, getVisibleRooms, canManage,
    updateMemberRole, setMemberRooms, transferLeader,
    reorderRooms, archiveProject, extendProject, endProject,
    formatUnread, isExpired, getOrCreateDmRoom, addRoom, leaveProject,
    kickMember, setWeeklyGoalSchedule, addWeeklyGoal,
    sendProjectInvite, setCoverImage, updateProjectInfo, blockedUsers,
    addMilestone, updateMilestone, deleteMilestone,
  } = useStore()

  const project = projects.find((p) => p.id === projectId)
  const [tab, setTab] = useState(tabParam || 'rooms')
  const [dragIdx, setDragIdx]       = useState(null)
  const [dragOrder, setDragOrder]   = useState(null)
  const [showExtend, setShowExtend] = useState(false)
  const [newEndDate, setNewEndDate] = useState('')

  const [showAddRoom, setShowAddRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')

  const [boardView, setBoardView]     = useState('list')
  const [selectedAnn, setSelectedAnn] = useState(null)
  const [annTitle, setAnnTitle]       = useState('')
  const [annContent, setAnnContent]   = useState('')
  const [annIsGlobal, setAnnIsGlobal] = useState(false)
  const [annFile, setAnnFile]         = useState(null)
  const fileRef = useRef(null)

  const [profileMember, setProfileMember] = useState(null)

  const [pendingRoles, setPendingRoles] = useState({})
  const [pendingRooms, setPendingRooms] = useState({})
  const [saveMsg, setSaveMsg]           = useState('')

  const [inviteCopied, setInviteCopied] = useState(false)
  const [sentInvites, setSentInvites]   = useState({}) // inviteeId → 'sent' | 'error'

  const [showLeave, setShowLeave]               = useState(false)
  const [leaveLoading, setLeaveLoading]         = useState(false)

  // 주간 목표
  const [goalText, setGoalText]               = useState('')
  const [showGoalForm, setShowGoalForm]       = useState(false)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [scheduleDay, setScheduleDay]         = useState('월')
  const [scheduleTime, setScheduleTime]       = useState('09:00')

  const [showEndProject, setShowEndProject]     = useState(false)
  const [showConfirmEnd, setShowConfirmEnd]     = useState(false)
  const [endCollectFeedback, setEndCollectFeedback] = useState(true)
  const [endFeedbackDuration, setEndFeedbackDuration] = useState(7)
  const [endSubmitting, setEndSubmitting]       = useState(false)
  const [endError, setEndError]                 = useState('')

  // 마일스톤
  const [showMsForm, setShowMsForm]       = useState(false)
  const [msTitle, setMsTitle]             = useState('')
  const [msDesc, setMsDesc]               = useState('')
  const [msDate, setMsDate]               = useState('')
  const [msSubmitting, setMsSubmitting]   = useState(false)

  // 커버 이미지 피커
  const [showCoverPicker, setShowCoverPicker]   = useState(false)
  const [coverUploading, setCoverUploading]     = useState(false)
  const coverFileRef = useRef(null)

  // 프로젝트 설정 모달
  const [showSettings, setShowSettings]   = useState(false)
  const [settingEmoji, setSettingEmoji]   = useState('')
  const [settingName, setSettingName]     = useState('')
  const [settingPurpose, setSettingPurpose] = useState('')
  const [settingStart, setSettingStart]   = useState('')
  const [settingEnd, setSettingEnd]       = useState('')
  const [settingSaving, setSettingSaving] = useState(false)

  useEffect(() => {
    if (tabParam) setTab(tabParam)
  }, [tabParam])

  if (!project) return <div className={styles.notFound}>프로젝트를 찾을 수 없어요</div>

  const isLeader     = project.leaderId === currentUser.id
  const myRole       = project.members.find((m) => m.id === currentUser.id)?.role
  const canInvite    = isLeader || myRole === 'sub-leader'
  const iCanManage   = canManage(project, currentUser.id)
  const progress     = getProgress(project)
  const dday         = getDday(project.endDate)
  const expired      = isExpired(project.endDate)
  const visibleRooms = getVisibleRooms(project, currentUser.id)
  const today        = new Date().toISOString().split('T')[0]
  const inviteLink   = `${import.meta.env.VITE_APP_URL || window.location.origin}/join/${project.inviteCode || project.id}`

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setCoverUploading(true)
    try {
      const sRef = storageRef(storage, `projects/${projectId}/cover.jpg`)
      await uploadBytes(sRef, file)
      const url = await getDownloadURL(sRef)
      await setCoverImage(projectId, url)
      setShowCoverPicker(false)
    } catch {
      alert('업로드에 실패했어요. Firebase Storage가 활성화되지 않았거나 네트워크 오류예요.')
    } finally {
      setCoverUploading(false)
      e.target.value = ''
    }
  }

  const openSettings = () => {
    setSettingEmoji(project.emoji || '')
    setSettingName(project.name || '')
    setSettingPurpose(project.purpose || '')
    setSettingStart(project.startDate || '')
    setSettingEnd(project.endDate || '')
    setShowSettings(true)
  }

  const handleSaveSettings = async () => {
    if (!settingName.trim()) { alert('프로젝트 이름은 비울 수 없어요.'); return }
    if (settingStart && settingEnd && settingEnd < settingStart) { alert('종료일이 시작일보다 빠를 수 없어요.'); return }
    setSettingSaving(true)
    try {
      await updateProjectInfo(projectId, {
        emoji: settingEmoji,
        name: settingName.trim(),
        purpose: settingPurpose.trim(),
        startDate: settingStart,
        endDate: settingEnd,
      })
      setShowSettings(false)
    } catch {
      alert('저장에 실패했어요. 다시 시도해주세요.')
    } finally {
      setSettingSaving(false)
    }
  }

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
    } catch {
      const el = document.createElement('textarea')
      el.value = inviteLink
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2500)
  }

  const handleDirectInvite = async (connect) => {
    if (sentInvites[connect.id]) return
    setSentInvites((s) => ({ ...s, [connect.id]: 'sending' }))
    try {
      await sendProjectInvite(projectId, connect)
      setSentInvites((s) => ({ ...s, [connect.id]: 'sent' }))
    } catch {
      setSentInvites((s) => ({ ...s, [connect.id]: 'error' }))
    }
  }

  const initManage = () => {
    const roles = {}, rooms = {}
    project.members.filter((m) => m.id !== currentUser.id).forEach((m) => {
      roles[m.id] = m.role
      rooms[m.id] = [...m.roomIds]
    })
    setPendingRoles(roles); setPendingRooms(rooms); setSaveMsg('')
  }

  const saveManage = () => {
    project.members.filter((m) => m.id !== currentUser.id).forEach((m) => {
      if (pendingRoles[m.id] !== m.role) updateMemberRole(project.id, m.id, pendingRoles[m.id])
      if ((pendingRoles[m.id] ?? m.role) === 'member') setMemberRooms(project.id, m.id, pendingRooms[m.id] || [])
    })
    setSaveMsg('저장됐어요!')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  const handleAddRoom = () => {
    if (!newRoomName.trim()) return
    addRoom(project.id, newRoomName)
    setNewRoomName(''); setShowAddRoom(false)
  }

  const handleWriteAnn = () => {
    if (!annTitle.trim() || !annContent.trim()) return
    addAnnouncement(project.id, { title: annTitle, content: annContent, isGlobal: annIsGlobal, fileName: annFile?.name || null })
    setAnnTitle(''); setAnnContent(''); setAnnIsGlobal(false); setAnnFile(null); setBoardView('list')
  }

  const handleDm = async (member) => {
    try {
      const room = await getOrCreateDmRoom(project.id, member.id, member.name)
      setProfileMember(null)
      navigate(`/project/${projectId}/chat/${room.id}`)
    } catch (e) {
      console.error('[DM] 열기 실패:', e)
    }
  }

  const handleDragStart = (i) => { setDragIdx(i); setDragOrder(visibleRooms) }
  const handleDragOver  = (e, i) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i) return
    const newOrder = [...(dragOrder || visibleRooms)]
    const [moved] = newOrder.splice(dragIdx, 1)
    newOrder.splice(i, 0, moved)
    setDragOrder(newOrder)
    setDragIdx(i)
  }
  const handleDragEnd = () => {
    if (dragOrder) reorderRooms(project.id, dragOrder.map((r) => r.id))
    setDragOrder(null)
    setDragIdx(null)
  }

  const TABS = [
    ['rooms',     '💬 채팅방'],
    ['board',     '📋 게시판'],
    ['todo',      '✅ 할 일'],
    ['calendar',  '📅 캘린더'],
    ['milestone', '🏁 마일스톤'],
    ['members',   '👥 멤버'],
    ...(iCanManage ? [['manage', '⚙️ 권한 관리']] : []),
    ...(isLeader  ? [['guide',  '📖 운영 방법']] : []),
  ]

  const milestones = project.milestones || []
  const MS_STATUS = { pending: '진행 중', done: '완료', delayed: '연기됨' }
  const MS_HISTORY_LABEL = { created: '생성', completed: '완료', reopened: '재개', delayed: '연기', modified: '수정' }

  const handleAddMilestone = async () => {
    if (!msTitle.trim() || msSubmitting) return
    setMsSubmitting(true)
    try {
      await addMilestone(project.id, { title: msTitle.trim(), description: msDesc.trim(), targetDate: msDate })
      setMsTitle(''); setMsDesc(''); setMsDate(''); setShowMsForm(false)
    } finally {
      setMsSubmitting(false)
    }
  }

  const handleCompleteMilestone = (msId) =>
    updateMilestone(project.id, msId, { action: 'completed', status: 'done', completedAt: new Date().toISOString() })

  const handleReopenMilestone = (msId) =>
    updateMilestone(project.id, msId, { action: 'reopened', status: 'pending', completedAt: null })

  const handleDelayMilestone = (msId) =>
    updateMilestone(project.id, msId, { action: 'delayed', status: 'delayed' })

  const handleDeleteMilestone = (msId) => {
    if (window.confirm('이 마일스톤을 삭제할까요?')) deleteMilestone(project.id, msId)
  }

  return (
    <div className={styles.page}>

      {/* 상단 네비게이션 */}
      <div className={styles.topNav}>
        <button className={styles.topNavBack} onClick={() => navigate('/home')}>← 홈</button>
        <span className={styles.topNavLogo}>Teamp</span>
        <div style={{ width: 80 }} />
      </div>

      {showExtend && (
        <div className={styles.backdrop} onClick={() => setShowExtend(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>기간 연장</h3>
            <p className={styles.modalDesc}>새로운 종료일을 선택해주세요</p>
            <input className={styles.modalInput} type="date" value={newEndDate} min={today}
              onChange={(e) => setNewEndDate(e.target.value)} />
            <div className={styles.modalBtns}>
              <button className={styles.modalCancel} onClick={() => setShowExtend(false)}>취소</button>
              <button className={styles.modalConfirm} disabled={!newEndDate}
                onClick={() => { extendProject(project.id, newEndDate); setShowExtend(false) }}>연장하기</button>
            </div>
          </div>
        </div>
      )}

      {showConfirmEnd && (
        <div className={styles.backdrop} onClick={() => setShowConfirmEnd(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>프로젝트를 마칠까요? 🍜</h3>
            <p className={styles.modalDesc}>이 작업은 되돌릴 수 없어요. 정말 마치시겠어요?</p>
            <div className={styles.modalBtns}>
              <button className={styles.modalCancel} onClick={() => setShowConfirmEnd(false)}>아직은요</button>
              <button className={styles.modalConfirm}
                onClick={() => { setShowConfirmEnd(false); setShowEndProject(true) }}>
                네, 마칠게요
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeave && (
        <div className={styles.backdrop} onClick={() => setShowLeave(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>프로젝트에서 나갈까요?</h3>
            <p className={styles.modalDesc}>나가면 다시 초대를 받아야 참여할 수 있어요. 이 작업은 되돌릴 수 없어요.</p>
            <div className={styles.modalBtns}>
              <button className={styles.modalCancel} onClick={() => setShowLeave(false)}>취소</button>
              <button
                className={styles.modalConfirm}
                style={{ background: '#E24B4A' }}
                disabled={leaveLoading}
                onClick={async () => {
                  setLeaveLoading(true)
                  try {
                    await leaveProject(project.id)
                    navigate('/home')
                  } finally {
                    setLeaveLoading(false)
                  }
                }}
              >
                {leaveLoading ? '처리 중...' : '나가기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEndProject && (
        <div className={styles.backdrop} onClick={() => setShowEndProject(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>🏁 프로젝트 마무리</h3>
            <p className={styles.modalDesc}>마무리 후 팀원들이 회고와 피드백을 남길 수 있어요</p>
            <label className={styles.modalCheckRow}>
              <input type="checkbox" checked={endCollectFeedback}
                onChange={(e) => setEndCollectFeedback(e.target.checked)} />
              <span>팀원 피드백 수집하기</span>
            </label>
            {endCollectFeedback && (
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>피드백 수집 기간</label>
                <select className={styles.modalSelect} value={endFeedbackDuration}
                  onChange={(e) => setEndFeedbackDuration(Number(e.target.value))}>
                  <option value={0.5}>12시간</option>
                  <option value={1}>1일</option>
                  <option value={3}>3일</option>
                  <option value={5}>5일</option>
                  <option value={7}>7일</option>
                  <option value={14}>14일</option>
                </select>
              </div>
            )}
            {endError && <p style={{ color: 'var(--coral)', fontSize: 13, margin: '4px 0 0' }}>{endError}</p>}
            <div className={styles.modalBtns}>
              <button className={styles.modalCancel} onClick={() => setShowEndProject(false)}>취소</button>
              <button className={styles.modalConfirm} disabled={endSubmitting}
                onClick={async () => {
                  setEndSubmitting(true)
                  setEndError('')
                  try {
                    await endProject(project.id, { collectFeedback: endCollectFeedback, feedbackDuration: endFeedbackDuration })
                    setShowEndProject(false)
                    navigate(`/project/${project.id}/wrapup`)
                  } catch (e) {
                    const msg = e?.code === 'permission-denied'
                      ? 'Firestore 권한 오류 — Firebase 콘솔에서 wrapups 규칙을 추가해주세요'
                      : `오류: ${e?.message || '알 수 없는 오류'}`
                    setEndError(msg)
                    console.error('endProject 오류:', e)
                  } finally {
                    setEndSubmitting(false)
                  }
                }}>
                {endSubmitting ? '처리 중...' : '마무리하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {profileMember && (
        <div className={styles.backdrop} onClick={() => setProfileMember(null)}>
          <div className={styles.profileModal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.profileClose} onClick={() => setProfileMember(null)}>✕</button>
            <div className={styles.profileAvatar}>{profileMember.name.charAt(0)}</div>
            <h3 className={styles.profileName}>{profileMember.name}</h3>
            <span className={styles.profileRole}>{ROLE_LABEL[profileMember.role]}</span>
            <div className={styles.profileInfo}>
              {profileMember.affiliation && (
                <div className={styles.profileRow}>
                  <span className={styles.profileKey}>소속</span>
                  <span className={styles.profileVal}>{profileMember.affiliation}</span>
                </div>
              )}
              {profileMember.email && (
                <div className={styles.profileRow}>
                  <span className={styles.profileKey}>이메일</span>
                  <span className={styles.profileVal}>{profileMember.email}</span>
                </div>
              )}
              {profileMember.memo && (
                <div className={styles.profileRow}>
                  <span className={styles.profileKey}>역할</span>
                  <span className={styles.profileVal}>"{profileMember.memo}"</span>
                </div>
              )}
            </div>
            {profileMember.id !== currentUser.id && (
              <button className={styles.dmBtn} onClick={() => handleDm(profileMember)}>
                💬 1:1 대화하기
              </button>
            )}
          </div>
        </div>
      )}

      {/* 커버 이미지 피커 모달 */}
      {showCoverPicker && (
        <div className={styles.backdrop} onClick={() => setShowCoverPicker(false)}>
          <div className={styles.coverPickerModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.coverPickerHeader}>
              <span className={styles.modalTitle}>커버 이미지</span>
              <button className={styles.profileClose} onClick={() => setShowCoverPicker(false)}>✕</button>
            </div>
            <p className={styles.modalDesc}>그라데이션 프리셋을 고르거나 직접 이미지를 업로드하세요</p>
            <div className={styles.coverPresetGrid}>
              {COVER_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={`${styles.coverPresetSwatch} ${project.coverImage === p.id ? styles.coverPresetActive : ''}`}
                  style={{ background: p.gradient }}
                  onClick={() => { setCoverImage(projectId, p.id); setShowCoverPicker(false) }}
                  title={p.label}
                />
              ))}
            </div>
            <div className={styles.coverPickerActions}>
              <button
                className={styles.modalCancel}
                onClick={() => coverFileRef.current.click()}
                disabled={coverUploading}
              >
                {coverUploading ? '업로드 중...' : '📁 이미지 업로드'}
              </button>
              {project.coverImage && (
                <button
                  className={styles.modalCancel}
                  onClick={() => { setCoverImage(projectId, null); setShowCoverPicker(false) }}
                >
                  🗑 제거
                </button>
              )}
            </div>
            <input ref={coverFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverUpload} />
          </div>
        </div>
      )}

      {/* 프로젝트 설정 모달 */}
      {showSettings && (
        <div className={styles.backdrop} onClick={() => !settingSaving && setShowSettings(false)}>
          <div className={styles.settingsModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>프로젝트 설정</h2>
              <button className={styles.closeBtn} onClick={() => !settingSaving && setShowSettings(false)}>✕</button>
            </div>
            <div className={styles.settingsBody}>
              <div className={styles.settingsField}>
                <label className={styles.settingsLabel}>이모지</label>
                <div className={styles.emojiGrid}>
                  {['📁','📚','💼','🎓','🏫','💡','🚀','🎯','🎨','🎬','🎵','⚽','🏀','🏃','✈️','🌱','🍕','☕','🐶','🌸','🌟','🔥','💎','🎮','📱','💻','🛠️','📝','📊','🗓️','🎉','🐱'].map((e) => (
                    <button key={e} className={`${styles.emojiBtn} ${settingEmoji === e ? styles.emojiBtnActive : ''}`}
                      onClick={() => setSettingEmoji(e)}>{e}</button>
                  ))}
                </div>
              </div>
              <div className={styles.settingsField}>
                <label className={styles.settingsLabel}>프로젝트 이름 *</label>
                <input className={styles.settingsInput} value={settingName}
                  onChange={(e) => setSettingName(e.target.value)} placeholder="프로젝트 이름" />
              </div>
              <div className={styles.settingsField}>
                <label className={styles.settingsLabel}>소개</label>
                <input className={styles.settingsInput} value={settingPurpose}
                  onChange={(e) => setSettingPurpose(e.target.value)} placeholder="한 줄 소개" />
              </div>
              <div className={styles.settingsDateRow}>
                <div className={styles.settingsField}>
                  <label className={styles.settingsLabel}>시작일</label>
                  <input className={styles.settingsInput} type="date" value={settingStart}
                    onChange={(e) => setSettingStart(e.target.value)} />
                </div>
                <div className={styles.settingsField}>
                  <label className={styles.settingsLabel}>종료일</label>
                  <input className={styles.settingsInput} type="date" value={settingEnd}
                    onChange={(e) => setSettingEnd(e.target.value)} />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCancel} onClick={() => setShowSettings(false)} disabled={settingSaving}>취소</button>
              <button className={styles.modalSave} onClick={handleSaveSettings} disabled={settingSaving}>
                {settingSaving ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.headerCard}>
        {/* 커버 이미지 스트립 — 설정된 경우만 표시 */}
        {project.coverImage && (
          <div className={styles.headerCover} style={getCoverStyle(project)}>
            {isLeader && (
              <button className={styles.coverEditBtn} onClick={() => setShowCoverPicker(true)} title="커버 이미지 변경">
                ✏️ 변경
              </button>
            )}
          </div>
        )}
        <div className={styles.headerTop}>
          <div className={styles.headerLeft}>
            <span className={styles.categoryBadge}>{project.category}</span>
            {/* 커버 없을 때만 이름 표시 (커버에 이모지가 있으므로) */}
            <h1 className={styles.projectName}>
              {project.emoji && <span style={{ marginRight: 8 }}>{project.emoji}</span>}
              {project.name}
            </h1>
            <p className={styles.projectPurpose}>{project.purpose}</p>
          </div>
          <div className={styles.headerRight}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {isLeader && !project.coverImage && (
                <button className={styles.addCoverBtn} onClick={() => setShowCoverPicker(true)} title="커버 이미지 추가">
                  🖼
                </button>
              )}
              {isLeader && (
                <button className={styles.addCoverBtn} onClick={openSettings} title="프로젝트 설정">
                  ⚙️
                </button>
              )}
              <span className={`${styles.ddayBadge} ${dday === '기한 초과' ? styles.ddayExpired : dday === 'D-day' ? styles.ddayToday : ''}`}>{dday}</span>
            </div>
            <div className={styles.progressWrap}>
              <div className={styles.progressInfo}>
                <span className={styles.progressLabel}>기간 진행률</span>
                <span className={styles.progressValue}>{progress}%</span>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progress}%`, background: progress >= 80 ? '#E24B4A' : progress >= 50 ? '#BA7517' : 'var(--primary)' }} />
              </div>
            </div>
          </div>
        </div>
        <div className={styles.headerMeta}>
          <span>📅 {project.startDate} ~ {project.endDate}</span>
          <span className={styles.dot}>·</span>
          <span>👥 {project.members.length}명</span>
          <span className={styles.dot}>·</span>
          <span>💬 {visibleRooms.length}개 채팅방</span>
        </div>
        {expired && isLeader && project.status === 'active' && (
          <div className={styles.expiredBar}>
            <span>기한이 만료됐어요</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={styles.expiredArchive} onClick={() => setShowEndProject(true)}>프로젝트 마치기 🍜</button>
              <button className={styles.expiredExtend} onClick={() => setShowExtend(true)}>연장하기</button>
            </div>
          </div>
        )}
        {!expired && isLeader && project.status === 'active' && (
          <div className={styles.earlyEndBar}>
            <button className={styles.earlyEndBtn} onClick={() => setShowConfirmEnd(true)}>
              프로젝트 마치기 🍜
            </button>
          </div>
        )}
        {(project.status === 'collecting' || project.status === 'archived') && (
          <div className={styles.wrapupBar}>
            <span>
              {project.status === 'collecting'
                ? `📬 피드백 수집 중 · 마감: ${project.feedbackDeadline?.slice(0, 10) || ''}`
                : '✅ 프로젝트가 완료됐어요'}
            </span>
            <button className={styles.wrapupBtn} onClick={() => navigate(`/project/${project.id}/wrapup`)}>
              랩업 보기 →
            </button>
          </div>
        )}
      </div>

      <div className={styles.tabs}>
        {TABS.map(([key, label]) => (
          <button key={key}
            className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`}
            onClick={() => { if (key === 'manage') initManage(); setBoardView('list'); setTab(key) }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'rooms' && (
        <div className={styles.section}>
          <p className={styles.hint}>드래그해서 순서를 바꿀 수 있어요</p>
          <div className={styles.roomList}>
            {(dragOrder || visibleRooms).map((room, i) => {
              const unread = formatUnread(room.unread || 0)
              return (
                <div key={room.id}
                  className={`${styles.roomCard} ${dragIdx === i ? styles.roomCardDragging : ''}`}
                  draggable onDragStart={() => handleDragStart(i)} onDragOver={(e) => handleDragOver(e, i)} onDragEnd={handleDragEnd}
                  onClick={() => navigate(`/project/${projectId}/chat/${room.id}`)}>
                  <div className={styles.dragHandle}>⠿</div>
                  <div className={styles.roomIcon} style={{ background: room.colorBg, color: room.color }}>
                    {room.isDm ? '💬' : `#${room.name.charAt(0)}`}
                  </div>
                  <div className={styles.roomBody}>
                    <div className={styles.roomTop}>
                      <span className={styles.roomName}>{room.isDm ? room.name : `# ${room.name}`}</span>
                      {unread > 0 ? <span className={styles.unreadBadge}>{unread}</span> : <span className={styles.roomTime}>{room.time}</span>}
                    </div>
                    <span className={styles.roomLast}>{room.lastMessage}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {iCanManage && (
            <div className={styles.addRoomWrap}>
              {showAddRoom ? (
                <div className={styles.addRoomForm}>
                  <input
                    className={styles.addRoomInput}
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="채팅방 이름을 입력하세요"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddRoom()
                    }}
                  />
                  <button className={styles.addRoomConfirm} onClick={handleAddRoom}>추가</button>
                  <button className={styles.addRoomCancel} onClick={() => { setShowAddRoom(false); setNewRoomName('') }}>취소</button>
                </div>
              ) : (
                <button className={styles.addRoomTrigger} onClick={() => setShowAddRoom(true)}>
                  + 팀 채팅방 추가
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'board' && (
        <div className={styles.section}>
          {boardView === 'list' && (
            <>
              <div className={styles.boardToolbar}>
                <div>
                  <h3 className={styles.boardTitle}>게시판</h3>
                  <p className={styles.boardDesc}>모든 팀원이 글을 작성할 수 있어요</p>
                </div>
                <button className={styles.writeBtn}
                  onClick={() => { setBoardView('write'); setAnnTitle(''); setAnnContent(''); setAnnIsGlobal(false); setAnnFile(null) }}>
                  ✏️ 글쓰기
                </button>
              </div>

              {project.announcements.length === 0 ? (
                <div className={styles.boardEmpty}>
                  <div className={styles.boardEmptyIcon}>📋</div>
                  <p className={styles.boardEmptyTitle}>아직 게시글이 없어요</p>
                  <p className={styles.boardEmptySub}>첫 번째 글을 작성해보세요</p>
                  <button className={styles.writeBtn} style={{ marginTop: 12 }}
                    onClick={() => { setBoardView('write'); setAnnTitle(''); setAnnContent(''); setAnnIsGlobal(false); setAnnFile(null) }}>
                    ✏️ 첫 글 쓰기
                  </button>
                </div>
              ) : (
                <div className={styles.boardList}>
                  {project.announcements.map((ann) => (
                    <div key={ann.id}
                      className={`${styles.boardCard} ${ann.isGlobal ? styles.boardCardNotice : ''}`}
                      onClick={() => { setSelectedAnn(ann); setBoardView('detail') }}>
                      <div className={styles.boardCardLeft}>
                        {ann.isGlobal
                          ? <span className={styles.noticeBadge}>📢 공지</span>
                          : <span className={styles.normalBadge}>일반</span>
                        }
                        <div className={styles.boardCardInfo}>
                          <span className={styles.boardCardTitle}>{ann.title}</span>
                          <span className={styles.boardCardPreview}>{ann.content.slice(0, 60)}{ann.content.length > 60 ? '...' : ''}</span>
                        </div>
                      </div>
                      <div className={styles.boardCardRight}>
                        {ann.fileName && <span className={styles.fileChip}>📎 파일</span>}
                        <span className={styles.boardCardAuthor}>{ann.author}</span>
                        <span className={styles.boardCardDate}>{ann.createdAt}</span>
                        <span className={styles.boardCardArrow}>›</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {boardView === 'write' && (
            <div className={styles.writeWrap}>
              <div className={styles.writeHeader}>
                <button className={styles.backBtn} onClick={() => setBoardView('list')}>← 목록으로</button>
                <h3 className={styles.writeTitle}>새 게시글</h3>
              </div>
              <div className={styles.writeForm}>
                {isLeader && (
                  <div className={styles.writeTypeRow}>
                    <button type="button"
                      className={`${styles.typeBtn} ${!annIsGlobal ? styles.typeBtnActive : ''}`}
                      onClick={() => setAnnIsGlobal(false)}>📝 일반 게시글</button>
                    <button type="button"
                      className={`${styles.typeBtn} ${annIsGlobal ? styles.typeBtnActiveNotice : ''}`}
                      onClick={() => setAnnIsGlobal(true)}>📢 전체 공지</button>
                    {annIsGlobal && <span className={styles.noticeHint}>모든 채팅방에 알림이 가요</span>}
                  </div>
                )}
                <div className={styles.writeField}>
                  <label className={styles.writeLabel}>제목 *</label>
                  <input className={styles.writeInput} value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)} placeholder="제목을 입력하세요" autoFocus />
                </div>
                <div className={styles.writeField}>
                  <label className={styles.writeLabel}>내용 *</label>
                  <textarea className={styles.writeTextarea} value={annContent}
                    onChange={(e) => setAnnContent(e.target.value)} placeholder="내용을 입력하세요..." rows={10} />
                </div>
                <div className={styles.writeBottom}>
                  <button className={styles.attachBtn} onClick={() => fileRef.current.click()}>
                    📎 {annFile ? annFile.name : '파일 첨부'}
                  </button>
                  <input ref={fileRef} type="file" style={{ display: 'none' }}
                    onChange={(e) => setAnnFile(e.target.files[0])} />
                  {annFile && <button className={styles.attachRemove} onClick={() => setAnnFile(null)}>✕</button>}
                  <div style={{ flex: 1 }} />
                  <button className={styles.cancelBtn} onClick={() => setBoardView('list')}>취소</button>
                  <button className={styles.submitBtn} onClick={handleWriteAnn}
                    disabled={!annTitle.trim() || !annContent.trim()}>게시하기</button>
                </div>
              </div>
            </div>
          )}

          {boardView === 'detail' && selectedAnn && (
            <div className={styles.detailWrap}>
              <button className={styles.backBtn} onClick={() => setBoardView('list')}>← 목록으로</button>
              <div className={styles.detailCard}>
                <div className={styles.detailHeader}>
                  {selectedAnn.isGlobal && <span className={styles.noticeBadge}>📢 공지</span>}
                  <h2 className={styles.detailTitle}>{selectedAnn.title}</h2>
                  <div className={styles.detailMeta}>
                    <div className={styles.detailAuthorAvatar}>{selectedAnn.author.charAt(0)}</div>
                    <span className={styles.detailAuthor}>{selectedAnn.author}</span>
                    <span className={styles.dot}>·</span>
                    <span className={styles.detailDate}>{selectedAnn.createdAt}</span>
                  </div>
                </div>
                <div className={styles.detailDivider} />
                <div className={styles.detailContent}>{selectedAnn.content}</div>
                {selectedAnn.fileName && (
                  <div className={styles.detailFile}>
                    <span>📎</span><span>{selectedAnn.fileName}</span>
                  </div>
                )}
                {(selectedAnn.authorId === currentUser.id || isLeader) && (
                  <div className={styles.detailActions}>
                    <button className={styles.deleteBtn}
                      onClick={() => { deleteAnnouncement(project.id, selectedAnn.id); setBoardView('list') }}>
                      🗑️ 삭제하기
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'todo' && (() => {
        const now = new Date()
        const monday = new Date(now)
        monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
        const weekKey = monday.toISOString().split('T')[0]
        const thisWeekGoal = (project.weeklyGoals || []).find((g) => g.week === weekKey)
        const schedule = project.weeklyGoalSchedule

        return (
          <div className={styles.section}>
            {/* 주간 목표 */}
            <div className={styles.weeklyGoalBox}>
              <div className={styles.weeklyGoalHeader}>
                <div>
                  <span className={styles.weeklyGoalTitle}>이번 주 목표</span>
                  {schedule && (
                    <span className={styles.weeklyGoalSchedule}>
                      매주 {schedule.day} {schedule.time}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {isLeader && (
                    <button className={styles.weeklyGoalBtn} onClick={() => {
                      setScheduleDay(schedule?.day || '월')
                      setScheduleTime(schedule?.time || '09:00')
                      setShowScheduleForm((v) => !v)
                    }}>일정 설정</button>
                  )}
                  {isLeader && (
                    <button className={styles.weeklyGoalBtn} onClick={() => {
                      setGoalText(thisWeekGoal?.text || '')
                      setShowGoalForm((v) => !v)
                    }}>
                      {thisWeekGoal ? '수정' : '+ 목표 작성'}
                    </button>
                  )}
                </div>
              </div>
              {showScheduleForm && isLeader && (
                <div className={styles.scheduleForm}>
                  <select className={styles.scheduleSelect} value={scheduleDay} onChange={(e) => setScheduleDay(e.target.value)}>
                    {['월', '화', '수', '목', '금', '토', '일'].map((d) => <option key={d}>{d}</option>)}
                  </select>
                  <input className={styles.scheduleTime} type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                  <button className={styles.weeklyGoalSave} onClick={() => {
                    setWeeklyGoalSchedule(project.id, { day: scheduleDay, time: scheduleTime })
                    setShowScheduleForm(false)
                  }}>저장</button>
                </div>
              )}
              {showGoalForm && isLeader && (
                <div className={styles.goalForm}>
                  <textarea className={styles.goalTextarea} value={goalText} onChange={(e) => setGoalText(e.target.value)} placeholder="이번 주 팀 목표를 입력하세요" rows={3} />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className={styles.weeklyGoalBtn} onClick={() => setShowGoalForm(false)}>취소</button>
                    <button className={styles.weeklyGoalSave} onClick={() => {
                      if (goalText.trim()) addWeeklyGoal(project.id, goalText.trim())
                      setShowGoalForm(false)
                    }}>저장</button>
                  </div>
                </div>
              )}
              {thisWeekGoal ? (
                <p className={styles.goalContent}>{thisWeekGoal.text}</p>
              ) : (
                <p className={styles.goalEmpty}>아직 이번 주 목표가 없어요{isLeader ? ' — 위에서 작성해보세요' : ''}</p>
              )}
            </div>

            <TodoBoard project={project} currentUser={currentUser} />
          </div>
        )
      })()}

      {tab === 'calendar' && (
        <div className={styles.section}>
          <CalendarInline project={project} currentUser={currentUser} />
        </div>
      )}

      {tab === 'milestone' && (
        <div className={styles.section}>
          {/* 마일스톤 추가 폼 */}
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

          {/* 타임라인 */}
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
                const doneCount = milestones.filter((m) => m.status === 'done').length
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
      )}

      {tab === 'members' && (
        <div className={styles.section}>
          <p className={styles.hint}>멤버를 클릭하면 프로필을 볼 수 있어요</p>
          <div className={styles.memberGrid}>
            {project.members.map((m) => (
              <div key={m.id} className={styles.memberCard} onClick={() => setProfileMember(m)}>
                <div className={styles.memberAvatar}>{m.name.charAt(0)}</div>
                <div className={styles.memberInfo}>
                  <p className={styles.memberName}>
                    {m.name}
                    {m.id === currentUser.id && <span className={styles.meTag}>나</span>}
                  </p>
                  <p className={styles.memberRole}>{ROLE_LABEL[m.role]}</p>
                  {m.affiliation && <p className={styles.memberAffil}>{m.affiliation}</p>}
                  {m.memo && <p className={styles.memberMemo}>"{m.memo}"</p>}
                </div>
                <span className={styles.memberArrow}>›</span>
              </div>
            ))}
          </div>

          {canInvite && <div className={styles.inviteSection}>
            <div className={styles.inviteSectionHeader}>
              <p className={styles.inviteSectionTitle}>팀원 초대</p>
            </div>

            {/* 링크 초대 */}
            <div className={styles.inviteBlock}>
              <p className={styles.inviteBlockLabel}>링크 공유</p>
              <div className={styles.inviteLinkRow}>
                <div className={styles.inviteLinkBox}>
                  <span className={styles.inviteLinkText}>{inviteLink}</span>
                </div>
                <button className={`${styles.copyBtn} ${inviteCopied ? styles.copyBtnDone : ''}`}
                  onClick={handleCopyInvite}>
                  {inviteCopied ? '✅ 복사됨' : '🔗 복사'}
                </button>
              </div>
            </div>

            {/* 커넥트 직접 초대 */}
            {(() => {
              const memberIds = new Set(project.members.map((m) => m.id))
              const invitable = connects.filter((c) => !memberIds.has(c.id) && !(blockedUsers || []).includes(c.id))
              if (invitable.length === 0) return null
              return (
                <div className={styles.inviteBlock}>
                  <p className={styles.inviteBlockLabel}>커넥트 초대</p>
                  <div className={styles.connectInviteList}>
                    {invitable.map((c) => {
                      const state = sentInvites[c.id]
                      return (
                        <div key={c.id} className={styles.connectInviteRow}>
                          <div className={styles.connectInviteAvatar}>{c.name.charAt(0)}</div>
                          <div className={styles.connectInviteInfo}>
                            <p className={styles.connectInviteName}>{c.name}</p>
                            {c.affiliation && <p className={styles.connectInviteAff}>{c.affiliation}</p>}
                          </div>
                          <button
                            className={`${styles.connectInviteBtn} ${state === 'sent' ? styles.connectInviteBtnDone : ''}`}
                            onClick={() => handleDirectInvite(c)}
                            disabled={!!state}>
                            {state === 'sending' ? '...' : state === 'sent' ? '✅ 전송됨' : state === 'error' ? '오류' : '초대'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>}

          {!isLeader && (
            <button className={styles.leaveBtn} onClick={() => setShowLeave(true)}>
              프로젝트 나가기
            </button>
          )}
        </div>
      )}

      {tab === 'guide' && isLeader && (
        <div className={styles.section}>
          <div className={styles.guideHeader}>
            <h2 className={styles.guideTitle}>리더 운영 가이드</h2>
            <p className={styles.guideSubtitle}>리더만 볼 수 있어요. 처음 운영이라면 여기서 시작하세요.</p>
          </div>

          <div className={styles.guideCard}>
            <div className={styles.guideCardTitle}>📢 공지하기</div>
            <p className={styles.guideCardBody}>
              게시판 탭 → 글쓰기 → <b>전체 공지</b> 선택<br />
              등록하면 모든 채팅방에 알림 메시지가 자동으로 전송돼요.
            </p>
            <button className={styles.guideShortcut} onClick={() => { setBoardView('write'); setAnnIsGlobal(true); setTab('board') }}>
              지금 공지 작성하기 →
            </button>
          </div>

          <div className={styles.guideCard}>
            <div className={styles.guideCardTitle}>👥 팀원 초대 & 방출</div>
            <p className={styles.guideCardBody}>
              <b>초대</b> — 멤버 탭 → '팀원 초대' 섹션에서 링크를 복사하거나, 커넥트에 있는 사람을 직접 초대할 수 있어요.<br />
              <b>방출</b> — 권한 관리 탭 → 해당 멤버 카드의 방출 버튼. 방출된 멤버는 다시 초대를 받아야 참여할 수 있어요.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={styles.guideShortcut} onClick={() => setTab('members')}>초대하러 가기 →</button>
              <button className={styles.guideShortcut} onClick={() => { initManage(); setTab('manage') }}>권한 관리로 가기 →</button>
            </div>
          </div>

          <div className={styles.guideCard}>
            <div className={styles.guideCardTitle}>⭐ 부리더 임명하기</div>
            <p className={styles.guideCardBody}>
              권한 관리 탭 → 역할 선택란에서 <b>부리더</b>로 변경 → 저장하기
            </p>
            <div className={styles.guideRoleTable}>
              <div className={styles.guideRoleRow}>
                <span className={styles.guideRoleLabel}>부리더가 할 수 있는 것</span>
                <div className={styles.guideRoleTags}>
                  {['팀원 초대', '채팅방 추가', '게시판 글 작성', '할 일 생성·수정·삭제'].map((t) => (
                    <span key={t} className={styles.guideTagCan}>{t}</span>
                  ))}
                </div>
              </div>
              <div className={styles.guideRoleRow}>
                <span className={styles.guideRoleLabel}>리더만 할 수 있는 것</span>
                <div className={styles.guideRoleTags}>
                  {['전체 공지', '팀원 방출', '역할 변경', '리더 양도', '프로젝트 마무리'].map((t) => (
                    <span key={t} className={styles.guideTagCant}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.guideCard}>
            <div className={styles.guideCardTitle}>🔒 채팅방 접근 권한 설정</div>
            <p className={styles.guideCardBody}>
              권한 관리 탭 → 멤버 카드 하단 <b>접근 가능한 채팅방</b> 체크박스로 채팅방별 접근을 제어할 수 있어요.<br />
              부리더는 모든 채팅방에 자동으로 접근돼요.
            </p>
          </div>

          <div className={styles.guideCard}>
            <div className={styles.guideCardTitle}>🎖 리더 양도하기</div>
            <p className={styles.guideCardBody}>
              권한 관리 탭 → 해당 멤버 카드 → <b>리더 양도</b> 버튼<br />
              양도 후엔 내가 일반 팀원 역할이 돼요. 신중하게 결정해주세요.
            </p>
          </div>

          <div className={styles.guideCard}>
            <div className={styles.guideCardTitle}>🏁 프로젝트 마무리</div>
            <p className={styles.guideCardBody}>
              상단 헤더의 <b>프로젝트 마치기</b>를 누르면 랩업(회고·피드백)을 진행할 수 있어요.<br />
              팀원들이 피드백을 작성할 기간을 설정하고, 기한이 지나면 자동으로 아카이브돼요.
            </p>
          </div>
        </div>
      )}

      {tab === 'manage' && iCanManage && (
        <div className={styles.section}>
          <div className={styles.manageTopRow}>
            <p className={styles.hint}>변경 후 저장 버튼을 눌러야 적용돼요</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {saveMsg && <span className={styles.saveMsg}>{saveMsg}</span>}
              <button className={styles.saveBtn} onClick={saveManage}>저장하기</button>
            </div>
          </div>
          <div className={styles.manageList}>
            {project.members.filter((m) => m.id !== currentUser.id).map((m) => {
              const curRole  = pendingRoles[m.id] ?? m.role
              const curRooms = pendingRooms[m.id] ?? m.roomIds
              return (
                <div key={m.id} className={styles.manageCard}>
                  <div className={styles.manageTop}>
                    <div className={styles.memberAvatar}>{m.name.charAt(0)}</div>
                    <div className={styles.memberInfo}>
                      <p className={styles.memberName}>{m.name}</p>
                      {m.affiliation && <p className={styles.memberAffil}>{m.affiliation}</p>}
                    </div>
                    <div className={styles.manageRight}>
                      <select className={styles.roleSelect} value={curRole}
                        onChange={(e) => setPendingRoles((prev) => ({ ...prev, [m.id]: e.target.value }))}>
                        <option value="sub-leader">⭐ 부리더</option>
                        <option value="member">팀원</option>
                      </select>
                      {isLeader && (
                        <button className={styles.transferBtn}
                          onClick={() => { if (window.confirm(`${m.name} 님에게 리더를 양도할까요?`)) transferLeader(project.id, m.id) }}>
                          리더 양도
                        </button>
                      )}
                      {isLeader && (
                        <button className={styles.kickBtn}
                          onClick={() => { if (window.confirm(`${m.name} 님을 프로젝트에서 방출할까요?`)) kickMember(project.id, m.id) }}>
                          방출
                        </button>
                      )}
                    </div>
                  </div>
                  {curRole === 'member' && (
                    <div className={styles.roomAssign}>
                      <p className={styles.roomAssignLabel}>접근 가능한 채팅방</p>
                      <div className={styles.roomAssignList}>
                        {project.rooms.filter((r) => !r.isDm).map((r) => {
                          const checked = curRooms.includes(r.id)
                          return (
                            <label key={r.id}
                              className={`${styles.roomChip} ${checked ? styles.roomChipOn : ''}`}
                              style={checked ? { borderColor: r.color, background: r.colorBg, color: r.color } : {}}>
                              <input type="checkbox" checked={checked} onChange={() => {
                                const next = checked ? curRooms.filter((x) => x !== r.id) : [...curRooms, r.id]
                                setPendingRooms((prev) => ({ ...prev, [m.id]: next }))
                              }} />
                              # {r.name}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}