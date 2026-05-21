import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { sendEmailVerification, signOut } from 'firebase/auth'
import { auth } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import styles from './VerifyEmailPage.module.css'
import TeampMark from '../components/TeampMark.jsx'

const MAIL_LINKS = {
  'gmail.com':    { label: 'Gmail 열기',         href: 'https://mail.google.com' },
  'naver.com':    { label: 'Naver 메일 열기',     href: 'https://mail.naver.com' },
  'daum.net':     { label: 'Daum 메일 열기',      href: 'https://mail.daum.net' },
  'kakao.com':    { label: 'Kakao 메일 열기',     href: 'https://mail.kakao.com' },
  'nate.com':     { label: 'Nate 메일 열기',      href: 'https://mail.nate.com' },
  'outlook.com':  { label: 'Outlook 열기',        href: 'https://outlook.live.com' },
  'hotmail.com':  { label: 'Outlook 열기',        href: 'https://outlook.live.com' },
  'live.com':     { label: 'Outlook 열기',        href: 'https://outlook.live.com' },
  'icloud.com':   { label: 'iCloud 메일 열기',    href: 'https://www.icloud.com/mail' },
}

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const { login, setNeedsUsernameSetup } = useStore()

  const [checking,       setChecking]      = useState(false)
  const [resendCooldown, setResendCooldown] = useState(60)
  const [message,        setMessage]       = useState('')
  const [messageType,    setMessageType]   = useState('info') // 'info' | 'error'

  const email    = auth.currentUser?.email || ''
  const domain   = email.split('@')[1]?.toLowerCase()
  const mailLink = MAIL_LINKS[domain] || null

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
      } catch {
        if (!auth.currentUser) { clearInterval(id); navigate('/login', { replace: true }) }
      }
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
        setMessageType('info')
        setMessage('아직 인증이 완료되지 않았어요. 이메일 링크를 클릭했는지 확인해주세요.')
      }
    } catch {
      setMessageType('error')
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
      setMessageType('info')
      setMessage('인증 메일을 다시 보냈어요. 받은 편지함을 확인해주세요.')
      setResendCooldown(60)
    } catch (e) {
      setMessageType('error')
      setMessage(e.code === 'auth/too-many-requests' ? '잠시 후 다시 시도해주세요.' : '재발송 중 오류가 발생했어요.')
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

      {/* ── 왼쪽: 브랜드 영역 ── */}
      <div className={styles.left}>
        <div className={styles.leftInner}>
          <div className={styles.brand}>
            <TeampMark size={40} />
            <div>
              <span className={styles.brandName}>Teamp</span>
              <span className={styles.brandTagline}>기여와 관계의 기록</span>
            </div>
          </div>

          <div className={styles.envelope}>
            <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden="true">
              <rect width="96" height="96" rx="28" fill="rgba(255,255,255,0.12)" />
              <rect x="16" y="28" width="64" height="44" rx="6" stroke="white" strokeWidth="2.5" fill="none" strokeOpacity="0.9"/>
              <path d="M16 34l32 20 32-20" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.9"/>
              <circle cx="72" cy="28" r="10" fill="#FF6B6B" />
              <path d="M68 28h8M72 24v8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>

          <div className={styles.copy}>
            <h2 className={styles.headline}>거의 다 왔어요!</h2>
            <p className={styles.subCopy}>
              {email ? (
                <><strong>{email}</strong>으로<br /></>
              ) : null}
              인증 메일을 보냈어요.<br />
              링크를 클릭하면<br />
              바로 팀프가 시작돼요.
            </p>
          </div>

          {/* 단계 표시 */}
          <div className={styles.steps}>
            <div className={`${styles.step} ${styles.stepDone}`}>
              <span className={styles.stepDot}>✓</span>
              <span>회원가입</span>
            </div>
            <div className={styles.stepLine} />
            <div className={`${styles.step} ${styles.stepActive}`}>
              <span className={styles.stepDot}>2</span>
              <span>이메일 인증</span>
            </div>
            <div className={styles.stepLine} />
            <div className={styles.step}>
              <span className={styles.stepDot}>3</span>
              <span>프로필 설정</span>
            </div>
          </div>
        </div>

        <div className={styles.decorCircle1} />
        <div className={styles.decorCircle2} />
      </div>

      {/* ── 오른쪽: 액션 카드 ── */}
      <div className={styles.right}>
        <div className={styles.card}>

          <div className={styles.cardHeader}>
            <div className={styles.mobileLogoRow}>
              <TeampMark size={32} />
              <span className={styles.mobileName}>Teamp</span>
            </div>
            <h1 className={styles.cardTitle}>이메일을 확인해주세요</h1>
            <p className={styles.cardDesc}>
              받은 편지함에서 팀프가 보낸 인증 링크를 클릭해주세요.<br />
              <span className={styles.spamHint}>메일이 안 보이면 스팸 폴더도 확인해보세요.</span>
            </p>
          </div>

          <div className={styles.emailBox}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className={styles.emailIcon}>
              <rect x="1" y="4" width="16" height="11" rx="2" stroke="var(--primary)" strokeWidth="1.6" fill="none"/>
              <path d="M1 6.5l8 5 8-5" stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            <span className={styles.emailAddr}>{email}</span>
          </div>

          {message && (
            <p className={`${styles.message} ${messageType === 'error' ? styles.messageError : ''}`}>
              {message}
            </p>
          )}

          {mailLink && (
            <a
              href={mailLink.href}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.mailBtn}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <path d="M1 5.5l7 4.5 7-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {mailLink.label}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className={styles.externalIcon}>
                <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7M7 1h4m0 0v4m0-4L5 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          )}

          <button className={styles.primaryBtn} onClick={handleCheckNow} disabled={checking}>
            {checking
              ? <><span className={styles.spinner} />확인 중...</>
              : '인증 완료했어요 →'}
          </button>

          <div className={styles.divider} />

          <button className={styles.resendBtn} onClick={handleResend} disabled={resendCooldown > 0}>
            {resendCooldown > 0
              ? `인증 메일 재발송 (${resendCooldown}초 후 가능)`
              : '인증 메일 다시 보내기'}
          </button>

          <button className={styles.cancelBtn} onClick={handleCancel}>
            취소하고 로그인 페이지로 돌아가기
          </button>
        </div>
      </div>
    </div>
  )
}
