import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TeampMark from '../components/TeampMark.jsx'
import styles from './LandingPage.module.css'

// 스크롤 진입 감지 훅
function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, inView]
}

const PAIN_POINTS = [
  {
    emoji: '😵',
    title: '대화와 자료가 여기저기 흩어져요',
    line1: '카카오톡, 슬랙, 노션, 구글 드라이브…',
    line2: '정보가 분산되어 무엇이 최신인지, 어디서 찾아야 할지 모르는 상황이 반복돼요.',
  },
  {
    emoji: '🧊',
    title: '내 기여가 어디에도 남지 않아요',
    line1: '밤새워 작업하고, 일정을 맞추고, 팀에 헌신했는데—',
    line2: '프로젝트가 끝나면 "내가 뭘 했는지" 증명할 방법이 아무것도 없어요.',
  },
  {
    emoji: '🕳️',
    title: '끝나면 관계도, 경험도 사라져요',
    line1: '같이 고생한 팀원들과 연락이 끊기고, 쌓은 노하우도 흩어져요.',
    line2: '다음에 다시 만나도 어떻게 함께 일했는지 기억할 방법이 없어요.',
  },
]

const FLOW_STEPS = [
  { num: '01', title: '프로젝트 개설', desc: '이름, 목적, 기간을 입력하면 채팅방과 도구들이 자동으로 준비돼요.' },
  { num: '02', title: '팀원 초대', desc: '링크 하나로 팀원들을 초대해요. 역할과 권한은 리더가 설정해요.' },
  { num: '03', title: '함께 협업', desc: '채팅, 할 일, 마일스톤, 캘린더로 프로젝트를 진행해요.' },
  { num: '04', title: '회고와 기록', desc: '마무리할 때 Wrap-up으로 팀의 여정을 기록으로 남겨요.' },
]

const MOCK_LIVE_PROJECTS = [
  {
    emoji: '🚀', name: '팀플 앱 개발', category: '개발',
    period: '2026.01 — 2026.06',
    members: ['🐢', '🦊', '🐬', '🦁', '🐧'], memberCount: 5,
    activity: { avatar: '🐢', name: '이준혁', action: '마일스톤 완료', detail: 'MVP 로그인 구현 ✓', time: '방금' },
  },
  {
    emoji: '🎨', name: '브랜딩 리뉴얼', category: '디자인',
    period: '2025.12 — 2026.04',
    members: ['🦊', '🦄', '🦁', '🐧'], memberCount: 4,
    activity: { avatar: '🦊', name: '김서연', action: '할 일 완료', detail: '1차 디자인 시안 완료', time: '1분 전' },
  },
  {
    emoji: '📊', name: '마케팅 캠페인', category: '기획/마케팅',
    period: '2026.02 — 2026.07',
    members: ['🐬', '🦁', '🦄', '🐢', '🐧', '🦊'], memberCount: 6,
    activity: { avatar: '🐬', name: '박민준', action: '게시글 작성', detail: '2분기 전략 공유 완료', time: '3분 전' },
  },
]

const MILESTONES_MOCK = [
  { title: 'MVP 기획 완료', status: 'done', date: '3월 12일', side: 'left' },
  { title: 'UI 디자인 1차', status: 'done', date: '3월 28일', side: 'right' },
  { title: '백엔드 API 연동', status: 'done', date: '4월 15일', side: 'left' },
  { title: '베타 출시', status: 'current', date: '4월 30일', side: 'right' },
  { title: '정식 런칭', status: 'future', date: '5월 20일', side: 'left' },
]

const MATCH_TAGS = ['React', 'UI/UX', '기획', '백엔드', '마케팅', '디자인', 'Python', '데이터 분석']

