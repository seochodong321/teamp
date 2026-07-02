import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import { useShallow } from 'zustand/react/shallow'
import { deleteProjectDeep } from '../store/helpers.js'
import { useAdminConfirm } from './admin/adminShared.jsx'
import StatsTab from './admin/StatsTab.jsx'
import AnnouncementTab from './admin/AnnouncementTab.jsx'
import ReportsTab from './admin/ReportsTab.jsx'
import ProjectsTab from './admin/ProjectsTab.jsx'
import MatchTab from './admin/MatchTab.jsx'
import UsersTab from './admin/UsersTab.jsx'
import LogsTab from './admin/LogsTab.jsx'
import styles from './AdminPage.module.css'

const ADMIN_EMAILS = ['seobomin524@gmail.com']

export default function AdminPage() {
  const { currentUser, showError } = useStore(useShallow((s) => ({ currentUser: s.currentUser, showError: s.showError })))
  const [activeTab, setActiveTab] = useState('stats')
  const [pendingReports, setPendingReports] = useState(0)
  const [migrating, setMigrating] = useState(false) // PII 마이그레이션(C1) 진행중 — 훅은 최상단
  const { ask, dialog } = useAdminConfirm()

  const isBootstrap = ADMIN_EMAILS.includes(currentUser?.email)  // 루트 — 승급/강등 권한
  const isAdmin = isBootstrap || currentUser?.isAdmin === true   // 어드민 = 루트 또는 승급된 유저

  // 대기 중인 신고 수 — 열자마자 처리할 일이 있는지 한눈에
  useEffect(() => {
    if (!isAdmin) return
    getDocs(query(collection(db, 'reports'), where('status', '==', 'pending')))
      .then((snap) => setPendingReports(snap.size))
      .catch(() => {})
  }, [isAdmin])

  if (!isAdmin) return <Navigate to="/home" replace />

  // 어드민 활동 로그 1건 기록 (append-only 감사 로그)
  const logAdmin = (entry) =>
    addDoc(collection(db, 'adminLogs'), {
      actorEmail: currentUser?.email || '',
      ...entry,
      createdAt: serverTimestamp(),
    }).catch(() => {})

  // ── 액션: 프로젝트 삭제
  const handleDeleteProject = (projectId, name, reportId, onSuccess) => {
    ask(`"${name}" 프로젝트를 삭제할까요? 되돌릴 수 없어요.`, async () => {
      const snap = await getDoc(doc(db, 'projects', projectId))
      const memberIds = snap.exists()
        ? (snap.data().memberIds || (snap.data().members || []).map((m) => m.id))
        : []
      if (snap.exists()) await deleteProjectDeep({ id: projectId, ...snap.data() })  // 메시지·파일까지 완전 삭제
      if (reportId) await updateDoc(doc(db, 'reports', reportId), { status: 'resolved', resolvedAt: serverTimestamp() })
      await Promise.all(memberIds.map((uid) =>
        addDoc(collection(db, 'notifications'), {
          targetUserId: uid, type: 'admin', read: false,
          fromUserId: currentUser.id, // 발신자 본인 검증 (보안 규칙)
          text: `🛡️ 관리자에 의해 "${name}" 프로젝트가 삭제되었습니다.`,
          link: '/help', createdAt: serverTimestamp(),
        })
      ))
      logAdmin({ type: 'delete-project', targetId: projectId, targetName: name })
      onSuccess?.()
    })
  }

  // ── 액션: 매치 모집글 삭제
  const handleDeleteMatch = (postId, title, reportId, onSuccess) => {
    ask(`"${title}" 모집글을 삭제할까요?`, async () => {
      const snap = await getDoc(doc(db, 'matchPosts', postId))
      const leaderId = snap.exists() ? snap.data().leaderId : null
      await deleteDoc(doc(db, 'matchPosts', postId))
      if (reportId) await updateDoc(doc(db, 'reports', reportId), { status: 'resolved', resolvedAt: serverTimestamp() })
      if (leaderId) {
        await addDoc(collection(db, 'notifications'), {
          targetUserId: leaderId, type: 'admin', read: false,
          fromUserId: currentUser.id, // 발신자 본인 검증 (보안 규칙)
          text: `🛡️ 관리자에 의해 "${title}" 모집글이 삭제되었습니다.`,
          link: '/help', createdAt: serverTimestamp(),
        })
      }
      logAdmin({ type: 'delete-match', targetId: postId, targetName: title })
      onSuccess?.()
    })
  }

  // ── 액션: 유저 블락
  const handleBlockUser = (uid, name, onSuccess, reportId) => {
    ask(`"${name}" 계정을 블락할까요? 해당 유저는 로그인할 수 없게 돼요.`, async () => {
      await updateDoc(doc(db, 'users', uid), { banned: true, bannedAt: serverTimestamp() })
      if (reportId) await updateDoc(doc(db, 'reports', reportId), { status: 'resolved', resolvedAt: serverTimestamp() })
      logAdmin({ type: 'block', targetId: uid, targetName: name })
      onSuccess?.()
    })
  }

  // ── 액션: 매치 강제 마감
  const handleCloseMatch = (postId, title, onSuccess) => {
    ask(`"${title}" 모집글을 마감 처리할까요? 기존 지원자는 유지되고 새 지원은 받지 않아요.`, async () => {
      const snap = await getDoc(doc(db, 'matchPosts', postId))
      const leaderId = snap.exists() ? snap.data().leaderId : null
      await updateDoc(doc(db, 'matchPosts', postId), { status: 'closed' })
      if (leaderId) {
        await addDoc(collection(db, 'notifications'), {
          targetUserId: leaderId, type: 'admin', read: false,
          fromUserId: currentUser.id, // 발신자 본인 검증 (보안 규칙)
          text: `🛡️ 관리자에 의해 "${title}" 모집글이 마감 처리되었습니다.`,
          link: '/help', createdAt: serverTimestamp(),
        })
      }
      logAdmin({ type: 'close-match', targetId: postId, targetName: title })
      onSuccess?.()
    })
  }

  // ── 액션: 유저 블락 해제
  const handleUnblockUser = (uid, name, onSuccess) => {
    ask(`"${name}" 계정의 블락을 해제할까요?`, async () => {
      await updateDoc(doc(db, 'users', uid), { banned: false, bannedAt: null })
      logAdmin({ type: 'unblock', targetId: uid, targetName: name })
      onSuccess?.()
    })
  }

  // ── 액션: 유저 완전 삭제 (Auth + Firestore) — Cloud Function 호출
  const handleDeleteUser = (uid, name, onSuccess) => {
    ask(`"${name}" 계정을 완전히 삭제할까요?\nFirebase 인증·프로필·데이터가 모두 사라지고 되돌릴 수 없어요.`, async () => {
      try {
        const call = httpsCallable(getFunctions(getApp(), 'asia-northeast3'), 'adminDeleteUser')
        const res = await call({ uid })
        if (res?.data?.authDeleted === false) {
          showError('데이터는 삭제했지만 인증 계정은 이미 없거나 삭제하지 못했어요.')
        }
        logAdmin({ type: 'delete-user', targetId: uid, targetName: name })
        onSuccess?.()
      } catch (e) {
        console.error('[adminDeleteUser]', e)
        showError(`삭제에 실패했어요: ${e?.message || '알 수 없는 오류'} (함수 배포가 필요할 수 있어요)`)
      }
    })
  }

  // ── 액션: PII 1회 마이그레이션 (C1) — 본문서 phone·blockedUsers → 본인전용 서브문서
  const handleMigratePii = () => {
    ask('전체 유저의 전화번호·차단목록을 본인전용 영역으로 이전하고 공개 문서에서 삭제할까요?\n새 클라이언트 배포(푸시) 후 1회 실행하세요. 여러 번 눌러도 안전해요.', async () => {
      setMigrating(true)
      try {
        const call = httpsCallable(getFunctions(getApp(), 'asia-northeast3'), 'migratePiiToPrivate')
        const res = await call()
        window.alert(`완료 — ${res?.data?.moved ?? 0}명 이전 / ${res?.data?.scanned ?? 0}명 검사`)
        logAdmin({ type: 'migrate-pii', targetName: `${res?.data?.moved ?? 0}명` })
      } catch (e) {
        console.error('[migratePiiToPrivate]', e)
        showError(`마이그레이션 실패: ${e?.message || '알 수 없는 오류'}`)
      } finally {
        setMigrating(false)
      }
    })
  }

  // ── 액션: 방 권한 1회 마이그레이션 (Task A) — leaderIds + 개별방 memberIds 백필
  const handleMigrateRooms = () => {
    ask('기존 프로젝트에 방별 접근권한(leaderIds·개별방 memberIds)을 채울까요?\n새 클라이언트 배포 후 1회 실행. 여러 번 눌러도 안전해요.', async () => {
      setMigrating(true)
      try {
        const call = httpsCallable(getFunctions(getApp(), 'asia-northeast3'), 'migrateRoomAccess')
        const res = await call()
        window.alert(`완료 — 프로젝트 ${res?.data?.projects ?? 0} / 개별방 ${res?.data?.rooms ?? 0}`)
        logAdmin({ type: 'migrate-rooms', targetName: `${res?.data?.projects ?? 0}개 프로젝트` })
      } catch (e) {
        console.error('[migrateRoomAccess]', e)
        showError(`마이그레이션 실패: ${e?.message || '알 수 없는 오류'}`)
      } finally {
        setMigrating(false)
      }
    })
  }

  // ── 액션: 매치 지원자 1회 마이그레이션 (M1) — applicants[] → 서브컬렉션, 본문서 PII 제거
  const handleMigrateMatch = () => {
    ask('기존 매치 모집글의 지원자를 본인전용 서브컬렉션으로 이전하고 공개 문서에서 PII(이름·소속·지원사유)를 제거할까요?\n새 클라이언트 배포 후 1회 실행. 여러 번 눌러도 안전해요.', async () => {
      setMigrating(true)
      try {
        const call = httpsCallable(getFunctions(getApp(), 'asia-northeast3'), 'migrateMatchApplicants')
        const res = await call()
        window.alert(`완료 — 모집글 ${res?.data?.posts ?? 0} / 지원자 ${res?.data?.applicants ?? 0}`)
        logAdmin({ type: 'migrate-match', targetName: `${res?.data?.posts ?? 0}개 모집글` })
      } catch (e) {
        console.error('[migrateMatchApplicants]', e)
        showError(`마이그레이션 실패: ${e?.message || '알 수 없는 오류'}`)
      } finally {
        setMigrating(false)
      }
    })
  }

  // ── 액션: 어드민 권한 부여/해제 (부트스트랩만 — 규칙도 동일하게 강제)
  const handleToggleAdmin = (uid, name, makeAdmin, onSuccess) => {
    ask(`"${name}" 님을 ${makeAdmin ? '어드민으로 승급할까요? 다른 유저를 관리할 수 있게 돼요.' : '어드민에서 해제할까요?'}`, async () => {
      try {
        await updateDoc(doc(db, 'users', uid), { isAdmin: makeAdmin })
        logAdmin({ type: makeAdmin ? 'promote' : 'demote', targetId: uid, targetName: name })
        onSuccess?.()
      } catch (e) {
        console.error('[toggleAdmin]', e)
        showError('권한 변경에 실패했어요.')
      }
    })
  }

  const TABS = [
    ['stats',    '📊 통계'],
    ['reports',  '🚩 신고'],
    ['projects', '📁 프로젝트'],
    ['match',    '🤝 매치'],
    ['users',    '👤 유저'],
    ['logs',     '📜 로그'],
    ['announce', '📢 공지'],
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>🛡️ 팀프 마스터</h1>
          <p className={styles.sub}>Teamp Admin · {currentUser?.email}</p>
        </div>
        {pendingReports > 0 && (
          <button className={styles.pendingPill} onClick={() => setActiveTab('reports')}>
            🚩 처리할 신고 {pendingReports}건 →
          </button>
        )}
      </div>

      <div className={styles.mainTabs}>
        {TABS.map(([key, label]) => (
          <button key={key} className={`${styles.mainTab} ${activeTab === key ? styles.mainTabActive : ''}`}
            onClick={() => setActiveTab(key)}>
            {label}
            {key === 'reports' && pendingReports > 0 && (
              <span className={styles.tabBadge}>{pendingReports > 9 ? '9+' : pendingReports}</span>
            )}
          </button>
        ))}
      </div>

      {isBootstrap && activeTab === 'stats' && (
        <div style={{ margin: '12px 0', padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-secondary)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            🔒 개인정보 격리(C1) — 전화번호·차단목록을 본인전용 영역으로 1회 이전. 클라이언트 배포 후 한 번 실행하세요.
          </div>
          <button onClick={handleMigratePii} disabled={migrating}
            style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: migrating ? 'default' : 'pointer' }}>
            {migrating ? '이전 중…' : 'PII 마이그레이션 실행'}
          </button>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '12px 0 8px' }}>
            🚪 방 권한(Task A) — 기존 프로젝트에 방별 접근권한 백필. 클라이언트 배포 후 한 번 실행하세요.
          </div>
          <button onClick={handleMigrateRooms} disabled={migrating}
            style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: migrating ? 'default' : 'pointer' }}>
            {migrating ? '이전 중…' : '방 권한 마이그레이션 실행'}
          </button>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '12px 0 8px' }}>
            🤝 매치 지원자(M1) — 지원자 PII를 본인전용 서브컬렉션으로 이전·공개문서서 제거. 클라이언트 배포 후 한 번 실행하세요.
          </div>
          <button onClick={handleMigrateMatch} disabled={migrating}
            style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: migrating ? 'default' : 'pointer' }}>
            {migrating ? '이전 중…' : '매치 지원자 마이그레이션 실행'}
          </button>
        </div>
      )}
      {activeTab === 'stats'    && <StatsTab />}
      {activeTab === 'reports'  && (
        <ReportsTab
          onDeleteProject={handleDeleteProject}
          onDeleteMatch={handleDeleteMatch}
          onBlockUser={handleBlockUser}
        />
      )}
      {activeTab === 'projects' && <ProjectsTab onDeleteProject={handleDeleteProject} />}
      {activeTab === 'match'    && <MatchTab    onDeleteMatch={handleDeleteMatch} onCloseMatch={handleCloseMatch} />}
      {activeTab === 'users'    && <UsersTab    onBlockUser={handleBlockUser} onUnblockUser={handleUnblockUser} onDeleteUser={handleDeleteUser} onToggleAdmin={handleToggleAdmin} isBootstrap={isBootstrap} logAdmin={logAdmin} />}
      {activeTab === 'logs'     && <LogsTab />}
      {activeTab === 'announce' && <AnnouncementTab currentUser={currentUser} />}

      {dialog}
    </div>
  )
}
