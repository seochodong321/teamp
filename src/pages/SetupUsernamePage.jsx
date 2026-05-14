import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { doc, setDoc, query, collection, where, getDocs } from 'firebase/firestore'
import { auth, db } from '../firebase.js'
import { useStore } from '../store/useStore.js'
import styles from './SetupUsernamePage.module.css'

export default function SetupUsernamePage() {
  const navigate = useNavigate()
  const { login, setNeedsUsernameSetup, isLoggedIn, needsUsernameSetup } = useStore()

  const [username, setUsername]           = useState('')
  const [usernameStatus, setUsernameStatus] = useState('idle') // idle | checking | ok | taken
  const [affiliation, setAffiliation]     = useState('')
  const [birthYear, setBirthYear]         = useState('')
  const [birthMonth, setBirthMonth]       = useState('')
  const [birthDay, setBirthDay]           = useState('')
  const [error, setError]                 = useState('')
  const [loading, setLoading]             = useState(false)

  // 로그인도 안 됐고 setup도 필요 없으면 → 로그인 페이지로
  if (!isLoggedIn && !auth.currentUser) return <Navigate to="/login" replace />
  // 이미 프로필 완성된 유저 → 홈으로
  if (isLoggedIn && !needsUsernameSetup) return <Navigate to="/home" replace />

  const checkUsername = async (raw) => {
    const val = raw.toLowerCase().replace(/^@/, '')
    if (!val || !/^[a-z0-9_]{3,20}$/.test(val)) { setUsernameStatus('idle'); return }
    setUsernameStatus('checking')
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('username', '==', `@${val}`)))
      setUsernameStatus(snap.empty ? 'ok' : 'taken')
    } catch { setUsernameStatus('idle') }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const uname = username.trim().toLowerCase().replace(/^@/, '')
    if (!uname || !/^[a-z0-9_]{3,20}$/.test(uname)) {
      setError('@아이디는 영문·숫자·_ 만 사용, 3~20자로 입력해주세요.')
      return
    }
    if (usernameStatus === 'taken')    { setError('이미 사용 중인 아이디예요.'); return }
    if (usernameStatus === 'checking') { setError('아이디 확인 중이에요. 잠시 후 다시 눌러주세요.'); return }
    if (usernameStatus === 'idle')     { setError('아이디 중복 확인을 해주세요.'); checkUsername(uname); return }
    if (!affiliation.trim())           { setError('소속을 입력해주세요.'); return }
    if (!birthYear || !birthMonth || !birthDay) { setError('생일을 선택해주세요.'); return }

    setLoading(true)
    try {
      const user     = auth.currentUser
      const uid      = user.uid
      const name     = user.displayName || '사용자'
      const email    = user.email || ''
      const finalUsername = `@${uname}`
      const birthday = `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`

      // 제출 직전 최종 중복 확인
      try {
        const check = await getDocs(query(collection(db, 'users'), where('username', '==', finalUsername)))
        if (!check.empty) {
          setUsernameStatus('taken')
          setError('이미 사용 중인 아이디예요. 다른 아이디를 입력해주세요.')
          setLoading(false)
          return
        }
      } catch {}

      await setDoc(doc(db, 'users', uid), {
        uid, name, email,
        username: finalUsername,
        affiliation: affiliation.trim(),
        phone: '', bio: '',
        birthday,
        photoURL: user.photoURL || null,
        createdAt: new Date().toISOString(),
      })

      login(name, email, uid, {
        username: finalUsername,
        affiliation: affiliation.trim(),
        birthday,
        photoURL: user.photoURL || null,
      })
      setNeedsUsernameSetup(false)
      navigate('/home', { replace: true })
    } catch (err) {
      setError('저장 중 오류가 발생했어요. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.mark}>T</div>
          <h1 className={styles.title}>프로필 설정</h1>
          <p className={styles.sub}>팀프에서 사용할 @아이디와 기본 정보를 설정해 주세요.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {/* @아이디 */}
          <div className={styles.field}>
            <label className={styles.label}>
              @아이디 * <span className={styles.hint}>(영문·숫자·_ , 3~20자, 나중에 변경 가능)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', fontWeight: 700, fontSize: 14 }}>@</span>
              <input
                className={styles.input}
                style={{ paddingLeft: 24 }}
                value={username}
                onChange={(e) => { setUsername(e.target.value); checkUsername(e.target.value) }}
                placeholder="예) teampuser123"
                disabled={loading}
                maxLength={20}
                autoFocus
              />
              {usernameStatus === 'ok' && (
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5L5.5 10L11 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 700 }}>사용 가능</span>
                </span>
              )}
              {usernameStatus === 'taken' && (
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--coral)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2L10 10M10 2L2 10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--coral)', fontWeight: 700 }}>이미 사용 중</span>
                </span>
              )}
              {usernameStatus === 'checking' && (
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'spin 0.7s linear infinite' }} />
              )}
            </div>
          </div>

          {/* 소속 */}
          <div className={styles.field}>
            <label className={styles.label}>소속 * <span className={styles.hint}>(학교, 회사, 단체 등)</span></label>
            <input
              className={styles.input}
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value)}
              placeholder="예) OO대학교 컴퓨터공학과, OO회사"
              disabled={loading}
            />
          </div>

          {/* 생일 */}
          <div className={styles.field}>
            <label className={styles.label}>생일 *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className={styles.input} style={{ flex: 1.2 }} value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)} disabled={loading}>
                <option value="">년도</option>
                {Array.from({ length: 36 }, (_, i) => 2010 - i).map((y) => (
                  <option key={y} value={String(y)}>{y}년</option>
                ))}
              </select>
              <select className={styles.input} style={{ flex: 1 }} value={birthMonth}
                onChange={(e) => { setBirthMonth(e.target.value); setBirthDay('') }} disabled={loading}>
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

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? '저장 중...' : '팀프 시작하기 →'}
          </button>
        </form>
      </div>
    </div>
  )
}
