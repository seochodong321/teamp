import React, { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import styles from './ProjectPage.module.css'

const ROLE_LABEL = { leader: '👑 리더', 'sub-leader': '⭐ 부리더', member: '팀원' }
const ROOM_COLORS = [
  { color: '#534AB7', colorBg: '#EEEDFE' },
  { color: '#0F6E56', colorBg: '#E1F5EE' },
  { color: '#993C1D', colorBg: '#FAECE7' },
  { color: '#185FA5', colorBg: '#E6F1FB' },
  { color: '#854F0B', colorBg: '#FAEEDA' },
]

export default function ProjectPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const {
    projects, currentUser,
    addAnnouncement, deleteAnnouncement,
    getProgress, getDday, getVisibleRooms, canManage,
    updateMemberRole, toggleMemberRoom, transferLeader,
    reorderRooms, archiveProject, extendProject,
    formatUnread, isExpired, getOrCreateDmRoom,
  } = useStore()

  const project = projects.find((p) => p.id === projectId)
  const [tab, setTab]             = useState('rooms')
  const [dragIdx, setDragIdx]     = useState(null)
  const [showExtend, setShowExtend] = useState(false)
  const [newEndDate, setNewEndDate] = useState('')

  // 팀 채팅방 추가
  const [showAddRoom, setShowAddRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')

  // 게시판
  const [boardView, setBoardView]   = useState('list') // 'list' | 'write' | 'detail'
  const [selectedAnn, setSelectedAnn] = useState(null)
  const [annTitle, setAnnTitle]     = useState('')
  const [annContent, setAnnContent] = useState('')
  const [annIsGlobal, setAnnIsGlobal] = useState(false)
  const [annFile, setAnnFile]       = useState(null)
  const fileRef = useRef(null)

  // 멤버 프로필 모달
  const [profileMember, setProfileMember] = useState(null)

  // 권한 관리 - 임시 저장 (저장 버튼 누를 때 적용)
  const [pendingRoles, setPendingRoles]   = useState({})
  const [pendingRooms, setPendingRooms]   = useState({})
  const [savedManage, setSavedManage]     = useState(false)

  if (!project) return <div className={styles.notFound}>프로젝트를 찾을 수 없어요</div>

  const isLeader    = project.leaderId === currentUser.id
  const iCanManage  = canManage(project, currentUser.id)
  const progress    = getProgress(project)
  const dday        = getDday(project.endDate)
  const expired     = isExpired(project.endDate)
  const visibleRooms = getVisibleRooms(project, currentUser.id)
  const today       = new Date().toISOString().split('T')[0]

  // 권한 관리 탭 열 때 현재 상태로 초기화
  const initManage = () => {
    const roles = {}
    const rooms = {}
    project.members.filter((m) => m.id !== currentUser.id).forEach((m) => {
      roles[m.id] = m.role
      rooms[m.id] = [...m.roomIds]
    })
    setPendingRoles(roles)
    setPendingRooms(rooms)
    setSavedManage(false)
  }

  // 저장 버튼
  const saveManage = () => {
    project.members.filter((m) => m.id !== currentUser.id).forEach((m) => {
      if (pendingRoles[m.id] !== m.role) updateMemberRole(project.id, m.id, pendingRoles[m.id])
      // 룸 권한 동기화
      const pending = pendingRooms[m.id] || []
      const current = m.roomIds
      project.rooms.forEach((r) => {
        const shouldHave = pending.includes(r.id)
        const has = current.includes(r.id)
        if (shouldHave !== has) toggleMemberRoom(project.id, m.id, r.id)
      })
    })
    setSavedManage(true)
    setTimeout(() => setSavedManage(false), 2000)
  }

  // 팀 채팅방 추가
  const handleAddRoom = () => {
    if (!newRoomName.trim()) return
    const colorIdx = project.rooms.filter((r) => !r.isDm).length % ROOM_COLORS.length
    const newRoom = {
      id: `room_${Date.now()}`,
      name: newRoomName.trim(),
      lastMessage: '채팅방이 생성됐어요',
      unread: 0,
      time: '방금',
      ...ROOM_COLORS[colorIdx],
    }
    // 스토어에 직접 추가
    const { projects: allProjects } = useStore.getState()
    useStore.setState({
      projects: allProjects.map((p) =>
        p.id !== projectId ? p : { ...p, rooms: [...p.rooms, newRoom] }
      ),
    })
    setNewRoomName('')
    setShowAddRoom(false)
  }

  // 게시글 작성
  const handleWriteAnn = () => {
    if (!annTitle.trim() || !annContent.trim()) return
    addAnnouncement(project.id, { title: annTitle.trim(), content: annContent.trim(), isGlobal: annIsGlobal, fileName: annFile?.name || null })
    setAnnTitle(''); setAnnContent(''); setAnnIsGlobal(false); setAnnFile(null)
    setBoardView('list')
  }

  // 1:1 채팅
  const handleDm = (member) => {
    const room = getOrCreateDmRoom(project.id, member.id, member.name)
    setProfileMember(null)
    navigate(`/project/${projectId}/chat/${room.id}`)
  }

  // 드래그
  const handleDragStart = (i) => setDragIdx(i)
  const handleDragOver  = (e, i) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i) return
    const newOrder = [...visibleRooms]
    const [moved] = newOrder.splice(dragIdx, 1)
    newOrder.splice(i, 0, moved)
    reorderRooms(project.id, newOrder.map((r) => r.id))
    setDragIdx(i)
  }
  const handleDragEnd = () => setDragIdx(null)

  const TABS = [
    ['rooms', '💬 채팅방'],
    ['board', '📋 게시판'],
    ['calendar', '📅 캘린더'],
    ['members', '👥 멤버'],
    ...(iCanManage ? [['manage', '⚙️ 권한 관리']] : []),
  ]

  return (
    <div className={styles.page}>

      {/* ── 연장 모달 ── */}
      {showExtend && (
        <div className={styles.modalBackdrop} onClick={() => setShowExtend(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>기간 연장</h3>
            <p className={styles.modalDesc}>새로운 종료일을 선택해주세요</p>
            <input className={styles.modalInput} type="date" value={newEndDate} min={today} onChange={(e) => setNewEndDate(e.target.value)} />
            <div className={styles.modalBtns}>
              <button className={styles.modalCancel} onClick={() => setShowExtend(false)}>취소</button>
              <button className={styles.modalConfirm} onClick={() => { extendProject(project.id, newEndDate); setShowExtend(false) }} disabled={!newEndDate}>연장하기</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 멤버 프로필 모달 ── */}
      {profileMember && (
        <div className={styles.modalBackdrop} onClick={() => setProfileMember(null)}>
          <div className={styles.profileModal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.profileModalClose} onClick={() => setProfileMember(null)}>✕</button>
            <div className={styles.profileModalAvatar}>{profileMember.name.charAt(0)}</div>
            <h3 className={styles.profileModalName}>{profileMember.name}</h3>
            <span className={styles.profileModalRole}>{ROLE_LABEL[profileMember.role]}</span>
            <div className={styles.profileModalInfo}>
              {profileMember.affiliation && (
                <div className={styles.profileModalRow}>
                  <span className={styles.profileModalKey}>소속</span>
                  <span className={styles.profileModalVal}>{profileMember.affiliation}</span>
                </div>
              )}
              {profileMember.email && (
                <div className={styles.profileModalRow}>
                  <span className={styles.profileModalKey}>이메일</span>
                  <span className={styles.profileModalVal}>{profileMember.email}</span>
                </div>
              )}
              {profileMember.memo && (
                <div className={styles.profileModalRow}>
                  <span className={styles.profileModalKey}>역할</span>
                  <span className={styles.profileModalVal}>"{profileMember.memo}"</span>
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

      {/* ── 헤더 카드 ── */}
      <div className={styles.headerCard}>
        <div className={styles.headerTop}>
          <div className={styles.headerLeft}>
            <span className={styles.categoryBadge}>{project.category}</span>
            <h1 className={styles.projectName}>{project.name}</h1>
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
          <span className={styles.metaDot}>·</span>
          <span>👥 {project.members.length}명</span>
          <span className={styles.metaDot}>·</span>
          <span>💬 {visibleRooms.length}개 채팅방</span>
        </div>
        {expired && isLeader && (
          <div className={styles.expiredBar}>
            <span>기한이 만료됐어요</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={styles.expiredArchive} onClick={() => archiveProject(project.id)}>종료하기</button>
              <button className={styles.expiredExtend} onClick={() => setShowExtend(true)}>연장하기</button>
            </div>
          </div>
        )}
      </div>

      {/* ── 탭 ── */}
      <div className={styles.tabs}>
        {TABS.map(([key, label]) => (
          <button key={key}
            className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`}
            onClick={() => {
              if (key === 'calendar') { navigate(`/project/${projectId}/calendar`); return }
              if (key === 'manage') initManage()
              setTab(key)
              setBoardView('list')
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── 채팅방 ── */}
      {tab === 'rooms' && (
        <div className={styles.section}>
          <p className={styles.sectionHint}>드래그해서 순서를 바꿀 수 있어요</p>
          <div className={styles.roomList}>
            {visibleRooms.map((room, i) => {
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
            <>
              {showAddRoom ? (
                <div className={styles.addRoomForm}>
                  <input className={styles.addRoomInput} value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="팀 채팅방 이름" onKeyDown={(e) => e.key === 'Enter' && handleAddRoom()} autoFocus />
                  <button className={styles.addRoomConfirm} onClick={handleAddRoom}>추가</button>
                  <button className={styles.addRoomCancel} onClick={() => { setShowAddRoom(false); setNewRoomName('') }}>취소</button>
                </div>
              ) : (
                <button className={styles.addRoom} onClick={() => setShowAddRoom(true)}>+ 팀 채팅방 추가</button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── 게시판 ── */}
      {tab === 'board' && (
        <div className={styles.section}>
          {/* 목록 */}
          {boardView === 'list' && (
            <>
              <div className={styles.boardHeader}>
                <p className={styles.boardDesc}>모든 팀원이 글을 작성할 수 있어요</p>
                <button className={styles.writeBtn} onClick={() => { setBoardView('write'); setAnnTitle(''); setAnnContent(''); setAnnIsGlobal(false); setAnnFile(null) }}>
                  ✏️ 글쓰기
                </button>
              </div>
              {project.announcements.length === 0 && (
                <div className={styles.emptyState}>
                  <p className={styles.emptyIcon}>📋</p>
                  <p>아직 게시글이 없어요</p>
                  <p className={styles.emptySub}>첫 번째 글을 작성해보세요</p>
                </div>
              )}
              <div className={styles.boardList}>
                {project.announcements.map((ann, i) => (
                  <div key={ann.id} className={`${styles.boardRow} ${ann.isGlobal ? styles.boardRowGlobal : ''}`}
                    onClick={() => { setSelectedAnn(ann); setBoardView('detail') }}>
                    <div className={styles.boardRowLeft}>
                      {ann.isGlobal && <span className={styles.globalBadge}>📢 공지</span>}
                      <span className={styles.boardRowTitle}>{ann.title}</span>
                      {ann.fileName && <span className={styles.boardRowFile}>📎</span>}
                    </div>
                    <div className={styles.boardRowRight}>
                      <span className={styles.boardRowAuthor}>{ann.author}</span>
                      <span className={styles.boardRowDate}>{ann.createdAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 글쓰기 */}
          {boardView === 'write' && (
            <div className={styles.writeForm}>
              <div className={styles.writeFormHeader}>
                <button className={styles.backBtn} onClick={() => setBoardView('list')}>← 목록으로</button>
                <h3 className={styles.writeFormTitle}>새 게시글</h3>
              </div>
              <div className={styles.writeField}>
                <label className={styles.writeLabel}>제목 *</label>
                <input className={styles.writeInput} value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} placeholder="제목을 입력하세요" autoFocus />
              </div>
              <div className={styles.writeField}>
                <label className={styles.writeLabel}>내용 *</label>
                <textarea className={styles.writeTextarea} value={annContent} onChange={(e) => setAnnContent(e.target.value)} placeholder="내용을 입력하세요..." rows={8} />
              </div>
              <div className={styles.writeOptions}>
                <label className={`${styles.globalLabel} ${annIsGlobal ? styles.globalLabelOn : ''}`}>
                  <input type="checkbox" checked={annIsGlobal} onChange={(e) => setAnnIsGlobal(e.target.checked)} />
                  📢 전체 공지로 등록
                </label>
                <button className={styles.attachBtn} onClick={() => fileRef.current.click()}>
                  📎 {annFile ? annFile.name : '파일 첨부'}
                </button>
                <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={(e) => setAnnFile(e.target.files[0])} />
                {annFile && <button className={styles.attachRemove} onClick={() => setAnnFile(null)}>✕</button>}
              </div>
              <div className={styles.writeBtns}>
                <button className={styles.writeCancelBtn} onClick={() => setBoardView('list')}>취소</button>
                <button className={styles.writeSubmitBtn} onClick={handleWriteAnn} disabled={!annTitle.trim() || !annContent.trim()}>등록하기</button>
              </div>
            </div>
          )}

          {/* 상세 */}
          {boardView === 'detail' && selectedAnn && (
            <div className={styles.detailWrap}>
              <button className={styles.backBtn} onClick={() => setBoardView('list')}>← 목록으로</button>
              <div className={styles.detailHeader}>
                {selectedAnn.isGlobal && <span className={styles.globalBadge}>📢 전체 공지</span>}
                <h2 className={styles.detailTitle}>{selectedAnn.title}</h2>
                <div className={styles.detailMeta}>
                  <span>{selectedAnn.author}</span>
                  <span className={styles.metaDot}>·</span>
                  <span>{selectedAnn.createdAt}</span>
                </div>
              </div>
              <div className={styles.detailContent}>{selectedAnn.content}</div>
              {selectedAnn.fileName && (
                <div className={styles.detailFile}>
                  <span>📎</span>
                  <span>{selectedAnn.fileName}</span>
                </div>
              )}
              {(selectedAnn.authorId === currentUser.id || isLeader) && (
                <button className={styles.deleteBtn} onClick={() => { deleteAnnouncement(project.id, selectedAnn.id); setBoardView('list') }}>
                  🗑️ 삭제
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 멤버 ── */}
      {tab === 'members' && (
        <div className={styles.section}>
          <p className={styles.sectionHint}>멤버를 클릭하면 프로필을 볼 수 있어요</p>
          <div className={styles.memberGrid}>
            {project.members.map((m) => (
              <div key={m.id} className={styles.memberCard} onClick={() => setProfileMember(m)} style={{ cursor: 'pointer' }}>
                <div className={styles.memberAvatar}>{m.name.charAt(0)}</div>
                <div className={styles.memberInfo}>
                  <p className={styles.memberName}>
                    {m.name}
                    {m.id === currentUser.id && <span className={styles.meTag}>나</span>}
                  </p>
                  <p className={styles.memberRole}>{ROLE_LABEL[m.role]}</p>
                  {m.affiliation && <p className={styles.memberAffiliation}>{m.affiliation}</p>}
                  {m.memo && <p className={styles.memberMemo}>"{m.memo}"</p>}
                </div>
              </div>
            ))}
          </div>
          {iCanManage && <button className={styles.inviteBtn}>+ 팀원 초대</button>}
        </div>
      )}

      {/* ── 권한 관리 ── */}
      {tab === 'manage' && iCanManage && (
        <div className={styles.section}>
          <div className={styles.manageTopRow}>
            <p className={styles.sectionHint}>설정 후 저장 버튼을 눌러야 적용돼요</p>
            <button className={`${styles.saveManageBtn} ${savedManage ? styles.saveManageBtnDone : ''}`} onClick={saveManage}>
              {savedManage ? '✓ 저장됨' : '저장하기'}
            </button>
          </div>
          <div className={styles.manageList}>
            {project.members.filter((m) => m.id !== currentUser.id).map((m) => (
              <div key={m.id} className={styles.manageCard}>
                <div className={styles.manageTop}>
                  <div className={styles.memberAvatar}>{m.name.charAt(0)}</div>
                  <div className={styles.memberInfo}>
                    <p className={styles.memberName}>{m.name}</p>
                    <p className={styles.memberRole}>{ROLE_LABEL[pendingRoles[m.id] || m.role]}</p>
                  </div>
                  <div className={styles.manageActions}>
                    <select className={styles.roleSelect} value={pendingRoles[m.id] || m.role}
                      onChange={(e) => setPendingRoles((prev) => ({ ...prev, [m.id]: e.target.value }))}>
                      <option value="leader">👑 리더</option>
                      <option value="sub-leader">⭐ 부리더</option>
                      <option value="member">팀원</option>
                    </select>
                    {isLeader && (pendingRoles[m.id] || m.role) !== 'leader' && (
                      <button className={styles.transferBtn} onClick={() => { if (window.confirm(`${m.name} 님에게 리더를 양도할까요?`)) transferLeader(project.id, m.id) }}>
                        리더 양도
                      </button>
                    )}
                  </div>
                </div>
                {(pendingRoles[m.id] || m.role) === 'member' && (
                  <div className={styles.roomAssign}>
                    <p className={styles.roomAssignLabel}>접근 가능한 채팅방</p>
                    <div className={styles.roomAssignList}>
                      {project.rooms.map((r) => {
                        const checked = (pendingRooms[m.id] || m.roomIds).includes(r.id)
                        return (
                          <label key={r.id} className={`${styles.roomAssignItem} ${checked ? styles.roomAssignItemOn : ''}`}
                            style={checked ? { borderColor: r.color, background: r.colorBg } : {}}>
                            <input type="checkbox" checked={checked}
                              onChange={() => {
                                const cur = pendingRooms[m.id] || [...m.roomIds]
                                const next = cur.includes(r.id) ? cur.filter((x) => x !== r.id) : [...cur, r.id]
                                setPendingRooms((prev) => ({ ...prev, [m.id]: next }))
                              }} />
                            <span style={checked ? { color: r.color } : {}}>{r.isDm ? '💬' : '#'} {r.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}