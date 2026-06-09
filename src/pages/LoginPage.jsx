import React, { useState, useEffect } from 'react'
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom'
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  sendEmailVerification, sendPasswordResetEmail,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import { BANNED_MESSAGE } from '../constants.js'
import styles from './LoginPage.module.css'
import TeampMark from '../components/TeampMark.jsx'
import Spinner from '../components/Spinner.jsx'

function getPasswordStrength(pw) {
  if (!pw) return null
  let score = 0
  if (pw.length >= 8)  score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[a-z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 2) return { level: 'weak',   label: '약함' }
  if (score <= 4) return { level: 'medium', label: '보통' }
  return              { level: 'strong',  label: '강함' }
}

const FEATURES = [
  { icon: '💬', text: '채팅 · 할 일 · 캘린더 · 게시판' },
  { icon: '🌸', text: '프로젝트가 끝나면 팀원 피드백이 남아요' },
  { icon: '🎓', text: '쌓인 기록이 나의 포트폴리오가 돼요' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo  = searchParams.get('redirect') || '/home'
  const defaultMode = searchParams.get('mode') || 'login'
  const { login, setNeedsUsernameSetup, isLoggedIn } = useStore()

  const [mode, setMode]               = useState(defaultMode)
  const [name, setName]   = useState('')
  const [email, setEmail] = useState(() => localStorage.getItem('teamp-saved-email') || '')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [errorField, setErrorField] = useState(null) // 'email' | 'password' | null
  const [loading, setLoading]         = useState(false)
  // 기본 ON — 명시적으로 끈 적 없으면 아이디 저장 (이전엔 저장된 이메일이 있어야만 켜져서 영영 안 켜지던 모순)
  const [rememberEmail, setRememberEmail] = useState(() => localStorage.getItem('teamp-remember-email') !== 'false')
  const [autoLogin, setAutoLogin]         = useState(() => localStorage.getItem('teamp-auto-login') !== 'false')
  const [authReady, setAuthReady]         = useState(false)

  // 미인증 계정 로그인 시 재발송 UI
  const [unverifiedEmail, setUnverifiedEmail] = useState('')
  const [resendCooldown,  setResendCooldown]  = useState(0)
  const [emailAlreadyInUse, setEmailAlreadyInUse] = useState(false)
  const resendTimerRef = React.useRef(null)

  // 비밀번호 재설정
  const [showForgot, setShowForgot]   = useState(false)
  const [forgotSent, setForgotSent]   = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  const startResendCooldown = () => {
    clearInterval(resendTimerRef.current)
    setResendCooldown(60)
    resendTimerRef.current = setInterval(() => {
      setResendCooldown((c) => { if (c <= 1) { clearInterval(resendTimerRef.current); return 0 } return c - 1 })
    }, 1000)
  }

  useEffect(() => () => clearInterval(resendTimerRef.current), [])

  const handleForgotPassword = async () => {
    if (!email.trim()) { setError('이메일을 입력해주세요.'); return }
    setForgotLoading(true)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setForgotSent(true)
      setError('')
    } catch (e) {
      setError(e.code === 'auth/user-not-found' ? '등록되지 않은 이메일이에요.' : '재설정 메일 발송 중 오류가 발생했어요.')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return
    setError('')
    try {
      await setPersistence(auth, browserSessionPersistence)
      const cred = await signInWithEmailAndPassword(auth, unverifiedEmail, password)
      await sendEmailVerification(cred.user)
      await signOut(auth)
      setError('인증 메일을 다시 보냈어요. 받은 편지함을 확인해주세요.')
      startResendCooldown()
    } catch {
      setError('재발송 중 오류가 발생했어요. 비밀번호를 확인해주세요.')
    }
  }

  // Firebase Auth 초기화 대기 — 기존 세션 복원 전에 로그인 폼이 깜빡이는 현상 방지
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => { setAuthReady(true) })
    return () => unsub()
  }, [])

  if (!authReady) return <Spinner />

  if (isLoggedIn) return <Navigate to={redirectTo} replace />

  // ── 소셜 로그인 공통 핸들러 (Google / Apple / Kakao 등 재사용)
  const handleSocialLogin = async (provider) => {
    setLoading(true)
    setError('')

    // 로그아웃 후 stale한 Firebase 세션이 남아있을 수 있으므로 강제 클리어
    if (auth.currentUser) {
      try { await signOut(auth) } catch { /* signOut 실패해도 팝업으로 진행 */ }
    }

    try {
      const cred = await signInWithPopup(auth, provider)
      const user  = cred.user
      const snap  = await getDoc(doc(db, 'users', user.uid))
      if (snap.exists()) {
        const d = snap.data()
        if (d.banned) {
          await signOut(auth)
          setError(BANNED_MESSAGE)
          setLoading(false)
          return
        }
        if (d.username) {
          login(d.name, d.email || user.email, user.uid, d)
          navigate(redirectTo, { replace: true })
          return
        }
      }
      // 초대 링크 등 redirect를 온보딩 너머까지 보존 (소셜 신규 가입도 이메일과 동일하게)
      if (redirectTo !== '/home') localStorage.setItem('teamp-post-auth-redirect', redirectTo)
      else localStorage.removeItem('teamp-post-auth-redirect')
      setNeedsUsernameSetup(true)
      navigate('/setup-username', { replace: true })
    } catch (e) {
      console.error('[소셜 로그인 오류]', e.code, e.message)
      if (e.code === 'auth/unauthorized-domain') {
        const host = window.location.hostname
        if (host !== 'teamp.vercel.app' && host !== 'localhost') {
          window.location.replace('https://teamp.vercel.app' + window.location.pathname + window.location.search)
          return
        }
        setError(`이 주소(${host})는 Google 로그인이 허용되지 않아요. teamp.vercel.app 에서 시도해주세요.`)
      } else if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        setError('팝업이 닫혔어요. 다시 시도하거나 팝업 차단을 해제해주세요.')
      } else if (e.code === 'auth/popup-blocked') {
        setError('브라우저가 팝업을 차단했어요. 주소창 오른쪽의 팝업 차단 아이콘을 클릭해 허용해주세요.')
      } else if (e.code === 'auth/too-many-requests') {
        setError('로그인 시도가 너무 많아 일시적으로 제한됐어요. 잠시 후 다시 시도해주세요.')
      } else {
        setError('Google 로그인에 실패했어요. 잠시 후 다시 시도해주세요.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim())       { setError('이메일을 입력해주세요.'); return }
    if (password.length < 8) { setError('비밀번호는 8자 이상이어야 해요.'); return }
    if (mode === 'signup') {
      if (!name.trim()) { setError('이름을 입력해주세요.'); return }
      if (password !== passwordConfirm) { setError('비밀번호가 일치하지 않아요.'); return }
    }
    setLoading(true)
    try {
      // 자동 로그인 여부에 따라 세션 지속성 설정
      await setPersistence(auth, autoLogin ? browserLocalPersistence : browserSessionPersistence)

      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
        await updateProfile(cred.user, { displayName: name.trim() })
        await sendEmailVerification(cred.user)
        if (rememberEmail) { localStorage.setItem('teamp-saved-email', email.trim()); localStorage.removeItem('teamp-remember-email') }
        else { localStorage.removeItem('teamp-saved-email'); localStorage.setItem('teamp-remember-email', 'false') }
        if (!autoLogin) localStorage.setItem('teamp-auto-login', 'false')
        else localStorage.removeItem('teamp-auto-login')
        // 초대 링크 등 redirect를 온보딩(이메일 인증·아이디 설정) 너머까지 보존
        if (redirectTo !== '/home') localStorage.setItem('teamp-post-auth-redirect', redirectTo)
        else localStorage.removeItem('teamp-post-auth-redirect')
        navigate('/verify-email', { replace: true })
        return
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
        if (!cred.user.emailVerified) {
          await signOut(auth)
          setUnverifiedEmail(email.trim())
          setError('이메일 인증이 완료되지 않았어요. 받은 편지함의 인증 메일을 확인해주세요.')
          setLoading(false)
          return
        }
        // Firestore 프로필 로드 실패해도 로그인 자체는 성공 처리
        try {
          const snap = await getDoc(doc(db, 'users', cred.user.uid))
          if (snap.exists()) {
            const d = snap.data()
            if (d.banned) {
              await signOut(auth)
              setError(BANNED_MESSAGE)
              setLoading(false)
              return
            }
            login(d.name, d.email, cred.user.uid, d) // 전체 프로필(oneliner·birthday·photoURL·plan 등) 반영
          } else {
            login(cred.user.displayName || '사용자', cred.user.email, cred.user.uid)
          }
        } catch {
          login(cred.user.displayName || '사용자', cred.user.email, cred.user.uid)
        }
      }

      // 아이디 저장 처리
      if (rememberEmail) {
        localStorage.setItem('teamp-saved-email', email.trim())
        localStorage.removeItem('teamp-remember-email')
      } else {
        localStorage.removeItem('teamp-saved-email')
        localStorage.setItem('teamp-remember-email', 'false')
      }
      // 자동 로그인 설정 기억
      if (!autoLogin) {
        localStorage.setItem('teamp-auto-login', 'false')
      } else {
        localStorage.removeItem('teamp-auto-login')
      }

      navigate(redirectTo, { replace: true })
    } catch (err) {
      console.error('[로그인 오류]', err.code, err.message)
      if (err.code === 'auth/email-already-in-use') {
        setEmailAlreadyInUse(true)
        setError('이미 가입된 이메일이에요. 로그인 탭에서 로그인해주세요.')
        setLoading(false)
        return
      }
      setEmailAlreadyInUse(false)
      if (err.code === 'auth/too-many-requests') { setShowForgot(true) }
      const emailErrors = new Set(['auth/invalid-email', 'auth/user-not-found', 'auth/email-already-in-use'])
      const passErrors  = new Set(['auth/wrong-password', 'auth/weak-password'])
      if (emailErrors.has(err.code))      setErrorField('email')
      else if (passErrors.has(err.code))  setErrorField('password')
      else                                setErrorField('both') // invalid-credential: 어느 쪽이 틀렸는지 불명확
      const map = {
        'auth/invalid-email':          '이메일 형식이 올바르지 않아요.',
        'auth/weak-password':          '비밀번호는 8자 이상 입력해주세요.',
        'auth/user-not-found':         '등록되지 않은 이메일이에요.',
        'auth/wrong-password':         '비밀번호가 맞지 않아요.',
        'auth/invalid-credential':     '이메일 또는 비밀번호가 올바르지 않아요.',
        'auth/too-many-requests':      '로그인 시도가 너무 많아 일시적으로 제한됐어요. 잠시 후 다시 시도하거나 아래에서 비밀번호를 재설정해주세요.',
        'auth/network-request-failed': '네트워크 연결을 확인해주세요.',
        'auth/unauthorized-domain':    '이 도메인은 Firebase에서 허용되지 않았어요. 관리자에게 문의하세요.',
        'auth/operation-not-allowed':  '이 로그인 방식이 비활성화되어 있어요. 관리자에게 문의하세요.',
      }
      setError(map[err.code] || `오류가 발생했어요. (${err.code})`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>

      {/* ── 왼쪽: 서비스 소개 ── */}
      <div className={styles.left}>
        <div className={styles.leftInner}>
          <div className={styles.brand}>
            <TeampMark size={44} />
            <div>
              <span className={styles.brandName}>Teamp</span>
              <span className={styles.brandTagline}>기여와 관계의 기록</span>
            </div>
          </div>

          <div className={styles.copy}>
            <h1 className={styles.headline}>
              기한이 있는<br />프로젝트라면,<br />
              <span className={styles.headlineAccent}>팀프에서 시작하세요.</span>
            </h1>
            <p className={styles.subCopy}>
              단톡방에 묻히는 파일,<br />
              흩어지는 할 일,<br />
              끝나고 사라지는 기억.<br />
              <br />
              <strong>기여와 관계의 기록이 남아요.</strong>
            </p>
          </div>

          <ul className={styles.features}>
            {FEATURES.map((f, i) => (
              <li key={i} className={styles.featureItem}>
                <span className={styles.featureIcon}>{f.icon}</span>
                <span className={styles.featureText}>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.decorCircle1} />
        <div className={styles.decorCircle2} />
      </div>

      {/* ── 오른쪽: 폼 ── */}
      <div className={styles.right}>
        <div className={styles.card}>
          {/* 모바일에서만 보이는 로고 */}
          <div className={styles.mobileLogoRow}>
            <TeampMark size={36} />
            <span className={styles.mobileName}>Teamp</span>
          </div>

          {error && (
            <div className={styles.errorBanner} role="alert">
              <span>⚠️</span> {error}
            </div>
          )}

          <div className={styles.tabs}>
            <button className={`${styles.tab} ${mode === 'login'  ? styles.tabActive : ''}`}
                onClick={() => { setMode('login');  setError(''); setPasswordConfirm(''); setEmailAlreadyInUse(false) }}>로그인</button>
            <button className={`${styles.tab} ${mode === 'signup' ? styles.tabActive : ''}`}
              onClick={() => { setMode('signup'); setError(''); setPasswordConfirm(''); setEmailAlreadyInUse(false) }}>회원가입</button>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div className={styles.field}>
                <label className={styles.label}>이름 *</label>
                <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="실명 또는 닉네임" autoFocus disabled={loading} />
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label}>이메일 *</label>
              <input
                className={`${styles.input} ${(errorField === 'email' || errorField === 'both') ? styles.inputError : ''}`}
                type="email" value={email}
                onChange={(e) => { setEmail(e.target.value); setErrorField(null); setError('') }}
                placeholder="example@email.com" autoComplete="email" disabled={loading} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>비밀번호 *</label>
              <input
                className={`${styles.input} ${(errorField === 'password' || errorField === 'both') ? styles.inputError : ''}`}
                type="password" value={password}
                onChange={(e) => { setPassword(e.target.value); setErrorField(null); setError('') }}
                placeholder="8자 이상" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} disabled={loading} />
              {mode === 'signup' && password.length > 0 && (() => {
                const s = getPasswordStrength(password)
                return (
                  <div className={styles.strengthRow}>
                    <div className={styles.strengthBar}>
                      <div className={`${styles.strengthSegment} ${s.level !== 'weak' ? styles.strengthFilled : ''}`} data-level={s.level} />
                      <div className={`${styles.strengthSegment} ${s.level === 'medium' || s.level === 'strong' ? styles.strengthFilled : ''}`} data-level={s.level} />
                      <div className={`${styles.strengthSegment} ${s.level === 'strong' ? styles.strengthFilled : ''}`} data-level={s.level} />
                    </div>
                    <span className={`${styles.strengthLabel} ${styles['strengthLabel_' + s.level]}`}>{s.label}</span>
                  </div>
                )
              })()}
            </div>
            {mode === 'signup' && (
              <div className={styles.field}>
                <label className={styles.label}>비밀번호 확인 *</label>
                <input className={`${styles.input} ${passwordConfirm && password !== passwordConfirm ? styles.inputError : ''}`}
                  type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="비밀번호를 한 번 더 입력해주세요" autoComplete="new-password" disabled={loading} />
                {passwordConfirm && password !== passwordConfirm && (
                  <span className={styles.fieldError}>비밀번호가 일치하지 않아요</span>
                )}
                {passwordConfirm && password === passwordConfirm && password.length >= 8 && (
                  <span className={styles.fieldOk}>비밀번호가 일치해요</span>
                )}
              </div>
            )}

            {/* 로그인 옵션 (로그인 모드 전용) */}
            {mode === 'login' && (
              <>
                <div className={styles.optRow}>
                  <label className={styles.optItem}>
                    <input type="checkbox" checked={rememberEmail}
                      onChange={(e) => setRememberEmail(e.target.checked)} />
                    <span>아이디 저장</span>
                  </label>
                  <label className={styles.optItem}>
                    <input type="checkbox" checked={autoLogin}
                      onChange={(e) => setAutoLogin(e.target.checked)} />
                    <span>자동 로그인</span>
                  </label>
                  <button type="button" className={styles.forgotLink}
                    onClick={() => { setShowForgot((v) => !v); setForgotSent(false); setError('') }}>
                    비밀번호 잊으셨나요?
                  </button>
                </div>
                {showForgot && (
                  <div className={styles.forgotBox}>
                    {forgotSent ? (
                      <p className={styles.forgotSuccess}>재설정 메일을 보냈어요! 받은 편지함을 확인해주세요.</p>
                    ) : (
                      <>
                        <p className={styles.forgotDesc}>가입한 이메일로 비밀번호 재설정 링크를 보내드려요.</p>
                        <button type="button" className={styles.forgotBtn}
                          onClick={handleForgotPassword} disabled={forgotLoading}>
                          {forgotLoading ? '발송 중...' : '재설정 메일 보내기'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* 에러는 카드 상단 errorBanner 한 곳에서만 표시 (중복 제거) */}
            {emailAlreadyInUse && mode === 'signup' && (
              <button type="button" className={styles.resendBtn}
                onClick={() => { setMode('login'); setError(''); setEmailAlreadyInUse(false); setPasswordConfirm('') }}>
                로그인 탭으로 이동하기
              </button>
            )}
            {unverifiedEmail && mode === 'login' && (
              <button type="button" className={styles.resendBtn}
                onClick={handleResendVerification} disabled={resendCooldown > 0}>
                {resendCooldown > 0 ? `재발송 대기 (${resendCooldown}s)` : '인증 메일 다시 보내기'}
              </button>
            )}

            <button type="submit" className={`${styles.submitBtn} ${loading ? styles.submitBtnLoading : ''}`} disabled={loading}>
              {loading ? (mode === 'login' ? '로그인 중...' : '가입 중...') : (mode === 'login' ? '로그인' : '가입하기')}
            </button>
          </form>

          {/* ── 소셜 로그인 ── */}
          <div className={styles.dividerOr}><span>또는</span></div>
          <button type="button" className={styles.socialBtn} onClick={() => handleSocialLogin(new GoogleAuthProvider())} disabled={loading}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 13.652 17.64 11.345 17.64 9.2z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
            </svg>
            Google로 계속하기
          </button>

          <p className={styles.switchText}>
            {mode === 'login' ? '아직 계정이 없으신가요? ' : '이미 계정이 있으신가요? '}
            <button className={styles.switchBtn} type="button"
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setPasswordConfirm(''); setEmailAlreadyInUse(false) }}>
              {mode === 'login' ? '회원가입' : '로그인'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
