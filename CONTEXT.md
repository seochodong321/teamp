# Teamp 컨텍스트

**팀프** — 기한이 있는 팀 프로젝트를 시작~마무리까지 지원하는 협업 플랫폼.
태그라인: **"기여와 관계의 기록"**

---

## 서비스 철학

"함께 해낸 것은 사라지지 않아야 한다"
평가하지 말고, 기록하게 만들어라.
점수 없음 · 순위 없음 · 데이터와 따뜻한 언어로만.

## 타겟

기한이 있고 다수가 함께하는 모든 프로젝트.
공모전 · 캡스톤 · 사이드 프로젝트 · 사내 TF · 동아리 행사.
카톡 대체가 목표가 아니라, 단톡방이 불편한 순간을 정확히 파고드는 것.

## BM (예정)

1. 실물 꽃다발 배송 — 랩업 후 팀원에게 실제 꽃 보내기
2. 짜장면 쏘기 — 배달 앱 연동, 식사 상품권
3. 랩업 포스터 인쇄 배송 — 실물 기념품
4. 팀프 매치 프리미엄 — 지원자 상세 열람, 우선 노출
5. 기관/학교 단위 구독 (B2B)
6. AI 팀원 에이전트 (유료) — 팀에 부족한 역량 파악 후 맞는 역할의 AI 팀원 추가, 능동적으로 팀 관리

## 장기 로드맵

웹 베타 → 사용자 검증 → React Native 앱 → 앱스토어 출시

> React Native 전환 시 Zustand + Firebase 레이어는 그대로 재사용 가능하도록 설계 유지.
> B2B(기관/학교 구독) 대비해 멀티 테넌시 구조 고려 필요.
> AI 에이전트 BM은 별도 백엔드(함수) + LLM API 연동이 필요한 시점에 설계.

---

- **배포**: Firebase Hosting — https://teamp-7923c.web.app
- **Firebase 프로젝트 ID**: teamp-7923c / **관리 계정**: seobomin524@gmail.com
- **스택**: React 18 + Vite + CSS Modules + Zustand(persist) + React Router + Firebase(Auth/Firestore/Storage/FCM)
- **장기 비전**: 앱스토어 출시 준비 중 (유저가 "시작하자" 신호 줄 때까지 착수 금지)

---

## 핵심 파일

```
src/
  App.jsx                   라우터 + Firebase Auth 구독 + lazy import
  firebase.js               Firebase 설정 + offline persistence + FCM
  store/
    useStore.js             Zustand create(persist(...)) — 8개 슬라이스 조합
    slices/
      authSlice.js          로그인·프로필·커넥트·차단·서브프로필
      projectSlice.js       프로젝트 CRUD·멤버·역할·마감·커버
      taskSlice.js          공지·투두·이벤트·마일스톤·댓글
      chatSlice.js          채팅방 메시지·파일·투표·DM
      inviteSlice.js        초대 링크·참여
      wrapupSlice.js        랩업·피드백·회고·주간목표
      notificationSlice.js  인앱 알림
      uiSlice.js            테마·토스트·ConfirmDialog
  components/Layout.jsx     사이드바 + 탭바, ConfirmDialog/ChatToast/ErrorToast 마운트
  pages/                    LoginPage·HomePage·ProjectPage·ChatPage·WrapupPage·
                            ProfilePage·PublicProfilePage·MatchPage·ConnectPage·
                            MessagesPage·CalendarPage·HelpPage·LandingPage
  pages/project/            BoardTab·GuideTab·ManageTab·MembersTab·MilestonesTab·RoomsTab
public/
  sw.js / firebase-messaging-sw.js / manifest.json   PWA + FCM
```

---

## Firebase

- **Auth**: 이메일/비밀번호 + Google 로그인
- **Firestore**: asia-northeast3, offline persistence 활성화
- **Storage**: Blaze 요금제, storage.rules 적용 (파일 타입·용량 제한)
- **FCM**: VAPID 키 .env `VITE_FIREBASE_VAPID_KEY`에 있음

### Firestore 컬렉션
`users` · `projects` · `rooms/{id}/messages` · `wrapups` · `dmRooms` ·
`notifications` · `projectInvites` · `matchPosts` · `birthdayLogs`

- **실시간 onSnapshot**: projects · messages · dmRooms · notifications · projectInvites · matchPosts
- **Zustand persist(localStorage)**: roomOrders · dmRooms · connects · notifications · invites · theme · mutedProjects · hiddenProjects · dmUnreadCounts · pinnedId

### 보안 규칙 요약
- users: 인증된 모든 유저 읽기, 본인만 쓰기
- projects: memberIds 포함이거나 isPublic == true 읽기
- rooms/messages · dmRooms · wrapups: 인증된 유저
- notifications · projectInvites: targetUserId/inviteeId 본인만

---

## 아키텍처 비망록 (코드만 봐서는 모르는 것들)

- **DM 방 ID**: `room_dm_{projectId}_{userId}` 결정론적 생성 (중복 방지)
- **login()**: 다른 uid 로그인 시 projects/invites/notifications 등 자동 초기화
- **낙관적 업데이트**: updateTodo · votePoll 실패 시 이전 상태 rollback
- **번들**: 모든 페이지 React.lazy(), firebase-core/db/msg/vendor 청크 분리
- **꽃다발(flowerTagSummary)**: ProfilePage에서 집계 후 users 문서에 캐싱 → PublicProfilePage가 프라이버시 우회 없이 읽음
- **게시판 댓글**: `announcement.comments[].replies[]` 구조로 project 문서 내 저장
- **ConfirmDialog**: Promise 기반 `showConfirm(msg)` — window.confirm 대체
- **한글 IME 이중 제출**: onKeyDown에 `e.nativeEvent.isComposing` 체크 필수

---

## 작업 방식

- Claude = CTO, 유저 = COO — 제안 타당성 검토 후 구현 또는 대안 제시
- **git push는 절대 하지 않음** — add/commit까지만, push는 유저가 직접
- 인라인 주석은 한국어, CSS는 global.css 변수만 사용 (하드코딩 금지)
- 파일 수정은 Edit 툴(diff), 신규만 Write
- 명확한 작업 목록이면 질문 없이 바로 구현
