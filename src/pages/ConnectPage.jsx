import React, { useState } from 'react'
import { useStore } from '../store/useStore.js'
import styles from './ConnectPage.module.css'

export default function ConnectPage() {
  const { connects, removeConnect, currentUser } = useStore()
  const [search, setSearch] = useState('')
  const [removedId, setRemovedId] = useState(null)

  const filtered = connects.filter((c) =>
    c.name.includes(search) || c.affiliation?.includes(search)
  )

  const handleRemove = (id, name) => {
    if (!window.confirm(`${name} 님을 팀프 커넥트에서 제거할까요?\n상대방에게는 알림이 가지 않아요.`)) return
    removeConnect(id)
    setRemovedId(id)
  }

  // 프로젝트별로 그룹핑
  const grouped = filtered.reduce((acc, c) => {
    const key = c.projectName || '기타'
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>팀프 커넥트</h1>
          <p className={styles.subtitle}>같은 프로젝트에서 함께한 사람들이에요</p>
        </div>
        <span className={styles.countBadge}>{connects.length}명</span>
      </div>

      <div className={styles.searchWrap}>
        <input
          className={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름 또는 소속으로 검색"
        />
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
              <div key={c.id} className={styles.memberCard}>
                <div className={styles.memberAvatar}>{c.name.charAt(0)}</div>
                <div className={styles.memberInfo}>
                  <p className={styles.memberName}>{c.name}</p>
                  {c.affiliation && <p className={styles.memberAffil}>{c.affiliation}</p>}
                  {c.email && <p className={styles.memberEmail}>{c.email}</p>}
                  <p className={styles.memberConnected}>연결됨 {c.connectedAt}</p>
                </div>
                <button
                  className={styles.removeBtn}
                  onClick={() => handleRemove(c.id, c.name)}
                  title="커넥트에서 제거"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && connects.length > 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>검색 결과가 없어요</p>
        </div>
      )}

      <div className={styles.notice}>
        <p>💡 <strong>팀프 커넥트</strong>는 같은 프로젝트에 참여했던 사람들의 목록이에요.</p>
        <p>커넥트된 사람과는 1:1 채팅이 가능하고, 새 프로젝트를 제안할 수 있어요. (곧 출시 예정)</p>
      </div>
    </div>
  )
}