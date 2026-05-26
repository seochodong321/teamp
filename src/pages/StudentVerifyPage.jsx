import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
} from 'firebase/auth'
import { doc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import TeampMark from '../components/TeampMark.jsx'
import styles from './StudentVerifyPage.module.css'

const STUDENT_DOMAINS = ['.ac.kr', '.edu', '.ac.jp', '.ac.uk', '.edu.au']

function isStudentEmail(email) {
  return STUDENT_DOMAINS.some((d) => email.toLowerCase().endsWith(d))
}

export default function StudentVerifyPage() {
  const navigate      = useNavigate()
  const [params]      = useSearchParams()
  const { currentUser, updateProfile } = useStore((s) => ({ currentUser: s.currentUser, updateProfile: s.updateProfile }))

  const [email,    setEmail]    = useState('')
  const [sent,     setSent]     = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [verified, setVerified] = useState(false)

  // ── 이메일 링크 콜백 처리 ──────────────────────────────────
  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return

    const savedEmail = window.localStorage.getItem('studentVerifyEmail')
    const savedUid   = window.localStorage.getItem('studentVerifyUid')
    if (!savedEmail || !savedUid) {
      setError('인증 정보가 없어요. 다시 시도해주세요.')
      return
    }

    setLoading(true)
    signInWithEmailLink(auth, savedEmail, window.location.href)
      .then(async () => {
        await updateDoc(doc(db, 'users', savedUid), {
          plan:               'student',
          studentEmail:       savedEmail,
          studentVerifiedAt:  new Date().toISOString(),
        })
        updateProfile({ plan: 'student', studentEmail: savedEmail })
        window.localStorage.removeItem('studentVerifyEmail')
        window.localStorage.removeItem('studentVerifyUid')
        setVerified(true)
      })
      .catch(() => setError('인증에 실패했어요. 링크가 만료됐거나 이미 사용됐어요.'))
      .finally(() => setLoading(false))
  }, [updateProfile])

  // ── 이메일 발송 ───────────────────────────────────────────
  const handleSend = async (e) => {
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
      const appOrigin = import.meta.env.VITE_APP_URL || window.location.origin
      await sendSignInLinkToEmail(auth, trimmed, {
        url: `${appOrigin}/verify-student`,
        handleCodeInApp: true,
      })
      window.localStorage.setItem('studentVerifyEmail', trimmed)
      window.localStorage.setItem('studentVerifyUid',   currentUser.id)
      setSent(true)
    } catch (err) {
      if (err.code === 'auth/invalid-email') setError('올바른 이메일 형식이 아니에요.')
      else setError('발송에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  // ── 이미 학생 플랜 ────────────────────────────────────────
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

  // ── 인증 완료 ─────────────────────────────────────────────
  if (verified) return (
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

  // ── 로딩 (콜백 처리 중) ──────────────────────────────────
  if (loading && isSignInWithEmailLink(auth, window.location.href)) return (
    <div className={styles.page}>
      <div className={styles.card}>
        <TeampMark size={40} />
        <p className={styles.sub}>인증 처리 중...</p>
      </div>
    </div>
  )

  // ── 발송 완료 ─────────────────────────────────────────────
  if (sent) return (
    <div className={styles.page}>
      <div className={styles.card}>
        <TeampMark size={40} />
        <div className={styles.iconWrap} style={{ background: '#FEF9C3', color: '#CA8A04' }}>✉️</div>
        <h1 className={styles.title}>이메일을 확인해주세요</h1>
        <p className={styles.sub}><strong>{email}</strong>으로 인증 링크를 보냈어요.<br />링크를 클릭하면 자동으로 인증돼요.</p>
        <p className={styles.hint}>이메일이 안 보이면 스팸함을 확인해보세요.<br />링크는 1시간 후 만료돼요.</p>
        <button className={styles.btnSecondary} onClick={() => setSent(false)}>다른 이메일로 다시 시도</button>
      </div>
    </div>
  )

  // ── 입력 폼 ───────────────────────────────────────────────
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

        <form className={styles.form} onSubmit={handleSend}>
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
            {loading ? '발송 중...' : '인증 링크 받기'}
          </button>
        </form>

        <p className={styles.hint}>인증은 1년마다 갱신이 필요해요. 재학 중에만 유지돼요.</p>
      </div>
    </div>
  )
}
