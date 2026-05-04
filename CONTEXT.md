# Teamp 프로젝트 컨텍스트

## 개요

**Teamp(팀프)** — 팀 프로젝트 단위로 협업하는 채팅 앱.
프로젝트 → 팀 → 개인의 계층 구조를 가짐. 슬랙과 노션의 중간 자리를 노림.

- **배포**: https://teamp.vercel.app
- **레포**: GitHub (Vercel 자동 배포)
- **기술 스택**: React + Vite, CSS Modules, Zustand, React Router, Firebase Auth + Firestore
- **장기 비전**: 노션처럼 웹 + 앱 동시 사용 가능한 협업 도구

## 파일 구조

```
teamp-web/
├── index.html
├── package.json
├── vite.config.js
├── vercel.json (SPA 라우팅)
└── src/
    ├── main.jsx (다크 모드 초기 적용 + SW 등록)
    ├── App.jsx (라우터)
    ├── firebase.js (Firebase 설정)
    ├── styles/global.css (CSS 변수, 다크 모드)
    ├── store/useStore.js (Zustand 상태 관리)
    ├── components/
    │   ├── Layout.jsx + .module.css (사이드바, 종 아이콘)
    │   ├── CalendarInline.jsx + .module.css
    │   ├── TodoBoard.jsx + .module.css (칸반)
    │   └── NotificationPanel.jsx + .module.css (알림 패널)
    └── pages/
        ├── LoginPage.jsx
        ├── JoinPage.jsx (초대 링크 수락)
        ├── HomePage.jsx (새 프로젝트 팝업 모달 포함)
        ├── ProjectPage.jsx (탭: 채팅방/게시판/할 일/캘린더/멤버/권한)
        ├── ChatPage.jsx
        ├── CreateProjectPage.jsx (사이드바 진입용 단계별 페이지)
        ├── WrapupPage.jsx + WrapupPage.module.css (프로젝트 마무리)
        ├── ProfilePage.jsx (다크 모드 토글, 편집 모달)
        └── ConnectPage.jsx (팀프 커넥트)
```

## Firebase 설정

- Firebase Auth: 이메일/비밀번호 활성화
- Firestore: asia-northeast3(서울)
- **Firestore 보안 규칙** (Firebase 콘솔에 적용 완료):
  - `users/{userId}`: 본인만 읽기/쓰기
  - `projects/{projectId}`: memberIds 포함 시 읽기/수정, 인증 사용자 생성
  - `rooms/{roomId}/messages/{msgId}`: 인증 사용자 읽기/쓰기
  - `wrapups/{wrapupId}`: 인증 사용자 읽기/생성/수정
- **컬렉션 구조**:
  - `users/`: { uid, name, username, email, affiliation, phone, oneliner, bio, createdAt }
  - `projects/`: { id, name, emoji, category, startDate, endDate, status, leaderId, memberIds, members, rooms, announcements, todos, events, isPublic, inviteCode, wrapupId?, feedbackDeadline?, collectFeedback? }
  - `rooms/{roomId}/messages/`: { senderId, senderName, type, text, time, createdAt, options? }
  - `wrapups/`: { projectId, projectName, summary, highlights, members, reflections, feedbacks, createdAt }
- projects/messages는 Firestore onSnapshot 실시간 구독
- roomOrders, dmRooms, connects, notifications, invites, theme은 localStorage(Zustand persist)

## 완성된 기능

### 인증
- Firebase 회원가입/로그인 (이름, 소속 필수, 핸드폰 선택)
- 새로고침 시 로그인 유지
- 로그아웃

### 프로젝트
- 새 프로젝트 생성 (홈 팝업 모달 + /create 페이지 둘 다 가능)
- 프로젝트 이모지 필수 선택 (32종, CSS 클래스 기반 선택기)
- 카테고리: 학교/회사/스터디/기타 (기타 선택 시 직접 입력)
- 기본 채팅방: '나와의 채팅' + '전체' 자동 생성
- 추가 팀 채팅방 (Enter로 추가, 한글 IME 이중 입력 버그 수정 완료)
- 종료일 과거 설정 방지 + 날짜 오류 메시지 스타일 적용
- 기한 만료 → 마무리하기 모달(피드백 수집 옵션) / 연장 (달력 모달)
- 신규 로그인 시 '📖 Teamp 사용방법' 튜토리얼 프로젝트 자동 생성 (Firestore)

### 초대 링크
- 실제 작동: `${window.location.origin}/join/${project.id}`
- `/join/:code` 라우트 (로그인 없이 접근 가능)
- 로그인 후 자동 참여 + 커넥트 추가 + 시스템 메시지
- 멤버 탭에 초대 링크 복사 버튼

