import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './HelpPage.module.css'

const sections = [
  {
    id: 'start',
    icon: '🚀',
    title: '시작하기 — 프로젝트 만드는 법',
    steps: [
      { label: '새 프로젝트 만들기', desc: '홈 화면 오른쪽 위 [+ 새 프로젝트] 버튼을 누르거나 사이드바에서 [+ 새 프로젝트]를 클릭하세요.' },
      { label: '기본 정보 입력', desc: '이모지, 이름, 목적, 카테고리, 시작일·종료일을 입력해요. 종료일은 선택 사항이에요.' },
      { label: '기본 채팅방 구성', desc: '프로젝트 생성 시 나와의 채팅·전체 채팅방이 자동으로 만들어져요. 필요하면 채팅방을 추가로 만들 수 있어요.' },
      { label: '초대 링크 공유', desc: '프로젝트 생성 후 초대 링크가 만들어져요. 링크를 복사해 팀원들에게 공유하면 돼요.' },
    ],
  },
  {
    id: 'phases',
    icon: '🗓️',
    title: '3단계 프로젝트 흐름 — 프리 · 진행 · 포스트',
    steps: [
      { label: '프리 단계', desc: '시작일 이전의 준비 기간이에요. 팀원을 초대하고 채팅방·마일스톤·할 일을 미리 세팅할 수 있어요. 홈 카드에 "시작 D-N"이 표시돼요.' },
      { label: '프로젝트 단계', desc: '시작일부터 종료일까지 본격 협업하는 기간이에요. "진행 중 · D-N" 형태로 마감까지 남은 날을 확인할 수 있어요. D-7 이내면 주황, D-3 이내면 빨간 경고 색으로 강조돼요.' },
      { label: '포스트 단계', desc: '종료일 이후 약 2주간의 정리·기록 기간이에요. Wrap-up 작성과 팀 피드백(꽃다발) 수집을 이 기간에 진행해요. "포스트 · 마친 지 N일"로 표시돼요.' },
      { label: '홈 카드 상태바', desc: '카드 하단 상태바가 3가지 색으로 단계 비율을 보여줘요. 회색(프리) → 보라(진행) → 초록(포스트) 순이며, 흰 점이 오늘의 위치를 표시해요.' },
    ],
  },
  {
    id: 'use',
    icon: '📋',
    title: '프로젝트 안에서 기능 활용하기',
    steps: [
      { label: '채팅방', desc: '팀원과 실시간으로 대화하세요. 파일·이미지 전송, 투표 만들기도 가능해요. 채팅방은 언제든 추가할 수 있어요.' },
      { label: '게시판', desc: '중요한 공지나 자료를 게시판에 올려두세요. 전체 공지는 모든 채팅방에 알림이 가요.' },
      { label: '캘린더', desc: '팀 일정을 등록하세요. 개인 일정은 나만 볼 수 있고, 공유 일정은 채팅방에 알림이 가요.' },
      { label: '할 일', desc: '할 일을 만들고 드래그로 진행 상태를 바꿀 수 있어요. 담당자는 여러 명 선택 가능하고, 리더는 이번 주 팀 목표도 설정할 수 있어요.' },
      { label: '마일스톤', desc: '핵심 목표를 타임라인으로 기록해요. 리더·부리더만 추가·수정할 수 있어요.' },
      { label: '멤버 관리', desc: '멤버 탭에서 팀원을 클릭해 프로필을 확인하거나 쪽지를 보낼 수 있어요. 리더는 역할·권한을 조정하고 팀원을 내보내기할 수 있어요.' },
    ],
  },
  {
    id: 'wrapup',
    icon: '📝',
    title: '마무리와 기록 — 마일스톤 · 회고 · 랩업',
    steps: [
      { label: '마일스톤으로 여정 남기기', desc: '"MVP 로그인 완료", "디자인 1차 완료"처럼 핵심 목표를 마일스톤으로 기록해요. 완료·연기·재개할 때마다 누가 언제 변경했는지 이력이 자동으로 쌓여요.' },
      { label: '랩업 시작하기', desc: '프로젝트 헤더의 [마무리하기] 버튼을 누르면 랩업 페이지로 이동해요. 피드백 수집 여부와 기간을 설정하면 팀원들이 서로 꽃다발 피드백을 남길 수 있어요.' },
      { label: '개인 회고 작성', desc: '랩업 페이지에서 이번 프로젝트 회고를 작성하고, 메시지 수·할 일 완료율 같은 프로젝트 통계도 확인해요.' },
      { label: '꽃다발 피드백', desc: '피드백 기간 동안 팀원들이 서로에게 꽃다발 태그를 남겨요. 받은 꽃다발은 팀프폴리오에 기여 방식으로 기록되어 오래 남아요.' },
      { label: '완료 처리', desc: '피드백 마감일이 지나면 프로젝트가 자동으로 "완료됨"으로 이동해요. 홈에서 언제든 다시 확인할 수 있어요.' },
    ],
  },
  {
    id: 'profile',
    icon: '👤',
    title: '프로필 설정',
    steps: [
      { label: '기본 정보', desc: '사이드바 [프로필] 메뉴에서 원라이너(한 줄 소개), 소속, 이메일을 등록하세요. 저장하면 함께한 모든 프로젝트에 자동 반영돼요.' },
      { label: '프로젝트 공개 설정', desc: '프로젝트 › 멤버 탭에서 해당 프로젝트를 공개로 설정해야 팀프폴리오 외부 링크에 이력이 표시돼요.' },
      { label: '팀프폴리오 시작', desc: '프로필 페이지 하단 [팀프폴리오 관리]에서 생성하고 공개 여부·섹션 구성을 설정할 수 있어요. 자세한 내용은 아래 "팀프폴리오" 섹션을 확인하세요.' },
    ],
  },
  {
    id: 'share',
    icon: '🌿',
    title: '팀프폴리오 — 기여와 관계의 기록',
    steps: [
      { label: '팀프폴리오란?', desc: '함께한 프로젝트 이력, 받은 꽃다발, 팀 통계를 외부에 공개할 수 있는 나만의 포트폴리오 페이지예요. teamp.kr/u/아이디 형태의 링크로 누구에게나 공유할 수 있어요.' },
      { label: '생성 & 커스텀', desc: '프로필 페이지 하단 [팀프폴리오 관리]에서 [생성하기]를 눌러 시작해요. 꽃다발·프로젝트 이력·통계 섹션을 켜고 끄면서 보여줄 내용을 직접 고를 수 있어요.' },
      { label: '반영하기', desc: '편집이 끝나면 반드시 [반영하기]를 눌러야 외부 링크에 적용돼요. 반영 전까지는 공개 페이지에 변경 사항이 나타나지 않아요.' },
      { label: '꽃다발이 핵심이에요', desc: '받은 꽃다발 태그는 랩업 피드백에서 팀원들이 남겨준 기억이에요. 숫자가 아니라 "어떤 방식으로 기여했는지"를 보여주는 게 팀프폴리오만의 특징이에요.' },
      { label: '링크 활용', desc: '채용 담당자나 새로운 협업 파트너에게 팀프폴리오 링크를 공유해 나의 팀 경험과 기여 방식을 직접 보여주세요.' },
    ],
  },
  {
    id: 'connect',
    icon: '🔗',
    title: '팀프 커넥트',
    steps: [
      { label: '팀프 커넥트란?', desc: '함께한 프로젝트가 끝나도 관계는 계속돼요. 같은 프로젝트에 속했던 팀원들이 자동으로 커넥트에 추가되고, 어떤 프로젝트에서 함께했는지 제목과 기간으로 확인할 수 있어요.' },
      { label: '프로필 & 팀프폴리오 보기', desc: '커넥트 목록에서 이름을 클릭하면 그 사람의 프로필과 함께한 프로젝트 이력을 볼 수 있어요. 팀프폴리오 링크로 포트폴리오도 확인할 수 있어요.' },
      { label: '쪽지 보내기', desc: '프로필 모달에서 [쪽지 보내기]를 누르면 쪽지함으로 이동해 연락할 수 있어요. 프로젝트가 끝난 후에도 자유롭게 소통할 수 있어요.' },
      { label: '새 프로젝트로 초대하기', desc: '내가 리더로 있는 활성 프로젝트가 있다면 [+ 내 프로젝트로 초대하기] 버튼이 나타나요. 프로젝트를 선택하면 해당 페이지로 이동해 멤버를 추가할 수 있어요.' },
    ],
  },
  {
    id: 'messages',
    icon: '✉️',
    title: '쪽지함',
    steps: [
      { label: '쪽지란?', desc: '채팅과 달리 한 장의 메모처럼 상대에게 전달하는 짧은 메시지예요. 실시간 대화가 부담스러울 때 쪽지로 조용히 연락해보세요.' },
      { label: '쪽지 보내기', desc: '쪽지함 오른쪽 위 [✏️ 쪽지 쓰기]를 누르고 @아이디로 받는 사람을 검색해 작성하면 돼요. 팀프 매치에서 [문의하기]를 누르면 자동으로 쪽지함이 열려요.' },
      { label: '받은 쪽지 읽기', desc: '왼쪽 목록에서 쪽지를 선택하면 보낸 이·받는 이·날짜·내용을 편지처럼 확인할 수 있어요.' },
      { label: '답장하기', desc: '쪽지를 읽은 후 [↩ 답장하기] 버튼을 누르면 같은 쪽지에 답장 흐름이 이어져요.' },
    ],
  },
  {
    id: 'calendar',
    icon: '📅',
    title: '통합 캘린더',
    steps: [
      { label: '통합 캘린더란?', desc: '진행 중인 모든 프로젝트의 할 일 마감일·이벤트·마일스톤을 한눈에 볼 수 있는 월별 달력이에요.' },
      { label: '일정 보기', desc: '날짜 셀의 색상 pill을 클릭하면 해당 날짜의 일정 목록이 오른쪽 패널에 나타나요. 항목을 클릭하면 해당 프로젝트로 이동해요.' },
      { label: '내 할 일만 표시', desc: '할 일은 내가 담당자로 배정된 항목만 표시돼요. 이벤트와 마일스톤은 프로젝트 전체가 표시돼요.' },
      { label: '다가오는 일정', desc: '오른쪽 패널에 오늘 이후 일정이 최대 20개까지 날짜순으로 표시돼요. 클릭하면 해당 날짜로 달력이 이동해요.' },
    ],
  },
]

