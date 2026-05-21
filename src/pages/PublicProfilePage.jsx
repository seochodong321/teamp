import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '../firebase.js'
import { FLOWER_TAGS } from '../constants.js'
import TeampMark from '../components/TeampMark.jsx'
import ReportModal from '../components/ReportModal.jsx'
import styles from './PublicProfilePage.module.css'

const ROLE_LABEL = { leader: '👑 리더', 'sub-leader': '⭐ 부리더', member: '팀원' }

export default function PublicProfilePage() {
  const { username } = useParams()
  const [user, setUser]             = useState(null)
  const [projects, setProjects]     = useState([])   // 공개 프로젝트 (목록 표시용)
  const [allProjects, setAllProjects] = useState([]) // 전체 참여 프로젝트 (통계용)
  const [flowerTags, setFlowerTags] = useState({})
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)
  const [copied, setCopied]         = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [isOwnProfile, setIsOwnProfile] = useState(false)

  // auth 복원 완료 후 쿼리 (새 탭에서 auth가 초기화되기 전에 쿼리가 실행되는 문제 방지)
  useEffect(() => {
    let cancelled = false
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (!cancelled) {
        fetchProfile().then((uid) => {
          if (firebaseUser && uid) setIsOwnProfile(firebaseUser.uid === uid)
        })
      }
    })
    return () => { cancelled = true; unsub() }
  }, [username])

  const fetchProfile = async () => {
    setLoading(true)

    // 1단계: 유저 조회 (실패 → not found)
    let userData = null
    try {
      let userSnap = await getDocs(
        query(collection(db, 'users'), where('username', '==', `@${username}`))
      )
      if (userSnap.empty) {
        userSnap = await getDocs(
          query(collection(db, 'users'), where('username', '==', username))
        )
      }
      if (userSnap.empty) { setNotFound(true); setLoading(false); return null }
      const raw = userSnap.docs[0].data()
      userData = {
        id:               userSnap.docs[0].id,
        name:             raw.name             || '',
        username:         raw.username         || '',
        oneliner:         raw.oneliner         || '',
        affiliation:      raw.affiliation      || '',
        photoURL:         raw.photoURL         || null,
        flowerTagSummary: raw.flowerTagSummary || {},
        flowerSenderCount: raw.flowerSenderCount || 0,
      }
      setUser(userData)
    } catch (e) {
      console.error('유저 조회 실패:', e)
      setNotFound(true)
      setLoading(false)
      return null
    }

    // 2단계: 공개 프로젝트 + 꽃다발 태그 (실패해도 프로필은 표시)
    try {
      const projSnap = await getDocs(
        query(collection(db, 'projects'),
          where('memberIds', 'array-contains', userData.id))
      )
      const all = projSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => !p.isTutorial)
        .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))
      const pubs = all.filter((p) => p.isPublic)
      setAllProjects(all)
      setProjects(pubs)

      // 꽃다발 태그: 유저 문서에 캐싱된 값 사용 (공개/비공개 무관 전체 집계)
      setFlowerTags(userData.flowerTagSummary || {})
    } catch (e) {
      console.warn('프로젝트/태그 조회 실패 (Firestore 규칙 확인 필요):', e)
    } finally {
      setLoading(false)
    }
    return userData.id
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className={styles.loading}>불러오는 중...</div>

  if (notFound) {
    return (
      <div className={styles.shell}>
        <div className={styles.topBar}>
          <div className={styles.brandBlock}>
            <TeampMark size={28}/>
            <div className={styles.brandTexts}>
              <span className={styles.brand}>팀프폴리오</span>
              <span className={styles.brandSub}>기여와 관계의 기록</span>
            </div>
          </div>
          <Link to="/home" className={styles.ctaBtn}>팀프 홈으로 →</Link>
        </div>
        <div className={styles.card}>
          <div className={styles.notFound}>
            <p className={styles.notFoundIcon}>👤</p>
            <p className={styles.notFoundTitle}>존재하지 않는 프로필이에요</p>
            <p className={styles.notFoundSub}>@{username}은 찾을 수 없어요.</p>
          </div>
        </div>
      </div>
    )
  }

  // 통계는 전체 참여 프로젝트 기준 (공개 여부 무관)
  const completedCount  = allProjects.filter((p) => p.status === 'archived').length
  const uniqueTeammates = new Set(
    allProjects.flatMap((p) => (p.members || []).map((m) => m.id)).filter((id) => id !== user.id)
  ).size
  const totalFeedback   = Object.values(flowerTags).reduce((a, b) => a + b, 0)
  const topFlowers = FLOWER_TAGS
    .filter((t) => flowerTags[t.id])
    .sort((a, b) => (flowerTags[b.id] || 0) - (flowerTags[a.id] || 0))
    .slice(0, 6)

  return (
    <>
    <div className={styles.shell}>
      {/* 상단 바 */}
      <div className={styles.topBar}>
        <div className={styles.brandBlock}>
          <span className={styles.brand}>팀프폴리오</span>
          <span className={styles.brandSub}>기여와 관계의 기록</span>
        </div>
        <div className={styles.topActions}>
          <button className={styles.copyBtn} onClick={handleCopy}>
            {copied ? '✓ 복사됨' : '🔗 링크 복사'}
          </button>
          {!isOwnProfile && (
            <button className={styles.reportUserBtn} onClick={() => setShowReport(true)}>🚩 신고</button>
          )}
          <Link to="/home" className={styles.ctaBtn}>팀프 홈으로 →</Link>
        </div>
      </div>

      <div className={styles.card}>
        {/* 배너 */}
        <div className={styles.banner} />

        {/* 아바타 + 이름 */}
        <div className={styles.heroRow}>
          <div className={styles.avatar}>
            {user.photoURL
              ? <img className={styles.avatarImg} src={user.photoURL} alt={user.name} />
              : (user.name?.charAt(0) || '?')
            }
          </div>
          <div className={styles.nameBlock}>
            <p className={styles.name}>{user.name}</p>
            <p className={styles.username}>{user.username}</p>
          </div>
        </div>

        <div className={styles.body}>
          {/* 원라이너 */}
          {user.oneliner && (
            <p className={styles.oneliner}>"{user.oneliner}"</p>
          )}

          {/* 소속 */}
          {user.affiliation && (
            <div className={styles.metaRow}>
              <span className={styles.metaChip}>🏫 {user.affiliation}</span>
            </div>
          )}

          {/* 통계 */}
          <div className={styles.statsRow}>
            <div className={styles.statBox}>
              <p className={styles.statNum}>{completedCount}</p>
              <p className={styles.statLabel}>완료 프로젝트</p>
            </div>
            <div className={styles.statBox}>
              <p className={styles.statNum}>{uniqueTeammates}</p>
              <p className={styles.statLabel}>함께한 팀원</p>
            </div>
            <div className={styles.statBox}>
              <p className={styles.statNum}>{user.flowerSenderCount || totalFeedback}</p>
              <p className={styles.statLabel}>받은 피드백</p>
            </div>
          </div>
          {projects.length < allProjects.length && (
            <p className={styles.statNote}>* 공개 설정된 프로젝트 기준이에요</p>
          )}

          {/* 팀원 평가 */}
          {topFlowers.length > 0 && (
            <div>
              <p className={styles.secTitle}>팀원이 전한 말</p>
              <div className={styles.flowerRow}>
                {topFlowers.map((t) => (
                  <span key={t.id} className={styles.flowerChip}>
                    {t.emoji} {t.label}
                    <span className={styles.flowerCount}>{flowerTags[t.id]}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 프로젝트 이력 */}
          <div>
            <p className={styles.secTitle}>프로젝트 이력</p>
            {projects.length === 0 ? (
              <p className={styles.empty}>
                공개 설정된 프로젝트가 없어요<br />
                <span className={styles.emptyHint}>프로젝트 멤버 탭에서 공개 설정하면 이 곳에 표시돼요</span>
              </p>
            ) : (
              <div className={styles.projectList}>
                {projects.map((p) => {
                  const me = p.members?.find((m) => m.id === user.id)
                  const teamSize = p.members?.length || 0
                  return (
                    <div key={p.id} className={styles.projectCard}>
                      <div className={styles.projectTop}>
                        <span className={styles.projectEmoji}>{p.emoji || '📁'}</span>
                        <div className={styles.projectInfo}>
                          <p className={styles.projectName}>{p.name}</p>
                          <p className={styles.projectMeta}>
                            {p.category && `${p.category} · `}
                            {p.startDate}{p.endDate && ` ~ ${p.endDate}`}
                            {teamSize > 0 && ` · 팀원 ${teamSize}명`}
                          </p>
                        </div>
                        <div className={styles.projectChips}>
                          {me && <span className={styles.projectRole}>{ROLE_LABEL[me.role] || me.role}</span>}
                          <span className={`${styles.statusChip} ${p.status === 'archived' ? styles.statusDone : styles.statusActive}`}>
                            {p.status === 'archived' ? '완료' : '진행 중'}
                          </span>
                        </div>
                      </div>
                      {p.purpose && (
                        <p className={styles.projectPurpose}>{p.purpose}</p>
                      )}
                      {me?.memo && (
                        <p className={styles.projectMemo}>✍️ {me.memo}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className={styles.footer}>Powered by <strong>Teamp</strong> · 팀 프로젝트 협업 플랫폼</p>
    </div>
    {showReport && user && (
      <ReportModal
        type="user"
        targetId={user.id}
        targetName={user.name}
        onClose={() => setShowReport(false)}
      />
    )}
    </>
  )
}
