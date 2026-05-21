import React from 'react'
import { useNavigate } from 'react-router-dom'
import TeampMark from '../components/TeampMark.jsx'
import styles from './NotFoundPage.module.css'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <div className={styles.inner}>

        {/* 브랜드 */}
        <div className={styles.brand}>
          <TeampMark size={28} />
          <span className={styles.brandName}>Teamp</span>
        </div>

        {/* 404 숫자 */}
        <div className={styles.numberWrap}>
          <span className={styles.four}>4</span>
          <div className={styles.zeroWrap}>
            <div className={styles.zero}>0</div>
            <div className={styles.zeroInner}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <rect x="4" y="10" width="24" height="16" rx="3" stroke="white" strokeWidth="2" strokeOpacity="0.8" fill="none"/>
                <path d="M4 14l12 8 12-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.8"/>
              </svg>
            </div>
          </div>
          <span className={styles.four}>4</span>
        </div>

        {/* 메시지 */}
        <h1 className={styles.title}>페이지를 찾을 수 없어요</h1>
        <p className={styles.desc}>
          주소가 잘못됐거나, 이미 삭제된 페이지예요.<br />
          팀프 홈으로 돌아가서 다시 시작해보세요.
        </p>

        {/* 버튼 */}
        <div className={styles.btns}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            ← 이전 페이지
          </button>
          <button className={styles.homeBtn} onClick={() => navigate('/', { replace: true })}>
            팀프 홈으로 →
          </button>
        </div>

      </div>

      {/* 배경 장식 */}
      <div className={styles.blob1} />
      <div className={styles.blob2} />
    </div>
  )
}