export default function HelpPage() {
  const navigate = useNavigate()
  const [openSection, setOpenSection] = useState('start')

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>도움말 💡</h1>
          <p className={styles.subtitle}>Teamp 사용 흐름을 빠르게 파악해보세요</p>
        </div>
      </div>

      {/* 흐름 요약 */}
      <div className={styles.flowBar}>
        {['프로젝트 시작', '→', '팀과 협업', '→', '마무리·기록', '→', '팀프폴리오', '→', '기여와 관계의 기록'].map((item, i) => (
          <span key={i} className={item === '→' ? styles.flowArrow : styles.flowStep}>{item}</span>
        ))}
      </div>

      <div className={styles.sections}>
        {sections.map((sec) => (
          <div key={sec.id} className={styles.section}>
            <button
              className={styles.sectionHeader}
              onClick={() => setOpenSection(openSection === sec.id ? null : sec.id)}>
              <span className={styles.sectionIcon}>{sec.icon}</span>
              <span className={styles.sectionTitle}>{sec.title}</span>
              <span className={styles.sectionToggle}>{openSection === sec.id ? '∧' : '∨'}</span>
            </button>
            {openSection === sec.id && (
              <div className={styles.stepList}>
                {sec.steps.map((step, i) => (
                  <div key={i} className={styles.step}>
                    <div className={styles.stepNum}>{i + 1}</div>
                    <div>
                      <p className={styles.stepLabel}>{step.label}</p>
                      <p className={styles.stepDesc}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.tipBox}>
        <p className={styles.tipTitle}>💡 빠른 팁</p>
        <ul className={styles.tipList}>
          <li>Cmd+K (Mac) 또는 Ctrl+K (Windows) 로 프로젝트·채팅방을 빠르게 검색할 수 있어요</li>
          <li>마일스톤은 "MVP 완료", "디자인 1차 완료" 같은 구체적인 목표로 기록하면 회고 때 훨씬 유용해요</li>
          <li>완료된 프로젝트는 홈 '완료됨' 섹션에서 언제든 다시 확인할 수 있어요</li>
          <li>채팅방에서 + 버튼 → 투표 만들기로 팀 의사결정을 간편하게 해요</li>
          <li>팀프 매치에서 [문의하기]를 누르면 모집자에게 쪽지를 바로 보낼 수 있어요</li>
          <li>팀프폴리오는 자동 생성이 아니에요 — 프로필 › 팀프폴리오 관리에서 직접 생성하고 반영해야 공개돼요</li>
          <li>커넥트에서 함께한 팀원에게 쪽지를 보내거나, 내 새 프로젝트로 바로 초대할 수 있어요</li>
        </ul>
      </div>

      <div className={styles.footer}>
        <p className={styles.footerText}>
          더 궁금한 점이 있다면{' '}
          <button className={styles.footerLink} onClick={() => navigate('/messages?compose=1&to=teamp')}>@teamp</button>
          로 메시지를 보내주세요
        </p>
        <button className={styles.footerBtn} onClick={() => navigate('/home')}>← 홈으로 돌아가기</button>
      </div>
    </div>
  )
}