### 채팅
- 한글 IME 중복 입력 버그 수정 (isComposing)
- 파일 공유, 투표 기능
- 1:1 DM 채팅 (getOrCreateDmRoom)
- Firestore 실시간 구독 (onSnapshot)

### 게시판
- 카드형 디자인 (목록/작성/상세 3단계)
- 공지(리더만) vs 일반(전원)
- 공지 시 전체 채팅방 알림
- 제목 + 본문 + 파일 첨부

### 캘린더
- ProjectPage 탭 안에 인라인 표시 (CalendarInline 컴포넌트)
- 일정 추가: 전체/팀별/나만보기 범위
- 등록 시 채팅방 알림

### 할 일 (Todo) — 칸반 보드
- 3컬럼: 할 일 / 진행 중 / 완료
- 드래그로 상태 변경
- 담당자 + 마감일 + 우선순위(낮음/보통/높음)
- 마감일 지나면 빨간색 + "(지남)" 표시
- 담당자 지정 시 채팅방 알림 + 알림 시스템 발동

### 알림
- 사이드바 좌상단 🔔 종 아이콘 (모바일은 우상단)
- 빨간 점 + 읽지 않은 알림 개수
- 슬라이드 패널 (오른쪽에서 등장)
- 알림 종류: 환영, 공지, 게시글, 할 일, 일정, 초대
- 클릭하면 정확한 탭으로 이동 (?tab=board, ?tab=todo)
- 모두 읽음 처리 / 전체 삭제 / 개별 삭제
- "3분 전" 같은 상대 시간 표시

### 멤버/권한
- 멤버 프로필 클릭 → 모달 (이름, 소속, 이메일, 역할 메모)
- 권한 관리: 역할(리더/부리더/팀원) + 채팅방 접근 권한, 저장 버튼으로 적용
- 리더 양도

### 팀프 커넥트
- 같은 프로젝트 참여자 자동 추가
- 프로젝트별 그룹핑
- 삭제 가능 (상대 모름)

### 프로필
- 편집 모달 (이름, 소속, 핸드폰, 팀프 원라이너 50자)
- Firestore 동기화
- 공개/비공개 토글 (보라/흰색)
- 역할 메모 편집
- 공개 프로젝트 표시 (클릭 비활성)

### 다크 모드
- 프로필 페이지 환경 설정 토글
- localStorage로 설정 유지
- 모든 페이지에 자동 적용 (CSS 변수 기반)
- 보라색은 살짝 밝게, 배경은 깊은 검정 톤

### 프로젝트 마무리 (Wrap-up)
- 리더가 기한 만료 시 "🏁 마무리하기" 버튼으로 종료 흐름 시작
- 피드백 수집 여부 + 기간(3/5/7/14일) 선택 모달
- 프로젝트 상태: active → collecting → archived
- WrapupPage (/project/:id/wrapup):
  - 📊 요약 탭: 메시지 수, 할 일 완료율, 파일 공유 수, 가장 활발한 팀원
  - 💬 회고 탭: 개인 회고 작성/수정, 전체 팀원 회고 목록
  - ⭐ 피드백 탭: 팀원별 피드백 (잘한 점/개선할 점/한 마디/익명 옵션), 받은 피드백 확인
- 피드백 마감일 자동 archived 전환 (checkAndArchive)
- 홈화면: "피드백 수집 중" 섹션 별도 표시, 완료 프로젝트 클릭 시 랩업 페이지 이동

### 디자인 시스템
- 메인: 보라 #534AB7 (4단계: soft → light → primary → dark)
- 보조: teal, amber, coral, rose (각 light/soft 단계 있음)
- 그림자: xs/sm/md/lg/xl + glow (보라 톤 살짝 섞임)
- 모서리: sm/md/lg/xl/2xl/full
- 트랜지션: fast/normal/slow
- 카드 hover 시 위로 떠오르며 보라→분홍 그라데이션 라인
- 버튼에 부드러운 보라 그림자
- **모든 색상 값을 CSS 변수로 통일 (하드코딩 제거 완료)**

## 라우팅 (App.jsx)

```
/login                                    → LoginPage (redirect 파라미터 지원)
/join/:code                               → JoinPage (로그인 없이 접근)
/ (PrivateRoute)
  /home                                   → HomePage
  /project/:projectId                     → ProjectPage (?tab= 파라미터 지원)
  /project/:projectId/chat/:roomId        → ChatPage (DM 지원)
  /project/:projectId/wrapup              → WrapupPage (프로젝트 마무리)
  /create                                 → CreateProjectPage
  /profile                                → ProfilePage
  /connect                                → ConnectPage
```

