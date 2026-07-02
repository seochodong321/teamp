import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { arrayUnion, collection, doc, getDoc, limitToLast, onSnapshot, orderBy, query, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase.js'
import { fetchUserProfile } from '../services/users.js'
import { useStore } from '../store/useStore.js'
import { useShallow } from 'zustand/react/shallow'
import { localDateStr, todayStr } from '../store/helpers.js'
import { ROLE_EMOJI } from '../constants.js'
import MessageReactions from '../components/MessageReactions.jsx'
import styles from './ChatPage.module.css'

const USER_COLORS = [
  { bg: 'var(--primary-light)', text: 'var(--primary)' },
  { bg: 'var(--teal-light)',    text: 'var(--teal)' },
  { bg: 'var(--amber-light)',   text: 'var(--amber)' },
  { bg: 'var(--coral-light)',   text: 'var(--coral)' },
  { bg: 'var(--rose-light)',    text: 'var(--rose)' },
]
function avatarStyle(userId) {
  if (!userId) return USER_COLORS[0]
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) % USER_COLORS.length
  return USER_COLORS[Math.abs(h) % USER_COLORS.length]
}

function getMsgDate(msg) {
  if (!msg.createdAt) return todayStr()
  try {
    const d = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt)
    return localDateStr(d)
  } catch {
    return todayStr()
  }
}

