import React, { useState, useRef, useEffect, lazy, Suspense } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import { getCoverStyle, COVER_PRESETS } from '../constants.js'
import { getDDayLabel, getPhaseBar } from '../utils/phases.js'
import CalendarInline from '../components/CalendarInline.jsx'
import TodoBoard from '../components/TodoBoard.jsx'
import RoomsTab      from './project/RoomsTab.jsx'
import BoardTab      from './project/BoardTab.jsx'
import MilestonesTab from './project/MilestonesTab.jsx'
import MembersTab    from './project/MembersTab.jsx'
import GuideTab      from './project/GuideTab.jsx'
import ManageTab     from './project/ManageTab.jsx'
import TeampMark     from '../components/TeampMark.jsx'
import ReportModal   from '../components/ReportModal.jsx'
import styles from './ProjectPage.module.css'

export default function ProjectPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const {
    projects, currentUser, connects,
    getProgress, getVisibleRooms, canManage,
    extendProject, endProject,
    isExpired, setCoverImage, updateProjectInfo, blockedUsers,
    setWeeklyGoalSchedule, addWeeklyGoal, showSuccess, showError,
  } = useStore()

  const project = projects.find((p) => p.id === projectId)
  const [tab, setTab] = useState(tabParam || 'rooms')

  // 헤더 모달 상태
  const [showExtend, setShowExtend]               = useState(false)
  const [newEndDate, setNewEndDate]               = useState('')
  const [showConfirmEnd, setShowConfirmEnd]       = useState(false)
  const [showEndProject, setShowEndProject]       = useState(false)
  const [endCollectFeedback, setEndCollectFeedback] = useState(true)
  const [endFeedbackDuration, setEndFeedbackDuration] = useState(7)
  const [endSubmitting, setEndSubmitting]         = useState(false)
  const [endError, setEndError]                   = useState('')
  const [showCoverPicker, setShowCoverPicker]     = useState(false)
  const [coverUploading, setCoverUploading]       = useState(false)
  const coverFileRef = useRef(null)
  const [showSettings, setShowSettings]         = useState(false)
  const [settingEmoji, setSettingEmoji]         = useState('')
  const [settingName, setSettingName]           = useState('')
  const [settingPurpose, setSettingPurpose]     = useState('')
  const [settingStart, setSettingStart]         = useState('')
  const [settingEnd, setSettingEnd]             = useState('')
  const [settingSaving, setSettingSaving]       = useState(false)

  // 신고
  const [showReport, setShowReport] = useState(false)

  // 게시판 탭 초기 상태 (가이드 탭 → 게시판 탭 공지 쓰기 진입 시 사용)
  const [boardKey, setBoardKey]               = useState(0)
  const [boardDefaultView, setBoardDefaultView] = useState('list')
  const [boardDefaultGlobal, setBoardDefaultGlobal] = useState(false)

  // 주간 목표 상태 (todo 탭 인라인)
  const [goalText, setGoalText]                 = useState('')
  const [showGoalForm, setShowGoalForm]         = useState(false)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [scheduleDay, setScheduleDay]           = useState('월')
  const [scheduleTime, setScheduleTime]         = useState('09:00')

  useEffect(() => {
    if (tabParam) setTab(tabParam)
  }, [tabParam])

  if (!project) return <div className={styles.notFound}>프로젝트를 찾을 수 없어요</div>

  const myRole       = project.members.find((m) => m.id === currentUser.id)?.role
  const isLeader     = myRole === 'leader'
  const canInvite    = isLeader || myRole === 'sub-leader'
  const iCanManage   = canManage(project, currentUser.id)
  const progress     = getProgress(project)
  const ddayLabel    = getDDayLabel(project)
  const phaseBar     = getPhaseBar(project)
  const expired      = isExpired(project.endDate)
  const visibleRooms = getVisibleRooms(project, currentUser.id)
  const today        = new Date().toISOString().split('T')[0]
  const inviteLink   = `${import.meta.env.VITE_APP_URL || window.location.origin}/join/${project.inviteCode || project.id}`

  const TABS = [
    ['rooms', '채팅방'],
    ['board', '게시판'],
    ['todo', '할 일'],
    ['calendar', '캘린더'],
    ['milestone', '마일스톤'],
    ['members', '멤버'],
    ...(isLeader ? [['guide', '운영 가이드']] : []),
    ...(iCanManage ? [['manage', '권한 관리']] : []),
  ]

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { showError('이미지 파일만 업로드할 수 있어요.'); e.target.value = ''; return }
    if (file.size > 5 * 1024 * 1024) { showError('이미지 크기는 5MB 이하여야 해요.'); e.target.value = ''; return }
    setCoverUploading(true)
    try {
      const sRef = storageRef(storage, `projects/${projectId}/cover.jpg`)
      await uploadBytes(sRef, file)
      const url = await getDownloadURL(sRef)
      setCoverImage(projectId, url)
      setShowCoverPicker(false)
    } finally {
      setCoverUploading(false)
    }
  }

  const openSettings = () => {
    setSettingEmoji(project.emoji || '')
    setSettingName(project.name || '')
    setSettingPurpose(project.purpose || '')
    setSettingStart(project.projectStartDate || project.startDate || '')
    setSettingEnd(project.projectEndDate || project.endDate || '')
    setShowSettings(true)
  }

  const handleSaveSettings = async () => {
    if (!settingName.trim()) return
    setSettingSaving(true)
    try {
      await updateProjectInfo(projectId, {
        emoji: settingEmoji, name: settingName.trim(),
        purpose: settingPurpose.trim(),
        startDate: settingStart, endDate: settingEnd,
        projectStartDate: settingStart, projectEndDate: settingEnd,
      })
      setShowSettings(false)
      showSuccess('프로젝트 설정이 저장됐어요.')
    } finally {
      setSettingSaving(false)
    }
  }

  return (
    <div className={styles.page}>

      {/* ─── 상단 네비게이션 ─── */}
      <div className={styles.topNav}>
        <button className={styles.topNavBack} onClick={() => navigate('/home')}>← 홈</button>
        <span className={styles.topNavLogo}><TeampMark size={22}/></span>
        <div style={{ width: 80 }} />
      </div>

      {/* ─── 헤더 모달: 기간 연장 ─── */}
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

      {/* ─── 헤더 모달: 프로젝트 마치기 확인 ─── */}
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

      {/* ─── 헤더 모달: 피드백 설정 ─── */}
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
                  setEndSubmitting(true); setEndError('')
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

      {/* ─── 커버 이미지 피커 ─── */}
      {showCoverPicker && (
        <div className={styles.backdrop} onClick={() => !coverUploading && setShowCoverPicker(false)}>
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
              <button className={styles.modalCancel} onClick={() => coverFileRef.current.click()} disabled={coverUploading}>
                {coverUploading ? '업로드 중...' : '📁 이미지 업로드'}
              </button>
              {project.coverImage && (
                <button className={styles.modalCancel}
                  onClick={() => { setCoverImage(projectId, null); setShowCoverPicker(false) }}>
                  🗑 제거
                </button>
              )}
            </div>
            <input ref={coverFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverUpload} />
          </div>
        </div>
      )}

      {/* ─── 프로젝트 설정 모달 ─── */}
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

      {/* ─── 헤더 카드 ─── */}
      <div className={styles.headerCard}>
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
            <h1 className={styles.projectName}>
              {project.emoji && <span style={{ marginRight: 8 }}>{project.emoji}</span>}
              {project.name}
            </h1>
            <p className={styles.projectPurpose}>{project.purpose}</p>
          </div>
          <div className={styles.headerRight}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {isLeader && !project.coverImage && (
                <button className={styles.addCoverBtn} onClick={() => setShowCoverPicker(true)} title="커버 이미지 추가">🖼</button>
              )}
              {isLeader && (
                <button className={styles.addCoverBtn} onClick={openSettings} title="프로젝트 설정">⚙️</button>
              )}
              <button className={styles.reportProjectBtn} onClick={() => setShowReport(true)} title="프로젝트 신고">🚩</button>
              <span className={`${styles.ddayBadge} ${styles[ddayLabel.cls] || ''}`}>
                {ddayLabel.main}
                {ddayLabel.sub && <span className={styles.ddaySub}>{ddayLabel.sub}</span>}
              </span>
            </div>
            <div className={styles.progressWrap}>
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
                  <div className={styles.progressFill} style={{ width: `${progress}%`, background: progress >= 80 ? '#E24B4A' : progress >= 50 ? '#BA7517' : 'var(--primary)' }} />
                </div>
              )}
            </div>
          </div>
        </div>
        <div className={styles.headerMeta}>
          <span>📅 {project.projectStartDate || project.startDate} ~ {project.projectEndDate || project.endDate}</span>
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

      {/* ─── 탭 바 ─── */}
      <div className={styles.tabs}>
        {TABS.map(([key, label]) => (
          <button key={key}
            className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`}
            onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {/* ─── 탭 콘텐츠 ─── */}
      {tab === 'rooms' && (
        <RoomsTab project={project} currentUser={currentUser} visibleRooms={visibleRooms} iCanManage={iCanManage} />
      )}

      {tab === 'board' && (
        <BoardTab key={boardKey} project={project} currentUser={currentUser} isLeader={isLeader}
          defaultView={boardDefaultView} defaultGlobal={boardDefaultGlobal} />
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
            <div className={styles.weeklyGoalBox}>
              <div className={styles.weeklyGoalHeader}>
                <div>
                  <span className={styles.weeklyGoalTitle}>이번 주 목표</span>
                  {schedule && <span className={styles.weeklyGoalSchedule}>매주 {schedule.day} {schedule.time}</span>}
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
                    showSuccess(`매주 ${scheduleDay} ${scheduleTime} 목표 알림이 설정됐어요.`)
                  }}>저장</button>
                </div>
              )}
              {showGoalForm && isLeader && (
                <div className={styles.goalForm}>
                  <textarea className={styles.goalTextarea} value={goalText} onChange={(e) => setGoalText(e.target.value)} placeholder="이번 주 팀 목표를 입력하세요" rows={3} />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className={styles.weeklyGoalBtn} onClick={() => setShowGoalForm(false)}>취소</button>
                    <button className={styles.weeklyGoalSave} onClick={() => {
                      if (goalText.trim()) {
                        addWeeklyGoal(project.id, goalText.trim())
                        showSuccess('이번 주 목표가 저장됐어요.')
                      }
                      setShowGoalForm(false)
                    }}>저장</button>
                  </div>
                </div>
              )}
              {thisWeekGoal
                ? <p className={styles.goalContent}>{thisWeekGoal.text}</p>
                : <p className={styles.goalEmpty}>아직 이번 주 목표가 없어요{isLeader ? ' — 위에서 작성해보세요' : ''}</p>
              }
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
        <MilestonesTab project={project} canInvite={canInvite} />
      )}

      {tab === 'members' && (
        <MembersTab
          project={project} currentUser={currentUser}
          isLeader={isLeader} canInvite={canInvite}
          connects={connects} blockedUsers={blockedUsers}
          inviteLink={inviteLink}
        />
      )}

      {tab === 'guide' && isLeader && (
        <GuideTab
          onGotoBoard={(write, global) => {
            setBoardDefaultView(write ? 'write' : 'list')
            setBoardDefaultGlobal(global || false)
            setBoardKey((k) => k + 1)
            setTab('board')
          }}
          onGotoManage={() => setTab('manage')}
          onGotoMembers={() => setTab('members')}
          onGotoMilestone={() => setTab('milestone')}
          onGotoTodo={() => setTab('todo')}
        />
      )}

      {tab === 'manage' && iCanManage && (
        <ManageTab project={project} currentUser={currentUser} isLeader={isLeader} />
      )}

      {showReport && (
        <ReportModal
          type="project"
          targetId={project.id}
          targetName={project.name}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  )
}
