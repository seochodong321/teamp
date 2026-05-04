import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import styles from './ConnectPage.module.css'

export default function ConnectPage() {
  const navigate = useNavigate()
  const { connects, removeConnect, currentUser, projects, getOrCreateDmRoom } = useStore()
  const [search, setSearch] = useState('')
  const [profile, setProfile] = useState(null)
  const [pubProjects, setPubProjects] = useState([])
  const [loadingProfile, setLoadingProfile] = useState(false)

  const filtered = connects.filter((c) =>
    c.name.includes(search) || c.affiliation?.includes(search)
  )

  const grouped = filtered.reduce((acc, c) => {
    const key = c.projectName || '기타'
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  const handleRemove = (id, name) => {
    if (!window.confirm(`${name} 님을 팀프 커넥트에서 제거할까요?\n상대방에게는 알림이 가지 않아요.`)) return
    removeConnect(id)
  }

  const openProfile = async (contact) => {
    setProfile(contact)
    setPubProjects([])
    setLoadingProfile(true)
    try {
      const q = query(collection(db, 'projects'), where('memberIds', 'array-contains', contact.id))
      const snap = await getDocs(q)
      const pubs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.isPublic)
      setPubProjects(pubs)
    } catch {}
    setLoadingProfile(false)
  }

  // 공유 프로젝트에서 역할 메모 찾기
  const getRoleMemo = (contactId) => {
    for (const p of projects) {
      const m = p.members?.find((m) => m.id === contactId)
      if (m?.memo) return { memo: m.memo, projectName: p.name }
    }
    return null
  }

  const handleDm = async () => {
    if (!profile) return
    const shared = projects.find((p) => p.memberIds?.includes(profile.id))
    if (!shared) return
    const room = await getOrCreateDmRoom(shared.id, profile.id, profile.name)
    setProfile(null)
    navigate(`/project/${shared.id}/chat/${room.id}`)
  }

  return (
    <div className={styles.page}>

      {/* 프로필 모달 */}
      {profile && (
        <div className={styles.backdrop} onClick={() => setProfile(null)}>
          <div className={styles.profileModal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setProfile(null)}>✕</button>
            <div className={styles.profileAvatar}>{profile.name.charAt(0)}</div>
            <h3 className={styles.profileName}>{profile.name}</h3>
            {profile.affiliation && <p className={styles.profileAffil}>{profile.affiliation}</p>}
            {profile.email && <p className={styles.profileEmail}>{profile.email}</p>}

            {(() => {
              const memoInfo = getRoleMemo(profile.id)
              return memoInfo ? (
                <div className={styles.memoBox}>
                  <span className={styles.memoLabel}>{memoInfo.projectName}</span>
                  <p className={styles.memoText}>"{memoInfo.memo}"</p>
                </div>
              ) : null
            })()}

            <div className={styles.pubProjectsSection}>
              <p className={styles.pubProjectsLabel}>공개 프로젝트</p>
              {loadingProfile ? (
                <p className={styles.pubLoading}>불러오는 중...</p>
              ) : pubProjects.length === 0 ? (
                <p className={styles.pubEmpty}>공개된 프로젝트가 없어요</p>
              ) : (
                <div className={styles.pubList}>
                  {pubProjects.map((p) => {
                    const member = p.members?.find((m) => m.id === profile.id)
                    return (
                      <div key={p.id} className={styles.pubItem}>
                        <span className={styles.pubEmoji}>{p.emoji || '📁'}</span>
                        <div className={styles.pubInfo}>
                          <p className={styles.pubName}>{p.name}</p>
                          <p className={styles.pubMeta}>{p.category} · {p.startDate} ~ {p.endDate}</p>
                          {member?.memo && <p className={styles.pubMemo}>"{member.memo}"</p>}
                        </div>
                        <span className={styles.pubRole}>
                          {member?.role === 'leader' ? '👑' : member?.role === 'sub-leader' ? '⭐' : '팀원'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <button className={styles.dmBtn} onClick={handleDm}>
              💬 1:1 대화하기
            </button>
          </div>
        </div>
      )}

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>팀프 커넥트</h1>
          <p className={styles.subtitle}>같은 프로젝트에서 함께한 사람들이에요</p>
        </div>
        <span className={styles.countBadge}>{connects.length}명</span>
      </div>

      <div className={styles.searchWrap}>
        <input className={styles.searchInput} value={search}
          onChange={(e) => setSearch(e.target.value)} placeholder="이름 또는 소속으로 검색" />
      </div>

      {connects.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyIcon}>🔗</p>
          <p className={styles.emptyTitle}>아직 커넥트가 없어요</p>
          <p className={styles.emptySub}>프로젝트에 참여하면 함께한 팀원들이 자동으로 추가돼요</p>
        </div>
      )}

      {Object.entries(grouped).map(([projectName, members]) => (
        <div key={projectName} className={styles.group}>
          <p className={styles.groupTitle}>📁 {projectName}</p>
          <div className={styles.memberGrid}>
            {members.map((c) => (
              <div key={c.id} className={styles.memberCard} onClick={() => openProfile(c)}>
                <div className={styles.memberAvatar}>{c.name.charAt(0)}</div>
                <div className={styles.memberInfo}>
                  <p className={styles.memberName}>{c.name}</p>
                  {c.affiliation && <p className={styles.memberAffil}>{c.affiliation}</p>}
                  {c.email && <p className={styles.memberEmail}>{c.email}</p>}
                  <p className={styles.memberConnected}>연결됨 {c.connectedAt}</p>
                </div>
                <button
                  className={styles.removeBtn}
                  onClick={(e) => { e.stopPropagation(); handleRemove(c.id, c.name) }}
                  title="커넥트에서 제거"
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && connects.length > 0 && (
        <div className={styles.empty}><p className={styles.emptyTitle}>검색 결과가 없어요</p></div>
      )}
    </div>
  )
}
