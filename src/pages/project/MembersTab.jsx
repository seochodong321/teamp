import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase.js'
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
  const { sendProjectInvite, getOrCreateDmRoom, leaveOrDeleteProject } = useStore()

  const [profileMember, setProfileMember] = useState(null)
  const [profileExtra, setProfileExtra]   = useState(null)   // { oneliner, username }
  const [profilePubs, setProfilePubs]     = useState([])
  const [profileLoading, setProfileLoading] = useState(false)
  const [inviteCopied, setInviteCopied]   = useState(false)
  const [sentInvites, setSentInvites]     = useState({})
  const [showLeave, setShowLeave]         = useState(false)
  const [leaveLoading, setLeaveLoading]   = useState(false)
  const [leaveError, setLeaveError]       = useState('')

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
      const userSnap = await getDoc(doc(db, 'users', member.id))
      const ud = userSnap.exists() ? userSnap.data() : {}
      setProfileExtra({ oneliner: ud.oneliner || '', username: ud.username || '' })
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
            <div className={styles.profileAvatar}>{(profileMember.id === currentUser.id ? currentUser.name : profileMember.name).charAt(0)}</div>
            <h3 className={styles.profileName}>{profileMember.id === currentUser.id ? currentUser.name : profileMember.name}</h3>
            <span className={styles.profileRole}>{ROLE_LABEL[profileMember.role]}</span>
            {profileExtra?.oneliner && <p className={styles.profileOneliner}>"{profileExtra.oneliner}"</p>}
            {profileMember.affiliation && <p className={styles.profileAffil}>{profileMember.affiliation}</p>}
            {profileMember.email && <p className={styles.profileEmail}>{profileMember.email}</p>}
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
              <button className={styles.dmBtn} onClick={() => handleDm(profileMember)}>
                💬 1:1 대화하기
              </button>
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
            {leaveError && <p style={{ fontSize: 13, color: '#E24B4A', margin: '4px 0 0' }}>{leaveError}</p>}
            <div className={styles.modalBtns}>
              <button className={styles.modalCancel} onClick={() => { setShowLeave(false); setLeaveError('') }}>취소</button>
              <button
                className={styles.modalConfirm}
                style={{ background: '#E24B4A' }}
                disabled={leaveLoading}
                onClick={async () => {
                  setLeaveLoading(true)
                  setLeaveError('')
                  try {
                    const result = await leaveOrDeleteProject(project.id)
                    if (result?.error) { setLeaveError(result.error); return }
                    navigate('/home')
                  } catch {
                    setLeaveError('오류가 발생했어요. 다시 시도해주세요.')
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
