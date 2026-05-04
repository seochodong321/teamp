import React, { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
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
    projects, currentUser,
    addAnnouncement, deleteAnnouncement,
    getProgress, getDday, getVisibleRooms, canManage,
    updateMemberRole, setMemberRooms, transferLeader,
    reorderRooms, archiveProject, extendProject, endProject,
    formatUnread, isExpired, getOrCreateDmRoom, addRoom,
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

  const [showEndProject, setShowEndProject]     = useState(false)
  const [showConfirmEnd, setShowConfirmEnd]     = useState(false)
  const [endCollectFeedback, setEndCollectFeedback] = useState(true)
  const [endFeedbackDuration, setEndFeedbackDuration] = useState(7)
  const [endSubmitting, setEndSubmitting]       = useState(false)

  useEffect(() => {
    if (tabParam) setTab(tabParam)
  }, [tabParam])

  if (!project) return <div className={styles.notFound}>프로젝트를 찾을 수 없어요</div>

  const isLeader     = project.leaderId === currentUser.id
  const iCanManage   = canManage(project, currentUser.id)
  const progress     = getProgress(project)
  const dday         = getDday(project.endDate)
  const expired      = isExpired(project.endDate)
  const visibleRooms = getVisibleRooms(project, currentUser.id)
  const today        = new Date().toISOString().split('T')[0]
  const inviteLink   = `${window.location.origin}/join/${project.inviteCode || project.id}`

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

  const handleDm = (member) => {
    const room = getOrCreateDmRoom(project.id, member.id, member.name)
    setProfileMember(null)
    navigate(`/project/${projectId}/chat/${room.id}`)
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
    ['rooms',    '💬 채팅방'],
    ['board',    '📋 게시판'],
    ['todo',     '✅ 할 일'],
    ['calendar', '📅 캘린더'],
    ['members',  '👥 멤버'],
    ...(iCanManage ? [['manage', '⚙️ 권한 관리']] : []),
  ]

  return (
    <div className={styles.page}>

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
                  <option value={3}>3일</option>
                  <option value={5}>5일</option>
                  <option value={7}>7일</option>
                  <option value={14}>14일</option>
                </select>
              </div>
            )}
            <div className={styles.modalBtns}>
              <button className={styles.modalCancel} onClick={() => setShowEndProject(false)}>취소</button>
              <button className={styles.modalConfirm} disabled={endSubmitting}
                onClick={async () => {
                  setEndSubmitting(true)
                  await endProject(project.id, { collectFeedback: endCollectFeedback, feedbackDuration: endFeedbackDuration })
                  setEndSubmitting(false)
                  setShowEndProject(false)
                  navigate(`/project/${project.id}/wrapup`)
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

      <div className={styles.headerCard}>
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
            <span className={`${styles.ddayBadge} ${dday === '기한 초과' ? styles.ddayExpired : dday === 'D-day' ? styles.ddayToday : ''}`}>{dday}</span>
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
                ? `📬 피드백 수집 중 · 마감: ${project.feedbackDeadline || ''}`
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

      {tab === 'todo' && (
        <div className={styles.section}>
          <TodoBoard project={project} currentUser={currentUser} />
        </div>
      )}

      {tab === 'calendar' && (
        <div className={styles.section}>
          <CalendarInline project={project} currentUser={currentUser} />
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

          <div className={styles.inviteSection}>
            <div className={styles.inviteSectionHeader}>
              <p className={styles.inviteSectionTitle}>팀원 초대</p>
              <p className={styles.inviteSectionDesc}>링크를 공유하면 상대방이 직접 참여 여부를 선택해요</p>
            </div>
            <div className={styles.inviteLinkRow}>
              <div className={styles.inviteLinkBox}>
                <span className={styles.inviteLinkText}>{inviteLink}</span>
              </div>
              <button className={`${styles.copyBtn} ${inviteCopied ? styles.copyBtnDone : ''}`}
                onClick={handleCopyInvite}>
                {inviteCopied ? '✅ 복사됨' : '🔗 링크 복사'}
              </button>
            </div>
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
                    </div>
                  </div>
                  {curRole === 'member' && (
                    <div className={styles.roomAssign}>
                      <p className={styles.roomAssignLabel}>접근 가능한 채팅방</p>
                      <div className={styles.roomAssignList}>
                        {project.rooms.map((r) => {
                          const checked = curRooms.includes(r.id)
                          return (
                            <label key={r.id}
                              className={`${styles.roomChip} ${checked ? styles.roomChipOn : ''}`}
                              style={checked ? { borderColor: r.color, background: r.colorBg, color: r.color } : {}}>
                              <input type="checkbox" checked={checked} onChange={() => {
                                const next = checked ? curRooms.filter((x) => x !== r.id) : [...curRooms, r.id]
                                setPendingRooms((prev) => ({ ...prev, [m.id]: next }))
                              }} />
                              {r.isDm ? '💬' : '#'} {r.name}
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