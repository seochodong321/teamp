import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchUserProfile, fetchPublicProjects } from '../services/users.js'
import { fetchMyApplication, fetchMatchPosts, createMatchPost, applyToMatchPost, setApplicantStatus, closeMatchPost } from '../services/match.js'
import { useStore } from '../store/useStore.js'
import { useShallow } from 'zustand/react/shallow'
import { notifyUser } from '../store/helpers.js'
import ProfileSelector from '../components/ProfileSelector.jsx'
import PostFormModal from '../components/match/PostFormModal.jsx'
import ReportModal from '../components/ReportModal.jsx'
import styles from './MatchPage.module.css'

// Firestore 보안 규칙 추가 필요:
// match /matchPosts/{postId} {
//   allow read: if request.auth != null;
//   allow create, update: if request.auth != null;
// }


function calcDday(deadline) {
  const today = new Date(new Date().toDateString())
  return Math.round((new Date(deadline + 'T00:00:00') - today) / 86400000)
}

export default function MatchPage() {
  const { projects, currentUser, addMemberToProject, blockedUsers, markMatchSeen, profiles, showError, showSuccess } = useStore(useShallow((s) => ({ projects: s.projects, currentUser: s.currentUser, addMemberToProject: s.addMemberToProject, blockedUsers: s.blockedUsers, markMatchSeen: s.markMatchSeen, profiles: s.profiles, showError: s.showError, showSuccess: s.showSuccess })))
  const navigate = useNavigate()
  // 지원자 배열에서 내 항목 찾기(과도기 옛 배열 호환용 — 정본은 서브컬렉션)
  const myEntry = (list) => (list || []).find((a) => a.userId === currentUser?.id)

  const [posts, setPosts]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState(null)
  const [showForm, setShowForm]       = useState(false)
  const [activeTab, setActiveTab]     = useState('pool') // 'pool' | 'mine'

  // 검색
  const [searchQuery, setSearchQuery] = useState('')

  // 모집글 작성 폼
  const [formProject, setFormProject] = useState('')
  const [formTitle, setFormTitle]     = useState('')
  const [formDesc, setFormDesc]       = useState('')
  const [formSkills, setFormSkills]   = useState([])
  const [formCustomSkill, setFormCustomSkill] = useState('')
  const [formDeadline, setFormDeadline]       = useState('')
  const [formVisibility, setFormVisibility]   = useState('public')
  const [formKeywords, setFormKeywords]       = useState([])
  const [formCustomKeyword, setFormCustomKeyword] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError]           = useState('')

  // 지원하기 모달
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [applyTarget, setApplyTarget]       = useState(null)
  const [applyNote, setApplyNote]           = useState('')
  const [applying, setApplying]             = useState(false)
  const [showProfileSel, setShowProfileSel] = useState(false)
  const [pendingApplyPost, setPendingApplyPost] = useState(null)

  // 신고
  const [reportTarget, setReportTarget] = useState(null) // { id, name }

  // 내 지원 여부(선택한 남의 글) — 지원자 PII가 서브컬렉션이라 본인 것만 따로 로드
  const [myApplication, setMyApplication] = useState(null)
  // 지원자 프로필 모달
  const [viewApplicant, setViewApplicant]       = useState(null)
  const [applicantProfile, setApplicantProfile] = useState(null)
  const [applicantProjects, setApplicantProjects] = useState([])
  const [profileLoading, setProfileLoading]     = useState(false)
  const [profileLoadFailed, setProfileLoadFailed] = useState(false)

  // 마감 확인 모달
  const [confirmClose, setConfirmClose] = useState(null) // postId | null

  // 마감된 모집글 아카이브
  const [closedMyPosts, setClosedMyPosts] = useState([])
  const [showClosed, setShowClosed]       = useState(false)

  const myLeaderProjects = useMemo(() =>
    projects.filter((p) =>
      p.status === 'active' &&
      p.isPublic === true && // 공개 프로젝트만 매치에 올릴 수 있음(비공개는 차단)
      p.members?.find((m) => m.id === currentUser?.id)?.role === 'leader'
    ),
  [projects, currentUser?.id])

  useEffect(() => { fetchPosts(); markMatchSeen() }, [])

  // 남의 글 선택 시 '내 지원 여부'만 따로 로드(지원자 PII는 서브문서, 본인 것만 읽음)
  useEffect(() => {
    if (!selected || !currentUser || selected.leaderId === currentUser.id) { setMyApplication(null); return }
    const fromArray = myEntry(selected.applicants) // 과도기: 옛 배열
    if (fromArray) { setMyApplication(fromArray); return }
    fetchMyApplication(selected.id, currentUser.id)
      .then(setMyApplication)
      .catch(() => setMyApplication(null))
  }, [selected?.id, currentUser?.id])

  const fetchPosts = async () => {
    setLoading(true)
    try {
      const { open, closedMine } = await fetchMatchPosts({
        uid: useStore.getState().currentUser?.id,
        blockedUsers: useStore.getState().blockedUsers || [],
      })
      setPosts(open)
      setClosedMyPosts(closedMine)
      return open
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
      await createMatchPost({
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
        visibility: formVisibility,
        keywords: formVisibility === 'keyword' ? formKeywords : [],
      })
      setShowForm(false)
      setFormTitle(''); setFormDesc(''); setFormSkills([]); setFormProject(''); setFormDeadline('')
      setFormVisibility('public'); setFormKeywords([]); setFormCustomKeyword('')
      fetchPosts()
    } catch (e) {
      console.error('matchPosts 작성 실패:', e)
      setFormError('등록에 실패했어요. Firebase 콘솔에서 matchPosts 컬렉션 읽기/쓰기 규칙을 확인해주세요.')
    } finally {
      setFormSubmitting(false)
    }
  }

  const doApply = async (post, note, profileId, profileAffiliation) => {
    if (!currentUser) return
    if (myApplication || myEntry(post.applicants)) return

    setApplying(true)
    try {
      const application = {
        userId: currentUser.id,
        userName: currentUser.name,
        affiliation: profileAffiliation || currentUser.affiliation || '',
        profileId: profileId || 'default',
        appliedAt: new Date().toISOString(),
        status: 'pending',
        note: note.trim(),
      }
      await applyToMatchPost(post.id, currentUser.id, application)
      setMyApplication(application)
      // 모집글 리더에게 새 지원 알림 (배지 카운트는 서버 함수가 증가)
      if (post.leaderId && post.leaderId !== currentUser.id) {
        await notifyUser(post.leaderId, {
          type: 'apply',
          text: `🙋 ${currentUser.name}님이 "${post.title}"에 지원했어요`,
          link: '/match',
        })
      }
    } finally {
      setApplying(false)
    }
  }

  const handleApply = async (post, note = '') => {
    if (!currentUser) return
    if (profiles.length > 0) {
      setPendingApplyPost({ post, note })
      setShowApplyModal(false)
      setShowProfileSel(true)
      return
    }
    await doApply(post, note, 'default', null)
  }

  const handleViewApplicant = async (applicant) => {
    setViewApplicant(applicant)
    setApplicantProfile(null)
    setApplicantProjects([])
    setProfileLoading(true)
    setProfileLoadFailed(false)
    try {
      const [profile, pubs] = await Promise.all([
        fetchUserProfile(applicant.userId),
        fetchPublicProjects(applicant.userId),
      ])
      setApplicantProfile(profile)
      setApplicantProjects(pubs)
    } catch {
      setApplicantProfile(null)
      setProfileLoadFailed(true)
    } finally {
      setProfileLoading(false)
    }
  }

  const handleAccept = async (post, applicant) => {
    const result = await addMemberToProject(post.projectId, applicant.userId, applicant.userName)
    if (result?.message) { showError(result.message); return }

    await setApplicantStatus(post.id, applicant.userId, 'accepted')
    // 지원자에게 수락 알림
    if (applicant.userId && applicant.userId !== currentUser.id) {
      await notifyUser(applicant.userId, {
        type: 'join',
        text: `🎉 "${post.title}" 지원이 수락되어 ${post.projectName}에 합류했어요`,
        link: `/project/${post.projectId}`,
        projectId: post.projectId,
      })
    }
    setViewApplicant(null)
    fetchPosts()
    showSuccess(`${applicant.userName} 님이 프로젝트에 합류했어요!`)
  }

  const handleHold = async (post, applicant) => {
    await setApplicantStatus(post.id, applicant.userId, 'held')
    const updated = await fetchPosts()
    const fresh = updated?.find((p) => p.id === post.id)
    if (fresh) setSelected(fresh)
  }

  const handleClosePost = (postId) => setConfirmClose(postId)

  const doClosePost = async () => {
    await closeMatchPost(confirmClose)
    setConfirmClose(null)
    fetchPosts()
    setSelected(null)
  }

  const q = searchQuery.trim().toLowerCase()
  const isSearching = q.length > 0

  const myPosts = useMemo(() => posts.filter((p) => p.leaderId === currentUser?.id), [posts, currentUser?.id])
  const pendingCount = myPosts.reduce((acc, p) =>
    acc + (p.applicants || []).filter((a) => a.status === 'pending').length, 0)

  const poolPosts = useMemo(() => {
    const others = posts.filter((p) => p.leaderId !== currentUser?.id)
    if (!isSearching) return others.filter((p) => p.visibility !== 'keyword')
    return others.filter((p) => {
      const haystack = [p.title, p.description || '', p.projectName, ...(p.skills || []), ...(p.keywords || [])].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [posts, currentUser?.id, isSearching, q])

  const isMyPost  = selected && selected.leaderId === currentUser?.id
  const myApplied = !isMyPost && (myApplication || myEntry(selected?.applicants))
  const myProject = selected && projects.find((p) => p.id === selected.projectId)

  return (
    <>
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

      <div className={`${styles.layout} ${selected ? styles.layoutDetail : ''}`}>
        {/* 목록 */}
        <div className={styles.listPanel}>
          {/* 탭 */}
          <div className={styles.matchTabs}>
            <button
              className={`${styles.matchTab} ${activeTab === 'pool' ? styles.matchTabActive : ''}`}
              onClick={() => { setActiveTab('pool'); setSelected(null) }}>
              오픈 풀
            </button>
            <button
              className={`${styles.matchTab} ${activeTab === 'mine' ? styles.matchTabActive : ''}`}
              onClick={() => { setActiveTab('mine'); setSelected(null) }}>
              내 모집글
              {pendingCount > 0 && <span className={styles.pendingBadge}>{pendingCount}</span>}
            </button>
          </div>

          {/* 오픈 풀 탭 */}
          {activeTab === 'pool' && (
            <>
              <div className={styles.searchRow}>
                <span className={styles.searchIcon}>🔍</span>
                <input
                  className={styles.searchInput}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="제목, 스킬, 키워드 검색..."
                />
                {searchQuery && (
                  <button className={styles.searchClear} onClick={() => setSearchQuery('')}>✕</button>
                )}
              </div>
              {!isSearching && <p className={styles.poolLabel}>전체공개 모집글</p>}
              {isSearching && poolPosts.length > 0 && <p className={styles.poolLabel}>검색 결과 {poolPosts.length}개</p>}
            </>
          )}

          {/* 내 모집글 탭 헤더 */}
          {activeTab === 'mine' && myPosts.length > 0 && (
            <p className={styles.poolLabel}>내가 올린 모집글 {myPosts.length}개</p>
          )}

          {loading ? (
            <div className={styles.loading}>불러오는 중...</div>
          ) : activeTab === 'pool' && poolPosts.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyIcon}>{isSearching ? '🔍' : '🤝'}</p>
              <p className={styles.emptyTitle}>{isSearching ? '검색 결과가 없어요' : '아직 모집 중인 팀이 없어요'}</p>
              <p className={styles.emptySub}>{isSearching ? '다른 키워드로 검색해보세요' : '프로젝트 리더라면 팀원을 모집해보세요'}</p>
            </div>
          ) : activeTab === 'mine' && myPosts.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyIcon}>📝</p>
              <p className={styles.emptyTitle}>올린 모집글이 없어요</p>
              <p className={styles.emptySub}>팀원이 필요하다면 모집글을 작성해보세요</p>
            </div>
          ) : (
            <>
            {(activeTab === 'pool' ? poolPosts : myPosts).map((post) => (
              <div key={post.id}
                className={`${styles.postCard} ${selected?.id === post.id ? styles.postCardActive : ''}`}
                onClick={() => setSelected(post)}>
                <div className={styles.postCardTop}>
                  <span className={styles.postEmoji}>{post.projectEmoji}</span>
                  <div className={styles.postCardInfo}>
                    <p className={styles.postTitle}>{post.title}</p>
                    <p className={styles.postMeta}>
                      {post.projectName} · {post.leaderName}
                      {post.deadline && (() => {
                        const diff = calcDday(post.deadline)
                        return <span className={diff <= 3 ? styles.ddayUrgent : styles.ddayNormal}>
                          · {diff === 0 ? '오늘 마감' : `D-${diff}`}
                        </span>
                      })()}
                    </p>
                  </div>
                  {activeTab === 'mine' ? (() => {
                    const pending = (post.applicants || []).filter((a) => a.status === 'pending').length
                    return (
                      <span className={pending > 0 ? styles.applicantCountNew : styles.applicantCount}>
                        {pending > 0 ? `🔔 ${pending}명 대기` : `${post.applicantCount ?? (post.applicants || []).length}명 지원`}
                      </span>
                    )
                  })() : (
                    <span className={styles.applicantCount}>{post.applicantCount ?? (post.applicants || []).length}명 지원</span>
                  )}
                </div>
                {activeTab === 'mine' && post.visibility === 'keyword' && (
                  <div className={styles.keywordBadge}>🔍 키워드 공개</div>
                )}
                {post.skills?.length > 0 && (
                  <div className={styles.skillTags}>
                    {post.skills.slice(0, 4).map((s) => <span key={s} className={styles.skillTag}>{s}</span>)}
                    {post.skills.length > 4 && <span className={styles.skillTag}>+{post.skills.length - 4}</span>}
                  </div>
                )}
              </div>
            ))}

            {/* 마감된 모집글 아카이브 */}
            {activeTab === 'mine' && closedMyPosts.length > 0 && (
              <div className={styles.closedSection}>
                <button className={styles.closedToggle} onClick={() => setShowClosed((v) => !v)}>
                  <span>📁 마감된 모집글 {closedMyPosts.length}개</span>
                  <span className={styles.closedToggleArrow}>{showClosed ? '▲' : '▼'}</span>
                </button>
                {showClosed && closedMyPosts.map((post) => (
                  <div key={post.id}
                    className={`${styles.postCard} ${styles.postCardClosed} ${selected?.id === post.id ? styles.postCardActive : ''}`}
                    onClick={() => setSelected(post)}>
                    <div className={styles.postCardTop}>
                      <span className={styles.postEmoji}>{post.projectEmoji}</span>
                      <div className={styles.postCardInfo}>
                        <p className={styles.postTitle}>{post.title}</p>
                        <p className={styles.postMeta}>{post.projectName} · {post.leaderName}</p>
                      </div>
                      <span className={styles.closedBadge}>마감됨</span>
                    </div>
                    {post.skills?.length > 0 && (
                      <div className={styles.skillTags}>
                        {post.skills.slice(0, 4).map((s) => <span key={s} className={styles.skillTag}>{s}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            </>
          )}
        </div>

        {/* 상세 */}
        <div className={styles.detailPanel}>
          <button className={styles.mobileBackBtn} onClick={() => setSelected(null)}>
            ← 목록으로
          </button>
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
                    return <p className={`${styles.deadlineInfo} ${diff <= 3 ? styles.deadlineUrgent : styles.deadlineNormal}`}>모집 기한 {selected.deadline} ({label})</p>
                  })()}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {isMyPost && selected.status !== 'closed' && (
                    <button className={styles.closePostBtn} onClick={() => handleClosePost(selected.id)}>마감하기</button>
                  )}
                  {!isMyPost && (
                    <button className={styles.reportBtn} onClick={() => setReportTarget({ id: selected.id, name: selected.title })}>🚩 신고</button>
                  )}
                </div>
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
                          <div className={styles.applicantInfo}>
                            <p className={styles.applicantName}>{a.userName}</p>
                            {a.note && <p className={styles.applicantNote}>"{a.note}"</p>}
                            <p className={styles.applicantDate}>{a.appliedAt?.slice(0, 10)}</p>
                          </div>
                          <div className={styles.applicantActions}>
                            {a.status === 'accepted' ? (
                              <span className={styles.acceptedBadge}>합류 완료</span>
                            ) : a.status === 'held' ? (
                              <span className={styles.heldBadge}>보류</span>
                            ) : (
                              <>
                                <button className={styles.profileBtn} onClick={() => handleViewApplicant(a)}>프로필</button>
                                <button className={styles.holdBtn} onClick={() => handleHold(selected, a)}>보류</button>
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
        <PostFormModal
          form={{
            formProject, setFormProject, formTitle, setFormTitle, formDesc, setFormDesc,
            formDeadline, setFormDeadline, formVisibility, setFormVisibility,
            formKeywords, setFormKeywords, formCustomKeyword, setFormCustomKeyword,
            formSkills, setFormSkills, formCustomSkill, setFormCustomSkill,
          }}
          myLeaderProjects={myLeaderProjects}
          submitting={formSubmitting}
          error={formError}
          onClose={() => setShowForm(false)}
          onSubmit={handleCreatePost}
        />
      )}

      {/* 지원하기 모달 */}
      {showApplyModal && applyTarget && (
        <div className={styles.backdrop} onClick={() => !applying && setShowApplyModal(false)}>
          <div className={styles.applyModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.formModalHeader}>
              <h3 className={styles.formModalTitle}>지원하기</h3>
              <button className={styles.formClose} onClick={() => setShowApplyModal(false)}>✕</button>
            </div>
            <div className={styles.applyModalBody}>
              <p className={styles.applyModalProject}>{applyTarget.projectEmoji} {applyTarget.projectName}</p>
              <p className={styles.applyModalPostTitle}>{applyTarget.title}</p>
              <div className={styles.applyProfilePrev}>
                <p className={styles.applyProfilePrevLabel}>리크루터에게 보이는 내 정보</p>
                <div className={styles.applyProfilePrevRow}>
                  <div className={styles.applyProfilePrevAvatar}>{currentUser?.name?.charAt(0)}</div>
                  <div>
                    <p className={styles.applyProfilePrevName}>{currentUser?.name}</p>
                    {(currentUser?.affiliation || currentUser?.oneliner) && (
                      <p className={styles.applyProfilePrevDetail}>{currentUser?.affiliation || currentUser?.oneliner}</p>
                    )}
                  </div>
                </div>
                {profiles.length > 0 && (
                  <p className={styles.applyProfilePrevHint}>다음 단계에서 소속 프로필을 선택할 수 있어요</p>
                )}
              </div>
              <div className={`${styles.formField} ${styles.applyNoteField}`}>
                <label className={styles.formLabel}>한 줄 자기소개 <span className={styles.formLabelOptional}>(선택 · 최대 100자)</span></label>
                <textarea
                  className={styles.formTextarea}
                  rows={3}
                  maxLength={100}
                  value={applyNote}
                  onChange={(e) => setApplyNote(e.target.value)}
                  placeholder="간단한 자기소개나 지원 동기를 적어주세요"
                />
                <p className={styles.charCount}>{applyNote.length}/100</p>
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
            <button className={`${styles.formClose} ${styles.profileCloseBtn}`} onClick={() => setViewApplicant(null)}>✕</button>
            <div className={styles.profileAvatar}>
              {applicantProfile?.photoURL
                ? <img src={applicantProfile.photoURL} alt="" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%',display:'block'}} />
                : (applicantProfile?.name || viewApplicant.userName).charAt(0)}
            </div>
            <p className={styles.profileName}>{applicantProfile?.name || viewApplicant.userName}</p>
            {profileLoading ? (
              <p className={styles.profileLoading}>불러오는 중...</p>
            ) : applicantProfile ? (
              <div className={styles.profileInfo}>
                {applicantProfile.oneliner && <p className={styles.profileOneliner}>"{applicantProfile.oneliner}"</p>}
                {applicantProfile.affiliation && <p className={styles.profileDetail}>{applicantProfile.affiliation}</p>}
                {applicantProfile.username && <p className={styles.profileHandle}>@{applicantProfile.username.replace('@', '')}</p>}
                {applicantProjects.length > 0 && (
                  <div className={styles.profileProjects}>
                    <p className={styles.profileProjectsLabel}>공개 프로젝트</p>
                    {applicantProjects.slice(0, 3).map((p) => (
                      <div key={p.id} className={styles.profileProjectItem}>
                        <span>{p.emoji || '📁'}</span>
                        <span className={styles.profileProjectName}>{p.name}</span>
                        {p.startDate && <span className={styles.profileProjectDate}>{p.startDate.slice(0, 7)}</span>}
                      </div>
                    ))}
                    {applicantProjects.length > 3 && (
                      <p className={styles.profileProjectMore}>+{applicantProjects.length - 3}개 더</p>
                    )}
                  </div>
                )}
                {applicantProfile.username && (
                  <a
                    href={`/u/${applicantProfile.username.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.profileTeamfolio}
                  >
                    팀프폴리오 보기 →
                  </a>
                )}
              </div>
            ) : profileLoadFailed ? (
              <p className={styles.profileEmpty}>프로필을 불러오지 못했어요. 네트워크를 확인해주세요.</p>
            ) : (
              <p className={styles.profileEmpty}>프로필 정보가 없어요</p>
            )}
            {/* 매치에서는 쪽지만 (1:1 실시간 대화는 합류 후 커넥트에서) */}
            {applicantProfile?.username && (
              <button className={styles.profileMsgBtn}
                onClick={() => {
                  const u = applicantProfile.username.replace('@', '')
                  setViewApplicant(null)
                  navigate(`/messages?compose=1&to=${u}`)
                }}>
                ✉️ 쪽지 보내기
              </button>
            )}
            <button className={`${styles.submitBtn} ${styles.profileJoinBtn}`}
              onClick={() => handleAccept(selected, viewApplicant)}>
              프로젝트에 합류시키기
            </button>
          </div>
        </div>
      )}
    </div>

    {/* 마감 확인 다이얼로그 */}
    {confirmClose && (
      <div className={styles.backdrop} onClick={() => setConfirmClose(null)}>
        <div className={styles.applyModal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.formModalHeader}>
            <h3 className={styles.formModalTitle}>모집 마감</h3>
            <button className={styles.formClose} onClick={() => setConfirmClose(null)}>✕</button>
          </div>
          <div className={styles.confirmBody}>
            <p className={styles.confirmText}>이 모집글을 마감할까요?</p>
            <p className={styles.confirmSub}>마감 후에는 새 지원자를 받을 수 없어요.</p>
          </div>
          <div className={styles.formFooter}>
            <button className={styles.cancelBtn} onClick={() => setConfirmClose(null)}>취소</button>
            <button className={`${styles.submitBtn} ${styles.submitBtnDanger}`} onClick={doClosePost}>마감하기</button>
          </div>
        </div>
      </div>
    )}

    {showProfileSel && pendingApplyPost && (
      <ProfileSelector
        title="어떤 프로필로 지원할까요?"
        onSelect={(p) => {
          const { post, note } = pendingApplyPost
          setShowProfileSel(false)
          setPendingApplyPost(null)
          doApply(post, note, p.id, p.affiliation)
        }}
        onClose={() => { setShowProfileSel(false); setPendingApplyPost(null) }}
      />
    )}
    {reportTarget && (
      <ReportModal
        type="match"
        targetId={reportTarget.id}
        targetName={reportTarget.name}
        onClose={() => setReportTarget(null)}
      />
    )}
    </>
  )
}
