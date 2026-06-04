import React, { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import styles from './ReportModal.module.css'

const REASONS = [
  { id: 'illegal',   label: '불법 콘텐츠' },
  { id: 'spam',      label: '스팸 / 홍보' },
  { id: 'false',     label: '허위 정보' },
  { id: 'hate',      label: '욕설 / 혐오 표현' },
  { id: 'other',     label: '기타' },
]

// type: 'project' | 'match' | 'user' | 'note'
// targetId: Firestore document ID
// targetName: display name for the report
// extra: 신고 컨텍스트(쪽지 발신/수신/내용 등) — 그대로 report 문서에 병합
export default function ReportModal({ type, targetId, targetName, extra, onClose }) {
  const { currentUser, showError } = useStore()
  const [reason, setReason]   = useState('')
  const [detail, setDetail]   = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)

  const TYPE_LABEL = { project: '프로젝트', match: '매치 모집글', user: '유저 프로필', note: '쪽지' }

  const handleSubmit = async () => {
    if (!reason) return
    if (!currentUser) { showError('신고하려면 로그인이 필요해요.'); return }
    setSending(true)
    try {
      await addDoc(collection(db, 'reports'), {
        type,
        targetId,
        targetName,
        reporterId: currentUser.id,
        reporterName: currentUser.name,
        reason,
        detail: detail.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
        ...(extra || {}),
      })
      setSent(true)
    } catch {
      showError('신고 접수 중 오류가 발생했어요. 다시 시도해주세요.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>신고하기</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {sent ? (
          <div className={styles.sentWrap}>
            <p className={styles.sentIcon}>✅</p>
            <p className={styles.sentTitle}>신고가 접수됐어요</p>
            <p className={styles.sentDesc}>검토 후 적절한 조치를 취할게요. 감사해요.</p>
            <button className={styles.doneBtn} onClick={onClose}>확인</button>
          </div>
        ) : (
          <div className={styles.body}>
            <p className={styles.target}>
              <span className={styles.targetType}>{TYPE_LABEL[type]}</span>
              <span className={styles.targetName}>{targetName}</span>
            </p>

            <div className={styles.reasonList}>
              {REASONS.map((r) => (
                <label key={r.id} className={`${styles.reasonItem} ${reason === r.id ? styles.reasonSelected : ''}`}>
                  <input type="radio" name="reason" value={r.id} checked={reason === r.id}
                    onChange={() => setReason(r.id)} />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>

            <textarea
              className={styles.detail}
              value={detail}
              onChange={(e) => setDetail(e.target.value.slice(0, 300))}
              placeholder="구체적인 내용을 적어주시면 빠른 처리에 도움이 돼요 (선택)"
              rows={3}
            />
            <span className={styles.detailCount}>{detail.length}/300</span>

            <button className={styles.submitBtn} onClick={handleSubmit} disabled={!reason || sending}>
              {sending ? '접수 중...' : '신고 접수'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
