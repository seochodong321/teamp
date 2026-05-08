import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, db, storage } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import { FLOWER_TAGS } from '../constants.js'
import styles from './ProfilePage.module.css'

const ROLE_LABEL = { leader: '👑 리더', 'sub-leader': '⭐ 부리더', member: '팀원' }

export default function ProfilePage() {
  const navigate = useNavigate()
  const { currentUser, projects, messages, togglePublic, updateMemberMemo, updateProfile, logout, theme, toggleTheme, leaveOrDeleteProject } = useStore()
  const myProjects = projects.filter((p) => p.members.some((m) => m.id === currentUser.id))

  // 나의 여정 통계
  const [flowerSenders, setFlowerSenders] = useState(0)
  const [flowerTags, setFlowerTags] = useState({})
  const [photoUploading, setPhotoUploading] = useState(false)
  const photoFileRef = useRef(null)

  const completedProjects = myProjects.filter((p) => p.status === 'archived' && !p.isTutorial).length
  const doneTodos = myProjects.flatMap((p) => p.todos || []).filter((t) => t.status === 'done').length
  const leaderProjects = myProjects.filter((p) => !p.isTutorial && p.members.find((m) => m.id === currentUser?.id)?.role === 'leader').length

  useEffect(() => {
    const fetchFlowers = async () => {
      const archivedWithWrapup = myProjects.filter((p) => p.status === 'archived' && p.wrapupId && !p.isTutorial)
      const senderIds = new Set()
      const tagCounts = {}
      await Promise.all(archivedWithWrapup.map(async (p) => {
        try {
          const snap = await getDoc(doc(db, 'wrapups', p.wrapupId))
          if (snap.exists()) {
            const data = snap.data()
            const myFeedbacks = (data.feedbacks || []).filter((f) => f.toUserId === currentUser?.id)
            myFeedbacks.forEach((f) => {
              senderIds.add(f.fromUserId)
              ;(f.tags || []).forEach((tag) => {
                tagCounts[tag.id] = (tagCounts[tag.id] || 0) + 1
              })
            })
          }
        } catch {}
      }))
      setFlowerSenders(senderIds.size)
      setFlowerTags(tagCounts)
    }
    fetchFlowers()
  }, [myProjects.map((p) => p.wrapupId).join(',')])

  // 편집 모달 상태
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName]                 = useState('')
  const [editAffiliation, setEditAffiliation]   = useState('')
  const [editPhone, setEditPhone]               = useState('')
  const [editOneliner, setEditOneliner]         = useState('')
  const [saving, setSaving]                     = useState(false)

  const [editingMemo, setEditingMemo] = useState(null)
  const [memoText, setMemoText]       = useState('')

  const startEdit = (p) => {
    const me = p.members.find((m) => m.id === currentUser.id)
    setMemoText(me?.memo || '')
    setEditingMemo(p.id)
  }

  const saveMemo = (projectId) => {
    updateMemberMemo(projectId, currentUser.id, memoText)
    setEditingMemo(null)
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhotoUploading(true)
    try {
      const sRef = storageRef(storage, `users/${currentUser.id}/avatar.jpg`)
      await uploadBytes(sRef, file)
      const url = await getDownloadURL(sRef)
      await updateDoc(doc(db, 'users', currentUser.id), { photoURL: url })
      updateProfile({ photoURL: url })
    } catch {
      alert('업로드에 실패했어요. Firebase Storage가 활성화되지 않았거나 네트워크 오류예요.')
    } finally {
      setPhotoUploading(false)
      e.target.value = ''
    }
  }

  const openEditModal = () => {
    setEditName(currentUser.name || '')
    setEditAffiliation(currentUser.affiliation || '')
    setEditPhone(currentUser.phone || '')
    setEditOneliner(currentUser.oneliner || '')
    setShowEditModal(true)
  }

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      alert('이름은 비울 수 없어요.')
      return
    }
    setSaving(true)
    try {
      // Firestore에 저장
      if (currentUser.id) {
        await updateDoc(doc(db, 'users', currentUser.id), {
          name: editName.trim(),
          affiliation: editAffiliation.trim(),
          phone: editPhone.trim(),
          oneliner: editOneliner.trim(),
        })
      }
      // 로컬 상태 업데이트
      updateProfile({
        name: editName.trim(),
        affiliation: editAffiliation.trim(),
        phone: editPhone.trim(),
        oneliner: editOneliner.trim(),
      })
      setShowEditModal(false)
    } catch (err) {
      console.error(err)
      alert('저장에 실패했어요. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    try { await signOut(auth) } catch {}
    logout()
    navigate('/login')
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>내 프로필</h1>

      {/* 편집 모달 */}
      {showEditModal && (
        <div className={styles.backdrop} onClick={() => !saving && setShowEditModal(false)}>
          <div className={styles.editModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.editModalHeader}>
              <h2 className={styles.editModalTitle}>프로필 편집</h2>
              <button className={styles.closeBtn} onClick={() => !saving && setShowEditModal(false)}>✕</button>
            </div>

            <div className={styles.editModalBody}>
              <div className={styles.editField}>
                <label className={styles.editLabel}>이름 *</label>
                <input className={styles.editInput} value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="실명 또는 닉네임" />
              </div>

              <div className={styles.editField}>
                <label className={styles.editLabel}>
                  팀프 원라이너
                  <span className={styles.editLabelHint}>한 줄로 자신을 표현해보세요 ✨</span>
                </label>
                <input className={styles.editInput} value={editOneliner}
                  onChange={(e) => setEditOneliner(e.target.value.slice(0, 50))}
                  placeholder="예) 무엇이든 만들어보고 싶은 디자이너" maxLength={50} />
                <span className={styles.editCount}>{editOneliner.length}/50</span>
              </div>

              <div className={styles.editField}>
                <label className={styles.editLabel}>소속</label>
                <input className={styles.editInput} value={editAffiliation}
                  onChange={(e) => setEditAffiliation(e.target.value)}
                  placeholder="예) OO대학교 컴퓨터공학과" />
              </div>

              <div className={styles.editField}>
                <label className={styles.editLabel}>핸드폰 번호</label>
                <input className={styles.editInput} value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="010-0000-0000" type="tel" />
              </div>

              <p className={styles.editHint}>
                💡 이메일은 로그인 정보라 변경할 수 없어요
              </p>
            </div>

            <div className={styles.editModalFooter}>
              <button className={styles.editCancel} onClick={() => setShowEditModal(false)} disabled={saving}>
                취소
              </button>
              <button className={styles.editSave} onClick={handleSaveProfile} disabled={saving}>
                {saving ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 프로필 카드 */}
      <div className={styles.profileCard}>
        <div className={styles.avatarWrap} onClick={() => !photoUploading && photoFileRef.current?.click()} title="프로필 사진 변경">
          {currentUser.photoURL
            ? <img className={styles.avatarImg} src={currentUser.photoURL} alt={currentUser.name} />
            : <div className={styles.avatar}>{currentUser.name.charAt(0)}</div>
          }
          <div className={styles.avatarEditOverlay}>{photoUploading ? '⏳' : '📷'}</div>
          <input type="file" accept="image/*" ref={photoFileRef} style={{ display: 'none' }} onChange={handlePhotoUpload} />
        </div>
        <div className={styles.info}>
          <h2 className={styles.name}>{currentUser.name}</h2>
          {currentUser.oneliner && (
            <p className={styles.oneliner}>"{currentUser.oneliner}"</p>
          )}
          <p className={styles.username}>{currentUser.username}</p>
          {currentUser.affiliation && <p className={styles.detail}>🏢 {currentUser.affiliation}</p>}
          {currentUser.email && <p className={styles.detail}>✉️ {currentUser.email}</p>}
          {currentUser.phone && <p className={styles.detail}>📱 {currentUser.phone}</p>}
        </div>
        <div className={styles.profileActions}>
          <button className={styles.editBtn} onClick={openEditModal}>편집</button>
          <button className={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
        </div>
      </div>

      {/* 나의 여정 */}
      <div className={styles.journeySection}>
        <div className={styles.journeyHeader}>
          <div>
            <span className={styles.journeyTitle}>나의 여정</span>
            <span className={styles.journeySubtitle}>기여와 관계의 기록</span>
          </div>
          <span className={styles.journeyEmoji}>✨</span>
        </div>
        <div className={styles.journeyGrid}>
          <div className={styles.journeyItem}>
            <span className={styles.journeyIcon}>🎓</span>
            <span className={styles.journeyCount}>{completedProjects}</span>
            <span className={styles.journeyLabel}>완료한 프로젝트</span>
          </div>
          <div className={styles.journeyItem}>
            <span className={styles.journeyIcon}>🌸</span>
            <span className={styles.journeyCount}>{flowerSenders}</span>
            <span className={styles.journeyLabel}>꽃다발을 보낸 팀원</span>
          </div>
          <div className={styles.journeyItem}>
            <span className={styles.journeyIcon}>👑</span>
            <span className={styles.journeyCount}>{leaderProjects}</span>
            <span className={styles.journeyLabel}>리더 프로젝트</span>
          </div>
          <div className={styles.journeyItem}>
            <span className={styles.journeyIcon}>✅</span>
            <span className={styles.journeyCount}>{doneTodos}</span>
            <span className={styles.journeyLabel}>완료한 할 일</span>
          </div>
        </div>
        {Object.keys(flowerTags).length > 0 && (
          <div className={styles.flowerTagsRow}>
            {FLOWER_TAGS
              .filter((t) => flowerTags[t.id])
              .sort((a, b) => (flowerTags[b.id] || 0) - (flowerTags[a.id] || 0))
              .map((t) => (
                <span key={t.id} className={styles.flowerTag}>
                  {t.emoji} {t.label} <strong>{flowerTags[t.id]}</strong>
                </span>
              ))}
          </div>
        )}
      </div>

      {/* 공개된 프로젝트 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>공개된 프로젝트</h3>
          <p className={styles.sectionDesc}>다른 사람이 내 프로필에서 볼 수 있어요</p>
        </div>
        <div className={styles.publicChips}>
          {myProjects.filter((p) => p.isPublic && !p.isTutorial).map((p) => {
            const me = p.members.find((m) => m.id === currentUser.id)
            return (
              <div key={p.id} className={styles.publicChip}>
                {p.emoji && <span>{p.emoji}</span>}
                <div className={styles.publicChipInfo}>
                  <span className={styles.publicChipName}>{p.name}</span>
                  {me?.memo && <span className={styles.publicChipMemo}>{me.memo}</span>}
                </div>
                <span className={styles.publicChipRole}>{ROLE_LABEL[me?.role]}</span>
                <span className={`${styles.publicChipStatus} ${p.status === 'archived' ? styles.statusDone : styles.statusActive}`}>
                  {p.status === 'archived' ? '완료' : '진행 중'}
                </span>
              </div>
            )
          })}
          {myProjects.filter((p) => p.isPublic && !p.isTutorial).length === 0 && (
            <p className={styles.emptyText}>공개된 프로젝트가 없어요</p>
          )}
        </div>
      </div>

      {/* 프로젝트 관리 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>프로젝트 관리</h3>
          <p className={styles.sectionDesc}>공개 여부를 설정하고 나의 역할을 기록해요</p>
        </div>

        <div className={styles.projectList}>
          {myProjects.filter((p) => !p.isTutorial).map((p) => {
            const me = p.members.find((m) => m.id === currentUser.id)
            const isEditing = editingMemo === p.id
            return (
              <div key={p.id} className={styles.projectItem}>
                <div className={styles.projectItemTop}>
                  <div className={styles.projectItemLeft}>
                    {p.emoji && <span className={styles.projectItemEmoji}>{p.emoji}</span>}
                    <span className={styles.projectItemName}>{p.name}</span>
                    <span className={styles.projectItemRole}>{ROLE_LABEL[me?.role]}</span>
                    <span className={`${styles.projectItemStatus} ${p.status === 'archived' ? styles.statusDone : styles.statusActive}`}>
                      {p.status === 'archived' ? '완료' : '진행 중'}
                    </span>
                  </div>
                  <div className={styles.projectItemActions}>
                    <button
                      className={`${styles.toggle} ${p.isPublic ? styles.toggleOn : styles.toggleOff}`}
                      onClick={() => togglePublic(p.id)}
                      aria-label={p.isPublic ? '공개 중' : '비공개'}
                    >
                      <span className={styles.toggleKnob} />
                      <span className={styles.toggleLabel}>{p.isPublic ? '공개' : '비공개'}</span>
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => {
                        const isLeader = p.members.find((m) => m.id === currentUser.id)?.role === 'leader'
                        const msg = isLeader
                          ? `"${p.name}" 프로젝트를 삭제할까요? 모든 팀원이 접근할 수 없게 돼요.`
                          : `"${p.name}" 프로젝트에서 나갈까요?`
                        if (window.confirm(msg)) leaveOrDeleteProject(p.id)
                      }}
                      title="삭제 / 나가기"
                    >
                      🗑
                    </button>
                  </div>
                </div>
                <div className={styles.memoArea}>
                  {isEditing ? (
                    <div className={styles.memoEdit}>
                      <input className={styles.memoInput} value={memoText}
                        onChange={(e) => setMemoText(e.target.value)}
                        placeholder="이 프로젝트에서 내가 한 역할을 짧게 적어요" autoFocus />
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
          {myProjects.filter((p) => !p.isTutorial).length === 0 && (
            <p className={styles.emptyText}>아직 참여한 프로젝트가 없어요</p>
          )}
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
      
      {/* 환경 설정 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>환경 설정</h3>
          <p className={styles.sectionDesc}>나에게 맞는 환경을 설정하세요</p>
        </div>
        <div className={styles.themeRow}>
          <div className={styles.themeInfo}>
            <span className={styles.themeIcon}>{theme === 'dark' ? '🌙' : '☀️'}</span>
            <div>
              <p className={styles.themeName}>{theme === 'dark' ? '다크 모드' : '라이트 모드'}</p>
              <p className={styles.themeDesc}>
                {theme === 'dark' ? '눈이 편한 어두운 배경이에요' : '깔끔한 밝은 배경이에요'}
              </p>
            </div>
          </div>
          <button
            className={`${styles.toggle} ${theme === 'dark' ? styles.toggleOn : styles.toggleOff}`}
            onClick={toggleTheme}
            aria-label="다크 모드 전환"
          >
            <span className={styles.toggleKnob} />
            <span className={styles.toggleLabel}>{theme === 'dark' ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>
    </div>
    
  )
}