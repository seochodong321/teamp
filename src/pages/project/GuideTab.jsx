import React from 'react'
import styles from '../ProjectPage.module.css'

export default function GuideTab({ onGotoBoard, onGotoManage, onGotoMembers, onGotoMilestone, onGotoTodo }) {
  return (
    <div className={styles.section}>
      <div className={styles.guideHeader}>
        <h2 className={styles.guideTitle}>리더 운영 가이드</h2>
        <p className={styles.guideSubtitle}>리더만 볼 수 있어요. 처음 운영이라면 여기서 시작하세요.</p>
      </div>

      <div className={styles.guideCard}>
        <div className={styles.guideCardTitle}>🗓️ 3단계 프로젝트 흐름</div>
        <p className={styles.guideCardBody}>
          Teamp 프로젝트는 시작일·종료일 기준으로 3단계가 자동 전환돼요.<br /><br />
          <b>🚀 프리 단계</b> — 시작일 이전 준비 기간. 팀원 초대, 채팅방·마일스톤 세팅을 먼저 해두면 시작과 동시에 바로 달릴 수 있어요.<br />
          <b>💼 진행 중</b> — 시작일~종료일. 홈 카드의 보라색 바와 D-Day 뱃지로 마감을 체크하세요. D-3 이내엔 빨간색으로 강조돼요.<br />
          <b>📝 포스트</b> — 종료 후 2주. 회고 작성·피드백 수집·Wrap-up 완성에 집중하세요.<br /><br />
          홈 카드 하단 3색 상태바(회색·보라·초록)가 현재 어느 단계인지 한눈에 보여줘요.
        </p>
      </div>

      <div className={styles.guideCard}>
        <div className={styles.guideCardTitle}>📢 공지하기</div>
        <p className={styles.guideCardBody}>
          게시판 탭 → 글쓰기 → <b>전체 공지</b> 선택 후 등록하면 모든 채팅방에 알림이 자동으로 전송돼요.<br />
          특정 채팅방에만 올리고 싶다면 전체 공지 체크를 해제하고 게시판에만 저장할 수 있어요.
        </p>
        <button className={styles.guideShortcut} onClick={() => onGotoBoard(true, true)}>
          지금 공지 작성하기 →
        </button>
      </div>

      <div className={styles.guideCard}>
        <div className={styles.guideCardTitle}>👥 팀원 초대 & 모집</div>
        <p className={styles.guideCardBody}>
          <b>초대 링크</b> — 멤버 탭에서 링크를 복사해 공유하거나, 커넥트에 있는 사람을 직접 초대할 수 있어요.<br />
          <b>팀프 매치</b> — 사이드바 '팀프 매치'에서 모집글을 올리면 지원자를 확인하고 바로 프로젝트에 합류시킬 수 있어요.<br />
          <b>방출</b> — 권한 관리 탭 → 멤버 카드의 방출 버튼. 방출된 멤버는 다시 초대를 받아야 참여할 수 있어요.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className={styles.guideShortcut} onClick={() => onGotoMembers()}>초대하러 가기 →</button>
          <button className={styles.guideShortcut} onClick={() => onGotoManage()}>권한 관리로 가기 →</button>
        </div>
      </div>

      <div className={styles.guideCard}>
        <div className={styles.guideCardTitle}>⭐ 부리더 임명하기</div>
        <p className={styles.guideCardBody}>
          권한 관리 탭 → 역할 선택란에서 <b>부리더</b>로 변경 → 저장하기<br />
          부리더는 팀 운영의 실질적인 파트너예요. 아래 권한 범위를 확인하세요.
        </p>
        <div className={styles.guideRoleTable}>
          <div className={styles.guideRoleRow}>
            <span className={styles.guideRoleLabel}>부리더도 할 수 있는 것</span>
            <div className={styles.guideRoleTags}>
              {['팀원 초대', '채팅방 추가', '게시판 글 작성', '할 일 생성·수정·삭제', '마일스톤 추가·완료·연기'].map((t) => (
                <span key={t} className={styles.guideTagCan}>{t}</span>
              ))}
            </div>
          </div>
          <div className={styles.guideRoleRow}>
            <span className={styles.guideRoleLabel}>리더만 할 수 있는 것</span>
            <div className={styles.guideRoleTags}>
              {['전체 공지', '팀원 방출', '역할 변경', '리더 양도', '이번 주 팀 목표 설정', '프로젝트 마무리'].map((t) => (
                <span key={t} className={styles.guideTagCant}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.guideCard}>
        <div className={styles.guideCardTitle}>🏁 마일스톤 관리</div>
        <p className={styles.guideCardBody}>
          마일스톤 탭에서 프로젝트의 핵심 목표를 타임라인으로 기록해요.<br />
          "MVP 로그인 완료", "1차 디자인 완료"처럼 <b>구체적인 목표</b>로 등록하면 나중에 회고할 때 훨씬 유용해요.<br />
          완료·연기·재개 처리 시 변경 이력이 자동으로 기록되고, 프로젝트 마무리 시 Wrap-up에 자동으로 반영돼요.
        </p>
        <button className={styles.guideShortcut} onClick={() => onGotoMilestone()}>마일스톤 탭으로 가기 →</button>
      </div>

      <div className={styles.guideCard}>
        <div className={styles.guideCardTitle}>📋 이번 주 팀 목표 설정</div>
        <p className={styles.guideCardBody}>
          할 일 탭 상단의 <b>이번 주 목표</b> 카드에서 팀 전체의 이번 주 방향을 한 줄로 제시할 수 있어요.<br />
          목표는 모든 팀원의 할 일 탭 최상단에 표시되고, 매주 새로 설정할 수 있어요.<br />
          할 일을 배정할 때마다 해당 팀원에게 자동으로 알림이 전송돼요.
        </p>
        <button className={styles.guideShortcut} onClick={() => onGotoTodo()}>할 일 탭으로 가기 →</button>
      </div>

      <div className={styles.guideCard}>
        <div className={styles.guideCardTitle}>🔒 채팅방 접근 권한 설정</div>
        <p className={styles.guideCardBody}>
          권한 관리 탭 → 멤버 카드 하단 <b>접근 가능한 채팅방</b> 체크박스로 채팅방별 접근을 제어할 수 있어요.<br />
          부리더는 모든 채팅방에 자동으로 접근돼요. 팀원은 리더가 허용한 채팅방만 볼 수 있어요.
        </p>
      </div>

      <div className={styles.guideCard}>
        <div className={styles.guideCardTitle}>🎖 리더 양도하기</div>
        <p className={styles.guideCardBody}>
          권한 관리 탭 → 해당 멤버 카드 → <b>리더 양도</b> 버튼<br />
          양도 후엔 내가 일반 팀원 역할이 돼요. 신중하게 결정해주세요.
        </p>
      </div>

      <div className={styles.guideCard}>
        <div className={styles.guideCardTitle}>🏁 프로젝트 마무리 (Wrap-up)</div>
        <p className={styles.guideCardBody}>
          상단 헤더의 <b>프로젝트 마치기</b>를 누르면 Wrap-up 페이지로 이동해요.<br />
          피드백 수집 여부와 기간을 설정하고, 팀원들이 서로 피드백을 남길 수 있어요.<br />
          마일스톤 탭에서 쌓은 기록은 Wrap-up의 <b>마일스톤 여정</b> 섹션에 자동으로 포함돼요.
        </p>
      </div>
    </div>
  )
}