export default function LandingPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  // 네비게이션 스크롤 감지
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])


  const [whyRef, whyInView] = useInView()
  const [flowRef, flowInView] = useInView()
  const [actRef, actInView] = useInView()
  const [msRef, msInView] = useInView()
  const [matchRef, matchInView] = useInView()
  const [capsuleRef, capsuleInView] = useInView()
  const [ctaRef, ctaInView] = useInView()

  return (
    <div className={styles.page}>
      {/* ── 고정 네비게이션 ── */}
      <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}>
        <div className={styles.navInner}>
          <div className={styles.navLogo} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <TeampMark size={28}/>
            <span className={styles.navLogoText}>Teamp</span>
          </div>
          <div className={styles.navActions}>
            <button className={styles.navLogin} onClick={() => navigate('/login?mode=login')}>로그인</button>
            <button className={styles.navCta} onClick={() => navigate('/login?mode=signup')}>무료로 시작</button>
          </div>
        </div>
      </nav>

      {/* ── 1. Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroParticles} aria-hidden="true">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className={styles.particle} style={{
              '--delay': `${(i * 0.37) % 3}s`,
              '--x': `${(i * 17 + 5) % 90}%`,
              '--size': `${6 + (i % 4) * 4}px`,
              '--dur': `${4 + (i % 3) * 1.5}s`,
            }} />
          ))}
        </div>
        <div className={styles.heroBadge}>기한이 있는 프로젝트를 위한 협업 플랫폼</div>
        <h1 className={styles.heroTitle}>TEAMP</h1>
        <p className={styles.heroTagline}>기여와 관계의 기록</p>
        <p className={styles.heroSub}>
          프로젝트가 끝난 뒤에도 여러분의 노력이<br />
          이력으로 남는 팀 협업 플랫폼이에요.
        </p>
        <div className={styles.heroActions}>
          <button className={styles.heroBtn} onClick={() => navigate('/login?mode=signup')}>
            무료로 시작하기
          </button>
          <button className={styles.heroBtnSecondary} onClick={() => navigate('/login?mode=login')}>
            로그인
          </button>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.heroStat}><strong>실시간</strong><span>채팅·협업</span></div>
          <div className={styles.heroStatDivider} />
          <div className={styles.heroStat}><strong>마일스톤</strong><span>성장 타임라인</span></div>
          <div className={styles.heroStatDivider} />
          <div className={styles.heroStat}><strong>Wrap-up</strong><span>프로젝트 회고</span></div>
        </div>
        <div className={styles.heroScroll} aria-hidden="true">
          <span />
        </div>
      </section>

      {/* ── 2. Why Teamp (Pain Points) ── */}
      <section ref={whyRef} className={`${styles.section} ${styles.whySection} ${whyInView ? styles.visible : ''}`}>
        <div className={styles.sectionInner}>
          <p className={styles.sectionEyebrow}>왜 팀프인가요?</p>
          <h2 className={styles.sectionTitle}>기존 협업 툴의 문제</h2>
          <p className={styles.sectionDesc}>많은 팀들이 비슷한 불편을 겪고 있어요</p>
          <div className={styles.painGrid}>
            {PAIN_POINTS.map((p, i) => (
              <div key={i} className={styles.painCard} style={{ '--i': i }}>
                <span className={styles.painEmoji}>{p.emoji}</span>
                <h3 className={styles.painTitle}>{p.title}</h3>
                <p className={styles.painLine1}>{p.line1}</p>
                <p className={styles.painLine2}>{p.line2}</p>
              </div>
            ))}
          </div>
          <div className={styles.painAnswer}>
            <span className={styles.painAnswerBadge}>팀프의 답</span>
            <p>프로젝트 단위로 모든 협업을 묶고, 완료된 뒤에도 기여를 기록으로 남겨요.</p>
          </div>
        </div>
      </section>

      {/* ── 3. Flow (사용 흐름) ── */}
      <section ref={flowRef} className={`${styles.section} ${styles.flowSection} ${flowInView ? styles.visible : ''}`}>
        <div className={styles.sectionInner}>
          <p className={styles.sectionEyebrow}>사용 흐름</p>
          <h2 className={styles.sectionTitle}>프로젝트 시작부터 마무리까지</h2>
          <div className={styles.flowSteps}>
            {FLOW_STEPS.map((step, i) => (
              <div key={i} className={styles.flowStep} style={{ '--i': i }}>
                <div className={styles.flowNum}>{step.num}</div>
                <div className={styles.flowContent}>
                  <h3 className={styles.flowTitle}>{step.title}</h3>
                  <p className={styles.flowDesc}>{step.desc}</p>
                </div>
                {i < FLOW_STEPS.length - 1 && <div className={styles.flowArrow}>→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. Live Activity (실시간 활동) ── */}
      <section ref={actRef} className={`${styles.section} ${styles.actSection} ${actInView ? styles.visible : ''}`}>
        <div className={styles.sectionInner}>
          <p className={styles.sectionEyebrow}>지금 이 순간</p>
          <h2 className={styles.sectionTitle}>팀들이 협업하고 있어요</h2>
          <div className={styles.actCards}>
            {MOCK_LIVE_PROJECTS.map((proj, i) => (
              <div key={i} className={styles.actCard} style={{ '--i': i }}>
                <div className={styles.actCardHeader}>
                  <span className={styles.actCardEmoji}>{proj.emoji}</span>
                  <div className={styles.actCardInfo}>
                    <h3 className={styles.actCardName}>{proj.name}</h3>
                    <span className={styles.actCardCategory}>{proj.category}</span>
                  </div>
                  <span className={styles.actCardLive}>● LIVE</span>
                </div>
                <p className={styles.actCardPeriod}>{proj.period}</p>
                <div className={styles.actCardMembers}>
                  {proj.members.map((em, j) => (
                    <span key={j} className={styles.actCardMemberAvatar}>{em}</span>
                  ))}
                  <span className={styles.actCardMemberCount}>{proj.memberCount}명</span>
                </div>
                <div className={styles.actCardActivity}>
                  <span className={styles.actCardActAvatar}>{proj.activity.avatar}</span>
                  <div className={styles.actCardActBody}>
                    <p className={styles.actCardActText}>
                      <strong>{proj.activity.name}</strong> · {proj.activity.action}
                    </p>
                    <p className={styles.actCardActDetail}>{proj.activity.detail}</p>
                  </div>
                  <span className={styles.actCardActTime}>{proj.activity.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Milestone & Wrapup ── */}
      <section ref={msRef} className={`${styles.section} ${styles.msSection} ${msInView ? styles.visible : ''}`}>
        <div className={styles.sectionInner}>
          <p className={styles.sectionEyebrow}>마일스톤 & Wrap-up</p>
          <h2 className={styles.sectionTitle}>성장의 순간을 타임라인으로</h2>
          <p className={styles.sectionDesc}>핵심 목표를 마일스톤으로 기록하고,<br />프로젝트 완료 후 팀의 여정을 회고로 남겨요.</p>
          <div className={styles.msDemo}>
            <div className={styles.msTimeline}>
              <div className={styles.msLine} />
              {MILESTONES_MOCK.map((ms, i) => (
                <div key={i} className={`${styles.msItem} ${ms.side === 'right' ? styles.msItemRight : styles.msItemLeft}`} style={{ '--i': i }}>
                  <div className={`${styles.msCard} ${styles[`ms_${ms.status}`]}`}>
                    <span className={styles.msCardStatus}>
                      {ms.status === 'done' ? '✓ 완료' : ms.status === 'current' ? '● 진행 중' : '○ 예정'}
                    </span>
                    <p className={styles.msCardTitle}>{ms.title}</p>
                    <span className={styles.msCardDate}>{ms.date}</span>
                  </div>
                  <div className={styles.msDot} />
                </div>
              ))}
            </div>
            <div className={styles.msWrapupHint}>
              <span className={styles.msWrapupIcon}>🏁</span>
              <p>마무리 시점에 Wrap-up으로 팀의 이야기를 기록해요</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Match & Connect ── */}
      <section ref={matchRef} className={`${styles.section} ${styles.matchSection} ${matchInView ? styles.visible : ''}`}>
        <div className={styles.sectionInner}>
          <div className={styles.matchCols}>
            <div className={styles.matchCol}>
              <p className={styles.sectionEyebrow}>팀프 매치</p>
              <h2 className={styles.sectionTitle}>필요한 팀원을<br />쉽게 찾아요</h2>
              <p className={styles.matchDesc}>
                프로젝트 리더라면 팀프 매치에 모집글을 올려보세요.<br />
                지원자를 확인하고 바로 프로젝트에 합류시킬 수 있어요.
              </p>
              <div className={styles.matchTags}>
                {MATCH_TAGS.map((tag, i) => (
                  <span key={i} className={styles.matchTag} style={{ '--i': i }}>{tag}</span>
                ))}
              </div>
            </div>
            <div className={styles.matchCol}>
              <p className={styles.sectionEyebrow}>팀프 커넥트</p>
              <h2 className={styles.sectionTitle}>함께했던 팀원과<br />계속 연결돼요</h2>
              <p className={styles.matchDesc}>
                같은 프로젝트에 속했던 사람들이 자동으로 커넥트에 추가돼요.<br />
                언제든 프로필을 확인하고 1:1 대화를 시작할 수 있어요.
              </p>
              <div className={styles.connectAvatars}>
                {['🐢', '🦊', '🐬', '🦁', '🐧', '🦄'].map((em, i) => (
                  <span key={i} className={styles.connectAvatar} style={{ '--i': i }}>{em}</span>
                ))}
                <span className={styles.connectMore}>+더보기</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. Time Capsule ── */}
      <section ref={capsuleRef} className={`${styles.section} ${styles.capsuleSection} ${capsuleInView ? styles.visible : ''}`}>
        <div className={styles.sectionInner}>
          <p className={styles.sectionEyebrow}>타임 캡슐</p>
          <h2 className={styles.sectionTitle}>프로젝트가 끝나도<br />기여는 남아요</h2>
          <p className={styles.sectionDesc}>
            완료된 프로젝트는 사라지지 않아요.<br />
            여러분의 역할, 기여, 팀원들의 피드백이 이력으로 남아 있어요.<br />
            <span className={styles.sectionDescAccent}>팀프폴리오 공개 링크로 외부에도 자유롭게 공유할 수 있어요.</span>
          </p>
          <div className={styles.capsuleCards}>
            {[
              { title: '앱 개발 프로젝트', period: '2025.03 — 2025.11', members: 5, role: '프론트엔드 개발', done: '완료됨' },
              { title: '브랜딩 리뉴얼', period: '2025.06 — 2025.12', members: 4, role: '디자인 리더', done: '완료됨' },
              { title: '마케팅 캠페인', period: '2025.09 — 2026.02', members: 6, role: '기획 & 운영', done: '완료됨' },
            ].map((card, i) => (
              <div key={i} className={styles.capsuleCard} style={{ '--i': i }}>
                <div className={styles.capsuleBadge}>{card.done}</div>
                <h3 className={styles.capsuleTitle}>{card.title}</h3>
                <p className={styles.capsulePeriod}>{card.period}</p>
                <div className={styles.capsuleMeta}>
                  <span>👥 {card.members}명</span>
                  <span>🏷️ {card.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. CTA ── */}
      <section ref={ctaRef} className={`${styles.section} ${styles.ctaSection} ${ctaInView ? styles.visible : ''}`}>
        <div className={styles.ctaInner}>
          <p className={styles.ctaEyebrow}>지금 시작하세요</p>
          <h2 className={styles.ctaTitle}>기여와 관계의 기록,<br />팀프와 함께</h2>
          <p className={styles.ctaDesc}>Google 또는 이메일로 바로 시작해요.<br />무료로 사용할 수 있어요.</p>
          <button className={styles.ctaBtn} onClick={() => navigate('/login?mode=signup')}>
            무료로 시작하기 →
          </button>
          <p className={styles.ctaNote}>이미 계정이 있으신가요? <button className={styles.ctaNoteBtn} onClick={() => navigate('/login?mode=login')}>로그인</button></p>
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLogo}>
            <TeampMark size={26}/>
            <span className={styles.footerLogoText}>Teamp</span>
          </div>
          <p className={styles.footerTagline}>기여와 관계의 기록</p>
          <p className={styles.footerCopy}>© 2026 Teamp. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
