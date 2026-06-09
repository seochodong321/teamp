import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import styles from './ConnectPage.module.css'

export default function ConnectPage() {
  const navigate = useNavigate()
  const { connects, removeConnect, currentUser, projects, showError, showConfirm, getOrCreateDmRoom } = useStore()
  const [search, setSearch] = useState('')
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [showInvite, setShowInvite] = useState(false)

  // 동일인이 여러 프로젝트에 걸쳐 있을 수 있으므로 ID 기준 dedup
  const uniqueContacts = useMemo(() => {
    const seen = new Set()
    return connects.filter((c) => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })
  }, [connects])

  const q = search.toLowerCase()
  const filtered = uniqueContacts.filter((c) =>
    c.name.toLowerCase().includes(q) || c.affiliation?.toLowerCase().includes(q)
  )

  // 로컬 projects 스토어에서 함께한 프로젝트 목록
  const getSharedProjects = (contactId) =>
    projects.filter((p) =>
      !p.isTutorial &&
      p.members?.some((m) => m.id === currentUser.id) &&
      p.members?.some((m) => m.id === contactId)
    ).map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji || '📁',
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
    }))

  // 초대 가능한 내 리더 프로젝트 (contact가 아직 없는 것만)
  const getInviteableProjects = (contactId) =>
    projects.filter((p) =>
      p.status === 'active' &&
      !p.isTutorial &&
      p.members?.find((m) => m.id === currentUser.id)?.role === 'leader' &&
      !p.members?.some((m) => m.id === contactId)
    )

  const handleRemove = async (id, name) => {
    if (!await showConfirm(`${name} 님을 팀프 커넥트에서 제거할까요?\n상대방에게는 알림이 가지 않아요.`)) return
    removeConnect(id)
  }

  const openProfile = async (contact) => {
    setProfile({ ...contact })
    setShowInvite(false)
    setLoadingProfile(true)
    try {
      const userSnap = await getDoc(doc(db, 'users', contact.id))
      const ud = userSnap.exists() ? userSnap.data() : {}
      setProfile({
        ...contact,
        name:        ud.name        || contact.name        || '',
        affiliation: ud.affiliation || contact.affiliation || '',
        email:       ud.email       || contact.email       || '',
        oneliner:    ud.oneliner    || '',
        username:    ud.username    || '',
        photoURL:    ud.photoURL    || null,
      })
    } catch {
      // 프로필 로드 실패해도 connects 데이터로 표시
    }
    setLoadingProfile(false)
  }

  const closeModal = () => { setProfile(null); setShowInvite(false) }

  const handleMessage = () => {
    if (!profile) return
    const username = profile.username?.replace('@', '')
    if (!username) { showError('상대방의 아이디를 찾을 수 없어요.'); return }
    closeModal()
    navigate(`/messages?compose=1&to=${username}`)
  }

  // 1:1 실시간 대화 — 함께한 프로젝트를 컨텍스트로 DM 방 생성/재사용
  const handleDm = async () => {
    if (!profile) return
    const shared = getSharedProjects(profile.id)
    const projId = shared[0]?.id
    if (!projId) { showError('함께한 프로젝트가 있어야 1:1 대화를 시작할 수 있어요.'); return }
    try {
      const room = await getOrCreateDmRoom(projId, profile.id, profile.name)
      if (room) { closeModal(); navigate(`/project/${projId}/chat/${room.id}`) }
    } catch {
      showError('대화방을 열지 못했어요. 잠시 후 다시 시도해주세요.')
    }
  }

  return (
    <div className={styles.page}>

      {/* 프로필 모달 */}
      {profile && (
        <div className={styles.backdrop} onClick={closeModal}>
          <div className={styles.profileModal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={closeModal}>✕</button>

            <div className={styles.profileAvatar}>
              {profile.photoURL
                ? <img src={profile.photoURL} alt="" className={styles.avatarImg} />
                : profile.name.charAt(0)}
            </div>
            <h3 className={styles.profileName}>{profile.name}</h3>
            {profile.oneliner && <p className={styles.profileOneliner}>"{profile.oneliner}"</p>}
            {profile.affiliation && <p className={styles.profileAffil}>{profile.affiliation}</p>}
            {profile.username && <p className={styles.profileUsername}>@{profile.username.replace('@', '')}</p>}

            {/* 함께한 프로젝트 */}
            {(() => {
              const shared = getSharedProjects(profile.id)
              return (
                <div className={styles.sharedSection}>
                  <p className={styles.sharedLabel}>함께한 프로젝트</p>
                  {loadingProfile ? (
                    <p className={styles.sharedEmpty}>
                      <span className={styles.loadingSpinner} /> 불러오는 중...
                    </p>
                  ) : shared.length === 0 ? (
                    <p className={styles.sharedEmpty}>함께한 프로젝트 정보가 없어요</p>
                  ) : (
                    <div className={styles.sharedList}>
                      {shared.map((p) => (
                        <div key={p.id} className={styles.sharedItem}>
                          <span className={styles.sharedEmoji}>{p.emoji}</span>
                          <div className={styles.sharedInfo}>
                            <p className={styles.sharedName}>{p.name}</p>
                            <p className={styles.sharedPeriod}>
                              {p.startDate}{p.endDate ? ` ~ ${p.endDate}` : ''}
                              <span className={p.status === 'archived' ? styles.tagDone : styles.tagActive}>
                                {p.status === 'archived' ? '완료' : '진행 중'}
                              </span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            {profile.username && (
              <a
                href={`/u/${profile.username.replace('@', '')}`}
                target="_blank"
                rel="noreferrer"
                className={styles.teamfolioLink}
                onClick={(e) => e.stopPropagation()}
              >
                팀프폴리오 보기 →
              </a>
            )}

            {/* 1:1 대화(실시간) + 쪽지 — 커넥트는 둘 다 가능 */}
            <div className={styles.contactActions}>
              <button className={styles.dmBtn} onClick={handleDm}>
                💬 1:1 대화
              </button>
              <button className={styles.msgBtn} onClick={handleMessage}>
                ✉️ 쪽지
              </button>
            </div>

            {/* 프로젝트 초대 */}
            {(() => {
              const eligible = getInviteableProjects(profile.id)
              if (eligible.length === 0) return null
              return (
                <div className={styles.inviteWrap}>
                  {!showInvite ? (
                    <button className={styles.inviteToggleBtn} onClick={() => setShowInvite(true)}>
                      + 내 프로젝트로 초대하기
                    </button>
                  ) : (
                    <div className={styles.inviteList}>
                      <p className={styles.inviteLabel}>초대할 프로젝트 선택</p>
                      {eligible.map((p) => (
                        <button key={p.id} className={styles.inviteItem}
                          onClick={() => { closeModal(); navigate(`/project/${p.id}`) }}>
                          {p.emoji || '📁'} {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>팀프 커넥트 🔗</h1>
          <p className={styles.subtitle}>함께한 팀원들과 계속 연결되세요</p>
        </div>
        <span className={styles.countBadge}>{uniqueContacts.length}명</span>
      </div>

      <div className={styles.searchWrap}>
        <input className={styles.searchInput} value={search}
          onChange={(e) => setSearch(e.target.value)} placeholder="이름 또는 소속으로 검색" />
      </div>

      {uniqueContacts.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyIcon}>🔗</p>
          <p className={styles.emptyTitle}>아직 커넥트가 없어요</p>
          <p className={styles.emptySub}>프로젝트에 참여하면 함께한 팀원들이 자동으로 추가돼요</p>
        </div>
      )}

      <div className={styles.memberGrid}>
        {filtered.map((c) => {
          const shared = getSharedProjects(c.id)
          return (
            <div key={c.id} className={styles.memberCard} onClick={() => openProfile(c)}>
              <div className={styles.memberAvatar}>{c.name.charAt(0)}</div>
              <div className={styles.memberInfo}>
                <p className={styles.memberName}>{c.name}</p>
                {c.affiliation && <p className={styles.memberAffil}>{c.affiliation}</p>}
                {shared.length > 0 ? (
                  <div className={styles.projectChips}>
                    {shared.slice(0, 2).map((p) => (
                      <span key={p.id} className={styles.projectChip}>{p.emoji} {p.name}</span>
                    ))}
                    {shared.length > 2 && (
                      <span className={styles.projectChipMore}>+{shared.length - 2}</span>
                    )}
                  </div>
                ) : (
                  c.projectName && (
                    <div className={styles.projectChips}>
                      <span className={styles.projectChip}>📁 {c.projectName}</span>
                    </div>
                  )
                )}
              </div>
              <button
                className={styles.removeBtn}
                onClick={(e) => { e.stopPropagation(); handleRemove(c.id, c.name) }}
                title="커넥트에서 제거"
              >✕</button>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && uniqueContacts.length > 0 && (
        <div className={styles.empty}><p className={styles.emptyTitle}>검색 결과가 없어요</p></div>
      )}
    </div>
  )
}
