import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc, getDocFromServer, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { useStore } from '../../store/useStore.js'
import { useShallow } from 'zustand/react/shallow'
import { ROLE_LABEL as BASE_ROLE_LABEL } from '../../constants.js'
import styles from '../ProjectPage.module.css'

export default function MembersTab({ project, currentUser, isLeader, canInvite, connects, blockedUsers, inviteLink }) {
  const leaderCount = project.members.filter((m) => m.role === 'leader').length
  // 공동리더(리더 2명+)일 때만 leader 라벨 동적 — 나머지는 공유 상수 재사용
  const ROLE_LABEL = { ...BASE_ROLE_LABEL, ...(leaderCount > 1 ? { leader: '🌟 공동리더' } : {}) }
  const navigate = useNavigate()
  const { sendProjectInvite, getOrCreateDmRoom, leaveOrDeleteProject } = useStore(useShallow((s) => ({ sendProjectInvite: s.sendProjectInvite, getOrCreateDmRoom: s.getOrCreateDmRoom, leaveOrDeleteProject: s.leaveOrDeleteProject })))

  const [profileMember, setProfileMember] = useState(null)
  const [profileExtra, setProfileExtra]   = useState(null)   // { oneliner, username }
  const [profilePubs, setProfilePubs]     = useState([])
  const [profileLoading, setProfileLoading] = useState(false)
  const [inviteCopied, setInviteCopied]   = useState(false)
  const [sentInvites, setSentInvites]     = useState({})
  const [showLeave, setShowLeave]         = useState(false)
  const [leaveLoading, setLeaveLoading]   = useState(false)
  const [leaveError, setLeaveError]       = useState('')

  // 모바일 네이티브 공유(카톡·메시지 등) — 지원 시에만 버튼 노출
  const canShare = typeof navigator !== 'undefined' && !!navigator.share
  const handleShareInvite = async () => {
    try {
      await navigator.share({
        title: `${project.name} 팀 초대`,
        text: `'${project.name}' 프로젝트에 초대해요. 링크로 참여하세요!`,
        url: inviteLink,
      })
    } catch { /* 사용자가 공유 취소 — 무시 */ }
  }

  const handleCopyInvite = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(inviteLink)
      } else {
        const el = document.createElement('textarea')
        el.value = inviteLink
        document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
      }
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 2000)
    } catch {}
  }

  const handleDirectInvite = async (connect) => {
    setSentInvites((prev) => ({ ...prev, [connect.id]: 'sending' }))
    const result = await sendProjectInvite(project.id, connect)
    setSentInvites((prev) => ({ ...prev, [connect.id]: result?.alreadySent ? 'sent' : result?.success ? 'sent' : 'error' }))
  }

  const openProfile = async (member) => {
    setProfileMember(member)
    setProfileExtra(null)
    setProfilePubs([])
    setProfileLoading(true)
    try {
      let ud
      if (member.id === currentUser.id) {
        // 본인 — 방금 수정한 값이 바로 보이도록 live 스토어 사용
        ud = currentUser
      } else {
        // 타인 — 서버 강제 조회로 오프라인 캐시의 옛 값 방지 (실패 시 캐시 폴백)
        const ref = doc(db, 'users', member.id)
        const snap = await getDocFromServer(ref).catch(() => getDoc(ref))
        ud = snap.exists() ? snap.data() : {}
      }
      setProfileExtra({
        oneliner:    ud.oneliner    || '',
        username:    ud.username    || '',
        name:        ud.name        || '',
        affiliation: ud.affiliation || '',
        email:       ud.email       || '',
        photoURL:    ud.photoURL    || null,
      })
      const projSnap = await getDocs(query(collection(db, 'projects'), where('memberIds', 'array-contains', member.id)))
      setProfilePubs(
        projSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
          .filter((p) => p.isPublic && !p.isTutorial)
          .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))
      )
    } catch {}
    setProfileLoading(false)
  }

  const handleDm = async (member) => {
    setProfileMember(null)
    try {
      const room = await getOrCreateDmRoom(project.id, member.id, member.name)
      if (room) navigate(`/project/${project.id}/chat/${room.id}`)
    } catch (e) {
      console.error('[DM]', e)
    }
  }

  return (
    <div className={styles.section}>
      {/* 멤버 프로필 모달 */}
      {profileMember && (
        <div className={styles.backdrop} onClick={() => { setProfileMember(null); setProfileExtra(null); setProfilePubs([]) }}>
          <div className={styles.profileModal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.profileClose} onClick={() => { setProfileMember(null); setProfileExtra(null); setProfilePubs([]) }}>✕</button>
            <div className={styles.profileAvatar}>
              {profileExtra?.photoURL
                ? <img src={profileExtra.photoURL} alt="" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%',display:'block'}} />
                : (profileExtra?.name || (profileMember.id === currentUser.id ? currentUser.name : profileMember.name)).charAt(0)}
            </div>
            <h3 className={styles.profileName}>{profileExtra?.name || (profileMember.id === currentUser.id ? currentUser.name : profileMember.name)}</h3>
            <span className={styles.profileRole}>{ROLE_LABEL[profileMember.role]}</span>
            {profileExtra?.oneliner && <p className={styles.profileOneliner}>"{profileExtra.oneliner}"</p>}
            {(profileExtra !== null ? profileExtra.affiliation : profileMember.affiliation) && (
              <p className={styles.profileAffil}>{profileExtra !== null ? profileExtra.affiliation : profileMember.affiliation}</p>
            )}
            {profileExtra?.username && (
              <p className={styles.profileUsername}>@{profileExtra.username.replace('@', '')}</p>
            )}
            {profileMember.memo && (
              <div className={styles.memoBox}>
                <span className={styles.memoLabel}>{project.name}</span>
                <p className={styles.memoText}>"{profileMember.memo}"</p>
              </div>
            )}
            <div className={styles.pubProjectsSection}>
              <p className={styles.pubProjectsLabel}>공개 프로젝트</p>
              {profileLoading ? (
                <p className={styles.pubLoading}>불러오는 중...</p>
              ) : profilePubs.length === 0 ? (
                <p className={styles.pubEmpty}>공개된 프로젝트가 없어요</p>
              ) : (
                <div className={styles.pubList}>
                  {profilePubs.map((p) => {
                    const mem = p.members?.find((m) => m.id === profileMember.id)
                    return (
                      <div key={p.id} className={styles.pubItem}>
                        <span className={styles.pubEmoji}>{p.emoji || '📁'}</span>
                        <div className={styles.pubInfo}>
                          <p className={styles.pubName}>{p.name}</p>
                          <p className={styles.pubMeta}>{p.category} · {p.startDate} ~ {p.endDate}</p>
                          {mem?.memo && <p className={styles.pubMemo}>"{mem.memo}"</p>}
                        </div>
                        <span className={styles.pubRole}>
                          {mem?.role === 'leader' ? '👑' : mem?.role === 'sub-leader' ? '⭐' : '팀원'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            {profileExtra?.username && (
              <a href={`/u/${profileExtra.username.replace('@','')}`} target="_blank" rel="noreferrer" className={styles.teamfolioLink} onClick={(e) => e.stopPropagation()}>
                팀프폴리오 보기 →
              </a>
            )}
            {profileMember.id !== currentUser.id && (
              <div className={styles.profileActions}>
                <button className={styles.dmBtn} onClick={() => handleDm(profileMember)}>
                  💬 1:1 대화
                </button>
                {profileExtra?.username && (
                  <button className={styles.noteBtn}
                    onClick={() => navigate(`/messages?compose=1&to=${profileExtra.username.replace('@', '')}`)}>
                    ✉️ 쪽지
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 프로젝트 나가기 확인 모달 */}
      {showLeave && (
        <div className={styles.backdrop} onClick={() => { setShowLeave(false); setLeaveError('') }}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>프로젝트에서 나갈까요?</h3>
            <p className={styles.modalDesc}>나가면 다시 초대를 받아야 참여할 수 있어요. 이 작업은 되돌릴 수 없어요.</p>
            {leaveError && <p style={{ fontSize: 13, color: 'var(--coral)', margin: '4px 0 0' }}>{leaveError}</p>}
            <div className={styles.modalBtns}>
              <button className={styles.modalCancel} onClick={() => { setShowLeave(false); setLeaveError('') }}>취소</button>
              <button
                className={styles.modalConfirm}
                style={{ background: 'var(--coral)' }}
                disabled={leaveLoading}
                onClick={async () => {
                  setLeaveLoading(true)
                  setLeaveError('')
                  try {
                    const result = await leaveOrDeleteProject(project.id)
                    if (result?.error) { setLeaveError(result.error); return }
                    navigate('/home')
                  } catch {
                    setLeaveError('나가지 못했어요. 잠시 후 다시 시도해주세요.')
                  } finally {
                    setLeaveLoading(false)
                  }
                }}
              >
                {leaveLoading ? '나가는 중...' : '나가기'}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className={styles.hint}>멤버를 클릭하면 프로필을 볼 수 있어요</p>
      <div className={styles.memberGrid}>
        {project.members.map((m) => (
          <div key={m.id} className={styles.memberCard} onClick={() => openProfile(m)}>
            <div className={styles.memberAvatar}>{m.name.charAt(0)}</div>
            <div className={styles.memberInfo}>
              <p className={styles.memberName}>
                {m.id === currentUser.id ? (currentUser.name || m.name) : m.name}
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

      {canInvite && (
        <div className={styles.inviteSection}>
          <div className={styles.inviteSectionHeader}>
            <p className={styles.inviteSectionTitle}>팀원 초대</p>
          </div>
          <div className={styles.inviteBlock}>
            <p className={styles.inviteBlockLabel}>링크 공유</p>
            <div className={styles.inviteLinkRow}>
              <div className={styles.inviteLinkBox}>
                <span className={styles.inviteLinkText}>{inviteLink}</span>
              </div>
              {canShare && (
                <button className={styles.shareBtn} onClick={handleShareInvite}>
                  📤 공유
                </button>
              )}
              <button className={`${styles.copyBtn} ${inviteCopied ? styles.copyBtnDone : ''}`}
                onClick={handleCopyInvite}>
                {inviteCopied ? '✅ 복사됨' : '🔗 복사'}
              </button>
            </div>
          </div>

          {(() => {
            const memberIds  = new Set(project.members.map((m) => m.id))
            const invitable  = connects.filter((c) => !memberIds.has(c.id) && !(blockedUsers || []).includes(c.id))
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
                          {state === 'sending' ? '...' : state === 'sent' ? '✅ 전송됨' : state === 'error' ? '다시 시도' : '초대'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {!isLeader && (
        <button className={styles.leaveBtn} onClick={() => setShowLeave(true)}>
          프로젝트 나가기
        </button>
      )}
    </div>
  )
}
