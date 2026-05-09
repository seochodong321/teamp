import React, { useState } from 'react'
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom'
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import styles from './LoginPage.module.css'

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
  const { login, isLoggedIn } = useStore()

  const [mode, setMode]               = useState(defaultMode)
  const [name, setName]               = useState('')
  const [email, setEmail]             = useState(() => localStorage.getItem('teamp-saved-email') || '')
  const [password, setPassword]       = useState('')
  const [affiliation, setAffiliation] = useState('')
  const [phone, setPhone]             = useState('')
  const [birthMonth, setBirthMonth]   = useState('')
  const [birthDay, setBirthDay]       = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [rememberEmail, setRememberEmail] = useState(() => !!localStorage.getItem('teamp-saved-email'))
  const [autoLogin, setAutoLogin]         = useState(() => localStorage.getItem('teamp-auto-login') !== 'false')

  if (isLoggedIn) return <Navigate to={redirectTo} replace />

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
      // 자동 로그인 여부에 따라 세션 지속성 설정
      await setPersistence(auth, autoLogin ? browserLocalPersistence : browserSessionPersistence)

      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
        await updateProfile(cred.user, { displayName: name.trim() })
        const birthday = (birthMonth && birthDay)
          ? `${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`
          : ''
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid, name: name.trim(),
          username: `@${email.split('@')[0]}`, email: email.trim(),
          affiliation: affiliation.trim(), phone: phone.trim(), bio: '',
          birthday,
          createdAt: new Date().toISOString(),
        })
        login(name.trim(), email.trim(), cred.user.uid, { affiliation: affiliation.trim(), phone: phone.trim(), birthday })
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

      {/* ── 왼쪽: 서비스 소개 ── */}
      <div className={styles.left}>
        <div className={styles.leftInner}>
          <div className={styles.brand}>
            <div className={styles.brandMark}>T</div>
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
            <div className={styles.mobileMark}>T</div>
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
                <div className={styles.field}>
                  <label className={styles.label}>생일 <span className={styles.labelHint}>(선택 · 팀원에게 생일 알림이 가요 🎂)</span></label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select className={styles.input} style={{ flex: 1 }} value={birthMonth}
                      onChange={(e) => setBirthMonth(e.target.value)} disabled={loading}>
                      <option value="">월</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={String(m).padStart(2, '0')}>{m}월</option>
                      ))}
                    </select>
                    <select className={styles.input} style={{ flex: 1 }} value={birthDay}
                      onChange={(e) => setBirthDay(e.target.value)} disabled={loading || !birthMonth}>
                      <option value="">일</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={String(d).padStart(2, '0')}>{d}일</option>
                      ))}
                    </select>
                  </div>
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
