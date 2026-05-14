# Teamp 컨텍스트

**팀프** — 기한이 있는 팀 프로젝트를 시작~마무리까지 지원하는 협업 도구. 태그라인: **"기여와 관계의 기록"**

- **배포**: https://teamp.vercel.app (GitHub main push → Vercel 자동 배포)
- **스택**: React + Vite + CSS Modules + Zustand(persist) + React Router + Firebase(Auth/Firestore/FCM)
- **장기 비전**: 웹 → React Native 앱 (Zustand + Firebase 재사용 가능하도록 설계 중)
- **Firebase 관리 계정**: seobomin524@gmail.com / 프로젝트 ID: teamp-7923c

## 핵심 파일

```
src/
  App.jsx              라우터 + Firebase Auth 구독 + lazy import + checkBirthdays
  firebase.js          Firebase 설정 + offline persistence + FCM
  store/useStore.js    Zustand (~1,250줄, 전 도메인 통합)
  hooks/useProject.js  useProject/useCanManage/useMyRole/useTodos/useEvents/useVisibleRooms
  components/Layout.jsx  사이드바 레이아웃, id="page-content" on .content div
  pages/               LoginPage/HomePage/ProjectPage/ChatPage/WrapupPage/ProfilePage/...
public/
  sw.js / firebase-messaging-sw.js / manifest.json  (PWA + FCM)
```

## Firebase

- Auth: 이메일/비밀번호 + Google 로그인
- Firestore: asia-northeast3, offline persistence 활성화
- **레포 public** — 보안 경계는 Firestore 규칙
- FCM: VAPID 키 .env에 있음. **Vercel 환경변수 VITE_FIREBASE_VAPID_KEY 미등록** (배포 FCM 미활성)

### Firestore 컬렉션
`users` · `projects` · `rooms/{id}/messages` · `wrapups` · `dmRooms` · `notifications` · `projectInvites` · `birthdayLogs`

- 실시간 onSnapshot: projects · messages · dmRooms · notifications · projectInvites
- localStorage(Zustand persist): roomOrders · connects · theme · mutedProjects · hiddenProjects · dmUnreadCounts

### 보안 규칙 요약
- users: 인증된 모든 유저 읽기, 본인만 쓰기
- projects: memberIds 포함이거나 isPublic == true 읽기
- rooms/messages · dmRooms · wrapups: 인증된 유저
- notifications · projectInvites: targetUserId/inviteeId 본인만

## 아키텍처 비망록 (코드만 봐서는 모르는 것들)

- **DM 방 ID**: `room_dm_{projectId}_{userId}` 결정론적 생성 (중복 방지)
- **login()**: 다른 uid 로그인 시 projects/invites/notifications 등 자동 초기화
- **HomePage sticky 헤더**: `useLayoutEffect`로 `#page-content` padding-top을 0으로 설정 — `.content` overflow 컨테이너 최상단에 바로 붙이기 위함
- **낙관적 업데이트**: updateTodo / votePoll 실패 시 이전 상태 rollback
- **번들**: 모든 페이지 React.lazy(), firebase-core/db/msg/vendor 청크 분리 → 초기 번들 85KB

## 다음 우선순위

1. **긴급**: Vercel 환경변수 VITE_FIREBASE_VAPID_KEY 등록
2. **중요**: endProject() N+1 쿼리 제거 (방 개수만큼 getDocs → collectionGroup)
3. **리팩터**: useStore.js 도메인별 분리 (1,250줄), ProjectPage.jsx 분할 (820줄)

## 작업 방식

- Claude는 CTO, 유저는 COO — 제안 타당성 검토 후 구현 또는 대안 제시
- 코드 변경 후 항상 git add/commit/push 포함
- 인라인 주석은 한국어, CSS는 global.css 변수만 사용 (하드코딩 금지)
- 파일 수정은 Edit 툴, 신규만 Write
- 3개+ 작업은 TodoWrite로 추적
