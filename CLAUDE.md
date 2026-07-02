# Teamp

기한이 있는 팀 프로젝트를 시작~마무리까지 지원하는 협업 플랫폼.
태그라인: **"기여와 관계의 기록"**

## 서비스 철학
"함께 해낸 것은 사라지지 않아야 한다" — 평가하지 말고 기록하게 만들어라.
점수 없음 · 순위 없음 · 데이터와 따뜻한 언어로만.

## 타겟
기한이 있고 다수가 함께하는 모든 프로젝트 (공모전·캡스톤·사이드 프로젝트·사내 TF·동아리 행사).
카톡 대체가 목표가 아니라, 단톡방이 불편한 순간을 정확히 파고드는 것.

## BM (예정)
1. 실물 꽃다발 배송 — 랩업 후 팀원에게 실제 꽃
2. 짜장면 쏘기 — 배달 앱 연동, 식사 상품권
3. 랩업 포스터 인쇄 배송
4. 팀프 매치 프리미엄 — 지원자 상세 열람·우선 노출
5. 기관/학교 단위 구독 (B2B)
6. AI 팀원 에이전트 (유료) — 부족 역량 파악 후 맞는 역할의 AI 팀원 추가

## 장기 로드맵
웹 베타 → 사용자 검증 → React Native 앱 → 앱스토어 출시.
> RN 전환 시 Zustand + Firebase 레이어 재사용 가능하도록 설계 유지. B2B 대비 멀티 테넌시 고려. AI 에이전트는 별도 백엔드+LLM 연동 시점에 설계.
> 앱스토어 착수는 유저가 "시작하자" 신호 줄 때까지 금지.

---

## 스택
React 18 + Vite + CSS Modules + Zustand(persist) + React Router + Firebase(Auth/Firestore/Storage/FCM). UI 한국어, 존댓말 톤.

```
src/
  App.jsx                 라우터 셸(107줄) — PrivateRoute + lazy import만
  app/                    useSession(인증+실시간 구독 수명주기) · useChatToastWatchers(백그라운드 토스트)
  services/               페이지 밖 Firebase 로직 — users(프로필·공개프로젝트 조회)·birthdays. RN 재사용 경계
  analytics.js            GA4 track()/initAnalytics — 전부 no-op 폴백(계측이 앱 못 깨뜨림)
  firebase.js             Firebase 설정 + offline persistence + FCM
  store/
    useStore.js           Zustand create(persist) — 8개 슬라이스 조합. 공유 셀렉터(countOwnedProjects 등)
    helpers.js            txProject·getWeekKey·ROOM_COLORS·makeDmRoomId 등 공유 로직
    slices/               auth·project·task·chat·invite·wrapup·notification·ui
  components/Layout.jsx    사이드바 + 하단 탭바, ConfirmDialog/ChatToast/ErrorToast 마운트
  components/chat/        PollMessage·ProfilePopup (ChatPage에서 추출)
  constants.js            ROLE_LABEL·MS_STATUS·FLOWER_TAGS·커버 프리셋 (공유 상수)
  pages/                  Login·Home·Project·Chat·Wrapup·Profile·PublicProfile·Match·Connect·Messages·Calendar·Help·Landing
  pages/project/          BoardTab·GuideTab·ManageTab·MembersTab·MilestonesTab·RoomsTab
public/  sw.js · firebase-messaging-sw.js · manifest.json · icons/ · splash/
```
- **스토어 구독 규약**: `useStore()` 비선택자 호출 금지 — 항상 `useStore(useShallow((s) => ({...})))` 또는 단일 셀렉터(전체 구독=아무 값 변경에도 리렌더).
- **의미색 규약**: teal=성공/완료 · amber=진행/마감임박 · coral=위험/파괴적 (global.css 주석 참조).

## Firebase
- 프로젝트 ID: `teamp-7923c` (관리 계정은 Firebase 콘솔/메모리 참조 — 문서에 미기재)
- **Auth**: 이메일·비밀번호 + Google
- **Firestore**: asia-northeast3, offline persistence(persistentLocalCache) 활성화
- **Storage**: Blaze, storage.rules (파일 타입·용량 제한)
- **FCM**: VAPID 키 `.env` `VITE_FIREBASE_VAPID_KEY`
- **컬렉션**: `users` · `projects` · `rooms/{id}/messages` · `wrapups` · `dmRooms` · `notifications` · `projectInvites` · `matchPosts` · `birthdayLogs`
- **onSnapshot 실시간**: projects · messages · dmRooms · notifications · projectInvites · matchPosts
- **persist(localStorage)**: roomOrders · dmRooms · connects · notifications · invites · theme · mutedProjects · hiddenProjects · dmUnreadCounts · pinnedId
- **보안 규칙**(`firestore.rules`이 진짜 권한 경계, 클라 체크는 UX용): users 읽기=인증 유저·쓰기=본인(create/update 분리, plan 자가 승급·isAdmin 변경 차단) / projects 읽기=memberIds 포함 or isPublic / rooms·dmRooms·wrapups=인증 유저 / notifications·projectInvites=본인만 / reports=create는 reporterId 본인 검증, 읽기는 어드민

