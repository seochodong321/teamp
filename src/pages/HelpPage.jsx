import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './HelpPage.module.css'

const sections = [
  {
    id: 'start',
    icon: '🚀',
    title: '시작하기 — 프로젝트 만드는 법',
    steps: [
      { label: '새 프로젝트 만들기', desc: '홈 화면 오른쪽 위 [+ 새 프로젝트] 버튼을 누르거나 사이드바의 [+ 새 프로젝트]를 클릭하세요.' },
      { label: '기본 정보 입력', desc: '이모지, 프로젝트 이름, 목적, 카테고리, 시작일·종료일을 입력해요. 종료 시간은 선택 사항이에요.' },
      { label: '팀 채팅방 설정', desc: '기본으로 나와의 채팅, 전체 채팅방이 생성돼요. 추가로 원하는 채팅방을 만들 수 있어요.' },
      { label: '초대 링크 공유', desc: '프로젝트 완성 후 초대 링크가 생성돼요. 링크를 복사해 팀원들에게 공유하면 돼요.' },
    ],
  },
  {
    id: 'phases',
    icon: '🗓️',
    title: '3단계 프로젝트 흐름 — 프리 · 진행 · 포스트',
    steps: [
      { label: '🚀 프리 단계 (Pre)', desc: '프로젝트 시작일 이전의 준비 기간이에요. 팀원을 초대하고, 채팅방·마일스톤·할 일을 미리 세팅할 수 있어요. 홈 카드 D-Day 뱃지에 "시작 D-N"이 표시돼요.' },
      { label: '💼 프로젝트 단계 (Project)', desc: '시작일부터 종료일까지 본격 협업하는 기간이에요. "진행 중 · D-N" 형태로 마감까지 얼마나 남았는지 실시간으로 확인돼요. D-7 이내면 주황, D-3 이내면 빨간 경고 색상으로 강조돼요.' },
      { label: '📝 포스트 단계 (Post)', desc: '종료일 이후 약 2주간의 정리·기록 기간이에요. 마일스톤 회고·Wrap-up 작성·팀 피드백 수집을 이 단계에서 진행해요. 뱃지에 "포스트 · 마친 지 N일"이 표시돼요.' },
      { label: '홈 카드 3색 상태바', desc: '홈 프로젝트 카드 하단 상태바가 3가지 색으로 단계 비율을 보여줘요. 회색(프리) → 보라(진행) → 초록(포스트) 순이며, 흰 점(●)이 오늘의 위치를 표시해요.' },
    ],
  },
  {
    id: 'use',
    icon: '📋',
    title: '프로젝트 안에서 기능 활용하기',
    steps: [
      { label: '채팅방', desc: '팀원과 실시간으로 대화하세요. 파일·이미지 전송, 투표 만들기도 가능해요. 채팅방은 언제든 추가할 수 있어요.' },
      { label: '게시판', desc: '중요한 공지나 자료를 게시판에 올려두세요. 전체 공지는 모든 채팅방에 알림이 가요.' },
      { label: '캘린더', desc: '팀 일정을 캘린더에 등록하세요. 개인 일정은 나만 볼 수 있고, 공유 일정은 채팅방에 알림이 가요.' },
      { label: '할 일', desc: '할 일을 만들어 드래그로 진행 상태를 바꿀 수 있어요. 담당자는 여러 명 선택이 가능하고, 이번 주 팀 목표도 리더가 설정할 수 있어요.' },
      { label: '마일스톤', desc: '프로젝트 탭에서 마일스톤을 등록해 주요 목표를 타임라인으로 기록하세요. 리더·부리더만 추가·수정할 수 있어요.' },
      { label: '멤버 관리', desc: '멤버 탭에서 팀원을 클릭해 프로필을 확인하거나 1:1 대화를 시작할 수 있어요. 리더는 역할·권한을 조정하고 팀원을 방출할 수 있어요.' },
    ],
  },
  {
    id: 'milestone',
    icon: '🏁',
    title: '마일스톤 & Wrap-up 회고',
    steps: [
      { label: '마일스톤이란?', desc: '마일스톤은 "MVP 로그인 완료", "디자인 1차 완료"처럼 프로젝트의 핵심 목표를 기록하는 기능이에요. 성장 과정을 타임라인으로 남겨줘요.' },
      { label: '마일스톤 작성 권한', desc: '리더와 부리더만 마일스톤을 추가·수정·삭제할 수 있어요. 완료, 연기, 재개 처리 모두 리더·부리더 전용이에요. 팀원은 읽기 전용으로 확인할 수 있어요.' },
      { label: '타임라인 구조', desc: '마일스톤은 화면 중앙 세로 라인을 기준으로 좌우 번갈아 표시돼요. 위에서 아래로 쌓여 프로젝트의 성장 흐름을 한눈에 볼 수 있어요.' },
      { label: '상태 변경과 자동 기록', desc: '마일스톤을 완료·연기·재개할 때마다 변경 이력이 자동으로 기록돼요. 누가, 언제 바꿨는지 카드 하단에서 확인할 수 있어요.' },
      { label: 'Wrap-up 회고 작성', desc: '마일스톤 탭 상단의 [회고 작성] 버튼을 누르면 역순 타임라인으로 프로젝트 여정을 돌아볼 수 있어요. 통계 요약과 팀 회고 노트도 저장할 수 있어요.' },
    ],
  },
  {
    id: 'end',
    icon: '🏁',
    title: '프로젝트 종료와 랩업',
    steps: [
      { label: '마무리 시작', desc: '프로젝트 헤더의 [마무리하기] 버튼을 눌러 랩업 페이지로 이동해요.' },
      { label: '피드백 수집 설정', desc: '피드백을 수집할지, 수집 기간(일수)을 설정해요. 설정하면 팀원들이 서로 피드백을 남길 수 있어요.' },
      { label: '회고 작성', desc: '랩업 페이지에서 개인 회고를 작성하세요. 프로젝트 통계(메시지 수, 할 일 완료율 등)도 확인해요.' },
      { label: '완료 이동', desc: '피드백 마감일이 지나면 자동으로 \'완료됨\'으로 이동해요. 홈에서 완료된 프로젝트를 확인할 수 있어요.' },
    ],
  },
  {
    id: 'profile',
    icon: '👤',
    title: '프로필 설정',
    steps: [
      { label: '원라이너 작성', desc: '사이드바 [프로필] 메뉴에서 나를 한 줄로 소개하는 원라이너를 작성해보세요.' },
      { label: '프로젝트 공개 설정', desc: '프로젝트 > 멤버 탭에서 해당 프로젝트를 공개로 설정하면 팀프 커넥트에서 다른 사람이 볼 수 있어요.' },
      { label: '소속·연락처', desc: '소속과 이메일을 등록하면 팀원들이 내 프로필을 확인할 때 함께 표시돼요.' },
    ],
  },
  {
    id: 'connect',
    icon: '🔗',
    title: '팀프 커넥트 & 1:1 대화',
    steps: [
      { label: '팀프 커넥트', desc: '같은 프로젝트에 속했던 사람들이 자동으로 커넥트에 추가돼요. 이름을 클릭하면 프로필을 볼 수 있어요.' },
      { label: '1:1 대화 시작', desc: '커넥트나 멤버 프로필에서 [1:1 대화] 버튼을 누르면 DM이 시작돼요. DM은 사이드바 채팅 섹션에서 확인해요.' },
      { label: '팀프 매치', desc: '프로젝트 리더라면 팀프 매치에서 팀원 모집글을 올릴 수 있어요. 지원자를 확인하고 바로 프로젝트에 합류시킬 수 있어요.' },
    ],
  },
  {
    id: 'calendar',
    icon: '📅',
    title: '통합 캘린더',
    steps: [
      { label: '통합 캘린더란?', desc: '진행 중인 모든 프로젝트의 할 일 마감일, 이벤트, 마일스톤을 한눈에 볼 수 있는 월별 달력이에요.' },
      { label: '일정 보기', desc: '날짜 셀에 표시된 컬러 pill을 클릭하면 해당 날짜의 일정 목록이 오른쪽 패널에 나타나요. 각 항목을 클릭하면 해당 프로젝트로 이동해요.' },
      { label: '내 할 일만 표시', desc: '할 일은 담당자로 배정된 항목만 표시돼요. 이벤트와 마일스톤은 프로젝트 전체가 표시돼요.' },
      { label: '다가오는 일정', desc: '오른쪽 패널에 오늘 이후의 일정이 최대 20개까지 날짜순으로 표시돼요. 클릭하면 해당 날짜로 달력이 이동해요.' },
    ],
  },
  {
    id: 'share',
    icon: '🔗',
    title: '공개 프로필 & 포트폴리오 공유',
    steps: [
      { label: '공유 링크 만들기', desc: '내 프로필 페이지 상단의 [공유 링크] 버튼을 클릭하면 외부에서 열 수 있는 공개 URL이 복사돼요.' },
      { label: '외부 공개 정보', desc: '공유된 페이지에서는 이름, 소속, 원라이너, 공개 프로젝트, 받은 꽃다발 태그가 표시돼요. 비공개 프로젝트와 연락처는 노출되지 않아요.' },
      { label: '프로젝트 공개 설정', desc: '프로젝트 > 멤버 탭에서 해당 프로젝트를 공개로 설정해야 공유 페이지에 나타나요.' },
      { label: '포트폴리오 활용', desc: '채용 담당자나 협업 파트너에게 링크를 보내 가볍게 내 활동 이력을 공유해보세요.' },
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
        {['프로젝트 시작', '→', '팀과 협업', '→', '마무리·랩업', '→', '팀프폴리오 기록', '→', '새로운 프로젝트'].map((item, i) => (
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
          <li>팀프 매치에서 [문의하기] 버튼을 누르면 모집자에게 쪽지를 바로 보낼 수 있어요</li>
        </ul>
      </div>

      <div className={styles.footer}>
        <p className={styles.footerText}>더 궁금한 점이 있다면</p>
        <button className={styles.footerBtn} onClick={() => navigate('/home')}>← 홈으로 돌아가기</button>
      </div>
    </div>
  )
}
