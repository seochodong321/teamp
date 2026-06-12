import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApp } from 'firebase/app'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { useStore } from '../store/useStore.js'
import TeampMark from '../components/TeampMark.jsx'
import styles from './StudentVerifyPage.module.css'

const STUDENT_DOMAINS = ['.ac.kr', '.edu', '.ac.jp', '.ac.uk', '.edu.au']

function isStudentEmail(email) {
  return STUDENT_DOMAINS.some((d) => email.toLowerCase().endsWith(d))
}

export default function StudentVerifyPage() {
  const navigate = useNavigate()
  const { currentUser, updateProfile } = useStore((s) => ({
    currentUser: s.currentUser,
    updateProfile: s.updateProfile,
  }))

  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [done,    setDone]    = useState(false)

  if (currentUser?.plan === 'student') return (
    <div className={styles.page}>
      <div className={styles.card}>
        <TeampMark size={40} />
        <div className={styles.iconWrap} style={{ background: '#CCFBF1', color: '#0D9488' }}>✓</div>
        <h1 className={styles.title}>이미 학생 인증이 완료됐어요</h1>
        <p className={styles.sub}>Pro 플랜을 무료로 이용 중이에요.</p>
        <button className={styles.btn} onClick={() => navigate('/profile')}>프로필로 돌아가기</button>
      </div>
    </div>
  )

  if (done) return (
    <div className={styles.page}>
      <div className={styles.card}>
        <TeampMark size={40} />
        <div className={styles.iconWrap} style={{ background: '#CCFBF1', color: '#0D9488' }}>🎓</div>
        <h1 className={styles.title}>학생 인증 완료!</h1>
        <p className={styles.sub}>Pro 플랜을 1년간 무료로 사용할 수 있어요.<br />1년 후 재인증 안내를 드릴게요.</p>
        <button className={styles.btn} onClick={() => navigate('/home')}>팀프 시작하기 →</button>
      </div>
    </div>
  )

  const handleVerify = async (e) => {
    e.preventDefault()
    setError('')
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) { setError('이메일을 입력해주세요.'); return }
    if (!isStudentEmail(trimmed)) {
      setError('학교 이메일(.ac.kr, .edu 등)만 인증할 수 있어요.')
      return
    }
    if (!currentUser) { setError('로그인이 필요해요.'); return }

    setLoading(true)
    try {
      // 결제 우회 차단 — plan은 클라가 직접 못 쓰고 서버 함수(verifyStudent)가 도메인 검증 후 부여
      const call = httpsCallable(getFunctions(getApp(), 'asia-northeast3'), 'verifyStudent')
      await call({ email: trimmed })
      const now = new Date().toISOString()
      updateProfile({ plan: 'student', studentEmail: trimmed, studentVerifiedAt: now })
      setDone(true)
    } catch (e) {
      setError(e?.message || '인증에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>← 뒤로</button>
        <TeampMark size={40} />
        <div className={styles.iconWrap}>🎓</div>
        <h1 className={styles.title}>학생 인증</h1>
        <p className={styles.sub}>학교 이메일로 인증하면 <strong>Pro 플랜을 1년간 무료</strong>로 사용할 수 있어요.</p>

        <div className={styles.domainList}>
          {STUDENT_DOMAINS.map((d) => (
            <span key={d} className={styles.domainChip}>{d}</span>
          ))}
        </div>

        <form className={styles.form} onSubmit={handleVerify}>
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError('') }}
            placeholder="학교 이메일 입력 (예: student@university.ac.kr)"
            disabled={loading}
            autoFocus
          />
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.btn} disabled={loading || !email.trim()}>
            {loading ? '인증 중...' : '학생 인증하기'}
          </button>
        </form>

        <p className={styles.hint}>인증은 1년마다 갱신이 필요해요. 재학 중에만 유지돼요.</p>
      </div>
    </div>
  )
}
