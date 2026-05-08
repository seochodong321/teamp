# Teamp 프로젝트 컨텍스트

## 개요

**Teamp(팀프)** — 팀 프로젝트 단위로 협업하는 채팅 앱.
프로젝트 → 팀 → 개인의 계층 구조를 가짐. 슬랙과 노션의 중간 자리를 노림.

- **배포**: https://teamp.vercel.app
- **레포**: GitHub (Vercel 자동 배포)
- **기술 스택**: React + Vite, CSS Modules, Zustand, React Router, Firebase Auth + Firestore + Storage + FCM
- **장기 비전**: 웹 완성 후 React Native 앱으로 확장

## 파일 구조

```
teamp/
├── index.html
├── package.json
├── vite.config.js          (manualChunks로 Firebase/React/앱 코드 분리)
├── jsconfig.json           (IDE 자동완성용)
├── vercel.json             (SPA 라우팅)
├── .env                    (Firebase 키 + VITE_FIREBASE_VAPID_KEY)
├── .env.production         (VITE_APP_URL=https://teamp.vercel.app)
├── public/
│   ├── manifest.json       (PWA — short_name: 팀프)
│   ├── sw.js               (캐시 v2 + push/notificationclick 처리)
│   ├── firebase-messaging-sw.js  (FCM 백그라운드 메시지 수신)
│   ├── icon.svg
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
└── src/
    ├── main.jsx            (다크 모드 초기 적용 + SW 등록)
    ├── App.jsx             (라우터 + Auth 구독 + lazy import)
    ├── firebase.js         (Firebase 설정 + offline persistence + FCM)
    ├── styles/global.css   (CSS 변수, 다크 모드)
    ├── store/
    │   └── useStore.js     (Zustand — 약 1,250줄, 전 도메인 통합)
    ├── hooks/
    │   └── useProject.js   (useProject, useCanManage, useMyRole, useTodos, useEvents, useVisibleRooms)
    ├── types/
    │   └── index.d.ts      (Project/Member/Room/Message 등 전 도메인 타입)
    ├── components/
    │   ├── Layout.jsx + .module.css     (사이드바 고정 레이아웃, 알림 배너, 에러 토스트)
    │   ├── ErrorToastContainer.jsx      (전역 에러 토스트 UI)
    │   ├── ChatToastContainer.jsx + .module.css
    │   ├── CalendarInline.jsx + .module.css
    │   ├── TodoBoard.jsx + .module.css  (칸반)
    │   ├── NotificationPanel.jsx + .module.css
    │   ├── SearchModal.jsx + .module.css
    │   └── CreateProjectModal.jsx + .module.css
    └── pages/
        ├── LoginPage.jsx
        ├── JoinPage.jsx            (초대 링크 수락)
        ├── HomePage.jsx            (새 프로젝트 팝업 모달 포함)
        ├── ProjectPage.jsx         (탭: 채팅방/게시판/할 일/캘린더/멤버/권한)
        ├── ChatPage.jsx
        ├── CreateProjectPage.jsx   (사이드바 진입용 단계별 페이지)
        ├── WrapupPage.jsx          (프로젝트 마무리)
        ├── ProfilePage.jsx         (다크 모드 토글, 편집 모달, 프로젝트 삭제)
        ├── ConnectPage.jsx         (팀프 커넥트)
        ├── MatchPage.jsx
        └── HelpPage.jsx
```

## Firebase 설정

- Firebase Auth: 이메일/비밀번호 활성화
- Firestore: asia-northeast3(서울), **offline persistence 활성화** (enableIndexedDbPersistence)
- **Firestore 보안 규칙** (Firebase 콘솔에 적용 완료):
  - `users/{userId}`: 인증된 모든 사용자 읽기, 본인만 쓰기
  - `projects/{projectId}`: 멤버이거나 isPublic == true인 경우 읽기; arrayUnion 방식 참여 허용
  - `rooms/{roomId}/messages/{msgId}`: 인증 사용자 읽기/쓰기
  - `wrapups/{wrapupId}`: 인증 사용자 읽기/생성/수정
  - `dmRooms/{roomId}`: participants 포함 시 읽기/수정
  - `notifications/{id}`: targetUserId 본인만 읽기/수정
  - `projectInvites/{id}`: inviteeId 본인만 읽기/수정, inviterId만 생성
