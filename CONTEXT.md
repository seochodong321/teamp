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
    ├── main.jsx (다크 모드 초기 적용 포함)
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
        ├── ProfilePage.jsx (다크 모드 토글, 편집 모달)
        └── ConnectPage.jsx (팀프 커넥트)
```

## Firebase 설정

- Firebase Auth: 이메일/비밀번호 활성화
- Firestore: 테스트 모드, asia-northeast3(서울)
- users 컬렉션: { uid, name, username, email, affiliation, phone, oneliner, bio, createdAt }
- **projects/messages는 Firestore 저장 + onSnapshot 실시간 동기화 (2025-05-03 완료)**
- roomOrders, dmRooms, connects, notifications, invites, theme은 localStorage(Zustand persist)로 관리

## 완성된 기능

### 인증
- Firebase 회원가입/로그인 (이름, 소속 필수, 핸드폰 선택)
- 새로고침 시 로그인 유지
- 로그아웃

### 프로젝트
- 새 프로젝트 생성 (홈 팝업 모달 + /create 페이지 둘 다 가능)
- **프로젝트 이모지 필수 선택** (32종)
- 카테고리: 학교/회사/스터디/기타 (기타 선택 시 직접 입력)
- 기본 채팅방: '나와의 채팅' + '전체' 자동 생성
- 추가 팀 채팅방 (Enter로 추가, 한글 IME 버그 처리됨)
- 종료일 과거 설정 방지
- 기한 만료 → 종료/연장 (달력 모달)
- 신규 로그인 시 '📖 Teamp 사용방법' 튜토리얼 프로젝트 자동 생성

### 초대 링크
- 실제 작동: `${window.location.origin}/join/${project.id}`
- `/join/:code` 라우트 (로그인 없이 접근 가능)
- 로그인 후 자동 참여 + 커넥트 추가 + 시스템 메시지
- 멤버 탭에 초대 링크 복사 버튼

### 채팅
- 한글 IME 중복 입력 버그 수정 (isComposing)
- 파일 공유, 투표 기능
- 1:1 DM 채팅 (getOrCreateDmRoom)

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

### 디자인 시스템
- 메인: 보라 #534AB7 (4단계: soft → light → primary → dark)
- 보조: teal, amber, coral, rose (각 light/soft 단계 있음)
- 그림자: xs/sm/md/lg/xl + glow (보라 톤 살짝 섞임)
- 모서리: sm/md/lg/xl/2xl/full
- 트랜지션: fast/normal/slow
- 카드 hover 시 위로 떠오르며 보라→분홍 그라데이션 라인
- 버튼에 부드러운 보라 그림자

## 라우팅 (App.jsx)

```
/login                                    → LoginPage (redirect 파라미터 지원)
/join/:code                               → JoinPage (로그인 없이 접근)
/ (PrivateRoute)
  /home                                   → HomePage
  /project/:projectId                     → ProjectPage (?tab= 파라미터 지원)
  /project/:projectId/chat/:roomId        → ChatPage (DM 지원)
  /create                                 → CreateProjectPage
  /profile                                → ProfilePage
  /connect                                → ConnectPage
```

## 깃허브 배포

```bash
git add .
git commit -m "변경 내용"
git push
```
→ Vercel 자동 배포 (1~2분)

## 핵심 함수 (useStore.js)

- `login(name, email, uid, extra)` → currentUser 세팅만. 프로젝트는 Firestore onSnapshot이 담당
- `createTutorialProject(userId, userName)` → 첫 로그인 시 App.jsx에서 호출, Firestore에 튜토리얼 프로젝트 생성
- `getProjectByInviteCode(code)`, `joinProjectByCode(code)`
- `getOrCreateDmRoom(projectId, otherUserId, otherUserName)`
- `addRoom`, `addAnnouncement`, `addTodo`, `updateTodo`, `deleteTodo`
- `addEvent`, `removeEvent`
- `createProject(data)` → inviteCode = project.id, emoji 포함
- `updateMemberRole`, `setMemberRooms`, `transferLeader`
- `togglePublic`, `updateMemberMemo`, `updateProfile`
- `removeConnect`, `addConnectsFromProject`
- `addNotification`, `markNotificationRead`, `markAllNotificationsRead`, `removeNotification`
- `setTheme`, `toggleTheme`

## 다음에 할 일 (우선순위 순)

### 🔥 베타 출시 전 필수
1. ~~**Firestore 연동**~~ ✅ 완료 (2025-05-03)
2. **도메인 연결** — teamp.app 같은 정식 도메인
3. **PWA 설정** — manifest.json + 아이콘 (앱처럼 홈화면 추가 가능)
4. **초대 링크 다중 사용자 테스트** — 진짜로 다른 사람이 들어와서 채팅까지 되는지

### 🌟 기능 추가
- 검색 (글로벌 검색)
- 빈 화면 개선 (empty state 일러스트)
- 마이크로 인터랙션
- 타이포그래피 위계 강화
- 모바일 반응형 점검

### 🛠️ 알려진 이슈 (Firestore 연동 후 검증)
- 할 일 알림 정확성: 지금은 1인 데모라 진짜 다중 사용자 환경에서 알림이 올바른 사람에게만 가는지 확인 필요

### 🚀 장기 비전
- React Native로 네이티브 앱 변환
- 공식 인증 / 브이체크 (사기꾼 방지)
- 프로젝트 회고 / 마무리 보고서 → 공개 프로필 포트폴리오로 쌓임
- 팀프 점수 / 신뢰도 시스템

## 작업 스타일 메모

- 사용자는 부분 수정보다 전체 코드를 받는 걸 선호함
- 깃 푸시 명령어를 응답 끝에 항상 포함하는 게 좋음
- 한 번 요청한 것은 정확히 수행. 반복 요청은 비효율
- 모든 코드는 한국어 주석 + 친근한 톤
