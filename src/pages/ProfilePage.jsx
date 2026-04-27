import React, { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useNavigate } from 'react-router-dom'
import styles from './ProfilePage.module.css'

const ROLE_LABEL = { leader: '👑 리더', 'sub-leader': '⭐ 부리더', member: '팀원' }

export default function ProfilePage() {
  const { currentUser, projects, togglePublic, updateMemberMemo, logout } = useStore()
  const navigate = useNavigate()

  const myProjects = projects.filter((p) => p.members.some((m) => m.id === currentUser.id))
  const [editingMemo, setEditingMemo] = useState(null) // projectId
  const [memoText, setMemoText] = useState('')

  const startEdit = (p) => {
    const me = p.members.find((m) => m.id === currentUser.id)
    setMemoText(me?.memo || '')
    setEditingMemo(p.id)
  }

  const saveMemo = (projectId) => {
    updateMemberMemo(projectId, currentUser.id, memoText)
    setEditingMemo(null)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>내 프로필</h1>

      <div className={styles.profileCard}>
        <div className={styles.avatarArea}>
          <div className={styles.avatar}>{currentUser.name.charAt(0)}</div>
          <div>
            <h2 className={styles.name}>{currentUser.name}</h2>
            <p className={styles.username}>{currentUser.username}</p>
            <p className={styles.email}>{currentUser.email}</p>
          </div>
        </div>
        <div className={styles.profileActions}>
          <button className={styles.editBtn}>편집</button>
          <button className={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
        </div>
      </div>

      {/* 공개된 프로젝트 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>공개된 프로젝트</h3>
        <p className={styles.sectionDesc}>다른 사람이 내 프로필에서 볼 수 있어요</p>
        <div className={styles.chipRow}>
          {myProjects.filter((p) => p.isPublic).map((p) => {
            const me = p.members.find((m) => m.id === currentUser.id)
            return (
              <div key={p.id} className={styles.chip} onClick={() => navigate(`/project/${p.id}`)}>
                <span className={styles.chipName}>{p.name}</span>
                <span className={styles.chipRole}>{ROLE_LABEL[me?.role] || ''}</span>
                <span className={`${styles.chipStatus} ${p.status === 'archived' ? styles.chipStatusDone : ''}`}>
                  {p.status === 'archived' ? '완료' : '진행 중'}
                </span>
              </div>
            )
          })}
          {myProjects.filter((p) => p.isPublic).length === 0 && (
            <p className={styles.emptyText}>공개된 프로젝트가 없어요</p>
          )}
        </div>
      </div>

      {/* 프로젝트별 역할 메모 + 공개 설정 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>프로젝트 관리</h3>
        <p className={styles.sectionDesc}>내가 참여한 프로젝트의 역할과 공개 여부를 설정하세요</p>

        <div className={styles.projectList}>
          {myProjects.map((p) => {
            const me = p.members.find((m) => m.id === currentUser.id)
            const isEditing = editingMemo === p.id
            return (
              <div key={p.id} className={styles.projectItem}>
                <div className={styles.projectItemTop}>
                  <div className={styles.projectItemLeft}>
                    <span className={styles.projectItemName}>{p.name}</span>
                    <span className={styles.projectItemRole}>{ROLE_LABEL[me?.role] || '팀원'}</span>
                    <span className={`${styles.projectItemStatus} ${p.status === 'archived' ? styles.projectItemStatusDone : ''}`}>
                      {p.status === 'archived' ? '완료' : '진행 중'}
                    </span>
                  </div>
                  <label className={styles.switch}>
                    <input type="checkbox" checked={p.isPublic} onChange={() => togglePublic(p.id)} />
                    <span className={styles.slider} />
                  </label>
                </div>

                {/* 역할 메모 */}
                <div className={styles.memoArea}>
                  {isEditing ? (
                    <div className={styles.memoEdit}>
                      <input className={styles.memoInput} value={memoText}
                        onChange={(e) => setMemoText(e.target.value)}
                        placeholder="이 프로젝트에서 내가 한 역할을 짧게 적어요 (공개 시 프로필에 표시)" />
                      <div className={styles.memoBtns}>
                        <button className={styles.memoSave} onClick={() => saveMemo(p.id)}>저장</button>
                        <button className={styles.memoCancel} onClick={() => setEditingMemo(null)}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.memoView} onClick={() => startEdit(p)}>
                      {me?.memo
                        ? <span className={styles.memoText}>"{me.memo}"</span>
                        : <span className={styles.memoPlaceholder}>+ 역할 메모 추가 (클릭해서 입력)</span>
                      }
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 요금제 */}
      <div className={styles.planCard}>
        <div className={styles.planLeft}>
          <span className={styles.planBadge}>Free</span>
          <p className={styles.planTitle}>무료 플랜 사용 중</p>
          <p className={styles.planDesc}>아카이브 500MB · 프로젝트 5개까지</p>
        </div>
        <button className={styles.upgradeBtn}>업그레이드 →</button>
      </div>
    </div>
  )
}
