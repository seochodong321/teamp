import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  { emoji: '😵', title: '흩어진 대화와 자료', desc: '카카오톡, 슬랙, 노션… 정보가 여기저기 흩어져 있어요.' },
  { emoji: '🧊', title: '기여가 기록되지 않아요', desc: '내가 뭘 했는지, 팀원이 뭘 했는지 나중에 아무도 몰라요.' },
  { emoji: '🕳️', title: '프로젝트가 끝나면 사라져요', desc: '협업의 경험이 이력으로 남지 않고 그냥 사라져버려요.' },
]

const FLOW_STEPS = [
  { num: '01', title: '프로젝트 개설', desc: '이름, 목적, 기간을 입력하면 채팅방과 도구들이 자동으로 준비돼요.' },
  { num: '02', title: '팀원 초대', desc: '링크 하나로 팀원들을 초대해요. 역할과 권한은 리더가 설정해요.' },
  { num: '03', title: '함께 협업', desc: '채팅, 할 일, 마일스톤, 캘린더로 프로젝트를 진행해요.' },
  { num: '04', title: '회고와 기록', desc: '마무리할 때 Wrap-up으로 팀의 여정을 기록으로 남겨요.' },
]

const MOCK_ACTIVITIES = [
  { avatar: '🐢', name: '이준혁', action: '마일스톤 완료', detail: 'MVP 로그인 완료', project: '팀플 앱', time: '방금' },
  { avatar: '🦊', name: '김서연', action: '할 일 완료', detail: 'API 연동 테스트', project: '쇼핑몰 리뉴얼', time: '1분 전' },
  { avatar: '🐬', name: '박민준', action: '게시글 작성', detail: '1차 디자인 시안 공유', project: '브랜딩 프로젝트', time: '3분 전' },
  { avatar: '🦁', name: '최지은', action: '채팅', detail: '오늘 회의 오후 3시에 해요!', project: '앱 개발팀', time: '5분 전' },
  { avatar: '🐧', name: '정다은', action: '마일스톤 추가', detail: '2차 스프린트 시작', project: '리서치 프로젝트', time: '8분 전' },
  { avatar: '🦄', name: '강민서', action: '팀원 합류', detail: '팀프 매치를 통해 참여', project: '게임 기획팀', time: '12분 전' },
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
  const [activityIdx, setActivityIdx] = useState(0)

  // 네비게이션 스크롤 감지
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // 라이브 활동 피드 자동 순환
  useEffect(() => {
    const id = setInterval(() => setActivityIdx((i) => (i + 1) % MOCK_ACTIVITIES.length), 2200)
    return () => clearInterval(id)
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
          <span className={styles.navLogo} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            팀프
          </span>
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
        <h1 className={styles.heroTitle}>
          기여와 관계의<br />
          <span className={styles.heroAccent}>기록</span>
        </h1>
        <p className={styles.heroSub}>
          팀프는 프로젝트가 끝난 뒤에도<br />
          여러분의 노력이 이력으로 남는 협업 공간이에요.
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
                <p className={styles.painDesc}>{p.desc}</p>
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
          <div className={styles.actFeed}>
            <div className={styles.actLiveTag}>● LIVE</div>
            <div className={styles.actList}>
              {MOCK_ACTIVITIES.map((act, i) => (
                <div
                  key={i}
                  className={`${styles.actItem} ${i === activityIdx ? styles.actItemActive : ''} ${i === (activityIdx - 1 + MOCK_ACTIVITIES.length) % MOCK_ACTIVITIES.length ? styles.actItemPrev : ''}`}
                >
                  <span className={styles.actAvatar}>{act.avatar}</span>
                  <div className={styles.actInfo}>
                    <span className={styles.actName}>{act.name}</span>
                    <span className={styles.actAction}>{act.action}</span>
                    <span className={styles.actDetail}>"{act.detail}"</span>
                  </div>
                  <div className={styles.actMeta}>
                    <span className={styles.actProject}>{act.project}</span>
                    <span className={styles.actTime}>{act.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.actDots}>
              {MOCK_ACTIVITIES.map((_, i) => (
                <span key={i} className={`${styles.actDot} ${i === activityIdx ? styles.actDotActive : ''}`} />
              ))}
            </div>
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
            여러분의 역할, 기여, 팀원들의 피드백이 이력으로 남아 있어요.
          </p>
          <div className={styles.capsuleCards}>
            {[
              { title: '앱 개발 프로젝트', period: '2024.09 — 2025.02', members: 5, role: '프론트엔드 개발', done: '완료됨' },
              { title: '브랜딩 리뉴얼', period: '2024.12 — 2025.03', members: 4, role: '디자인 리더', done: '완료됨' },
              { title: '마케팅 캠페인', period: '2025.01 — 2025.04', members: 6, role: '기획 & 운영', done: '완료됨' },
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
          <p className={styles.ctaDesc}>회원가입 없이 Google 계정으로 바로 시작해요.<br />무료로 사용할 수 있어요.</p>
          <button className={styles.ctaBtn} onClick={() => navigate('/login?mode=signup')}>
            무료로 시작하기 →
          </button>
          <p className={styles.ctaNote}>이미 계정이 있으신가요? <button className={styles.ctaNoteBtn} onClick={() => navigate('/login?mode=login')}>로그인</button></p>
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerLogo}>팀프</span>
          <p className={styles.footerTagline}>기여와 관계의 기록</p>
          <p className={styles.footerCopy}>© 2025 Teamp. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
