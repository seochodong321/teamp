import React, { useState, useEffect } from 'react'
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom'
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
  GoogleAuthProvider, signInWithPopup, onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import styles from './LoginPage.module.css'
import TeampMark from '../components/TeampMark.jsx'

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
  const [error, setError] = useState('')
  const [loading, setLoading]         = useState(false)
  const [rememberEmail, setRememberEmail] = useState(() => !!localStorage.getItem('teamp-saved-email'))
  const [autoLogin, setAutoLogin]         = useState(() => localStorage.getItem('teamp-auto-login') !== 'false')
  const [authReady, setAuthReady]         = useState(false)

  // Firebase Auth 초기화 대기 — 기존 세션 복원 전에 로그인 폼이 깜빡이는 현상 방지
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => { setAuthReady(true) })
    return () => unsub()
  }, [])

  // Firebase 초기화 전엔 스피너 — 기존 세션 자동 복원 대기
  if (!authReady) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #E8E6F8', borderTopColor: '#534AB7', animation: 'spin 0.75s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (isLoggedIn) return <Navigate to={redirectTo} replace />

  // ── 소셜 로그인 공통 핸들러 (Google / Apple / Kakao 등 재사용)
  const handleSocialLogin = async (provider) => {
    setLoading(true)
    setError('')

    // Firebase Auth 세션이 이미 있으면 팝업 없이 바로 처리 (멀티탭 케이스)
    const existingUser = auth.currentUser
    if (existingUser) {
      try {
        const snap = await getDoc(doc(db, 'users', existingUser.uid))
        if (snap.exists() && snap.data().username) {
          const d = snap.data()
          login(d.name, d.email || existingUser.email, existingUser.uid, d)
        } else {
          login(existingUser.displayName || '사용자', existingUser.email, existingUser.uid)
        }
        navigate(redirectTo, { replace: true })
      } catch {
        navigate(redirectTo, { replace: true })
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      const cred = await signInWithPopup(auth, provider)
      const user  = cred.user
      const snap  = await getDoc(doc(db, 'users', user.uid))
      if (snap.exists() && snap.data().username) {
        const d = snap.data()
        login(d.name, d.email || user.email, user.uid, d)
        navigate(redirectTo, { replace: true })
      } else {
        setNeedsUsernameSetup(true)
        navigate('/setup-username', { replace: true })
      }
    } catch (e) {
      if (e.code === 'auth/unauthorized-domain') {
        const host = window.location.hostname
        if (host !== 'teamp.vercel.app' && host !== 'localhost') {
          // preview URL → 안정 주소로 자동 이동
          window.location.replace('https://teamp.vercel.app' + window.location.pathname + window.location.search)
          return
        }
        setError(`이 주소(${host})는 Google 로그인이 허용되지 않아요. teamp.vercel.app 에서 시도해주세요.`)
      } else if (e.code !== 'auth/popup-closed-by-user') {
        setError(`소셜 로그인 실패: ${e.code || e.message}`)
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
    }
    setLoading(true)
    try {
      // 자동 로그인 여부에 따라 세션 지속성 설정
      await setPersistence(auth, autoLogin ? browserLocalPersistence : browserSessionPersistence)

      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
        await updateProfile(cred.user, { displayName: name.trim() })
        login(name.trim(), email.trim(), cred.user.uid)
        setNeedsUsernameSetup(true)
        if (rememberEmail) localStorage.setItem('teamp-saved-email', email.trim())
        else localStorage.removeItem('teamp-saved-email')
        if (!autoLogin) localStorage.setItem('teamp-auto-login', 'false')
        else localStorage.removeItem('teamp-auto-login')
        navigate('/setup-username', { replace: true })
        return
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
        // Firestore 프로필 로드 실패해도 로그인 자체는 성공 처리
        try {
          const snap = await getDoc(doc(db, 'users', cred.user.uid))
          if (snap.exists()) {
            const d = snap.data()
            login(d.name, d.email, cred.user.uid, { affiliation: d.affiliation || '', phone: d.phone || '' })
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
      } else {
        localStorage.removeItem('teamp-saved-email')
      }
      // 자동 로그인 설정 기억
      if (!autoLogin) {
        localStorage.setItem('teamp-auto-login', 'false')
      } else {
        localStorage.removeItem('teamp-auto-login')
      }

      navigate(redirectTo, { replace: true })
    } catch (err) {
      const map = {
        'auth/email-already-in-use':   '이미 사용 중인 이메일이에요.',
        'auth/invalid-email':          '이메일 형식이 올바르지 않아요.',
        'auth/weak-password':          '비밀번호는 8자 이상 입력해주세요.',
        'auth/user-not-found':         '등록되지 않은 이메일이에요.',
        'auth/wrong-password':         '비밀번호가 틀렸어요.',
        'auth/invalid-credential':     '이메일 또는 비밀번호가 올바르지 않아요.',
        'auth/too-many-requests':      '잠시 후 다시 시도해주세요.',
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

          <div className={styles.tabs}>
            <button className={`${styles.tab} ${mode === 'login'  ? styles.tabActive : ''}`}
              onClick={() => { setMode('login');  setError('') }}>로그인</button>
            <button className={`${styles.tab} ${mode === 'signup' ? styles.tabActive : ''}`}
              onClick={() => { setMode('signup'); setError('') }}>회원가입</button>
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
              <input className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com" autoComplete="email" disabled={loading} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>비밀번호 *</label>
              <input className={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="8자 이상" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} disabled={loading} />
            </div>

            {/* 로그인 옵션 (로그인 모드 전용) */}
            {mode === 'login' && (
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
              </div>
            )}

            {error && <p className={styles.error}>{error}</p>}

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
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>
              {mode === 'login' ? '회원가입' : '로그인'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
