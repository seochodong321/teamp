import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import styles from '../ProjectPage.module.css'

export default function MembersTab({ project, currentUser, isLeader, canInvite, connects, blockedUsers, inviteLink }) {
  const leaderCount = project.members.filter((m) => m.role === 'leader').length
  const ROLE_LABEL = {
    leader: leaderCount > 1 ? '🌟 공동리더' : '👑 리더',
    'sub-leader': '⭐ 부리더',
    member: '팀원',
  }
  const navigate = useNavigate()
  const { sendProjectInvite, getOrCreateDmRoom, leaveProject } = useStore()

  const [profileMember, setProfileMember] = useState(null)
  const [inviteCopied, setInviteCopied]   = useState(false)
  const [sentInvites, setSentInvites]     = useState({})
  const [showLeave, setShowLeave]         = useState(false)
  const [leaveLoading, setLeaveLoading]   = useState(false)

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

  const handleDm = async (member) => {
    setProfileMember(null)
    const room = await getOrCreateDmRoom(project.id, member.id, member.name)
    if (room) navigate(`/project/${project.id}/chat/${room.id}`)
  }

  return (
    <div className={styles.section}>
      {/* 멤버 프로필 모달 */}
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

      {/* 프로젝트 나가기 확인 모달 */}
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
                          {state === 'sending' ? '...' : state === 'sent' ? '✅ 전송됨' : state === 'error' ? '오류' : '초대'}
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
