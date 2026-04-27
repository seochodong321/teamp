import React, { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import styles from './ProjectPage.module.css'

const ROLE_LABEL = { leader: '👑 리더', 'sub-leader': '⭐ 부리더', member: '팀원' }

export default function ProjectPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const {
    projects, currentUser,
    addAnnouncement, deleteAnnouncement,
    getProgress, getDday, getVisibleRooms, canManage,
    updateMemberRole, toggleMemberRoom, transferLeader,
    reorderRooms, archiveProject, extendProject,
    formatUnread, isExpired,
  } = useStore()

  const project = projects.find((p) => p.id === projectId)
  const [tab, setTab]           = useState('rooms')
  const [dragIdx, setDragIdx]   = useState(null)
  const [showExtend, setShowExtend] = useState(false)
  const [newEndDate, setNewEndDate] = useState('')

  // 게시판
  const [annTitle, setAnnTitle]     = useState('')
  const [annContent, setAnnContent] = useState('')
  const [annIsGlobal, setAnnIsGlobal] = useState(false)
  const [annFile, setAnnFile]       = useState(null)
  const [showAnnForm, setShowAnnForm] = useState(false)
  const fileRef = useRef(null)

  if (!project) return <div className={styles.notFound}>프로젝트를 찾을 수 없어요</div>

  const isLeader    = project.leaderId === currentUser.id
  const iCanManage  = canManage(project, currentUser.id)
  const progress    = getProgress(project)
  const dday        = getDday(project.endDate)
  const expired     = isExpired(project.endDate)
  const visibleRooms = getVisibleRooms(project, currentUser.id)
  const today       = new Date().toISOString().split('T')[0]

  const handleAddAnn = () => {
    if (!annTitle.trim() || !annContent.trim()) return
    addAnnouncement(project.id, {
      title: annTitle.trim(),
      content: annContent.trim(),
      isGlobal: annIsGlobal,
      fileName: annFile?.name || null,
      fileUrl: null,
    })
    setAnnTitle(''); setAnnContent(''); setAnnIsGlobal(false); setAnnFile(null); setShowAnnForm(false)
  }

  const handleExtendConfirm = () => {
    if (!newEndDate) return
    extendProject(project.id, newEndDate)
    setShowExtend(false); setNewEndDate('')
  }

  const handleTransfer = (memberId) => {
    const member = project.members.find((m) => m.id === memberId)
    if (!member || !window.confirm(`${member.name} 님에게 리더를 양도할까요?`)) return
    transferLeader(project.id, memberId)
  }

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

      {/* 연장 모달 */}
      {showExtend && (
        <div className={styles.modalBackdrop} onClick={() => setShowExtend(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>프로젝트 기간 연장</h3>
            <p className={styles.modalDesc}>새로운 종료일을 선택해주세요</p>
            <input className={styles.modalDateInput} type="date" value={newEndDate} min={today}
              onChange={(e) => setNewEndDate(e.target.value)} />
            <div className={styles.modalBtns}>
              <button className={styles.modalCancel} onClick={() => setShowExtend(false)}>취소</button>
              <button className={styles.modalConfirm} onClick={handleExtendConfirm} disabled={!newEndDate}>연장하기</button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 카드 */}
      <div className={styles.headerCard}>
        <div className={styles.headerTop}>
          <div className={styles.headerLeft}>
            <span className={styles.categoryBadge}>{project.category}</span>
            <h1 className={styles.projectName}>{project.name}</h1>
            <p className={styles.projectPurpose}>{project.purpose}</p>
          </div>
          <div className={styles.headerRight}>
            <span className={`${styles.ddayBadge} ${dday === '기한 초과' ? styles.ddayExpired : dday === 'D-day' ? styles.ddayToday : ''}`}>
              {dday}
            </span>
            <div className={styles.progressWrap}>
              <div className={styles.progressInfo}>
                <span className={styles.progressLabel}>기간 진행률</span>
                <span className={styles.progressValue}>{progress}%</span>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill}
                  style={{ width: `${progress}%`, background: progress >= 80 ? '#E24B4A' : progress >= 50 ? '#BA7517' : 'var(--primary)' }} />
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
            <span>기한이 만료됐어요. 어떻게 할까요?</span>
            <div className={styles.expiredBtns}>
              <button className={styles.expiredArchive} onClick={() => archiveProject(project.id)}>종료하기</button>
              <button className={styles.expiredExtend} onClick={() => setShowExtend(true)}>연장하기</button>
            </div>
          </div>
        )}
      </div>

      {/* 탭 */}
      <div className={styles.tabs}>
        {TABS.map(([key, label]) => (
          <button key={key}
            className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`}
            onClick={() => key === 'calendar' ? navigate(`/project/${projectId}/calendar`) : setTab(key)}>
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
                  className={`${styles.roomCard} ${dragIdx === i ? styles.roomCardDragging : ''} ${room.isDm ? styles.roomCardDm : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDragEnd={handleDragEnd}
                  onClick={() => navigate(`/project/${projectId}/chat/${room.id}`)}>
                  <div className={styles.dragHandle}>⠿</div>
                  <div className={styles.roomIcon} style={{ background: room.colorBg, color: room.color }}>
                    {room.isDm ? '💬' : `#${room.name.charAt(0)}`}
                  </div>
                  <div className={styles.roomBody}>
                    <div className={styles.roomTop}>
                      <span className={styles.roomName}>{room.isDm ? room.name : `# ${room.name}`}</span>
                      {unread > 0
                        ? <span className={styles.unreadBadge}>{unread}</span>
                        : <span className={styles.roomTime}>{room.time}</span>
                      }
                    </div>
                    <span className={styles.roomLast}>{room.lastMessage}</span>
                  </div>
                </div>
              )
            })}
          </div>
          {iCanManage && (
            <button className={styles.addRoom}>+ 팀 채팅방 추가</button>
          )}
        </div>
      )}

      {/* ── 게시판 ── */}
      {tab === 'board' && (
        <div className={styles.section}>
          <div className={styles.boardHeader}>
            <p className={styles.boardDesc}>모든 팀원이 게시글을 작성할 수 있어요</p>
            <button className={styles.writeBtn} onClick={() => setShowAnnForm(!showAnnForm)}>
              {showAnnForm ? '취소' : '✏️ 글쓰기'}
            </button>
          </div>

          {showAnnForm && (
            <div className={styles.annForm}>
              <div className={styles.annFormTop}>
                <input className={styles.annTitleInput} value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)} placeholder="제목을 입력하세요" />
                <label className={`${styles.globalToggle} ${annIsGlobal ? styles.globalToggleOn : ''}`}>
                  <input type="checkbox" checked={annIsGlobal} onChange={(e) => setAnnIsGlobal(e.target.checked)} />
                  {annIsGlobal ? '📢 전체 공지' : '📝 일반 게시글'}
                </label>
              </div>
              <textarea className={styles.annTextarea} value={annContent}
                onChange={(e) => setAnnContent(e.target.value)}
                placeholder="내용을 입력하세요..." rows={5} />
              <div className={styles.annFormBottom}>
                <button className={styles.fileBtn} onClick={() => fileRef.current.click()}>
                  📎 {annFile ? annFile.name : '파일 첨부'}
                </button>
                <input ref={fileRef} type="file" style={{ display: 'none' }}
                  onChange={(e) => setAnnFile(e.target.files[0])} />
                {annFile && (
                  <button className={styles.fileRemove} onClick={() => setAnnFile(null)}>✕</button>
                )}
                <button className={styles.annSubmitBtn} onClick={handleAddAnn}
                  disabled={!annTitle.trim() || !annContent.trim()}>
                  등록
                </button>
              </div>
            </div>
          )}

          {project.announcements.length === 0 && (
            <div className={styles.emptyState}>
              <p className={styles.emptyIcon}>📋</p>
              <p>아직 게시글이 없어요</p>
            </div>
          )}

          <div className={styles.annList}>
            {project.announcements.map((ann) => (
              <div key={ann.id} className={`${styles.annCard} ${ann.isGlobal ? styles.annCardGlobal : ''}`}>
                <div className={styles.annHeader}>
                  <div className={styles.annLeft}>
                    {ann.isGlobal && <span className={styles.globalBadge}>📢 전체 공지</span>}
                    <span className={styles.annTitle}>{ann.title}</span>
                  </div>
                  <div className={styles.annRight}>
                    <span className={styles.annMeta}>{ann.author} · {ann.createdAt}</span>
                    {(ann.authorId === currentUser.id || isLeader) && (
                      <button className={styles.annDelete}
                        onClick={() => deleteAnnouncement(project.id, ann.id)}>✕</button>
                    )}
                  </div>
                </div>
                <p className={styles.annContent}>{ann.content}</p>
                {ann.fileName && (
                  <div className={styles.annFile}>
                    <span>📎</span>
                    <span className={styles.annFileName}>{ann.fileName}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 멤버 ── */}
      {tab === 'members' && (
        <div className={styles.section}>
          <div className={styles.memberGrid}>
            {project.members.map((m) => (
              <div key={m.id} className={styles.memberCard}>
                <div className={styles.memberAvatar}>{m.name.charAt(0)}</div>
                <div className={styles.memberInfo}>
                  <p className={styles.memberName}>
                    {m.name}
                    {m.id === currentUser.id && <span className={styles.meTag}>나</span>}
                  </p>
                  <p className={styles.memberRole}>{ROLE_LABEL[m.role]}</p>
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
          <p className={styles.sectionHint}>팀원의 역할과 채팅방 접근 권한을 설정하세요</p>
          <div className={styles.manageList}>
            {project.members.filter((m) => m.id !== currentUser.id).map((m) => (
              <div key={m.id} className={styles.manageCard}>
                <div className={styles.manageTop}>
                  <div className={styles.memberAvatar}>{m.name.charAt(0)}</div>
                  <div className={styles.memberInfo}>
                    <p className={styles.memberName}>{m.name}</p>
                    <p className={styles.memberRole}>{ROLE_LABEL[m.role]}</p>
                  </div>
                  <div className={styles.manageActions}>
                    <select className={styles.roleSelect} value={m.role}
                      onChange={(e) => updateMemberRole(project.id, m.id, e.target.value)}>
                      <option value="leader">👑 리더</option>
                      <option value="sub-leader">⭐ 부리더</option>
                      <option value="member">팀원</option>
                    </select>
                    {isLeader && m.role !== 'leader' && (
                      <button className={styles.transferBtn} onClick={() => handleTransfer(m.id)}>리더 양도</button>
                    )}
                  </div>
                </div>
                {m.role === 'member' && (
                  <div className={styles.roomAssign}>
                    <p className={styles.roomAssignLabel}>접근 가능한 채팅방</p>
                    <div className={styles.roomAssignList}>
                      {project.rooms.map((r) => (
                        <label key={r.id} className={styles.roomAssignItem}
                          style={{ borderColor: m.roomIds.includes(r.id) ? r.color : 'var(--border)', background: m.roomIds.includes(r.id) ? r.colorBg : 'var(--bg)' }}>
                          <input type="checkbox" checked={m.roomIds.includes(r.id)}
                            onChange={() => toggleMemberRoom(project.id, m.id, r.id)} />
                          <span style={{ color: m.roomIds.includes(r.id) ? r.color : 'var(--text)' }}>
                            {r.isDm ? '💬' : '#'} {r.name}
                          </span>
                        </label>
                      ))}
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