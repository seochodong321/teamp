import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import styles from './JoinPage.module.css'

export default function JoinPage() {
  const { code } = useParams()
  const navigate  = useNavigate()
  const { isLoggedIn, getProjectByInviteCode, joinProjectByCode, currentUser } = useStore()

  const [project, setProject] = useState(null)
  const [status, setStatus]   = useState('idle')
  const [msg, setMsg]         = useState('')

  useEffect(() => {
    const run = async () => {
      const p = await getProjectByInviteCode(code)
      setProject(p)
    }
    run()
  }, [code, isLoggedIn])

  const handleJoin = async () => {
    setStatus('joining')
    try {
      const result = await joinProjectByCode(code)
      if (result.success) {
        setStatus('done')
        setMsg(result.message || '프로젝트에 참여했어요!')
        setTimeout(() => navigate(`/project/${result.projectId}`), 1500)
      } else {
        setStatus('error')
        setMsg(result.message || '참여에 실패했어요.')
      }
    } catch (e) {
      setStatus('error')
      setMsg('오류가 발생했어요. 다시 시도해주세요.')
    }
  }

  if (!isLoggedIn) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logo}>
            <div className={styles.logoMark}>T</div>
            <h1 className={styles.logoName}>Teamp</h1>
          </div>
          {project ? (
            <>
              <div className={styles.projectInfo}>
                <span className={styles.inviteLabel}>프로젝트 초대</span>
                <h2 className={styles.projectName}>{project.name}</h2>
                {project.purpose && <p className={styles.projectPurpose}>{project.purpose}</p>}
                <div className={styles.projectMeta}>
                  <span>📅 ~ {project.endDate}</span>
                  <span>👥 팀원 {project.members.length}명</span>
                </div>
              </div>
              <p className={styles.desc}>참여하려면 로그인이 필요해요</p>
            </>
          ) : (
            <p className={styles.desc}>초대 링크를 확인하는 중...</p>
          )}
          <div className={styles.btns}>
            <button className={styles.loginBtn} onClick={() => navigate(`/login?redirect=/join/${code}`)}>로그인하기</button>
            <button className={styles.signupBtn} onClick={() => navigate(`/login?redirect=/join/${code}&mode=signup`)}>회원가입 후 참여</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>T</div>
          <h1 className={styles.logoName}>Teamp</h1>
        </div>
        {!project ? (
          <div className={styles.errorWrap}>
            <p className={styles.errorIcon}>🔗</p>
            <p className={styles.errorTitle}>유효하지 않은 초대 링크예요</p>
            <p className={styles.errorDesc}>링크가 만료됐거나 잘못된 주소예요</p>
            <button className={styles.loginBtn} onClick={() => navigate('/home')}>홈으로</button>
          </div>
        ) : status === 'done' ? (
          <div className={styles.doneWrap}>
            <div className={styles.doneIcon}>✓</div>
            <p className={styles.doneTitle}>{msg}</p>
            <p className={styles.doneDesc}>프로젝트로 이동할게요...</p>
          </div>
        ) : status === 'error' ? (
          <div className={styles.errorWrap}>
            <p className={styles.errorTitle}>{msg}</p>
            <button className={styles.loginBtn} onClick={() => navigate('/home')}>홈으로</button>
          </div>
        ) : (
          <>
            <div className={styles.projectInfo}>
              <span className={styles.inviteLabel}>프로젝트 초대</span>
              <h2 className={styles.projectName}>{project.name}</h2>
              {project.purpose && <p className={styles.projectPurpose}>{project.purpose}</p>}
              <div className={styles.projectMeta}>
                <span>📅 ~ {project.endDate}</span>
                <span>👥 팀원 {project.members.length}명</span>
              </div>
            </div>
            {project.members.find((m) => m.id === currentUser?.id) ? (
              <div className={styles.alreadyWrap}>
                <p className={styles.alreadyText}>이미 참여 중인 프로젝트예요</p>
                <button className={styles.loginBtn} onClick={() => navigate(`/project/${project.id}`)}>프로젝트로 →</button>
              </div>
            ) : (
              <div className={styles.btns}>
                <button className={styles.loginBtn} onClick={handleJoin} disabled={status === 'joining'}>
                  {status === 'joining' ? '참여 중...' : '✅ 참여하기'}
                </button>
                <button className={styles.signupBtn} onClick={() => navigate('/home')}>나중에</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}