## 핵심 함수 (useStore.js)

- `login(name, email, uid, extra)` → currentUser 세팅만. 프로젝트는 Firestore onSnapshot이 담당
- `setProjects(firestoreProjects)` → Firestore 데이터로 projects 동기화 (unread 카운트 보존)
- `setRoomMessages(roomId, msgs)` → 채팅방 메시지 동기화
- `createTutorialProject(userId, userName)` → 첫 로그인 시 App.jsx에서 호출, Firestore에 튜토리얼 프로젝트 생성
- `getProjectByInviteCode(code)`, `joinProjectByCode(code)`
- `getOrCreateDmRoom(projectId, otherUserId, otherUserName)`
- `addRoom`, `addAnnouncement`, `addTodo`, `updateTodo`, `deleteTodo`
- `addEvent`, `removeEvent`
- `createProject(data)` → inviteCode = project.id, emoji 포함, Firestore에 저장
- `sendMessage(roomId, text)`, `sendFile(roomId, fileName)`, `sendPoll(roomId, question, options)`, `votePoll(roomId, msgId, optId)`
- `updateMemberRole`, `setMemberRooms`, `transferLeader`
- `archiveProject`, `extendProject`
- `endProject(projectId, { collectFeedback, feedbackDuration })` → 통계 집계 후 wrapup 문서 생성, 상태 전환
- `addReflection(wrapupId, text)` → 회고 저장 (1인 1회고, 수정 가능)
- `addFeedback(wrapupId, feedbackData)` → 피드백 저장 (트랜잭션)
- `checkAndArchive(projectId)` → collecting 상태 + 마감일 지남 → archived 전환
- `togglePublic`, `updateMemberMemo`, `updateProfile`
- `removeConnect`, `addConnectsFromProject`
- `addNotification`, `markNotificationRead`, `markAllNotificationsRead`, `removeNotification`
- `setTheme`, `toggleTheme`

## 다음에 할 일 (우선순위 순)

### 🔥 베타 출시 전 필수
1. ~~**Firestore 연동**~~ ✅ 완료
2. ~~**디자인 정돈**~~ ✅ 완료 (CSS 변수 통일, WrapupPage 재작성, 이모지 선택기 정리)
3. **PWA 설정** ← 현재 진행 중 — manifest.json + 아이콘 + 서비스워커 (앱처럼 홈화면 추가)
4. **도메인 연결** — teamp.app 같은 정식 도메인 (Vercel에서 설정)
5. **초대 링크 다중 사용자 테스트** — 진짜로 다른 사람이 들어와서 채팅까지 되는지

### 🌟 서비스 고도화 (개발 집중)
- 모바일 반응형 점검 및 개선
- 빈 화면 개선 (empty state 안내 문구/시각적 처리)
- 로딩/스켈레톤 처리 (데이터 로딩 중 빈 화면 방지)
- 에러 핸들링 강화 (Firestore 실패 시 사용자 피드백)
- 마이크로 인터랙션 (메시지 전송 애니메이션 등)

### ❌ 개발 범위 외 (유저가 직접 담당)
- 글로벌 검색
- 마케팅 / 홍보
- 도메인 연결

### 🛠️ 알려진 이슈
- 할 일 알림 정확성: 다중 사용자 환경에서 알림이 올바른 사람에게만 가는지 확인 필요
- WrapupPage 통계: 현재 메시지 카운트 방식이 대용량 프로젝트에서 느릴 수 있음 (getDocs 루프)

### 🚀 장기 비전
- React Native로 네이티브 앱 변환
- 공식 인증 / 브이체크 (사기꾼 방지)
- 프로젝트 회고 / 마무리 보고서 → 공개 프로필 포트폴리오로 쌓임
- 팀프 점수 / 신뢰도 시스템

## 작업 방향

- Claude는 **개발과 서비스 고도화**에만 집중 (검색, 마케팅, 도메인은 유저 담당)
- 장기 목표: 웹 완성 후 React Native로 앱 버전 확장 (Zustand + Firebase 로직 재사용)

## 작업 스타일 메모

- 깃 푸시 명령어를 응답 끝에 항상 포함
- 한국어 인라인 주석 사용
- CSS는 반드시 global.css에 정의된 CSS 변수 사용 (하드코딩 금지)
- 새 페이지는 WrapupPage.module.css 스타일로 통일 (CSS 변수 기반)
