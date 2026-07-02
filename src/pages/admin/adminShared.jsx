import React, { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import styles from '../AdminPage.module.css'

// 어드민 탭 공용 — 라벨 상수·타임스탬프 유틸·확인 모달 훅·통계 카드
export const TYPE_LABEL = { project: '프로젝트', match: '매치 모집글', user: '유저 프로필', note: '쪽지' }
export const REASON_LABEL = {
  illegal: '불법 콘텐츠', spam: '스팸 / 홍보', false: '허위 정보',
  hate: '욕설 / 혐오 표현', other: '기타',
}
export const LOG_ACTION = {
  block: '🚫 블락', unblock: '✅ 블락 해제', 'delete-user': '🗑️ 유저 탈퇴',
  plan: '💳 요금제 변경', 'delete-project': '📁 프로젝트 삭제',
  'delete-match': '🤝 모집글 삭제', 'close-match': '🤝 모집 마감',
  promote: '🛡️ 어드민 승급', demote: '🔻 어드민 해제',
}
export const SELECTABLE_PLANS = ['free', 'student', 'pro', 'team']  // 'admin'은 요금제 아님(권한 토글로 분리)
export const PLAN_KO = { free: '무료', student: '학생', pro: '프로', team: '팀' }

export const tsMs  = (ts) => ts?.toMillis ? ts.toMillis() : (ts?.seconds ? ts.seconds * 1000 : 0)
export const fmtTs = (ts) => {
  const ms = tsMs(ts)
  if (!ms) return '-'
  return new Date(ms).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}


export function useAdminConfirm() {
  const [state, setState] = useState(null) // { message, onConfirm, error, loading }

  const ask = useCallback((message, onConfirm) => {
    setState({ message, onConfirm, error: null, loading: false })
  }, [])

  const dismiss = useCallback(() => setState(null), [])

  const handleOk = useCallback(async () => {
    if (!state) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      await state.onConfirm()
      setState(null)
    } catch (err) {
      const msg = err?.code === 'permission-denied'
        ? '권한이 없어요. Firestore 규칙을 확인해주세요.'
        : (err?.message || '오류가 발생했어요.')
      setState((s) => ({ ...s, loading: false, error: msg }))
    }
  }, [state])

  const dialog = state ? createPortal(
    <div className={styles.confirmBackdrop} onClick={dismiss}>
      <div className={styles.confirmBox} onClick={(e) => e.stopPropagation()}>
        <p className={styles.confirmMsg}>{state.message}</p>
        {state.error && <p className={styles.confirmError}>{state.error}</p>}
        <div className={styles.confirmBtns}>
          <button className={styles.confirmCancel} onClick={dismiss} disabled={state.loading}>취소</button>
          <button className={styles.confirmOk} onClick={handleOk} disabled={state.loading}>
            {state.loading ? '처리 중...' : '확인'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return { ask, dialog }
}

// ─── 통계 대시보드 탭 ─────────────────────────────────────────

export function StatCard({ label, value, sub }) {
  return (
    <div className={styles.statCard}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>{value.toLocaleString()}</p>
      {sub && <p className={styles.statSub}>{sub}</p>}
    </div>
  )
}