- **레포는 public** — 보안 경계는 Firestore 규칙
- **FCM 푸시 알림**: VAPID 키 .env 설정 완료. Vercel 환경변수에도 VITE_FIREBASE_VAPID_KEY 등록 필요
- **컬렉션 구조**:
  - `users/`: { uid, name, username, email, affiliation, phone, oneliner, fcmToken }
  - `projects/`: { id, name, emoji, category, startDate, endDate, status, leaderId, memberIds, members, rooms, announcements, todos, events, isPublic, inviteCode, wrapupId?, feedbackDeadline? }
  - `rooms/{roomId}/messages/`: { senderId, senderName, type, text, time, createdAt, options? }
  - `wrapups/`: { projectId, projectName, summary, highlights, members, reflections, feedbacks, createdAt }
  - `dmRooms/`: { id, dmKey, projectId, participants, participantNames, isDirect, createdBy, lastMessage, createdAt }
  - `notifications/`: { targetUserId, type, text, projectId, read, createdAt }
  - `projectInvites/`: { projectId, inviterId, inviterName, inviteeId, inviteeName, status, createdAt }
- projects/messages/dmRooms/notifications/projectInvites는 Firestore onSnapshot 실시간 구독
- roomOrders, connects, theme, mutedProjects, hiddenProjects, dmUnreadCounts는 localStorage(Zustand persist)

## 완성된 기능

### 인증
- Firebase 회원가입/로그인 (이름, 소속 필수, 핸드폰 선택)
- **아이디 저장** / **자동 로그인** 체크박스
- 로그아웃

### PWA / 모바일
- manifest.json (short_name: 팀프, PNG 아이콘 192/512)
- Service Worker (오프라인 캐시 + push/notificationclick)
- firebase-messaging-sw.js (FCM 백그라운드 푸시)
- 홈 화면 추가 가능 (iOS/Android)
- **모바일 하단 탭바**: 🏠홈 | 💬채팅 | 🔔알림 | 👤프로필 (미읽음 뱃지 포함)
- 알림 허용 배너 (최초 1회, Layout 상단)

### 성능 최적화
- **Lazy loading**: 모든 페이지 React.lazy() + Suspense
  - 초기 번들 85KB (기존 906KB 단일 파일 → 페이지별 분산)
- **useMemo**: HomePage 프로젝트 필터, Layout 미읽음 카운트
- **번들 스플리팅**: firebase-core / firebase-db / firebase-msg / vendor / 앱코드

### 안정성
- **Firestore offline persistence** — 네트워크 끊겨도 마지막 데이터 유지
- **낙관적 업데이트 rollback**: updateTodo / votePoll 실패 시 이전 상태 복원
- **DM 방 ID 결정론적**: `room_dm_{projectId}_{userId}` — 중복 생성 버그 수정 (acceptInvite / joinProjectByCode / addMemberToProject 전부)
- **전역 에러 토스트**: showError() / ErrorToastContainer — silent catch 대체

### 프로젝트
- 생성, 이모지 선택, 카테고리, 기본 채팅방 자동 생성
- 기한 만료 → 마무리/연장
- 신규 로그인 시 튜토리얼 프로젝트 자동 생성

### 초대
- 초대 링크 (`/join/:code`)
- **직접 초대**: 팀프 커넥트 연결된 사람 → 프로젝트 권한 관리에서 직접 초대 (projectInvites 컬렉션)

### 채팅
- 한글 IME 중복 입력 버그 수정
- 파일 공유, 투표 기능
- 1:1 DM 채팅 (Firestore dmRooms)
- 채팅 입장 시 즉시 스크롤 (behavior: 'instant'), 새 메시지는 smooth
- 사이드바 채팅방 접힘/펼침 (프로젝트별)
- 백그라운드 채팅 토스트 (startAfter 기반)

### 게시판
- 카드형 디자인, 공지(리더만) vs 일반, 파일 첨부

### 캘린더
- 인라인 표시, 전체/팀별/나만보기 범위

### 할 일 (칸반)
- 3컬럼 드래그, 담당자·마감일·우선순위, 낙관적 업데이트 rollback

### 알림
- 사이드바 상단 고정 🔔 버튼, 슬라이드 패널
- 프로젝트별 뮤트/언뮤트
- FCM 푸시 알림 (포그라운드 + 백그라운드)

### 멤버/권한
- 역할 (리더/부리더/팀원), 채팅방 접근 권한, 리더 양도
- 나와의 채팅 (isDm, ownerId 기반) — 권한 관리에서 본인 방 제외
- 초대 권한: 리더/부리더만 가능

### 팀프 커넥트
- 같은 프로젝트 참여자 자동 추가, 프로필 모달, 1:1 대화 시작

### 프로필
- 편집 모달 (이름/소속/핸드폰/원라이너), Firestore 동기화
- **나의 여정**: 완료 프로젝트 / 받은 꽃다발 / 리더 프로젝트 수 / 완료한 할 일
- **공개된 프로젝트**: 역할 메모 함께 표시
- **프로젝트 관리**: 공개/비공개 토글, 역할 메모, 삭제/나가기 버튼
- 다크 모드 토글

