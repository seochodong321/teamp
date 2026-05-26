import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import styles from './PricingPage.module.css'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    badge: null,
    price: { monthly: 0, yearly: 0 },
    desc: '개인 프로젝트와 소규모 팀을 위한 시작 플랜',
    color: 'default',
    cta: '현재 플랜',
    ctaDisabled: true,
    features: [
      { label: '동시 활성 프로젝트', value: '3개' },
      { label: '프로젝트당 팀원', value: '최대 5명' },
      { label: '채팅 히스토리', value: '최근 100개' },
      { label: '파일 스토리지', value: '500MB' },
      { label: 'Wrap-up & 회고', value: '프로젝트당 1회' },
      { label: '팀프폴리오', value: '기본 공개' },
      { label: '매치 & 커넥트', value: '✓' },
      { label: 'AI 요약', value: '—', dim: true },
      { label: '전용 지원', value: '—', dim: true },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    badge: '가장 인기',
    price: { monthly: 5900, yearly: 4900 },
    desc: '활발하게 협업하는 팀을 위한 풀 기능 플랜',
    color: 'primary',
    cta: '업그레이드',
    ctaDisabled: false,
    features: [
      { label: '동시 활성 프로젝트', value: '10개' },
      { label: '프로젝트당 팀원', value: '최대 20명' },
      { label: '채팅 히스토리', value: '무제한' },
      { label: '파일 스토리지', value: '5GB' },
      { label: 'Wrap-up & 회고', value: '무제한' },
      { label: '팀프폴리오', value: '커스텀 링크' },
      { label: '매치 & 커넥트', value: '✓' },
      { label: 'AI 요약', value: '✓ (준비 중)' },
      { label: '우선 지원', value: '✓' },
    ],
  },
  {
    id: 'team',
    name: 'Team',
    badge: '기업 추천',
    price: { monthly: 19900, yearly: 16900 },
    desc: '스타트업·조직을 위한 팀 단위 무제한 플랜',
    color: 'teal',
    cta: '도입 문의',
    ctaDisabled: false,
    features: [
      { label: '동시 활성 프로젝트', value: '무제한' },
      { label: '프로젝트당 팀원', value: '무제한' },
      { label: '채팅 히스토리', value: '무제한' },
      { label: '파일 스토리지', value: '무제한' },
      { label: 'Wrap-up & 회고', value: '무제한' },
      { label: '팀프폴리오', value: '커스텀 링크' },
      { label: '매치 & 커넥트', value: '✓' },
      { label: 'AI 요약', value: '✓ (준비 중)' },
      { label: '전용 지원 & SLA', value: '✓' },
    ],
  },
]

function fmt(n) {
  return n === 0 ? '무료' : `₩${n.toLocaleString()}`
}

export default function PricingPage() {
  const navigate = useNavigate()
  const currentUser = useStore((s) => s.currentUser)
  const [yearly, setYearly] = useState(false)

  return (
    <div className={styles.page}>
      {/* 헤더 */}
      <div className={styles.hero}>
        <button className={styles.backBtn} onClick={() => navigate('/profile')}>← 돌아가기</button>
        <p className={styles.eyebrow}>요금제</p>
        <h1 className={styles.title}>팀의 성장에 맞는 플랜을 선택하세요</h1>
        <p className={styles.sub}>모든 플랜은 언제든지 변경할 수 있어요. 결제는 준비 중이에요.</p>

        {/* 월/연 토글 */}
        <div className={styles.toggle}>
          <button
            className={`${styles.toggleBtn} ${!yearly ? styles.toggleActive : ''}`}
            onClick={() => setYearly(false)}
          >월간</button>
          <button
            className={`${styles.toggleBtn} ${yearly ? styles.toggleActive : ''}`}
            onClick={() => setYearly(true)}
          >
            연간
            <span className={styles.toggleSave}>17% 절약</span>
          </button>
        </div>
      </div>

      {/* 플랜 카드 */}
      <div className={styles.cards}>
        {PLANS.map((plan) => (
          <div key={plan.id} className={`${styles.card} ${styles[`card_${plan.color}`]}`}>
            {plan.badge && <span className={styles.badge}>{plan.badge}</span>}
            <div className={styles.cardTop}>
              <h2 className={styles.planName}>{plan.name}</h2>
              <div className={styles.priceRow}>
                <span className={styles.price}>
                  {fmt(yearly ? plan.price.yearly : plan.price.monthly)}
                </span>
                {plan.price.monthly > 0 && (
                  <span className={styles.priceUnit}>/월</span>
                )}
              </div>
              {plan.price.monthly > 0 && yearly && (
                <p className={styles.yearlyNote}>연 {fmt((yearly ? plan.price.yearly : plan.price.monthly) * 12)} 청구</p>
              )}
              <p className={styles.planDesc}>{plan.desc}</p>
            </div>

            <button
              className={`${styles.cta} ${styles[`cta_${plan.color}`]}`}
              disabled={plan.ctaDisabled}
              onClick={() => {
                if (plan.id === 'team') {
                  window.open('mailto:byond1318@gmail.com?subject=Teamp Team 플랜 문의', '_blank')
                }
              }}
            >
              {plan.ctaDisabled ? plan.cta : plan.id === 'team' ? plan.cta : `${plan.cta} (준비 중)`}
            </button>

            <ul className={styles.featureList}>
              {plan.features.map((f) => (
                <li key={f.label} className={`${styles.featureItem} ${f.dim ? styles.featureDim : ''}`}>
                  <span className={styles.featureLabel}>{f.label}</span>
                  <span className={styles.featureValue}>{f.value}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* 학생 플랜 */}
      <div className={styles.studentBanner}>
        <div className={styles.studentLeft}>
          <span className={styles.studentIcon}>🎓</span>
          <div>
            <p className={styles.studentTitle}>재학생이라면 Pro를 무료로</p>
            <p className={styles.studentDesc}>.ac.kr · .edu 학교 이메일로 인증하면 Pro 플랜을 1년간 무료로 사용할 수 있어요. 팀 프로젝트, 졸업작품, 스터디에 딱 맞아요.</p>
          </div>
        </div>
        <button className={styles.studentBtn} onClick={() => navigate('/verify-student')}>
          학생 인증하기 →
        </button>
      </div>

      {/* FAQ */}
      <div className={styles.faq}>
        <h2 className={styles.faqTitle}>자주 묻는 질문</h2>
        <div className={styles.faqGrid}>
          {[
            { q: '무료 플랜은 언제까지 무료인가요?', a: '무료 플랜은 계속 무료예요. 팀이 커지거나 더 많은 기능이 필요할 때 업그레이드하면 돼요.' },
            { q: '팀원 수 제한은 어떻게 적용되나요?', a: '프로젝트 생성 시, 또는 팀원 초대 시 현재 플랜의 제한을 초과하면 업그레이드가 안내돼요.' },
            { q: '연간 결제는 언제 청구되나요?', a: '결제 시스템 연동 준비 중이에요. 곧 안내드릴게요.' },
            { q: 'Team 플랜은 팀 단위인가요, 인원 단위인가요?', a: 'Team 플랜은 월 고정 요금으로 팀 전체가 사용해요. 인원 추가 비용은 없어요.' },
          ].map((item) => (
            <div key={item.q} className={styles.faqItem}>
              <p className={styles.faqQ}>{item.q}</p>
              <p className={styles.faqA}>{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
