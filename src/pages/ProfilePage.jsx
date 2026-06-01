import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut, sendPasswordResetEmail } from 'firebase/auth'
import { doc, getDoc, updateDoc, query, collection, where, getDocs, writeBatch } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, db, storage } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import { FLOWER_TAGS, ROLE_LABEL } from '../constants.js'
import NotificationSettings from '../components/NotificationSettings.jsx'
import styles from './ProfilePage.module.css'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { currentUser, projects, messages, togglePublic, updateMemberMemo, updateProfile, logout, theme, toggleTheme, leaveOrDeleteProject, profiles, addSubProfile, updateSubProfile, deleteSubProfile, showError, showConfirm, deleteAccount } = useStore()
  const myProjects = useMemo(
    () => projects.filter((p) => p.members.some((m) => m.id === currentUser.id)),
    [projects, currentUser.id]
  )

  // 나의 여정 통계
  const [flowerSenders, setFlowerSenders] = useState(0)
  const [flowerTags, setFlowerTags] = useState({})
  const [photoUploading, setPhotoUploading] = useState(false)
  const photoFileRef = useRef(null)
  const usernameDebounceRef = useRef(null)

  const completedProjects = useMemo(() => myProjects.filter((p) => p.status === 'archived' && !p.isTutorial).length, [myProjects])
  const doneTodos = useMemo(() => myProjects.flatMap((p) => p.todos || []).filter((t) => t.status === 'done').length, [myProjects])
  const leaderProjects = useMemo(() => myProjects.filter((p) => !p.isTutorial && p.members.find((m) => m.id === currentUser.id)?.role === 'leader').length, [myProjects, currentUser.id])

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
      // 팀프폴리오에서 읽을 수 있도록 유저 문서에 캐싱 (본인만 쓸 수 있는 필드)
      try {
        await updateDoc(doc(db, 'users', currentUser.id), {
          flowerTagSummary: tagCounts,
          flowerSenderCount: senderIds.size,
        })
      } catch {}
    }
    fetchFlowers()
  }, [myProjects.map((p) => p.wrapupId).join(',')])

  // 편집 모달 상태
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName]                 = useState('')
  const [editUsername, setEditUsername]         = useState('')
  const [usernameStatus, setUsernameStatus]     = useState('idle') // idle | checking | ok | taken
  const [usernameSuggestion, setUsernameSuggestion] = useState('')
  const [editAffiliation, setEditAffiliation]   = useState('')
  const [editPhone, setEditPhone]               = useState('')
  const [editOneliner, setEditOneliner]         = useState('')
  const [editBirthYear, setEditBirthYear]       = useState('')
  const [editBirthMonth, setEditBirthMonth]     = useState('')
  const [editBirthDay, setEditBirthDay]         = useState('')
  const [saving, setSaving]                     = useState(false)

  const [editingMemo, setEditingMemo] = useState(null)
  const [memoText, setMemoText]       = useState('')
  const [copied, setCopied]           = useState(false)
  const [copiedLink, setCopiedLink]   = useState(false)

  // 서브 프로필 관리 상태
  const [showProfileForm, setShowProfileForm] = useState(false)
  const [editingProfile, setEditingProfile]   = useState(null) // null=신규, id=수정 중
  const [pfLabel, setPfLabel]         = useState('')
  const [pfAffil, setPfAffil]         = useState('')
  const [pfOneliner, setPfOneliner]   = useState('')
  const [pfSaving, setPfSaving]       = useState(false)
  const [deleteConfirmed, setDeleteConfirmed] = useState(false)
  const [deleting, setDeleting]               = useState(false)
  const [dangerOpen, setDangerOpen]           = useState(false)
  const [pwResetSent, setPwResetSent]         = useState(false)
  const [pwResetLoading, setPwResetLoading]   = useState(false)

  // 팀프폴리오 설정
  const [tfDraft, setTfDraft] = useState(() => {
    const s = currentUser.teamfolioSettings || {}
    return {
      published:    s.published    !== false,
      showFlowers:  s.showFlowers  !== false,
      showProjects: s.showProjects !== false,
      showStats:    s.showStats    !== false,
    }
  })
  const [tfSaving, setTfSaving] = useState(false)
  const [tfSaved,  setTfSaved]  = useState(false)

  const handleSendPasswordReset = async () => {
    if (!currentUser.email || !auth.currentUser) return
    setPwResetLoading(true)
    try {
      await sendPasswordResetEmail(auth, currentUser.email)
      setPwResetSent(true)
    } catch {
      showError('비밀번호 재설정 메일 발송 중 오류가 발생했어요.')
    } finally {
      setPwResetLoading(false)
    }
  }

  const openNewProfile = () => {
    setEditingProfile(null)
    setPfLabel(''); setPfAffil(''); setPfOneliner('')
    setShowProfileForm(true)
  }
  const openEditProfile = (p) => {
    setEditingProfile(p.id)
    setPfLabel(p.label || ''); setPfAffil(p.affiliation || ''); setPfOneliner(p.oneliner || '')
    setShowProfileForm(true)
  }
  const handleSaveSubProfile = async () => {
    if (!pfLabel.trim()) return
    setPfSaving(true)
    if (editingProfile) {
      await updateSubProfile(editingProfile, { label: pfLabel.trim(), affiliation: pfAffil.trim(), oneliner: pfOneliner.trim() })
    } else {
      await addSubProfile({ label: pfLabel.trim(), affiliation: pfAffil.trim(), oneliner: pfOneliner.trim() })
    }
    setPfSaving(false)
    setShowProfileForm(false)
  }

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
    if (file.size > 5 * 1024 * 1024) { showError('이미지 크기는 5MB 이하여야 해요.'); e.target.value = ''; return }
    setPhotoUploading(true)
    try {
      const sRef = storageRef(storage, `users/${currentUser.id}/avatar.jpg`)
      await uploadBytes(sRef, file)
      const url = await getDownloadURL(sRef)
      await updateDoc(doc(db, 'users', currentUser.id), { photoURL: url })
      updateProfile({ photoURL: url })
      // 참여 중인 프로젝트의 members 배열에 photoURL 동기화
      if (myProjects.length > 0) {
        const batch = writeBatch(db)
        myProjects.forEach((p) => {
          batch.update(doc(db, 'projects', p.id), {
            members: p.members.map((m) =>
              m.id === currentUser.id ? { ...m, photoURL: url } : m
            ),
          })
        })
        await batch.commit()
      }
    } catch {
      showError('업로드에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setPhotoUploading(false)
      e.target.value = ''
    }
  }

  const saveTfSettings = async () => {
    setTfSaving(true)
    setTfSaved(false)
    try {
      await updateProfile({ teamfolioSettings: tfDraft })
      setTfSaved(true)
      setTimeout(() => setTfSaved(false), 2500)
    } catch {
      showError('저장에 실패했어요.')
    } finally {
      setTfSaving(false)
    }
  }

  const checkUsername = (raw) => {
    const val = raw.toLowerCase().replace(/^@/, '')
    const current = (currentUser.username || '').replace(/^@/, '')
    if (val === current) { setUsernameStatus('ok'); setUsernameSuggestion(''); return }
    if (!val || !/^[a-z0-9_]{3,20}$/.test(val)) { setUsernameStatus('idle'); setUsernameSuggestion(''); return }
    setUsernameStatus('checking')
    clearTimeout(usernameDebounceRef.current)
    usernameDebounceRef.current = setTimeout(async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), where('username', '==', `@${val}`)))
        if (snap.empty) {
          setUsernameStatus('ok')
          setUsernameSuggestion('')
        } else {
          setUsernameStatus('taken')
          for (const s of ['_', '1', '2', String(new Date().getFullYear()).slice(2)]) {
            const candidate = `${val}${s}`.slice(0, 20)
            if (/^[a-z0-9_]{3,20}$/.test(candidate)) {
              const c = await getDocs(query(collection(db, 'users'), where('username', '==', `@${candidate}`)))
              if (c.empty) { setUsernameSuggestion(candidate); break }
            }
          }
        }
      } catch { setUsernameStatus('idle'); setUsernameSuggestion('') }
    }, 400)
  }

  const openEditModal = () => {
    setEditName(currentUser.name || '')
    const rawU = (currentUser.username || '').replace(/^@/, '')
    setEditUsername(rawU)
    setUsernameStatus(rawU ? 'ok' : 'idle')
    setUsernameSuggestion('')
    setEditAffiliation(currentUser.affiliation || '')
    setEditPhone(currentUser.phone || '')
    setEditOneliner(currentUser.oneliner || '')
    const bd = currentUser.birthday || ''
    if (bd.length === 10) {
      const [y, m, d] = bd.split('-')
      setEditBirthYear(y); setEditBirthMonth(m); setEditBirthDay(d)
    } else if (bd.length === 5) {
      const [m, d] = bd.split('-')
      setEditBirthYear(''); setEditBirthMonth(m); setEditBirthDay(d)
    } else {
      setEditBirthYear(''); setEditBirthMonth(''); setEditBirthDay('')
    }
    setShowEditModal(true)
  }

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      showError('이름은 비울 수 없어요.')
      return
    }
    setSaving(true)
    const newBirthday = editBirthYear && editBirthMonth && editBirthDay
      ? `${editBirthYear}-${editBirthMonth}-${editBirthDay}`
      : (editBirthMonth && editBirthDay ? `${editBirthMonth}-${editBirthDay}` : '')
    const newUsername = editUsername.trim() ? `@${editUsername.trim().toLowerCase().replace(/^@/, '')}` : currentUser.username
    if (usernameStatus === 'checking') { showError('아이디 중복 확인 중이에요. 잠시 후 다시 시도해주세요.'); setSaving(false); return }
    if (usernameStatus === 'taken') { showError('이미 사용 중인 아이디예요.'); setSaving(false); return }
    try {
      // Firestore에 저장
      if (currentUser.id) {
        await updateDoc(doc(db, 'users', currentUser.id), {
          name: editName.trim(),
          username: newUsername,
          affiliation: editAffiliation.trim(),
          phone: editPhone.trim(),
          oneliner: editOneliner.trim(),
          birthday: newBirthday,
        })
        // 참여 중인 프로젝트의 members 배열 동기화 (이름·소속 스냅샷 갱신)
        const nameChanged = editName.trim() !== (currentUser.name || '')
        const affiliationChanged = editAffiliation.trim() !== (currentUser.affiliation || '')
        if ((nameChanged || affiliationChanged) && myProjects.length > 0) {
          const batch = writeBatch(db)
          myProjects.forEach((p) => {
            batch.update(doc(db, 'projects', p.id), {
              members: p.members.map((m) =>
                m.id === currentUser.id
                  ? { ...m, name: editName.trim(), affiliation: editAffiliation.trim() }
                  : m
              ),
            })
          })
          await batch.commit()
        }
      }
      // 로컬 상태 업데이트
      updateProfile({
        name: editName.trim(),
        username: newUsername,
        affiliation: editAffiliation.trim(),
        phone: editPhone.trim(),
        oneliner: editOneliner.trim(),
        birthday: newBirthday,
      })
      setShowEditModal(false)
    } catch (err) {
      console.error(err)
      showError('저장에 실패했어요. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    try { await signOut(auth) } catch { try { await signOut(auth) } catch {} }
    logout()
    navigate('/login')
  }

  const handleDeleteAccount = async () => {
    const confirmed = await showConfirm('정말로 탈퇴하시겠어요?\n계정과 모든 데이터가 즉시 삭제되며 복구할 수 없습니다.')
    if (!confirmed) return
    setDeleting(true)
    try {
      await deleteAccount()
      navigate('/', { replace: true })
    } catch (e) {
      if (e.code === 'requires-recent-login') {
        showError('보안을 위해 로그아웃 후 다시 로그인한 뒤 탈퇴해주세요.')
      } else {
        showError('탈퇴 처리 중 오류가 발생했어요. 다시 시도해주세요.')
      }
      setDeleting(false)
    }
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
                  placeholder="실명 또는 닉네임" disabled={saving} />
              </div>

              <div className={styles.editField}>
                <label className={styles.editLabel}>@아이디 <span className={styles.editLabelHint}>영문·숫자·_ 3~20자</span></label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputAtPrefix}>@</span>
                  <input className={`${styles.editInput} ${styles.editInputPadded}`}
                    value={editUsername}
                    onChange={(e) => { setEditUsername(e.target.value); checkUsername(e.target.value) }}
                    placeholder="나만의 아이디" maxLength={20} disabled={saving} />
                  {usernameStatus === 'ok' && (
                    <span className={styles.inputStatusRight}>
                      <span className={`${styles.inputStatusIcon} ${styles.inputStatusIconOk}`}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5L5.5 10L11 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </span>
                      <span className={styles.inputStatusTextOk}>사용 가능</span>
                    </span>
                  )}
                  {usernameStatus === 'taken' && (
                    <span className={styles.inputStatusRight}>
                      <span className={`${styles.inputStatusIcon} ${styles.inputStatusIconTaken}`}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2L10 10M10 2L2 10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                      </span>
                      <span className={styles.inputStatusTextTaken}>이미 사용 중</span>
                      {usernameSuggestion && (
                        <button
                          type="button"
                          className={styles.usernameSuggestBtn}
                          onClick={() => { setEditUsername(usernameSuggestion); checkUsername(usernameSuggestion) }}>
                          @{usernameSuggestion} 사용하기
                        </button>
                      )}
                    </span>
                  )}
                  {usernameStatus === 'checking' && <span className={styles.inputSpinner} />}
                </div>
              </div>

              <div className={styles.editField}>
                <label className={styles.editLabel}>
                  팀프 원라이너
                  <span className={styles.editLabelHint}>한 줄로 자신을 표현해보세요 ✨</span>
                </label>
                <input className={styles.editInput} value={editOneliner}
                  onChange={(e) => setEditOneliner(e.target.value.slice(0, 50))}
                  placeholder="예) 무엇이든 만들어보고 싶은 디자이너" maxLength={50} disabled={saving} />
                <span className={styles.editCount}>{editOneliner.length}/50</span>
              </div>

              <div className={styles.editField}>
                <label className={styles.editLabel}>소속</label>
                <input className={styles.editInput} value={editAffiliation}
                  onChange={(e) => setEditAffiliation(e.target.value)}
                  placeholder="예) OO대학교 컴퓨터공학과" disabled={saving} />
              </div>

              <div className={styles.editField}>
                <label className={styles.editLabel}>핸드폰 번호</label>
                <input className={styles.editInput} value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="010-0000-0000" type="tel" disabled={saving} />
              </div>

              <div className={styles.editField}>
                <label className={styles.editLabel}>생년월일</label>
                <div className={styles.birthRow}>
                  <select className={`${styles.editInput} ${styles.birthYear}`} value={editBirthYear}
                    onChange={(e) => setEditBirthYear(e.target.value)}>
                    <option value="">년도</option>
                    {Array.from({ length: 36 }, (_, i) => 2010 - i).map((y) => (
                      <option key={y} value={String(y)}>{y}년</option>
                    ))}
                  </select>
                  <select className={`${styles.editInput} ${styles.birthField}`} value={editBirthMonth}
                    onChange={(e) => { setEditBirthMonth(e.target.value); setEditBirthDay('') }}>
                    <option value="">월</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={String(m).padStart(2, '0')}>{m}월</option>
                    ))}
                  </select>
                  <select className={`${styles.editInput} ${styles.birthField}`} value={editBirthDay}
                    onChange={(e) => setEditBirthDay(e.target.value)} disabled={!editBirthMonth}>
                    <option value="">일</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={String(d).padStart(2, '0')}>{d}일</option>
                    ))}
                  </select>
                </div>
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
          <div className={styles.avatarEditOverlay} style={photoUploading ? { opacity: 1 } : undefined}>{photoUploading ? '⏳' : '📷'}</div>
          <input type="file" accept="image/*" ref={photoFileRef} className={styles.hidden} onChange={handlePhotoUpload} />
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
          {currentUser.birthday && (() => {
            const bd = currentUser.birthday
            const parts = bd.length === 10 ? bd.split('-') : ['', ...bd.split('-')]
            const [y, m, d] = parts
            const label = y ? `${y}년 ${parseInt(m)}월 ${parseInt(d)}일` : `${parseInt(m)}월 ${parseInt(d)}일`
            return <p className={styles.detail}>🎂 {label}</p>
          })()}
        </div>
        <div className={styles.profileActions}>
          <button className={styles.editBtn} onClick={openEditModal}>편집</button>
          {currentUser.username && (
            <button className={styles.shareBtn} onClick={() => {
              const url = `${window.location.origin}/u/${(currentUser.username || '').replace('@', '')}`
              navigator.clipboard.writeText(url).catch(() => {})
              window.open(url, '_blank', 'noopener,noreferrer')
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}>
              {copied ? '✓ 링크 복사됨' : '🗂️ 팀프폴리오'}
            </button>
          )}
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
          {[
            { icon: '🎓', count: completedProjects, label: '완료한 프로젝트' },
            { icon: '🌸', count: flowerSenders,     label: '나에게 꽃다발을 보낸 팀원' },
            { icon: '👑', count: leaderProjects,    label: '리더 프로젝트' },
            { icon: '✅', count: doneTodos,         label: '완료한 할 일' },
          ].map(({ icon, count, label }) => (
            <div key={label} className={styles.journeyItem}>
              <span className={`${styles.journeyIcon} ${count === 0 ? styles.journeyIconEmpty : ''}`}>{icon}</span>
              <span className={`${styles.journeyCount} ${count === 0 ? styles.journeyCountEmpty : ''}`}>{count}</span>
              <span className={styles.journeyLabel}>{label}</span>
            </div>
          ))}
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

      {/* 알림 설정 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>알림</h3>
          <p className={styles.sectionDesc}>메시지·할 일·공지 알림을 받으려면 켜주세요</p>
        </div>
        <NotificationSettings />
      </div>

      {/* 팀프폴리오 관리 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>팀프폴리오 관리</h3>
          <p className={styles.sectionDesc}>링크로 공유 가능한 나만의 포트폴리오 페이지예요</p>
        </div>

        <div className={styles.themeRow}>
          <div className={styles.themeInfo}>
            <span className={styles.themeIcon}>🗂️</span>
            <div>
              <p className={styles.themeName}>공개 여부</p>
              <p className={styles.themeDesc}>{tfDraft.published ? '외부 링크에서 누구나 볼 수 있어요' : '링크로 접근해도 보이지 않아요'}</p>
            </div>
          </div>
          <button
            className={`${styles.toggle} ${tfDraft.published ? styles.toggleOn : styles.toggleOff}`}
            onClick={() => setTfDraft((d) => ({ ...d, published: !d.published }))}
          >
            <span className={styles.toggleKnob} />
            <span className={styles.toggleLabel}>{tfDraft.published ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {tfDraft.published && (
          <>
            <p className={styles.tfLabel}>포함할 항목</p>
            <div className={styles.tfChipRow}>
              {[
                { key: 'showFlowers',  icon: '🌸', label: '꽃다발' },
                { key: 'showProjects', icon: '📁', label: '프로젝트 이력' },
                { key: 'showStats',    icon: '📊', label: '통계' },
              ].map(({ key, icon, label }) => (
                <button
                  key={key}
                  className={`${styles.tfChip} ${tfDraft[key] ? styles.tfChipOn : ''}`}
                  onClick={() => setTfDraft((d) => ({ ...d, [key]: !d[key] }))}
                >
                  {icon} {label}{tfDraft[key] && <span className={styles.tfChipCheck}>✓</span>}
                </button>
              ))}
            </div>

            {currentUser.username && (
              <div className={styles.tfUrlRow}>
                <span className={styles.tfUrl}>
                  teamp.kr/u/{(currentUser.username || '').replace('@', '')}
                </span>
                <button className={styles.tfCopyBtn} onClick={() => {
                  const url = `${window.location.origin}/u/${(currentUser.username || '').replace('@', '')}`
                  navigator.clipboard.writeText(url).catch(() => {})
                  setCopiedLink(true)
                  setTimeout(() => setCopiedLink(false), 2000)
                }}>{copiedLink ? '✓ 복사됨' : '🔗 복사'}</button>
                <a
                  href={`/u/${(currentUser.username || '').replace('@', '')}`}
                  target="_blank" rel="noreferrer"
                  className={styles.tfOpenBtn}
                >열기 →</a>
              </div>
            )}
          </>
        )}

        <button
          className={`${styles.tfSaveBtn} ${tfSaved ? styles.tfSaveBtnDone : ''}`}
          onClick={saveTfSettings}
          disabled={tfSaving}
        >
          {tfSaving ? '저장 중...' : tfSaved ? '✓ 반영됨' : '반영하기'}
        </button>
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
          {!myProjects.some((p) => p.isPublic && !p.isTutorial) && (
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
                      onClick={async () => {
                        const isLeader = p.members.find((m) => m.id === currentUser.id)?.role === 'leader'
                        const msg = isLeader
                          ? `"${p.name}" 프로젝트를 삭제할까요? 모든 팀원이 접근할 수 없게 돼요.`
                          : `"${p.name}" 프로젝트에서 나갈까요?`
                        if (await showConfirm(msg)) leaveOrDeleteProject(p.id)
                      }}
                    >
                      {p.members.find((m) => m.id === currentUser.id)?.role === 'leader' ? '삭제' : '나가기'}
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

      {/* 멀티 프로필 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>멀티프로필</h3>
          <p className={styles.sectionDesc}>소속별로 다른 프로필을 만들어 상황에 맞게 사용해요</p>
        </div>

        {/* 기본 프로필 (현재 계정) */}
        <div className={styles.profileItem}>
          <div className={styles.profileItemLeft}>
            <span className={styles.profileDefaultBadge}>기본</span>
            <div>
              <p className={styles.profileItemLabel}>{currentUser?.name}</p>
              {currentUser?.affiliation && <p className={styles.profileItemAffil}>🏢 {currentUser.affiliation}</p>}
              {currentUser?.oneliner && <p className={styles.profileItemOneliner}>"{currentUser.oneliner}"</p>}
            </div>
          </div>
        </div>

        {/* 서브 프로필 목록 */}
        {profiles.map((p) => (
          <div key={p.id} className={styles.profileItem}>
            <div className={styles.profileItemLeft}>
              <div className={styles.profileSubIcon}>{p.label?.charAt(0) || 'P'}</div>
              <div>
                <p className={styles.profileItemLabel}>{p.label}</p>
                {p.affiliation && <p className={styles.profileItemAffil}>🏢 {p.affiliation}</p>}
                {p.oneliner && <p className={styles.profileItemOneliner}>"{p.oneliner}"</p>}
              </div>
            </div>
            <div className={styles.profileItemActions}>
              <button className={styles.profileEditBtn} onClick={() => openEditProfile(p)}>편집</button>
              <button className={styles.profileDeleteBtn} onClick={async () => {
                if (await showConfirm(`"${p.label}" 프로필을 삭제할까요?`)) deleteSubProfile(p.id)
              }}>🗑</button>
            </div>
          </div>
        ))}

        <button className={styles.addProfileBtn} onClick={openNewProfile}>
          + 새 프로필 추가
        </button>
      </div>

      {/* 서브 프로필 편집 모달 */}
      {showProfileForm && (
        <div className={styles.backdrop} onClick={() => !pfSaving && setShowProfileForm(false)}>
          <div className={styles.editModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.editModalHeader}>
              <h2 className={styles.editModalTitle}>{editingProfile ? '프로필 수정' : '새 프로필 추가'}</h2>
              <button className={styles.closeBtn} onClick={() => !pfSaving && setShowProfileForm(false)}>✕</button>
            </div>
            <div className={styles.editModalBody}>
              <div className={styles.editField}>
                <label className={styles.editLabel}>프로필 이름 *</label>
                <input className={styles.editInput} value={pfLabel}
                  onChange={(e) => setPfLabel(e.target.value)}
                  placeholder="예) 학교 프로필, 동아리 활동" />
              </div>
              <div className={styles.editField}>
                <label className={styles.editLabel}>소속</label>
                <input className={styles.editInput} value={pfAffil}
                  onChange={(e) => setPfAffil(e.target.value)}
                  placeholder="예) 영화 동아리 씨네마" />
              </div>
              <div className={styles.editField}>
                <label className={styles.editLabel}>한 줄 소개</label>
                <input className={styles.editInput} value={pfOneliner}
                  onChange={(e) => setPfOneliner(e.target.value.slice(0, 50))}
                  placeholder="이 소속에서의 나를 한 줄로" maxLength={50} />
                <span className={styles.editCount}>{pfOneliner.length}/50</span>
              </div>
            </div>
            <div className={styles.editModalFooter}>
              <button className={styles.editCancel} onClick={() => setShowProfileForm(false)} disabled={pfSaving}>취소</button>
              <button className={styles.editSave} onClick={handleSaveSubProfile} disabled={pfSaving || !pfLabel.trim()}>
                {pfSaving ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 요금제 */}
      {(() => {
        const plan = currentUser?.plan || 'free'
        const isStudent = plan === 'student'
        const isPro = plan === 'pro' || plan === 'team' || plan === 'admin'
        const studentVerifiedAt = currentUser?.studentVerifiedAt
        const needsReVerify = isStudent && studentVerifiedAt &&
          (Date.now() - new Date(studentVerifiedAt).getTime()) > 365 * 24 * 60 * 60 * 1000

        return (
          <>
            {needsReVerify && (
              <div className={styles.reVerifyBanner}>
                <span>🎓 학생 인증이 1년이 지났어요.</span>
                <button onClick={() => navigate('/verify-student')}>재인증하기 →</button>
              </div>
            )}
            <div className={styles.planCard}>
              <div className={styles.planLeft}>
                <span className={styles.planBadge} style={
                  isStudent ? { background: '#CCFBF1', color: '#0D9488' } :
                  isPro     ? { background: '#EEF2FF', color: '#534AB7' } : {}
                }>
                  {plan === 'admin' ? 'Admin' : plan === 'team' ? 'Team' : plan === 'pro' ? 'Pro' : plan === 'student' ? 'Student' : 'Free'}
                </span>
                <p className={styles.planTitle}>
                  {isPro ? `${plan === 'admin' ? 'Admin' : plan === 'team' ? 'Team' : 'Pro'} 플랜 사용 중` :
                   isStudent ? '학생 플랜 사용 중 (Pro 동급)' : '무료 플랜 사용 중'}
                </p>
                <p className={styles.planDesc}>
                  {isStudent
                    ? (() => {
                        const expiry = studentVerifiedAt
                          ? new Date(new Date(studentVerifiedAt).getTime() + 365*24*60*60*1000).toLocaleDateString('ko-KR')
                          : null
                        return expiry ? `재학 중 무료 · ${expiry}까지` : '재학 중 무료'
                      })()
                    : isPro ? '프로젝트 무제한 · 팀원 무제한' : '프로젝트 3개 · 팀원 5명'}
                </p>
              </div>
              {!isPro && !isStudent && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  <button className={styles.upgradeBtn} onClick={() => navigate('/pricing')}>업그레이드 →</button>
                  <button style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'underline', textUnderlineOffset: 3 }}
                    onClick={() => navigate('/verify-student')}>학생이에요 🎓</button>
                </div>
              )}
            </div>
          </>
        )
      })()}
      
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

      {/* 비밀번호 변경 (이메일 계정 전용) */}
      {currentUser.email && auth.currentUser?.providerData?.[0]?.providerId === 'password' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>비밀번호 변경</h3>
          </div>
          <div className={styles.resetPwRow}>
            <div>
              <p className={styles.resetPwDesc}>
                <strong>{currentUser.email}</strong>으로 재설정 링크를 보내드려요.
              </p>
              {pwResetSent && <p className={styles.resetPwSuccess}>✓ 메일을 보냈어요. 받은 편지함을 확인해주세요.</p>}
            </div>
            <button className={styles.resetPwBtn} onClick={handleSendPasswordReset} disabled={pwResetLoading || pwResetSent}>
              {pwResetSent ? '발송 완료' : pwResetLoading ? '발송 중...' : '재설정 메일 보내기'}
            </button>
          </div>
        </div>
      )}

      {/* 계정 탈퇴 — 아코디언 */}
      <div className={`${styles.dangerZone} ${dangerOpen ? styles.dangerZoneOpen : ''}`}>
        <button
          className={styles.dangerToggle}
          onClick={() => { setDangerOpen((v) => !v); setDeleteConfirmed(false) }}
        >
          <span className={styles.dangerTitle}>계정 탈퇴</span>
          <svg
            className={`${styles.dangerChevron} ${dangerOpen ? styles.dangerChevronOpen : ''}`}
            width="16" height="16" viewBox="0 0 16 16" fill="none"
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {dangerOpen && (
          <>
            <ul className={styles.dangerList}>
              <li>계정과 모든 개인 데이터가 <strong>즉시 삭제</strong>되며 <strong>복구가 불가능</strong>합니다.</li>
              <li>내가 참여한 프로젝트의 채팅·할 일·파일 기록은 팀원들에게 텍스트로 보존됩니다.</li>
              <li>내가 유일한 멤버인 프로젝트는 함께 삭제됩니다.</li>
              <li>내가 리더인 프로젝트는 다른 팀원에게 리더 권한이 자동으로 이전됩니다.</li>
            </ul>
            <label className={styles.dangerCheck}>
              <input type="checkbox" checked={deleteConfirmed}
                onChange={(e) => setDeleteConfirmed(e.target.checked)} />
              <span>위 내용을 이해했으며 탈퇴에 동의합니다</span>
            </label>
            <button
              className={styles.dangerBtn}
              disabled={!deleteConfirmed || deleting}
              onClick={handleDeleteAccount}
            >
              {deleting ? '탈퇴 처리 중...' : '계정 탈퇴'}
            </button>
          </>
        )}
      </div>
    </div>

  )
}