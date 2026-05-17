import React from 'react'
import { useStore } from '../store/useStore.js'
import styles from './ProfileSelector.module.css'

/**
 * ProfileSelector — 프로필 선택 모달
 * props:
 *   title: string (모달 제목)
 *   onSelect(profile): 선택 콜백 { id, label, affiliation, bio, oneliner, isDefault }
 *   onClose(): 닫기 콜백
 */
export default function ProfileSelector({ title = '어떤 프로필로 참여할까요?', onSelect, onClose }) {
  const currentUser = useStore((s) => s.currentUser)
  const profiles    = useStore((s) => s.profiles)

  // 기본 프로필 (currentUser 데이터 기반)
  const defaultProfile = {
    id: 'default',
    label: '기본 프로필',
    affiliation: currentUser?.affiliation || '',
    bio: currentUser?.bio || '',
    oneliner: currentUser?.oneliner || '',
    isDefault: true,
  }

  const allProfiles = [defaultProfile, ...profiles]

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <p className={styles.sub}>참여 시 이 프로필 정보가 팀원들에게 공유돼요</p>

        <div className={styles.list}>
          {allProfiles.map((profile) => (
            <button
              key={profile.id}
              className={styles.profileCard}
              onClick={() => onSelect(profile)}
            >
              <div className={styles.profileAvatar}>
                {profile.isDefault
                  ? (currentUser?.photoURL
                    ? <img src={currentUser.photoURL} alt="" className={styles.avatarImg} />
                    : <div className={styles.avatarInitial}>{currentUser?.name?.charAt(0) || '?'}</div>)
                  : <div className={styles.avatarInitial}>{profile.label?.charAt(0) || 'P'}</div>
                }
                {profile.isDefault && <span className={styles.defaultBadge}>기본</span>}
              </div>
              <div className={styles.profileInfo}>
                <p className={styles.profileLabel}>{profile.label}</p>
                {profile.affiliation && <p className={styles.profileAffil}>🏢 {profile.affiliation}</p>}
                {profile.oneliner && <p className={styles.profileOneliner}>"{profile.oneliner}"</p>}
              </div>
              <span className={styles.selectArrow}>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