### 사이드바 레이아웃
- 로고+아이콘 상단 고정
- 프로젝트/채팅 목록 (nav) 중간 스크롤
- 유저 정보+로그아웃+새 프로젝트 하단 고정

### 랩업 (프로젝트 마무리)
- active → collecting → archived 흐름
- 요약 통계, 회고, 피드백(꽃다발 태그)

### 디자인 시스템
- 메인: 보라 #534AB7, 보조: teal/amber/coral/rose
- 모든 색상 CSS 변수로 통일 (하드코딩 금지)
- 다크 모드 완전 지원

## 라우팅 (App.jsx)

```
/login                                    → LoginPage
/join/:code                               → JoinPage (로그인 없이 접근)
/ (PrivateRoute + Suspense)
  /home                                   → HomePage (lazy)
  /project/:projectId                     → ProjectPage (lazy, ?tab= 지원)
  /project/:projectId/chat/:roomId        → ChatPage (lazy)
  /project/:projectId/wrapup              → WrapupPage (lazy)
  /create                                 → CreateProjectPage (lazy)
  /profile                                → ProfilePage (lazy)
  /connect                                → ConnectPage (lazy)
  /match                                  → MatchPage (lazy)
  /help                                   → HelpPage (lazy)
```

## Custom Hooks (src/hooks/useProject.js)

```js
useProject(projectId)        // 프로젝트 객체 (메모이제이션)
useCanManage(projectId)      // 리더/부리더 여부
useMyRole(projectId)         // 내 역할 문자열
useVisibleRooms(projectId)   // 내가 볼 수 있는 채팅방 목록
useTodos(projectId)          // 할 일 목록
useEvents(projectId)         // 캘린더 이벤트 목록
```

## 핵심 Store 함수 (useStore.js)

- `login(name, email, uid, extra)` → currentUser 세팅
- `setProjects(firestoreProjects)` → Firestore 동기화
- `showError(message)` → 전역 에러 토스트 (4초 후 자동 사라짐)
- `createProject`, `archiveProject`, `extendProject`, `leaveOrDeleteProject`
- `joinProjectByCode`, `acceptInvite`, `declineInvite`, `sendProjectInvite`
- `sendMessage`, `sendFile`, `sendPoll`, `votePoll` (rollback 포함)
- `addTodo`, `updateTodo` (rollback 포함), `deleteTodo`
- `addEvent`, `removeEvent`, `addAnnouncement`
- `updateMemberRole`, `setMemberRooms`, `transferLeader`, `addMemberToProject`
- `endProject`, `addReflection`, `addFeedback`, `checkAndArchive`
- `togglePublic`, `updateMemberMemo`, `updateProfile`
- `addNotification`, `showError`, `dismissError`
- `setTheme`, `toggleTheme`

## 다음 우선순위

### 🔥 긴급 (베타 전)
- Vercel 환경변수에 VITE_FIREBASE_VAPID_KEY 등록 → FCM 배포 환경 활성화

### 🟠 중요 (1개월)
- N+1 쿼리 제거: endProject()에서 방 개수만큼 getDocs 반복 → collectionGroup 또는 Cloud Function
- useStore.js 도메인별 분리 (~1,250줄 → useProjectStore / useChatStore / useBoardStore)
- ProjectPage.jsx 컴포넌트 분할 (820줄)

### 🟡 앱 전환 전
- CSS Modules → CSS-in-JS (styled-components 또는 NativeWind)
- 웹 전용 API 추상화 (navigator.clipboard, localStorage 직접 접근)
- Monorepo 구조 (web + mobile 공유 로직)

### ❌ 개발 범위 외 (유저 담당)
- 마케팅 / 홍보
- 도메인 연결

### 🛠️ 알려진 기술 부채
- WrapupPage 통계: getDocs 루프 → 대용량 프로젝트에서 느릴 수 있음
- useStore.js 단일 파일 비대화 (~1,250줄)

## 작업 방향

- Claude는 **CTO 역할** — COO(유저) 제안 → 타당성 검토 후 구현 또는 대안 제시
- 개발과 서비스 고도화에만 집중 (마케팅, 도메인은 유저 담당)
- **보안**: Firestore 규칙 항상 최소 권한 원칙

## 작업 스타일

- 깃 푸시 명령어를 응답 끝에 항상 포함
- 한국어 인라인 주석
- CSS는 반드시 global.css CSS 변수 사용 (하드코딩 금지)
- 3개 이상 작업 시 TodoWrite로 진행 추적
- 기존 파일 수정은 Edit 툴, 신규 파일만 Write
