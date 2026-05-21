import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { sendEmailVerification, signOut } from 'firebase/auth'
import { auth } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import styles from './VerifyEmailPage.module.css'
import TeampMark from '../components/TeampMark.jsx'

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const { login, setNeedsUsernameSetup } = useStore()

  const [checking,      setChecking]      = useState(false)
  const [resendCooldown, setResendCooldown] = useState(60)
  const [message,       setMessage]       = useState('')

  const email = auth.currentUser?.email || ''

  // 인증 완료 자동 감지 폴링 (5초마다)
  useEffect(() => {
    if (!auth.currentUser) { navigate('/login', { replace: true }); return }

    const id = setInterval(async () => {
      try {
        await auth.currentUser.reload()
        if (auth.currentUser.emailVerified) {
          clearInterval(id)
          handleVerified()
        }
      } catch {}
    }, 5000)

    return () => clearInterval(id)
  }, [])

  // 재발송 쿨다운 타이머
  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setInterval(() => {
      setResendCooldown((c) => { if (c <= 1) { clearInterval(id); return 0 } return c - 1 })
    }, 1000)
    return () => clearInterval(id)
  }, [resendCooldown])

  const handleVerified = () => {
    const user = auth.currentUser
    if (!user) return
    login(user.displayName || '사용자', user.email, user.uid)
    setNeedsUsernameSetup(true)
    navigate('/setup-username', { replace: true })
  }

  const handleCheckNow = async () => {
    if (!auth.currentUser) { navigate('/login', { replace: true }); return }
    setChecking(true)
    setMessage('')
    try {
      await auth.currentUser.reload()
      if (auth.currentUser.emailVerified) {
        handleVerified()
      } else {
        setMessage('아직 인증이 완료되지 않았어요. 이메일을 확인해주세요.')
      }
    } catch {
      setMessage('확인 중 오류가 발생했어요. 다시 시도해주세요.')
    } finally {
      setChecking(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0 || !auth.currentUser) return
    setMessage('')
    try {
      await sendEmailVerification(auth.currentUser)
      setMessage('인증 메일을 다시 보냈어요. 받은 편지함을 확인해주세요.')
      setResendCooldown(60)
    } catch (e) {
      if (e.code === 'auth/too-many-requests') {
        setMessage('잠시 후 다시 시도해주세요.')
      } else {
        setMessage('재발송 중 오류가 발생했어요.')
      }
    }
  }

  const handleCancel = async () => {
    try {
      if (auth.currentUser) await auth.currentUser.delete()
    } catch {}
    await signOut(auth)
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <TeampMark size={40} />
        </div>

        <div className={styles.iconWrap}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect width="48" height="48" rx="24" fill="var(--primary-soft)" />
            <path d="M10 16a2 2 0 0 1 2-2h24a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V16z" stroke="var(--primary)" strokeWidth="1.8" fill="none"/>
            <path d="M10 17l14 9 14-9" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>

        <h1 className={styles.title}>이메일을 확인해주세요</h1>
        <p className={styles.desc}>
          <span className={styles.emailBadge}>{email}</span>
          {' '}으로 인증 메일을 보냈어요.<br />
          받은 편지함에서 링크를 클릭하면 인증이 완료돼요.
        </p>

        <p className={styles.hint}>스팸 폴더도 확인해보세요.</p>

        {message && <p className={styles.message}>{message}</p>}

        <button className={styles.primaryBtn} onClick={handleCheckNow} disabled={checking}>
          {checking ? '확인 중...' : '인증 완료했어요'}
        </button>

        <button
          className={styles.secondaryBtn}
          onClick={handleResend}
          disabled={resendCooldown > 0}
        >
          {resendCooldown > 0
            ? `재발송 대기 (${resendCooldown}s)`
            : '인증 메일 다시 보내기'}
        </button>

        <button className={styles.cancelBtn} onClick={handleCancel}>
          취소하고 돌아가기
        </button>
      </div>
    </div>
  )
}
