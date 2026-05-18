import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { collection, getDocs, getDoc, query, where, doc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { FLOWER_TAGS } from '../constants.js'
import styles from './PublicProfilePage.module.css'

const ROLE_LABEL = { leader: '👑 리더', 'sub-leader': '⭐ 부리더', member: '팀원' }

export default function PublicProfilePage() {
  const { username } = useParams()
  const [user, setUser]         = useState(null)
  const [projects, setProjects] = useState([])
  const [flowerTags, setFlowerTags] = useState({})
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [username])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      // 1. username으로 유저 조회
      const userSnap = await getDocs(
        query(collection(db, 'users'), where('username', '==', `@${username}`))
      )
      if (userSnap.empty) { setNotFound(true); return }
      const userData = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() }
      setUser(userData)

      // 2. 공개 프로젝트 조회
      const projSnap = await getDocs(
        query(collection(db, 'projects'),
          where('memberIds', 'array-contains', userData.id),
          where('isPublic', '==', true))
      )
      const pubs = projSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => !p.isTutorial)
        .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))
      setProjects(pubs)

      // 3. 꽃다발 태그 (공개 완료 프로젝트의 wrapup에서)
      const archived = pubs.filter((p) => p.status === 'archived' && p.wrapupId)
      const tagCounts = {}
      await Promise.all(archived.map(async (p) => {
        try {
          const snap = await getDoc(doc(db, 'wrapups', p.wrapupId))
          if (snap.exists()) {
            const data = snap.data()
            ;(data.feedbacks || [])
              .filter((f) => f.toUserId === userData.id)
              .forEach((f) => {
                ;(f.tags || []).forEach((tag) => {
                  tagCounts[tag.id] = (tagCounts[tag.id] || 0) + 1
                })
              })
          }
        } catch {}
      }))
      setFlowerTags(tagCounts)
    } catch (e) {
      console.error(e)
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className={styles.loading}>불러오는 중...</div>

  if (notFound) {
    return (
      <div className={styles.shell}>
        <div className={styles.topBar} style={{ maxWidth: 600 }}>
          <span className={styles.brand}>Teamp</span>
          <Link to="/login" className={styles.ctaBtn}>로그인</Link>
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

  const completedCount = projects.filter((p) => p.status === 'archived').length
  const activeCount    = projects.filter((p) => p.status === 'active').length
  const topFlowers = FLOWER_TAGS
    .filter((t) => flowerTags[t.id])
    .sort((a, b) => (flowerTags[b.id] || 0) - (flowerTags[a.id] || 0))
    .slice(0, 5)

  return (
    <div className={styles.shell}>
      {/* 상단 브랜드 바 */}
      <div className={styles.topBar}>
        <span className={styles.brand}>Teamp</span>
        <Link to="/login" className={styles.ctaBtn}>Teamp 시작하기 →</Link>
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

          {/* 메타 정보 */}
          {(user.affiliation) && (
            <div className={styles.metaRow}>
              {user.affiliation && <span className={styles.metaChip}>🏫 {user.affiliation}</span>}
            </div>
          )}

          {/* 통계 */}
          <div className={styles.statsRow}>
            <div className={styles.statBox}>
              <p className={styles.statNum}>{projects.length}</p>
              <p className={styles.statLabel}>공개 프로젝트</p>
            </div>
            <div className={styles.statBox}>
              <p className={styles.statNum}>{completedCount}</p>
              <p className={styles.statLabel}>완료한 프로젝트</p>
            </div>
            <div className={styles.statBox}>
              <p className={styles.statNum}>{activeCount}</p>
              <p className={styles.statLabel}>현재 진행 중</p>
            </div>
          </div>

          {/* 꽃다발 태그 */}
          {topFlowers.length > 0 && (
            <div>
              <p className={styles.secTitle}>받은 꽃다발</p>
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

          {/* 공개 프로젝트 목록 */}
          <div>
            <p className={styles.secTitle}>공개 프로젝트</p>
            {projects.length === 0 ? (
              <p className={styles.empty}>공개된 프로젝트가 없어요</p>
            ) : (
              <div className={styles.projectList}>
                {projects.map((p) => {
                  const me = p.members?.find((m) => m.id === user.id)
                  return (
                    <div key={p.id} className={styles.projectCard}>
                      <span className={styles.projectEmoji}>{p.emoji || '📁'}</span>
                      <div className={styles.projectInfo}>
                        <p className={styles.projectName}>{p.name}</p>
                        <p className={styles.projectMeta}>
                          {p.category && `${p.category} · `}
                          {p.startDate}{p.endDate && ` ~ ${p.endDate}`}
                        </p>
                      </div>
                      {me && <span className={styles.projectRole}>{ROLE_LABEL[me.role] || me.role}</span>}
                      <span className={`${styles.statusChip} ${p.status === 'archived' ? styles.statusDone : styles.statusActive}`}>
                        {p.status === 'archived' ? '완료' : '진행 중'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className={styles.footer}>Powered by Teamp · 팀 프로젝트 협업 플랫폼</p>
    </div>
  )
}
