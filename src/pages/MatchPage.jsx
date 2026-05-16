import React, { useState, useEffect } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, orderBy, query, serverTimestamp, arrayUnion } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import styles from './MatchPage.module.css'

// Firestore 보안 규칙 추가 필요:
// match /matchPosts/{postId} {
//   allow read: if request.auth != null;
//   allow create, update: if request.auth != null;
// }

const SKILL_PRESETS = ['React', 'Vue', 'Node.js', 'Python', 'Java', 'Spring', 'Flutter', 'iOS', 'Android', 'UI/UX', '기획', '마케팅']

function calcDday(deadline) {
  const today = new Date(new Date().toDateString())
  return Math.round((new Date(deadline + 'T00:00:00') - today) / 86400000)
}

export default function MatchPage() {
  const { projects, currentUser, addMemberToProject, blockedUsers, markMatchSeen } = useStore()
  const navigate = useNavigate()

  const [posts, setPosts]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState(null)
  const [showForm, setShowForm]       = useState(false)

  // 모집글 작성 폼
  const [formProject, setFormProject] = useState('')
  const [formTitle, setFormTitle]     = useState('')
  const [formDesc, setFormDesc]       = useState('')
  const [formSkills, setFormSkills]   = useState([])
  const [formCustomSkill, setFormCustomSkill] = useState('')
  const [formDeadline, setFormDeadline]       = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError]           = useState('')

  // 지원하기 모달
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [applyTarget, setApplyTarget]       = useState(null)
  const [applyNote, setApplyNote]           = useState('')
  const [applying, setApplying]             = useState(false)

  // 지원자 프로필 모달
  const [viewApplicant, setViewApplicant]     = useState(null)
  const [applicantProfile, setApplicantProfile] = useState(null)
  const [profileLoading, setProfileLoading]   = useState(false)

  const myLeaderProjects = projects.filter((p) =>
    p.status === 'active' &&
    p.members?.find((m) => m.id === currentUser?.id)?.role === 'leader'
  )

  useEffect(() => { fetchPosts(); markMatchSeen() }, [])

  const fetchPosts = async () => {
    setLoading(true)
    try {
      const snap    = await getDocs(query(collection(db, 'matchPosts'), orderBy('createdAt', 'desc')))
      const today   = new Date().toISOString().split('T')[0]
      const blocked = useStore.getState().blockedUsers || []
      const valid   = []

      await Promise.all(snap.docs.map(async (d) => {
        const data = { id: d.id, ...d.data() }
        if (!data.deadline || data.deadline < today) {
          try { await deleteDoc(doc(db, 'matchPosts', d.id)) } catch {}
          return
        }
        if (data.status === 'open' && !blocked.includes(data.leaderId)) valid.push(data)
      }))

      const sorted = valid.sort((a, b) => (b.deadline > a.deadline ? 1 : -1))
      setPosts(sorted)
      return sorted
    } catch (e) {
      console.error('matchPosts 로드 실패:', e)
      return []
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePost = async () => {
    if (!formTitle.trim() || !formProject || !formDeadline) return
    const project = projects.find((p) => p.id === formProject)
    if (!project) return
    setFormSubmitting(true)
    setFormError('')
    try {
      await addDoc(collection(db, 'matchPosts'), {
        projectId: formProject,
        projectName: project.name,
        projectEmoji: project.emoji || '📁',
        projectCategory: project.category,
        leaderId: currentUser.id,
        leaderName: currentUser.name,
        leaderUsername: currentUser.username || '',
        title: formTitle.trim(),
        description: formDesc.trim(),
        skills: formSkills,
        deadline: formDeadline,
        applicants: [],
        status: 'open',
        createdAt: serverTimestamp(),
      })
      setShowForm(false)
      setFormTitle(''); setFormDesc(''); setFormSkills([]); setFormProject(''); setFormDeadline('')
      fetchPosts()
    } catch (e) {
      console.error('matchPosts 작성 실패:', e)
      setFormError('등록에 실패했어요. Firebase 콘솔에서 matchPosts 컬렉션 읽기/쓰기 규칙을 확인해주세요.')
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleApply = async (post, note = '') => {
    if (!currentUser) return
    const already = (post.applicants || []).find((a) => a.userId === currentUser.id)
    if (already) return

    setApplying(true)
    try {
      await updateDoc(doc(db, 'matchPosts', post.id), {
        applicants: arrayUnion({
          userId: currentUser.id,
          userName: currentUser.name,
          appliedAt: new Date().toISOString(),
          status: 'pending',
          note: note.trim(),
        }),
      })
      const updated = await fetchPosts()
      if (selected?.id === post.id) {
        const fresh = updated.find((p) => p.id === post.id)
        if (fresh) setSelected(fresh)
      }
    } finally {
      setApplying(false)
    }
  }

  const handleViewApplicant = async (applicant) => {
    setViewApplicant(applicant)
    setApplicantProfile(null)
    setProfileLoading(true)
    try {
      const snap = await getDoc(doc(db, 'users', applicant.userId))
      setApplicantProfile(snap.exists() ? snap.data() : null)
    } catch {
      setApplicantProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }

  const handleAccept = async (post, applicant) => {
    const result = await addMemberToProject(post.projectId, applicant.userId, applicant.userName)
    if (result?.message) { alert(result.message); return }

    const postRef  = doc(db, 'matchPosts', post.id)
    const postSnap = await getDoc(postRef)
    if (postSnap.exists()) {
      const data = postSnap.data()
      await updateDoc(postRef, {
        applicants: data.applicants.map((a) =>
          a.userId === applicant.userId ? { ...a, status: 'accepted' } : a
        ),
      })
    }
    setViewApplicant(null)
    fetchPosts()
    alert(`${applicant.userName} 님이 프로젝트에 합류했어요!`)
  }

  const handleClosePost = async (postId) => {
    if (!window.confirm('모집을 마감할까요?')) return
    await updateDoc(doc(db, 'matchPosts', postId), { status: 'closed' })
    fetchPosts()
    setSelected(null)
  }

  const toggleSkill = (skill) => {
    setFormSkills((prev) => prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill])
  }

  const isMyPost  = selected && selected.leaderId === currentUser?.id
  const myApplied = selected && (selected.applicants || []).find((a) => a.userId === currentUser?.id)
  const myProject = selected && projects.find((p) => p.id === selected.projectId)

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>팀프 매치 🤝</h1>
          <p className={styles.subtitle}>프로젝트 팀원을 모집하거나 팀에 합류해보세요</p>
        </div>
        {myLeaderProjects.length > 0 && (
          <button className={styles.createBtn} onClick={() => setShowForm(true)}>+ 모집글 작성</button>
        )}
      </div>

      <div className={styles.layout}>
        {/* 목록 */}
        <div className={styles.listPanel}>
          {loading ? (
            <div className={styles.loading}>불러오는 중...</div>
          ) : posts.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyIcon}>🤝</p>
              <p className={styles.emptyTitle}>아직 모집 중인 팀이 없어요</p>
              <p className={styles.emptySub}>프로젝트 리더라면 팀원을 모집해보세요</p>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id}
                className={`${styles.postCard} ${selected?.id === post.id ? styles.postCardActive : ''}`}
                onClick={() => setSelected(post)}>
                <div className={styles.postCardTop}>
                  <span className={styles.postEmoji}>{post.projectEmoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className={styles.postTitle}>{post.title}</p>
                    <p className={styles.postMeta}>
                      {post.projectName} · {post.leaderName}
                      {post.deadline && (() => {
                        const diff = calcDday(post.deadline)
                        return <span style={{ marginLeft: 6, color: diff <= 3 ? 'var(--coral)' : 'var(--text-tertiary)' }}>
                          · {diff === 0 ? '오늘 마감' : `D-${diff}`}
                        </span>
                      })()}
                    </p>
                  </div>
                  <span className={styles.applicantCount}>{(post.applicants || []).length}명 지원</span>
                </div>
                {post.skills?.length > 0 && (
                  <div className={styles.skillTags}>
                    {post.skills.slice(0, 4).map((s) => <span key={s} className={styles.skillTag}>{s}</span>)}
                    {post.skills.length > 4 && <span className={styles.skillTag}>+{post.skills.length - 4}</span>}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 상세 */}
        <div className={styles.detailPanel}>
          {!selected ? (
            <div className={styles.detailEmpty}>
              <p>모집글을 선택하면 상세 내용을 볼 수 있어요</p>
            </div>
          ) : (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <div className={styles.detailProjectBadge}>
                    {selected.projectEmoji} {selected.projectName}
                    {selected.projectCategory && <span className={styles.categoryTag}>{selected.projectCategory}</span>}
                  </div>
                  <h2 className={styles.detailTitle}>{selected.title}</h2>
                  <p className={styles.detailLeader}>리더: {selected.leaderName}</p>
                  {selected.deadline && (() => {
                    const diff  = calcDday(selected.deadline)
                    const label = diff < 0 ? '마감됨' : diff === 0 ? '오늘 마감' : `D-${diff}`
                    const color = diff <= 3 ? 'var(--coral)' : 'var(--text-secondary)'
                    return <p style={{ fontSize: 12, color, marginTop: 2 }}>모집 기한 {selected.deadline} ({label})</p>
                  })()}
                </div>
                {isMyPost && (
                  <button className={styles.closePostBtn} onClick={() => handleClosePost(selected.id)}>마감하기</button>
                )}
              </div>

              {selected.description && (
                <p className={styles.detailDesc}>{selected.description}</p>
              )}

              {selected.skills?.length > 0 && (
                <div className={styles.detailSection}>
                  <p className={styles.detailSectionTitle}>모집 스킬</p>
                  <div className={styles.skillTags}>
                    {selected.skills.map((s) => <span key={s} className={styles.skillTagLg}>{s}</span>)}
                  </div>
                </div>
              )}

              {/* 지원하기 + 문의하기 (내 글 아닌 경우) */}
              {!isMyPost && !myProject && (
                <div className={styles.applySection}>
                  {myApplied ? (
                    <div className={styles.appliedBadge}>
                      {myApplied.status === 'accepted' ? '✅ 합류 완료' : '✓ 지원 완료'}
                    </div>
                  ) : (
                    <button className={styles.applyBtn} onClick={() => { setApplyTarget(selected); setApplyNote(''); setShowApplyModal(true) }}>
                      지원하기
                    </button>
                  )}
                  <button className={styles.inquiryBtn}
                    onClick={() => {
                      const to = selected.leaderUsername || `@${selected.leaderName}`
                      const params = new URLSearchParams({
                        compose: '1', to,
                        matchId: selected.id,
                        matchTitle: selected.title,
                      })
                      navigate(`/messages?${params}`)
                    }}>
                    ✉️ 문의하기
                  </button>
                </div>
              )}

              {myProject && !isMyPost && (
                <div className={styles.alreadyMember}>이미 이 프로젝트의 멤버예요</div>
              )}

              {/* 지원자 목록 (내 글인 경우) */}
              {isMyPost && (
                <div className={styles.detailSection}>
                  <p className={styles.detailSectionTitle}>지원자 ({(selected.applicants || []).length}명)</p>
                  {(selected.applicants || []).length === 0 ? (
                    <p className={styles.noApplicants}>아직 지원자가 없어요</p>
                  ) : (
                    <div className={styles.applicantList}>
                      {(selected.applicants || []).map((a) => (
                        <div key={a.userId} className={styles.applicantCard}>
                          <div className={styles.applicantAvatar}>{a.userName.charAt(0)}</div>
                          <div style={{ flex: 1 }}>
                            <p className={styles.applicantName}>{a.userName}</p>
                            {a.note && <p className={styles.applicantNote}>"{a.note}"</p>}
                            <p className={styles.applicantDate}>{a.appliedAt?.slice(0, 10)}</p>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {a.status === 'accepted' ? (
                              <span className={styles.acceptedBadge}>합류 완료</span>
                            ) : (
                              <>
                                <button className={styles.profileBtn} onClick={() => handleViewApplicant(a)}>프로필</button>
                                <button className={styles.acceptBtn} onClick={() => handleAccept(selected, a)}>합류</button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 모집글 작성 모달 */}
      {showForm && (
        <div className={styles.backdrop} onClick={() => setShowForm(false)}>
          <div className={styles.formModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.formModalHeader}>
              <h3 className={styles.formModalTitle}>팀원 모집글 작성</h3>
              <button className={styles.formClose} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className={styles.formBody}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>프로젝트 선택 *</label>
                <select className={styles.formSelect} value={formProject} onChange={(e) => setFormProject(e.target.value)}>
                  <option value="">프로젝트를 선택하세요</option>
                  {myLeaderProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>모집 제목 *</label>
                <input className={styles.formInput} value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="예) 프론트엔드 개발자 구합니다" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>상세 설명</label>
                <textarea className={styles.formTextarea} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="프로젝트 소개, 원하는 팀원 유형 등을 자유롭게 적어주세요" rows={4} />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>모집 기한 *</label>
                <input className={styles.formInput} type="date"
                  value={formDeadline}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFormDeadline(e.target.value)} />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>필요 스킬</label>
                <div className={styles.skillPresets}>
                  {SKILL_PRESETS.map((s) => (
                    <button key={s} type="button"
                      className={`${styles.skillPresetBtn} ${formSkills.includes(s) ? styles.skillPresetActive : ''}`}
                      onClick={() => toggleSkill(s)}>{s}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <input className={styles.formInput} value={formCustomSkill}
                    onChange={(e) => setFormCustomSkill(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && formCustomSkill.trim()) {
                        e.preventDefault()
                        setFormSkills((prev) => [...new Set([...prev, formCustomSkill.trim()])])
                        setFormCustomSkill('')
                      }
                    }}
                    placeholder="직접 입력 후 Enter" />
                </div>
                {formSkills.length > 0 && (
                  <div className={styles.skillTags} style={{ marginTop: 8 }}>
                    {formSkills.map((s) => (
                      <button key={s} className={`${styles.skillTag} ${styles.skillTagRemove}`}
                        onClick={() => setFormSkills((prev) => prev.filter((x) => x !== s))}>
                        {s} ✕
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {formError && <p style={{ color: 'var(--coral)', fontSize: 12, padding: '0 20px 8px', margin: 0 }}>{formError}</p>}
            <div className={styles.formFooter}>
              <button className={styles.cancelBtn} onClick={() => setShowForm(false)}>취소</button>
              <button className={styles.submitBtn} onClick={handleCreatePost}
                disabled={!formTitle.trim() || !formProject || !formDeadline || formSubmitting}>
                {formSubmitting ? '등록 중...' : '모집글 등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 지원하기 모달 */}
      {showApplyModal && applyTarget && (
        <div className={styles.backdrop} onClick={() => setShowApplyModal(false)}>
          <div className={styles.applyModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.formModalHeader}>
              <h3 className={styles.formModalTitle}>지원하기</h3>
              <button className={styles.formClose} onClick={() => setShowApplyModal(false)}>✕</button>
            </div>
            <div className={styles.applyModalBody}>
              <p className={styles.applyModalProject}>{applyTarget.projectEmoji} {applyTarget.projectName}</p>
              <p className={styles.applyModalPostTitle}>{applyTarget.title}</p>
              <div className={styles.formField} style={{ marginTop: 16 }}>
                <label className={styles.formLabel}>한 줄 자기소개 <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(선택 · 최대 100자)</span></label>
                <textarea
                  className={styles.formTextarea}
                  rows={3}
                  maxLength={100}
                  value={applyNote}
                  onChange={(e) => setApplyNote(e.target.value)}
                  placeholder="간단한 자기소개나 지원 동기를 적어주세요"
                />
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right', marginTop: 4 }}>{applyNote.length}/100</p>
              </div>
            </div>
            <div className={styles.formFooter}>
              <button className={styles.cancelBtn} onClick={() => setShowApplyModal(false)}>취소</button>
              <button className={styles.submitBtn} disabled={applying}
                onClick={async () => {
                  await handleApply(applyTarget, applyNote)
                  setShowApplyModal(false)
                }}>
                {applying ? '지원 중...' : '지원하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 지원자 프로필 모달 */}
      {viewApplicant && (
        <div className={styles.backdrop} onClick={() => setViewApplicant(null)}>
          <div className={styles.profileModal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.formClose} style={{ alignSelf: 'flex-end', marginBottom: 4 }} onClick={() => setViewApplicant(null)}>✕</button>
            <div className={styles.profileAvatar}>{viewApplicant.userName.charAt(0)}</div>
            <p className={styles.profileName}>{viewApplicant.userName}</p>
            {profileLoading ? (
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>불러오는 중...</p>
            ) : applicantProfile ? (
              <div className={styles.profileInfo}>
                {applicantProfile.oneliner && <p className={styles.profileOneliner}>"{applicantProfile.oneliner}"</p>}
                {applicantProfile.affiliation && <p className={styles.profileDetail}>{applicantProfile.affiliation}</p>}
                {applicantProfile.email && <p className={styles.profileDetail}>{applicantProfile.email}</p>}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>프로필 정보가 없어요</p>
            )}
            <button className={styles.submitBtn} style={{ marginTop: 16, width: '100%' }}
              onClick={() => handleAccept(selected, viewApplicant)}>
              프로젝트에 합류시키기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
