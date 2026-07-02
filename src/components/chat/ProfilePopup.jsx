import React from 'react'
import { useNavigate } from 'react-router-dom'
import styles from '../../pages/ChatPage.module.css'

// 채팅 아바타 클릭 프로필 팝업 — 원라이너·함께한 프로젝트·팀프폴리오 링크·
// 1:1 대화/쪽지/차단. popup = { userId, name, avStyle, x, y, loading, data }
export default function ProfilePopup({ popup, projects, currentUserId, blockedUsers, onDm, onClose, onBlock, onUnblock }) {
  const navigate = useNavigate()
  const pd = popup.data || {}
  const sharedProjects = projects.filter((p) =>
    p.members.some((m) => m.id === currentUserId) &&
    p.members.some((m) => m.id === popup.userId) &&
    !p.isTutorial
  )
  const isBlocked = (blockedUsers || []).includes(popup.userId)
  return (
    <div className={styles.profilePopup}
      style={{ top: popup.y, left: popup.x }}
      onClick={(e) => e.stopPropagation()}>
      <div className={styles.ppHeader}>
        <div className={styles.ppAvatar} style={{ background: popup.avStyle.bg, color: popup.avStyle.text }}>
          {pd.photoURL
            ? <img src={pd.photoURL} alt={popup.name} className={styles.ppAvatarImg} />
            : popup.name.charAt(0)
          }
        </div>
        <div className={styles.ppInfo}>
          <p className={styles.ppName}>{pd.name || popup.name}</p>
          {pd.username && <p className={styles.ppUsername}>@{pd.username.replace('@', '')}</p>}
          {pd.affiliation && <p className={styles.ppAffiliation}>🏢 {pd.affiliation}</p>}
        </div>
      </div>
      {popup.loading
        ? <p className={styles.ppLoading}><span className={styles.ppSpinner} /> 불러오는 중...</p>
        : pd.oneliner ? <p className={styles.ppOneliner}>"{pd.oneliner}"</p> : null
      }
      {sharedProjects.length > 0 && (
        <p className={styles.ppShared}>함께한 프로젝트 {sharedProjects.length}개</p>
      )}
      {pd.username && (
        <a href={`/u/${pd.username.replace('@', '')}`} target="_blank" rel="noreferrer"
          className={styles.ppTeamfolio} onClick={(e) => e.stopPropagation()}>
          팀프폴리오 보기 →
        </a>
      )}
      {!isBlocked && !popup.loading && (
        <div className={styles.ppActions}>
          <button className={styles.ppDmBtn} onClick={() => onDm(popup)}>💬 1:1 대화</button>
          {pd.username && (
            <button className={styles.ppNoteBtn}
              onClick={() => { onClose(); navigate(`/messages?compose=1&to=${pd.username.replace('@', '')}`) }}>
              ✉️ 쪽지
            </button>
          )}
        </div>
      )}
      <div className={styles.ppFooter}>
        {isBlocked
          ? <button className={styles.ppUnblockBtn} onClick={() => { onUnblock(popup.userId); onClose() }}>차단 해제</button>
          : <button className={styles.ppBlockBtn} onClick={() => { onBlock(popup.userId); onClose() }}>차단하기</button>
        }
      </div>
    </div>
  )
}