## 빌드 / 배포 — ⚠️ 함정
- **배포는 Vercel + Firebase Hosting 둘 다 사용.**
  - **Vercel(메인)**: git push → `vercel.json`의 `npm run build:ci`를 Vercel이 자기 서버에서 빌드·배포. 커밋된 `dist/`는 안 쓰임(gitignore).
  - **Firebase Hosting**: teamp-7923c.web.app. (현재 `firebase.json`엔 rules만 있고 hosting 블록 없음 — hosting 배포는 별도.)
- **Firestore/Storage 규칙 배포**:
  `npx --cache /tmp/npm-cache firebase-tools deploy --only firestore:rules --project teamp-7923c`
  (로컬 npm 캐시 권한 오류 회피용 `--cache`).
- **`scripts/gen-sw.mjs`는 빌드 필수** — FCM용 `firebase-messaging-sw.js`를 env에서 생성. 빌드에서 빼지 말 것.
- **아이콘/스플래시는 손으로 교체하는 정적 파일**(`public/icons`·`public/splash`). 과거 `gen-assets.mjs`가 빌드마다 덮어써 제거함 — **다시 추가 금지**(커스텀 이미지 날아감).

## 테스트 — 푸시 전 `npm test`
- **`npm test`** — vitest 순수 로직(닉네임 형식·진행률 등). Java 불필요, 즉시. **푸시 전 돌릴 것.**
- **`npm run test:rules`** — Firestore 보안 규칙(에뮬레이터). 로컬은 **Java 21+** 필요(`brew install openjdk` → `PATH=/opt/homebrew/opt/openjdk/bin:$PATH`). `--project demo-teamp` 필수.
- **CI**(`.github/workflows/test.yml`): push/PR마다 둘 다 자동(node 24, java 21). 함정·CI 로그 읽는 법은 메모리 `project_test_infra` 참조.

## 모바일 / PWA — 실제 겪은 회귀
- 높이 `100dvh`, 하단 `env(safe-area-inset-bottom)`. `100vh` 금지.
- **⚠️ iOS 설치형 PWA에서 `position: fixed` 신뢰 금지** — 채팅이 상하로 잘리고 탭바가 바닥까지 안 닿던 근본 원인. 해결: `.shell`(`height: var(--app-height,100dvh)`) → `.main`(flex 컬럼) 안에서 **flex로 채움**. 탭바=flex-shrink:0 맨 아래, 채팅=`.contentChat`(flex) 안 `.page`(flex:1). 상태바/홈인디케이터는 헤더/입력창의 safe-area 패딩으로 비킨다.
- 키보드: ChatPage가 `visualViewport.height`로 `--app-height` 축소 → 입력창이 키보드 위로. `--kb-safe=0`으로 입력창 하단 패딩 collapse.
- 하단 탭바 항상 표시 — 채팅 페이지만 숨김(`isChatPage` → 탭바·모바일헤더 숨기고 `.contentChat`). fixed 토스트류는 `bottom: calc(60px + env(safe-area-inset-bottom))` 위로.
- **`interactive-widget=resizes-content` viewport 옵션 금지** — iOS 키보드 닫힐 때 탭바 아래 흰 공백 회귀로 되돌린 전례.
- 모바일 input `font-size: 16px`(iOS 줌 방지), 터치 타깃 ≥ 44×44px.
- iOS 홈화면 설치 아이콘/스플래시는 설치 시점에 OS가 구움 — 변경해도 기존 설치 유저는 재설치 전까지 안 바뀜(정상).

## 아키텍처 비망록 (코드만 봐선 모르는 것)
- **DM 방 ID**: `room_dm_{projectId}_{userId}` 결정론적 생성(중복 방지)
- **login()**: 다른 uid 로그인 시 projects/invites/notifications 자동 초기화
- **낙관적 업데이트**: updateTodo·votePoll·leaveOrDeleteProject 실패 시 rollback
- **번들**: 페이지 React.lazy(), firebase-core/db/msg/vendor 청크 분리
- **꽃다발(flowerTagSummary)**: 피드백 트랜잭션에서 users 문서에 캐싱 → PublicProfilePage가 프라이버시 우회 없이 읽음
- **프로젝트 한도**: 무료 3개. `countOwnedProjects`(useStore)가 리더이고 `!isTutorial`인 것만 카운트. 튜토리얼 제외.
- **게시판 댓글**: `announcement.comments[].replies[]` 구조로 project 문서 내 저장
- **ConfirmDialog**: Promise 기반 `showConfirm(msg)` — window.confirm 대체
- **한글 IME 이중 제출**: onKeyDown에 `e.nativeEvent.isComposing` 체크 필수

## 작업 방식
- Claude = CTO, 유저 = COO — 제안 타당성 검토 후 구현 또는 대안 제시
- **git push는 유저가 요청할 때만** (예: "푸시까지 해줘"). 평소엔 add/commit까지. 인라인 주석·커밋 메시지는 한국어.
- 파일 수정은 Edit(diff), 신규만 Write. CSS는 global.css 변수만 (하드코딩 금지).
- 명확한 작업 목록이면 질문 없이 바로 구현.
- **"다 됐다" 전에 검증**: 변경이 닿는 surface(전체 클릭 영역 / 즉시 state 갱신 / 모바일·webview)를 실제로 확인하고 어떻게 검증했는지 한 줄 보고.
- CSS/viewport 변경은 해당 컴포넌트로 **좁게** 스코프, 영향 가능 영역(탭바·레이아웃) 먼저 짚기.
- 중복 정의 금지 — 공유값은 `src/constants.js`, 공유 로직은 `src/store/helpers.js`.