function formatDateLabel(dateStr) {
  const today     = todayStr()
  const yesterday = localDateStr(new Date(Date.now() - 86400000))
  if (dateStr === today) return '오늘'
  if (dateStr === yesterday) return '어제'
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}월 ${parseInt(d)}일`
}

function linkify(text) {
  if (!text || typeof text !== 'string') return text
  const parts = text.split(/(https?:\/\/[^\s]+)/)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1
      ? <a key={i} href={part} target="_blank" rel="noreferrer noopener" className={styles.msgLink}>{part}</a>
      : part
  )
}

function calcPollPcts(options, total) {
  if (total === 0) return options.map(() => 0)
  const raw    = options.map((o) => (o.votes.length / total) * 100)
  const floors = raw.map(Math.floor)
  const rem    = 100 - floors.reduce((a, b) => a + b, 0)
  raw.map((r, i) => ({ d: r - floors[i], i }))
    .sort((a, b) => b.d - a.d)
    .slice(0, rem)
    .forEach(({ i }) => { floors[i]++ })
  return floors
}

function ChatImage({ src, alt, className, onClick }) {
  const [broken, setBroken] = React.useState(false)
  if (broken) return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 12, color: 'var(--text-tertiary)', cursor: 'default' }}>
      🖼️ <span>이미지를 불러올 수 없어요</span>
    </div>
  )
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" onError={() => setBroken(true)} onClick={onClick} />
}

export default function ChatPage() {
  const { projectId, roomId } = useParams()
  const navigate = useNavigate()
  const {
    projects, messages, currentUser,
    sendMessage, sendFile, sendPoll, votePoll, toggleReaction, markAsRead,
    dmRooms, dmRoomList, setRoomMessages,
    leaveDmRoom, blockUser, unblockUser, blockedUsers,
    toggleMuteDm, mutedDms, getOrCreateDmRoom,
    removeChatToastsByRoom, showError,
  } = useStore(useShallow((s) => ({
    projects: s.projects, messages: s.messages, currentUser: s.currentUser,
    sendMessage: s.sendMessage, sendFile: s.sendFile, sendPoll: s.sendPoll, votePoll: s.votePoll, toggleReaction: s.toggleReaction, markAsRead: s.markAsRead,
    dmRooms: s.dmRooms, dmRoomList: s.dmRoomList, setRoomMessages: s.setRoomMessages,
    leaveDmRoom: s.leaveDmRoom, blockUser: s.blockUser, unblockUser: s.unblockUser, blockedUsers: s.blockedUsers,
    toggleMuteDm: s.toggleMuteDm, mutedDms: s.mutedDms, getOrCreateDmRoom: s.getOrCreateDmRoom,
    removeChatToastsByRoom: s.removeChatToastsByRoom, showError: s.showError,
  })))

  const project = projects.find((p) => p.id === projectId)
  const dmRoom  = dmRoomList.find((r) => r.id === roomId)
    || Object.values(dmRooms).find((r) => r.id === roomId) || null
  const room = project?.rooms.find((r) => r.id === roomId) || dmRoom
  const roomMessages = messages[roomId] || []
  // 카톡식 나가기 — 내 clearedAt(나간 시점) 이후 메시지만 보임. 상대는 워터마크 없어 전부 유지.
  const myClearedMs = (() => {
    const c = dmRoom?.clearedAt?.[currentUser?.id]
    return c?.toMillis ? c.toMillis() : (c?.seconds ? c.seconds * 1000 : 0)
  })()
  const visibleMessages = myClearedMs
    ? roomMessages.filter((m) => {
        const t = m.createdAt?.toMillis ? m.createdAt.toMillis()
          : (m.createdAt?.seconds ? m.createdAt.seconds * 1000 : Date.now())
        return t > myClearedMs
      })
    : roomMessages

  // ─── state ─────────────────────────────────────────────────────
  const [text, setText]                   = useState('')
  const [mode, setMode]                   = useState('text')
  const [pollQ, setPollQ]                 = useState('')
  const [pollOptions, setPollOptions]     = useState(['', ''])
  const [showToolbar, setShowToolbar]     = useState(false)
  const [lightbox, setLightbox]           = useState(null)
  const [profilePopup, setProfilePopup]   = useState(null)
  const [sendPulseActive, setSendPulse]   = useState(false)
  const [showLeave, setShowLeave]         = useState(false)
  const [leaving, setLeaving]             = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)

  // ─── refs ──────────────────────────────────────────────────────
  const isComposing   = useRef(false)
  const isSending     = useRef(false)
  const bottomRef     = useRef(null)
  const fileRef       = useRef(null)
  const textareaRef   = useRef(null)
  const messagesRef   = useRef(null)
  const isInitialRef  = useRef(true)
  const nearBottomRef = useRef(true)
  const readAckedRef  = useRef(new Set())  // readBy 이미 발행한 메시지 id — 스냅샷마다 중복 쓰기 방지

  // ─── iOS PWA 키보드 대응 ──
  // 채팅은 .shell(height: var(--app-height,100dvh)) 안의 flex로 채워짐.
  // 키보드가 올라오면 visualViewport.height로 --app-height를 줄여 앱이 보이는 영역에 맞춰지고
  // → 입력창이 키보드 바로 위로 올라온다. --kb-safe=0으로 입력창 하단 패딩도 collapse.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    const reset = () => { root.style.removeProperty('--app-height'); root.style.removeProperty('--kb-safe') }
    const apply = () => {
      const kb = window.innerHeight - vv.height - vv.offsetTop
      if (kb > 1) {
        root.style.setProperty('--app-height', `${Math.round(vv.height)}px`)
        root.style.setProperty('--kb-safe', '0px')
        requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: 'end' }))
      } else {
        reset()
      }
    }
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      reset()
    }
  }, [])

  // ─── 방 메타(rooms/{id}) 보장 — 레거시 방 자가 치유 ─────────────
  // 메시지 보안 규칙이 이 문서의 projectId로 멤버십을 검증한다.
  // 예전에 만든 방엔 메타가 없으므로, 멤버가 방에 들어올 때 한 번 만들어 준다.
  const isProjectRoom = !!project?.rooms?.find((r) => r.id === roomId)
  useEffect(() => {
    if (!isProjectRoom || !projectId) return
    const roomDef = project.rooms.find((r) => r.id === roomId)
    ;(async () => {
      try {
        const ref = doc(db, 'rooms', roomId)
        const snap = await getDoc(ref)
        if (!snap.exists()) {
          await setDoc(ref, {
            projectId,
            ...(roomDef?.ownerId ? { ownerId: roomDef.ownerId } : {}),
          })
        }
      } catch { /* 권한/오프라인 — 규칙의 레거시 fallback으로 동작 */ }
    })()
  }, [roomId, projectId, isProjectRoom])

  // ─── Firestore 메시지 실시간 구독 ─────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'rooms', roomId, 'messages'), orderBy('createdAt', 'asc'), limitToLast(100))
    const unsub = onSnapshot(q, (snap) => {
      setRoomMessages(roomId, snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [roomId, setRoomMessages])

  // 방 진입 시 해당 방 토스트 즉시 제거
  useEffect(() => { removeChatToastsByRoom(roomId) }, [roomId, removeChatToastsByRoom])

  // 방 전환 시 초기 플래그 리셋
  useEffect(() => { isInitialRef.current = true }, [roomId])

  // 프로필 팝업 외부 클릭 닫기
  useEffect(() => {
    if (!profilePopup) return
    const close = () => setProfilePopup(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [profilePopup])

  // 방 진입 즉시 미읽음 배지 초기화 (메시지 로드 전에도)
  useEffect(() => {
    markAsRead(roomId)
  }, [roomId, markAsRead])

  // 새 메시지 → 스크롤 (nearBottom일 때만) + 읽음 처리
  useEffect(() => {
    if (!bottomRef.current) return
    if (isInitialRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'instant' })
      isInitialRef.current = false
      markAsRead(roomId)
    } else if (nearBottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
      markAsRead(roomId)
    }
  }, [roomMessages.length, roomId, markAsRead])

  // 방이 바뀌면 readBy 발행 기록 초기화
  useEffect(() => { readAckedRef.current = new Set() }, [roomId])

  // 읽지 않은 메시지에 readBy 추가 (배치) — 이미 발행한 id는 건너뛰어 스냅샷마다 재쓰기 방지
  useEffect(() => {
    if (!currentUser?.id) return
    const ids = roomMessages
      .filter((m) => m.id && m.senderId !== currentUser.id
        && !(m.readBy || []).includes(currentUser.id)
        && !readAckedRef.current.has(m.id))
      .slice(-30)
      .map((m) => m.id)
    if (!ids.length) return
    ids.forEach((id) => readAckedRef.current.add(id))  // 낙관적 — 인플라이트 중복 방지
    const batch = writeBatch(db)
    ids.forEach((id) => batch.update(doc(db, 'rooms', roomId, 'messages', id), { readBy: arrayUnion(currentUser.id) }))
    batch.commit().catch(() => { ids.forEach((id) => readAckedRef.current.delete(id)) })  // 실패 시 롤백 → 다음 스냅샷 재시도
  }, [roomMessages, roomId, currentUser?.id])

  // ─── 핸들러 ────────────────────────────────────────────────────
  const handleMessagesScroll = useCallback(() => {
    const el = messagesRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    nearBottomRef.current = dist < 150
    setShowScrollBtn(dist > 220)
  }, [])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShowScrollBtn(false)
  }, [])

  const handleTextChange = (e) => {
    setText(e.target.value)
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
    }
  }

  const handleSend = async () => {
    if (!text.trim() || isSending.current) return
    isSending.current = true
    const msg = text.trim()
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setSendPulse(true)
    try {
      await sendMessage(roomId, msg)
    } catch {
      showError('메시지를 보내지 못했어요. 다시 시도해주세요.')
      setText(msg)
    }
    setTimeout(() => { setSendPulse(false); isSending.current = false }, 400)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing.current) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setShowToolbar(false)
    try {
      await sendFile(roomId, file)
    } catch {
      showError('파일을 보내지 못했어요. 다시 시도해주세요.')
    }
  }

  const handlePollSend = async () => {
    const valid = pollOptions.filter((o) => o.trim())
    if (!pollQ.trim() || valid.length < 2) return
    try {
      await sendPoll(roomId, pollQ.trim(), valid)
      setPollQ(''); setPollOptions(['', '']); setMode('text'); setShowToolbar(false)
    } catch {
      showError('투표를 올리지 못했어요. 다시 시도해주세요.')
    }
  }

  const handleAvatarClick = async (e, userId, name, avStyle) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = rect.right + 220 > window.innerWidth ? rect.left - 230 : rect.right + 10
    const y = Math.min(rect.top, window.innerHeight - 260)
    setProfilePopup({ userId, name, avStyle, x, y, loading: true, data: null })
    try {
      const data = (await fetchUserProfile(userId)) || {}
      setProfilePopup((prev) => prev?.userId === userId ? { ...prev, loading: false, data } : prev)
    } catch {
      setProfilePopup((prev) => prev?.userId === userId ? { ...prev, loading: false, data: {} } : prev)
    }
  }

  // 프로필 팝업 → 1:1 대화 (그룹방에선 새 DM, 이미 그 사람과의 DM이면 동일방)
  const handlePopupDm = async (popup) => {
    const name = popup.data?.name || popup.name
    setProfilePopup(null)
    try {
      const room = await getOrCreateDmRoom(dmRoom?.projectId || projectId, popup.userId, name)
      if (room) navigate(`/project/${dmRoom?.projectId || projectId}/chat/${room.id}`)
    } catch (e) {
      console.error('[프로필 팝업 DM] 오류:', e)
      showError('대화를 열지 못했어요. 다시 시도해주세요.')
    }
  }

  const handleLeaveDm = async () => {
    setLeaving(true)
    try {
      await leaveDmRoom(roomId)  // Firestore 쓰기 완료 후 이동
    } catch (e) {
      console.error('DM 나가기 오류:', e)
    }
    const linkedProject = projects.find((p) => p.id === (dmRoom?.projectId || projectId))
    navigate(linkedProject?.status === 'active' ? `/project/${linkedProject.id}` : '/home')
    setShowLeave(false)
    setLeaving(false)
  }

  // ─── 가드 ──────────────────────────────────────────────────────
  if (!room) return <div className={styles.notFound}>채팅방을 찾을 수 없어요</div>

  // ─── DM 메타 ──────────────────────────────────────────────────
  const isDm          = !!dmRoom
  const otherUserId   = isDm ? (dmRoom?.participants || []).find((id) => id !== currentUser.id) : null
  const otherUserName = isDm ? (dmRoom?.participantNames?.[otherUserId] || '상대방') : null
  const roomName      = isDm ? (otherUserName || '1:1 대화') : room?.name
  const iBlocked      = isDm && (blockedUsers || []).includes(otherUserId)
  const isMuted       = isDm && (mutedDms || []).includes(roomId)
  const backLabel     = isDm ? '← 홈' : `← ${project?.name || ''}`
  const backPath      = isDm ? '/home' : `/project/${projectId}`

  return (
    <div className={styles.page}>
      {/* 라이트박스 */}
      {lightbox && (
        <div className={styles.lightbox} onClick={() => setLightbox(null)}>
          <img src={lightbox.url} alt={lightbox.name} className={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
          <div className={styles.lightboxBar} onClick={(e) => e.stopPropagation()}>
            <span className={styles.lightboxName}>{lightbox.name}</span>
            <a href={lightbox.url} download={lightbox.name} target="_blank" rel="noreferrer" className={styles.lightboxDown}>⬇ 다운로드</a>
            <button className={styles.lightboxClose} onClick={() => setLightbox(null)}>✕</button>
          </div>
        </div>
      )}

      {/* 미니 프로필 카드 */}
      {profilePopup && profilePopup.userId !== currentUser.id && (() => {
        const pd = profilePopup.data || {}
        const sharedProjects = projects.filter((p) =>
          p.members.some((m) => m.id === currentUser.id) &&
          p.members.some((m) => m.id === profilePopup.userId) &&
          !p.isTutorial
        )
        const isBlocked = (blockedUsers || []).includes(profilePopup.userId)
        return (
          <div className={styles.profilePopup}
            style={{ top: profilePopup.y, left: profilePopup.x }}
            onClick={(e) => e.stopPropagation()}>
            <div className={styles.ppHeader}>
              <div className={styles.ppAvatar} style={{ background: profilePopup.avStyle.bg, color: profilePopup.avStyle.text }}>
                {pd.photoURL
                  ? <img src={pd.photoURL} alt={profilePopup.name} className={styles.ppAvatarImg} />
                  : profilePopup.name.charAt(0)
                }
              </div>
              <div className={styles.ppInfo}>
                <p className={styles.ppName}>{pd.name || profilePopup.name}</p>
                {pd.username && <p className={styles.ppUsername}>@{pd.username.replace('@', '')}</p>}
                {pd.affiliation && <p className={styles.ppAffiliation}>🏢 {pd.affiliation}</p>}
              </div>
            </div>
            {profilePopup.loading
              ? <p className={styles.ppLoading}><span className={styles.ppSpinner} /> 불러오는 중...</p>
              : pd.oneliner ? <p className={styles.ppOneliner}>"{pd.oneliner}"</p> : null
            }
            {sharedProjects.length > 0 && (
              <p className={styles.ppShared}>함께한 프로젝트 {sharedProjects.length}개</p>
            )}
            {pd.username && (
              <a href={`/u/${pd.username.replace('@', '')}`} target="_blank" rel="noreferrer"
                className={styles.ppTeamfolio} onClick={(e) => e.stopPropagation()}>
                팀프폴리오 보기 →
              </a>
            )}
            {!isBlocked && !profilePopup.loading && (
              <div className={styles.ppActions}>
                <button className={styles.ppDmBtn} onClick={() => handlePopupDm(profilePopup)}>💬 1:1 대화</button>
                {pd.username && (
                  <button className={styles.ppNoteBtn}
                    onClick={() => { setProfilePopup(null); navigate(`/messages?compose=1&to=${pd.username.replace('@', '')}`) }}>
                    ✉️ 쪽지
                  </button>
                )}
              </div>
            )}
            <div className={styles.ppFooter}>
              {isBlocked
                ? <button className={styles.ppUnblockBtn} onClick={() => { unblockUser(profilePopup.userId); setProfilePopup(null) }}>차단 해제</button>
                : <button className={styles.ppBlockBtn} onClick={() => { blockUser(profilePopup.userId); setProfilePopup(null) }}>차단하기</button>
              }
            </div>
          </div>
        )
      })()}

      {/* DM 나가기 확인 모달 */}
      {showLeave && (
        <div className={styles.leaveBackdrop} onClick={() => !leaving && setShowLeave(false)}>
          <div className={styles.leaveModal} onClick={(e) => e.stopPropagation()}>
            <p className={styles.leaveTitle}>대화방을 나갈까요?</p>
            <p className={styles.leaveDesc}>이 대화가 내 목록에서 사라져요. 상대방에게는 그대로 남고, 알림도 가지 않아요.</p>
            <div className={styles.leaveBtns}>
              <button className={styles.leaveCancelBtn} onClick={() => setShowLeave(false)}>취소</button>
              <button className={styles.leaveConfirmBtn} disabled={leaving} onClick={handleLeaveDm}>
                {leaving ? '나가는 중...' : '나가기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 참여자 목록 모달 */}
      {showMembersModal && !isDm && project && (
        <div className={styles.membersBackdrop} onClick={() => setShowMembersModal(false)}>
          <div className={styles.membersModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.membersHeader}>
              <span className={styles.membersTitle}># {roomName} 참여자</span>
              <button className={styles.membersClose} onClick={() => setShowMembersModal(false)}>✕</button>
            </div>
            <div className={styles.membersList}>
              {project.members
                .filter((m) => m.role === 'leader' || m.role === 'sub-leader' || (m.roomIds || []).includes(roomId))
                .map((m) => {
                  const avStyle = avatarStyle(m.id)
                  return (
                    <div key={m.id} className={styles.memberRow}>
                      <div className={styles.memberAvatar} style={{ background: avStyle.bg, color: avStyle.text }}>
                        {m.name.charAt(0)}
                      </div>
                      <div className={styles.memberInfo}>
                        <span className={styles.memberName}>{m.name}</span>
                        {m.affiliation && <span className={styles.memberAffil}>{m.affiliation}</span>}
                      </div>
                      {ROLE_EMOJI[m.role] && (
                        <span className={styles.memberRole}>{ROLE_EMOJI[m.role]}</span>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate(backPath)}>{backLabel}</button>
        <div className={styles.headerCenter}>
          <span className={styles.roomName}>{isDm ? `💬 ${roomName}` : `# ${roomName}`}</span>
          {!isDm && project && (() => {
            const roomMembers = project.members.filter((m) =>
              m.role === 'leader' || m.role === 'sub-leader' || (m.roomIds || []).includes(roomId)
            )
            return (
              <button className={styles.roomMetaBtn} onClick={() => setShowMembersModal(true)}>
                {roomMembers.length}명
              </button>
            )
          })()}
        </div>
        {isDm ? (
          <div className={styles.dmHeaderActions}>
            <button className={styles.dmMuteBtn} onClick={() => toggleMuteDm(roomId)}
              title={isMuted ? '알림 켜기' : '알림 끄기'}>
              {isMuted ? '🔕' : '🔔'}
            </button>
            <button className={styles.dmLeaveBtn} onClick={() => setShowLeave(true)}>나가기</button>
          </div>
        ) : (
          <div className={styles.headerSpacer} />
        )}
      </div>

      {/* 메시지 목록 */}
      <div className={styles.messages} ref={messagesRef} onScroll={handleMessagesScroll}>
        {visibleMessages.length === 0 && (
          <div className={styles.emptyMessages}>
            <div className={styles.emptyIcon}>{isDm ? '💬' : '#'}</div>
            <p className={styles.emptyTitle}>{isDm ? `${roomName}와의 대화` : `# ${roomName}`}</p>
            <p className={styles.emptySub}>아직 메시지가 없어요.</p>
            <p className={styles.emptySub}>첫 번째 메시지를 보내보세요!</p>
          </div>
        )}

        {visibleMessages.map((msg, index) => {
          const isMine     = msg.senderId === currentUser.id
          const isSystem   = msg.senderId === 'system'
          const member     = project?.members.find((m) => m.id === msg.senderId)
          const senderName = isMine
            ? (currentUser.name || msg.senderName || '알 수 없음')
            : (msg.senderName || '알 수 없음')

          const prevMsg  = index > 0 ? visibleMessages[index - 1] : null
          const nextMsg  = index < visibleMessages.length - 1 ? visibleMessages[index + 1] : null
          const msgDate  = getMsgDate(msg)
          const prevDate = prevMsg ? getMsgDate(prevMsg) : null
          const nextDate = nextMsg ? getMsgDate(nextMsg) : null

          const showDateDivider = msgDate !== prevDate

          // 연속 메시지 그루핑: DM 포함, 날짜 경계·시스템 메시지 제외
          const isGrouped = !isMine && !isSystem && prevMsg
            && !showDateDivider
            && prevMsg.senderId === msg.senderId
            && prevMsg.senderId !== 'system'
            && msg.type !== 'notify' && prevMsg.type !== 'notify'

          // 같은 발신자·날짜의 마지막 메시지일 때만 시간 표시
          const isLastInGroup = !nextMsg
            || nextMsg.senderId !== msg.senderId
            || nextDate !== msgDate
            || nextMsg.type === 'notify'
            || nextMsg.senderId === 'system'

          const avStyle = avatarStyle(msg.senderId)

          const avatarEl = isMine ? null : isGrouped
            ? <div className={styles.avatarGap} />
            : (
              <div
                className={`${styles.avatar} ${styles.avatarClickable}`}
                style={{ background: avStyle.bg, color: avStyle.text }}
                onClick={(e) => handleAvatarClick(e, msg.senderId, senderName, avStyle)}>
                {senderName.charAt(0)}
              </div>
            )

          const nameEl = (!isMine && !isDm && !isGrouped && !isSystem) ? (
            <span className={styles.sender}>
              <span style={{ color: avStyle.text, fontWeight: 700 }}>{senderName}</span>
              {member && ROLE_EMOJI[member.role] && <span className={styles.roleTag}>{ROLE_EMOJI[member.role]}</span>}
            </span>
          ) : null

          const timeEl = isLastInGroup ? <span className={styles.time}>{msg.time}</span> : null

          // 시스템 알림
          if (isSystem || msg.type === 'notify') {
            const sn = msg.senderName || ''
            const isAnn   = sn.includes('공지')
            const isTodo  = sn.includes('할 일')
            const isEvent = sn.includes('일정')
            const isRich  = isAnn || isTodo || isEvent
            return (
              <React.Fragment key={msg.id}>
                {showDateDivider && <div className={styles.dateDivider}><span>{formatDateLabel(msgDate)}</span></div>}
                {isRich ? (
                  <div className={[styles.notifyCard, isAnn ? styles.notifyAnn : isTodo ? styles.notifyTodo : styles.notifyEvent].join(' ')}>
                    <span className={styles.notifyCardIcon}>{isAnn ? '📢' : isTodo ? '✅' : '📅'}</span>
                    <span className={styles.notifyCardText}>{msg.text}</span>
                  </div>
                ) : (
                  <div className={styles.systemMsg}>
                    <span>{msg.text}</span>
                  </div>
                )}
              </React.Fragment>
            )
          }

          const readCount = (msg.readBy || []).filter((id) => id !== msg.senderId).length

          // 이미지
          if (msg.type === 'image') {
            return (
              <React.Fragment key={msg.id}>
                {showDateDivider && <div className={styles.dateDivider}><span>{formatDateLabel(msgDate)}</span></div>}
                <div className={`${styles.row} ${isMine ? styles.rowMine : ''} ${isGrouped ? styles.rowGrouped : ''}`}>
                  {avatarEl}
                  <div className={styles.bubbleWrap}>
                    {nameEl}
                    <ChatImage src={msg.fileUrl} alt={msg.text} className={styles.chatImg}
                      onClick={() => setLightbox({ url: msg.fileUrl, name: msg.text })} />
                    {(timeEl || (isMine && readCount > 0)) && (
                      <div className={styles.timeRow}>
                        {isMine && readCount > 0 && <span className={styles.readReceipt}>읽음 {readCount}</span>}
                        {timeEl}
                      </div>
                    )}
                    <MessageReactions reactions={msg.reactions} myId={currentUser?.id} canReact={!isMine} mine={isMine} onToggle={(key) => toggleReaction(roomId, msg.id, key)} />
                  </div>
                </div>
              </React.Fragment>
            )
          }

          // 파일
          if (msg.type === 'file') {
            return (
              <React.Fragment key={msg.id}>
                {showDateDivider && <div className={styles.dateDivider}><span>{formatDateLabel(msgDate)}</span></div>}
                <div className={`${styles.row} ${isMine ? styles.rowMine : ''} ${isGrouped ? styles.rowGrouped : ''}`}>
                  {avatarEl}
                  <div className={styles.bubbleWrap}>
                    {nameEl}
                    <div className={`${styles.fileBubble} ${isMine ? styles.fileBubbleMine : ''}`}>
                      <span>📎</span>
                      <span className={styles.fileName}>{msg.text}</span>
                    </div>
                    {(timeEl || (isMine && readCount > 0)) && (
                      <div className={styles.timeRow}>
                        {isMine && readCount > 0 && <span className={styles.readReceipt}>읽음 {readCount}</span>}
                        {timeEl}
                      </div>
                    )}
                    <MessageReactions reactions={msg.reactions} myId={currentUser?.id} canReact={!isMine} mine={isMine} onToggle={(key) => toggleReaction(roomId, msg.id, key)} />
                  </div>
                </div>
              </React.Fragment>
            )
          }

          // 투표
          if (msg.type === 'poll') {
            const total = msg.options.reduce((s, o) => s + o.votes.length, 0)
            const pcts  = calcPollPcts(msg.options, total)
            return (
              <React.Fragment key={msg.id}>
                {showDateDivider && <div className={styles.dateDivider}><span>{formatDateLabel(msgDate)}</span></div>}
                <div className={`${styles.pollWrap} ${isGrouped ? styles.rowGrouped : ''}`}>
                  {avatarEl}
                  <div className={styles.pollCard}>
                    <div className={styles.pollHeader}>
                      {!isMine && !isDm && <span className={styles.pollAuthor} style={{ color: avStyle.text }}>{senderName}</span>}
                      <span className={styles.pollBadge}>📊 투표</span>
                    </div>
                    <p className={styles.pollQuestion}>{msg.text}</p>
                    <div className={styles.pollOptions}>
                      {msg.options.map((opt, oi) => {
                        const pct   = pcts[oi]
                        const voted = opt.votes.includes(currentUser.id)
                        return (
                          <button key={opt.id}
                            className={`${styles.pollOption} ${voted ? styles.pollOptionVoted : ''}`}
                            onClick={() => votePoll(roomId, msg.id, opt.id)}>
                            <div className={styles.pollBar} style={{ width: `${pct}%` }} />
                            <span className={styles.pollOptLabel}>{opt.label}</span>
                            <span className={styles.pollOptPct}>{pct}%</span>
                          </button>
                        )
                      })}
                    </div>
                    <p className={styles.pollTotal}>총 {total}명 참여</p>
                  </div>
                </div>
              </React.Fragment>
            )
          }

          // 일반 텍스트
          return (
            <React.Fragment key={msg.id}>
              {showDateDivider && <div className={styles.dateDivider}><span>{formatDateLabel(msgDate)}</span></div>}
              <div className={`${styles.row} ${isMine ? styles.rowMine : ''} ${isGrouped ? styles.rowGrouped : ''}`}>
                {avatarEl}
                <div className={styles.bubbleWrap}>
                  {nameEl}
                  <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleOther}`}>
                    {linkify(msg.text)}
                  </div>
                  {(timeEl || (isMine && readCount > 0)) && (
                    <div className={styles.timeRow}>
                      {isMine && readCount > 0 && <span className={styles.readReceipt}>읽음 {readCount}</span>}
                      {timeEl}
                    </div>
                  )}
                  <MessageReactions reactions={msg.reactions} myId={currentUser?.id} canReact={!isMine} mine={isMine} onToggle={(key) => toggleReaction(roomId, msg.id, key)} />
                </div>
              </div>
            </React.Fragment>
          )
        })}
        <div ref={bottomRef} />

        {/* 스크롤 아래로 버튼 */}
        {showScrollBtn && (
          <button className={styles.scrollBottomBtn} onClick={scrollToBottom}>↓</button>
        )}
      </div>

      {/* 투표 만들기 */}
      {mode === 'poll' && (
        <div className={styles.pollMaker}>
          <div className={styles.pollMakerHeader}>
            <span className={styles.pollMakerTitle}>투표 만들기</span>
            <button onClick={() => setMode('text')}>✕</button>
          </div>
          <input className={styles.pollMakerInput} value={pollQ}
            onChange={(e) => setPollQ(e.target.value)} placeholder="질문을 입력하세요" />
          {pollOptions.map((opt, i) => (
            <div key={i} className={styles.pollOptRow}>
              <input className={styles.pollMakerInput} value={opt}
                onChange={(e) => { const o = [...pollOptions]; o[i] = e.target.value; setPollOptions(o) }}
                placeholder={`선택지 ${i + 1}`} />
              {pollOptions.length > 2 && (
                <button onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}>✕</button>
              )}
            </div>
          ))}
          {pollOptions.length < 5 && (
            <button className={styles.addOptBtn} onClick={() => setPollOptions([...pollOptions, ''])}>+ 선택지 추가</button>
          )}
          <button className={styles.pollSendBtn} onClick={handlePollSend}>투표 등록</button>
        </div>
      )}

      {/* 입력창 */}
      {iBlocked ? (
        <div className={styles.chatBlockedBar}>
          <span>내가 차단한 사용자예요.</span>
          <button className={styles.unblockBtn} onClick={() => unblockUser(otherUserId)}>차단 해제</button>
        </div>
      ) : (
        <div className={styles.inputArea}>
          <div className={styles.inputRow}>
            <div className={styles.toolbarWrap}>
              <button
                className={`${styles.toolBtn} ${showToolbar ? styles.toolBtnActive : ''}`}
                onClick={() => setShowToolbar(!showToolbar)}>+</button>
              {showToolbar && (
                <div className={styles.toolMenu}>
                  <button className={styles.toolItem} onClick={() => { fileRef.current.click(); setShowToolbar(false) }}>
                    📎 파일 공유
                  </button>
                  <button className={styles.toolItem} onClick={() => { setMode('poll'); setShowToolbar(false) }}>
                    📊 투표 만들기
                  </button>
                </div>
              )}
            </div>
            <textarea
              ref={textareaRef}
              className={styles.input}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKey}
              onCompositionStart={() => { isComposing.current = true }}
              onCompositionEnd={() => { isComposing.current = false }}
              placeholder="메시지를 입력하세요"
              rows={1}
            />
            <button
              className={`${styles.sendBtn} ${!text.trim() ? styles.sendBtnOff : ''} ${sendPulseActive ? styles.sendBtnPulse : ''}`}
              onClick={handleSend} disabled={!text.trim()}>↑</button>
            <input ref={fileRef} type="file" accept="image/*,*/*" style={{ display: 'none' }} onChange={handleFile} />
          </div>
          <p className={styles.inputHint}>Enter 전송 · Shift+Enter 줄바꿈</p>
        </div>
      )}
    </div>
  )
}
