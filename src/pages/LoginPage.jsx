import React, { useState } from 'react'
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import styles from './LoginPage.module.css'

// 데모 계정 — Firebase에 미리 만들어둔 계정
const DEMO_EMAIL = 'demo@teamp.app'
const DEMO_PW    = 'demo1234'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/home'
  const defaultMode = searchParams.get('mode') || 'login'

  const { login, isLoggedIn } = useStore()

  const [mode, setMode]               = useState(defaultMode)
  const [name, setName]               = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [affiliation, setAffiliation] = useState('')
  const [phone, setPhone]             = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)

  if (isLoggedIn) return <Navigate to={redirectTo} replace />

  const handleDemoLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PW)
      const snap = await getDoc(doc(db, 'users', cred.user.uid))
      if (snap.exists()) {
        const d = snap.data()
        login(d.name, d.email, cred.user.uid, { affiliation: d.affiliation || '', phone: d.phone || '' })
      } else {
        login(cred.user.displayName || '데모 사용자', cred.user.email, cred.user.uid)
      }
      navigate(redirectTo, { replace: true })
    } catch {
      setError('데모 계정 로그인에 실패했어요. Firebase에서 데모 계정을 먼저 만들어주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim())       { setError('이메일을 입력해주세요.'); return }
    if (password.length < 6) { setError('비밀번호는 6자리 이상이어야 해요.'); return }
    if (mode === 'signup') {
      if (!name.trim())        { setError('이름을 입력해주세요.'); return }
      if (!affiliation.trim()) { setError('소속을 입력해주세요.'); return }
    }

    setLoading(true)
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
        await updateProfile(cred.user, { displayName: name.trim() })
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid, name: name.trim(),
          username: `@${email.split('@')[0]}`, email: email.trim(),
          affiliation: affiliation.trim(), phone: phone.trim(), bio: '',
          createdAt: new Date().toISOString(),
        })
        login(name.trim(), email.trim(), cred.user.uid, { affiliation: affiliation.trim(), phone: phone.trim() })
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
        const snap = await getDoc(doc(db, 'users', cred.user.uid))
        if (snap.exists()) {
          const d = snap.data()
          login(d.name, d.email, cred.user.uid, { affiliation: d.affiliation || '', phone: d.phone || '' })
        } else {
          login(cred.user.displayName || '사용자', cred.user.email, cred.user.uid)
        }
      }
      navigate(redirectTo, { replace: true })
    } catch (err) {
      const map = {
        'auth/email-already-in-use':   '이미 사용 중인 이메일이에요.',
        'auth/invalid-email':          '이메일 형식이 올바르지 않아요.',
        'auth/weak-password':          '비밀번호는 6자리 이상 입력해주세요.',
        'auth/user-not-found':         '등록되지 않은 이메일이에요.',
        'auth/wrong-password':         '비밀번호가 틀렸어요.',
        'auth/invalid-credential':     '이메일 또는 비밀번호가 올바르지 않아요.',
        'auth/too-many-requests':      '잠시 후 다시 시도해주세요.',
        'auth/network-request-failed': '네트워크 연결을 확인해주세요.',
      }
      setError(map[err.code] || '오류가 발생했어요. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>T</div>
          <h1 className={styles.logoName}>Teamp</h1>
          <p className={styles.logoSub}>팀 프로젝트, 더 쉽게</p>
        </div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${mode === 'login'  ? styles.tabActive : ''}`}
            onClick={() => { setMode('login');  setError('') }}>로그인</button>
          <button className={`${styles.tab} ${mode === 'signup' ? styles.tabActive : ''}`}
            onClick={() => { setMode('signup'); setError('') }}>회원가입</button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>이름 *</label>
                <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="실명 또는 닉네임" autoFocus disabled={loading} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>소속 * <span className={styles.labelHint}>(학교, 회사, 단체 등)</span></label>
                <input className={styles.input} value={affiliation} onChange={(e) => setAffiliation(e.target.value)}
                  placeholder="예) OO대학교 컴퓨터공학과, OO회사" disabled={loading} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>핸드폰 번호 <span className={styles.labelHint}>(선택)</span></label>
                <input className={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-0000-0000" type="tel" disabled={loading} />
              </div>
              <div className={styles.divider}><span>계정 정보</span></div>
            </>
          )}

          <div className={styles.field}>
            <label className={styles.label}>이메일 *</label>
            <input className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com" autoComplete="email" disabled={loading} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>비밀번호 *</label>
            <input className={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="6자리 이상" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} disabled={loading} />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={`${styles.submitBtn} ${loading ? styles.submitBtnLoading : ''}`} disabled={loading}>
            {loading ? (mode === 'login' ? '로그인 중...' : '가입 중...') : (mode === 'login' ? '로그인' : '가입하기')}
          </button>
        </form>

        {mode === 'login' && (
          <>
            <div className={styles.divider}><span>또는</span></div>
            <button
              type="button"
              className={styles.demoBtn}
              onClick={handleDemoLogin}
              disabled={loading}
            >
              🎯 데모 계정으로 체험하기
            </button>
          </>
        )}

        <p className={styles.switchText}>
          {mode === 'login' ? '아직 계정이 없으신가요? ' : '이미 계정이 있으신가요? '}
          <button className={styles.switchBtn} type="button"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>
            {mode === 'login' ? '회원가입' : '로그인'}
          </button>
        </p>
      </div>
    </div>
  )
}