# Teamp 기술 진단 리포트 (CTO Review)

> 작성: 2026-06-12 · 기준: `main` @ `216aa40` · 방법: 전체 코드 실측(라인 수·쿼리 패턴·규칙 grep) + 보안 규칙 에뮬레이터 검증
> 규모: src 15,688줄(JS/JSX) + CSS 10,946줄 · Cloud Functions 3개 · 테스트 17개(CI 그린)

---

## 0. 요약 (한 단락)

Teamp는 **MVP로서 평균 이상**이다 — 서버 경계(보안 규칙)가 실제로 권한을 강제하고, 트랜잭션·낙관적 업데이트·테스트 그물·CI까지 갖췄다. 그러나 구조의 중심에 **"프로젝트 문서 하나에 전부 박는" 데이터 모델**(todos·공지·댓글·일정·멤버·방 메타가 한 문서)과 **"비즈니스 로직이 전부 클라이언트에 있는" 아키텍처**가 있다. 이 둘은 지금은 작동하지만, **유료화(과금 강제)와 두 번째 클라이언트(앱)** 시점에 각각 정면으로 부딪힌다. 그리고 진단 중 **현재 프로덕션에서 깨져 있을 가능성이 높은 P0 버그 1건**(피드백 제출 거부)을 에뮬레이터로 확정했다.

---

## 1. 현재 아키텍처 구조

```
[React 18 + Vite SPA]
  App.jsx ── Firebase Auth 구독 + 5개 컬렉션 onSnapshot 통구독
  │            (projects·matchPosts·notifications·projectInvites·dmRooms)
  Zustand(persist) ── 8개 슬라이스 = 사실상 전체 비즈니스 로직 레이어
  │            (auth·project·task·chat·invite·wrapup·notification·ui)
  └─ Firestore(asia-northeast3) + Storage + FCM
[Cloud Functions 3개] 푸시 발송 2 + 어드민 유저 삭제 1 — 그 외 서버 로직 없음
[배포] Vercel(메인) + Firebase Hosting / 규칙·함수는 prod 직배포 (스테이징 없음)
```

**평가:**
- ✅ 구조 자체는 일관적이고 추적 가능. 공유 로직(`helpers.js`)·공유 상수(`constants.js`) 분리, 페이지 lazy 청크 분리 등 규율 있음.
- ✅ 보안 경계를 클라이언트가 아닌 **firestore.rules**에 둔다는 원칙이 서 있고, 이번에 규칙 테스트 8개 + CI로 고정됨.
- ⚠️ **"서버"가 사실상 없다.** 검증·집계·정합성 유지 로직이 전부 클라이언트 슬라이스에 있다. Firestore 규칙은 *접근 제어*는 하지만 *비즈니스 불변식*(프로젝트 개수 한도, 피드백 집계, 자동 종료)은 못 지킨다. 클라이언트가 곧 서버인 구조 — 1개 클라이언트(웹)일 때만 성립한다.
- ⚠️ 페이지 컴포넌트 비대화: ProfilePage 957줄, AdminPage 913줄, MatchPage 864줄. 기능 추가 속도가 점점 느려지는 단계에 진입.

---

## 2. 확장성 문제

| # | 문제 | 근거 | 터지는 시점 |
|---|------|------|------------|
| S1 | **matchPosts 배지용 통구독** — 배지 숫자 하나를 위해 모든 유저가 *모든 open 모집글 문서 전체*를 실시간 다운로드 | `App.jsx:209-212` `onSnapshot(where status==open)` → `snap.size` | 유저 수 × 모집글 수에 비례해 읽기 폭증. 1,000명·글 200개면 상시 20만 문서 구독 |
| S2 | **프로젝트 문서 1개 = 팀 전체의 실시간 채널** — todo 하나 체크해도 멤버 전원에게 *문서 전체*(공지+댓글+일정+멤버) 재전송 | `txProject`(helpers.js:123) + `App.jsx:216` 통구독 | 활동 많은 10인 팀에서 즉시 체감(전송량·렌더) |
| S3 | **Firestore 문서 1MiB 한도** — 한 학기짜리 프로젝트의 todos+announcements(댓글·대댓글 포함)+events가 전부 한 문서 | `projectSlice.js:173` `rooms, announcements:[], todos:[]` | 공지/댓글 활발한 장기 프로젝트에서 도달 가능. 도달하면 **그 프로젝트는 모든 쓰기 실패** |
| S4 | **문서당 지속 쓰기 ~1회/초 한계 + txProject 경합** — 팀원 여럿이 동시에 todo 체크/투표하면 트랜잭션 재시도 급증 | 모든 변경이 같은 문서로 수렴 | 10인 팀 동시 사용 시 |
| S5 | **클라이언트가 서버 잡 수행** — 피드백 마감 자동 종료를 *모든 멤버의 브라우저가 각자* 시도(레이스) | `App.jsx` 스냅샷 핸들러 안 `updateDoc(status:'archived')` | 지금도 중복 쓰기 발생 중(멱등이라 티 안 날 뿐) |
| S6 | 어드민 유저 목록 `limit(300)` 고정 | `AdminPage.jsx:533` | 유저 300명 초과 시 어드민이 유저를 못 찾음 |

채팅은 `limitToLast(100)`(ChatPage.jsx:160)으로 잘 끊었다. 다만 **과거 메시지 로드(페이지네이션)가 없어** 100개 이전 대화는 영구히 안 보인다 — 확장성 문제라기보다 기능 공백.

---

## 3. Firebase 사용 방식의 문제

### 3-1. 보안 규칙 — 잘한 것과 구멍

✅ 잘한 것: users 자가승급 차단·plan 자가변경 제한·usernames 선점·reports/adminLogs 어드민 전용 — 모두 규칙으로 강제 + 테스트로 고정.

구멍 (심각도 순):

| # | 구멍 | 근거 | 영향 |
|---|------|------|------|
| F1 | **rooms 메시지 = 인증만 하면 전부 읽기/쓰기** (`allow read, write: if request.auth != null`). 주석은 "방 ID는 UUID라 추측 불가"라지만 **DM 방 ID는 결정론적**(`room_dm_{projectId}_{userId}`), 튜토리얼 방도(`tut_dm_{uid}`) 결정론적. projectId는 매치 글·공개 프로젝트로 노출됨 | `firestore.rules:83-85` + `chatSlice.js` DM ID 규약 | 가입자 누구나 남의 프로젝트 채팅·**1:1 DM을 읽고, 위조 메시지 삽입** 가능. 보안이 아니라 obscurity |
| F2 | **wrapups 전체 읽기 허용** — 피드백 원문(누가 누구에게 뭐라고 썼는지)이 모든 가입자에게 열림. flowerTagSummary 캐싱으로 "프라이버시 우회 없이 읽게" 한 설계 의도와 모순 | `firestore.rules:173-179` | 따뜻한 언어로 쓴 비공개 피드백이 사실상 공개 데이터 |
| F3 | **notifications 생성 = 인증 유저 전부** — 아무나 임의 유저에게 알림 문서 생성 가능하고, `pushOnNotification` 함수가 그걸 **그대로 푸시로 발송** | `firestore.rules:113` + `functions/index.js:65` | 스팸·피싱 푸시 벡터 (가입만 하면 전 유저에게 푸시 발사 가능) |
| F4 | **users 전체 읽기** — 이메일 등 PII가 모든 가입자에게 노출. UI는 @username만 보여주지만 데이터는 열려 있음 | `firestore.rules:26` | 크롤링하면 전체 회원 이메일 수집 가능 |
| F5 | projects update가 **필드 구분 없이 멤버 전원 허용** — 멤버가 leaderId·memberIds·endDate를 임의 조작 가능 | `firestore.rules:72-73` | 내부자 장난/실수에 무방비 (멤버는 준신뢰라 우선순위는 낮음) |

### 3-2. 운영 방식

- **스테이징 없음** — 규칙·함수를 prod에 직배포. 규칙 한 줄 실수 = 전 유저 장애. (이번 P0가 정확히 이 패턴의 산물)
- **에러 모니터링 없음** — Sentry류 부재. 클라이언트 `catch(() => {})` 패턴이 많아 **실패가 조용히 삼켜진다**. P0 버그가 지금까지 안 보였다면 바로 이 때문일 가능성.
- functions 패키지 구버전(firebase-functions v6, v7 존재) — 유저가 "나중에" 결정한 사항, 유지.

---

## 4. 데이터 모델 문제

### 4-1. 🔴 P0 — 피드백 제출이 현재 규칙에서 거부됨 (에뮬레이터로 확정)

`wrapupSlice.js:201-209`의 `addFeedback` 트랜잭션은 **wrapup 문서 + 받는 사람(타인)의 users 문서**(flowerTagSummary increment, flowerSenderUids arrayUnion)를 한 트랜잭션으로 쓴다. 그런데 현재 users 규칙은 타인 문서 쓰기를 **어드민에게만** 허용한다 → 트랜잭션 전체가 `permission-denied`.

**검증:** 에뮬레이터에서 일반 유저로 타인 users에 동일 페이로드 쓰기 → **DENIED 확정** (2026-06-12, 일회성 규칙 테스트).

**의미: 일반 유저의 꽃다발 피드백 제출이 통째로 실패하고 있을 가능성이 높다.** (어드민 계정 테스트에선 통과해서 안 보였을 것.) 구조적 원인은 "보내는 사람이 받는 사람 문서에 쓴다"는 설계 — 이건 규칙을 여는 게 아니라 **Cloud Function(트리거)으로 집계를 옮기는 게** 정석이다. 규칙을 열면 아무나 남의 꽃다발 수를 조작할 수 있게 된다.

### 4-2. 모놀리식 프로젝트 문서

위 S2~S4와 동일 뿌리. 정석은 todos·announcements(댓글 포함)·events를 **서브컬렉션으로 분리**하고 문서엔 메타만 남기는 것. 단, 이건 마이그레이션 비용이 커서 시점 선택이 중요하다(아래 로드맵 참조). **앱(두 번째 클라이언트) 만들기 전에 하는 게 총비용이 가장 싸다** — 클라이언트가 둘이 된 후의 스키마 변경은 양쪽 동시 마이그레이션이다.

### 4-3. 스냅샷 비정규화의 일관성 문제

`projects.members[]`에 가입 시점의 name·affiliation·email을 복사해 두는 구조라, 프로필 변경이 기존 프로젝트에 반영되지 않는다(이미 인지된 이슈 — 프로필 일관성 플랜 존재). 비정규화 자체는 Firestore 정석이지만, **동기화 책임자가 없다**(클라이언트 batch 동기화는 그 유저가 접속해야만 돈다). 장기적으로 users 변경 → 프로젝트 멤버 스냅샷 갱신은 Cloud Function 트리거 소관.

### 4-4. 날짜가 UTC 기준 — KST 아침의 하루 오차

`todayStr()`·`getWeekKey()`가 `toISOString()`(UTC) 기반(helpers.js:114-121). **KST 00:00~08:59에는 "오늘"이 어제로 계산된다.** 마감일 비교(`calcProgress`, D-day), 주간 목표 키가 아침마다 하루 어긋난다. 한국 타깃 서비스에서 아침 사용이 많은 만큼 실사용 버그. (`getWeekKey`는 같은 월요일 아침/오후에 서로 다른 주 키를 만들 수도 있다.)

### 4-5. 기타

- `dmRooms`에 delete 규칙 부재(이미 메모리에 기록된 gotcha) — 양쪽 다 나간 방 정리는 update로 우회 중.
- localStorage persist에 notifications·invites·dmRooms 캐싱 — 다른 uid 로그인 시 초기화 로직이 있어 수용 가능.

---

## 5. 향후 Flutter 앱 개발 시 문제가 될 부분

> ⚠️ **먼저 결정할 것:** 로드맵 문서(CLAUDE.md)는 **React Native**("Zustand + Firebase 레이어 재사용 가능하도록 설계 유지")인데, 이 질문은 **Flutter**다. 이 차이는 사소하지 않다:

| | React Native | Flutter |
|---|---|---|
| Zustand 슬라이스(비즈니스 로직 ~2,000줄) | **재사용 가능** | ❌ **전부 Dart 재작성** |
| helpers.js (claimUsername·deleteProjectDeep·notifyUser·txProject) | 재사용 가능 | ❌ Dart 재작성 |
| 재작성 범위 | UI 레이어만 | UI + 상태 + 비즈니스 로직 전부 |

**Flutter를 택한다면, 지금 아키텍처의 진짜 문제가 드러난다:**

1. **비즈니스 로직이 클라이언트에 있으므로 두 벌이 된다.** 닉네임 선점 트랜잭션, DM clearedAt 워터마크, formerMembers 보존, deleteProjectDeep, 낙관적 업데이트+rollback — 이걸 Dart로 한 번 더 짜고, **이후 모든 수정을 두 코드베이스에 동시 반영**해야 한다. 웹과 앱이 같은 Firestore 문서를 서로 다른 로직으로 쓰면 데이터가 갈라진다. → **해법: 앱 착수 전에 불변식이 걸린 쓰기(피드백 집계·프로젝트 삭제·닉네임 변경·멤버 추방)를 Cloud Functions(onCall)로 올려 "API화"**하라. 그러면 클라이언트는 얇아지고 두 벌 유지 비용이 급감한다.
2. **모놀리식 프로젝트 문서**는 모바일에서 더 아프다 — 셀룰러에서 todo 하나 바뀔 때마다 문서 전체 수신.
3. **FCM**: 웹 VAPID 토큰과 iOS APNs는 별개 체계. `users.fcmToken`이 **단일 필드**라 기기 여러 대(웹+폰)면 마지막 기기만 푸시를 받는다 → `fcmTokens` 배열/맵으로 바꿔야 함(앱 전에 필수).
4. **결정론적 방 ID 보안 구멍(F1)**은 앱 출시 전 반드시 봉합 — 앱스토어 심사·실유저 확대 전 마지노선.
5. PWA 전용 자산(sw.js·visualViewport 키보드 핸들링)은 자연히 버려지는 비용 — 문제 아님, 인지만.

**권고:** 앱 전환의 선행 조건은 프레임워크 선택이 아니라 **"로직의 서버 이전"**이다. 그게 되면 RN이든 Flutter든 클라이언트는 뷰 레이어 선택의 문제로 줄어든다. (참고: 기존 로드맵대로 RN이면 재작성 비용이 구조적으로 작다. Flutter로 바꿀 거면 그 이유가 '팀 역량/생태계'처럼 분명해야 한다.)

---

## 6. 향후 유료화 시 문제가 될 부분

| # | 문제 | 근거 | 결과 |
|---|------|------|------|
| M1 | **플랜 한도가 100% 클라이언트 강제** — 무료 3개 제한이 `CreateProjectModal`의 if문뿐. 규칙엔 프로젝트 생성 개수 제한이 없음 | `CreateProjectModal.jsx:59-61`, `firestore.rules:70-71` | 콘솔 한 줄(`addDoc`)로 무제한 생성. **돈 받는 순간 이건 "버그"가 아니라 "과금 우회"가 된다** |
| M2 | **student 플랜 자가 변경 허용 + student가 유료 혜택 보유** — 규칙이 본인 plan→'student' 변경을 허용하는데(`firestore.rules:36-37`), `isPaidPlan`에 'student'가 포함됨(`CreateProjectModal.jsx:60`) | 두 파일 교차 확인 | **누구나 셀프로 student 전환 → 무제한 프로젝트.** 학생 인증 절차가 없다면 유료화 즉시 구멍 |
| M3 | **결제 웹훅 받을 서버가 없음** — 토스페이먼츠(예정)는 승인/취소/만료 웹훅이 서버 필수. plan 변경은 웹훅→Functions→users.plan이어야 하며, 클라이언트가 plan을 쓰는 경로는 전부 닫아야 함 | functions에 onRequest 엔드포인트 0개 | 결제 도입 = Functions 작업이 선행 |
| M4 | **팀 인원 수 제한(BM 핵심 예정)도 강제 지점이 없음** — members 추가는 멤버 누구나 가능한 projects update | `firestore.rules:72` | 인원 제한 과금을 만들려면 멤버 추가를 onCall 함수로 옮기거나 규칙에 size 제한 |
| M5 | **수익 이벤트 추적 수단 없음** — 분석(GA/Mixpanel)·에러 추적 모두 부재 | grep 확인 | 전환율·결제 실패를 볼 눈이 없음 |

**원칙: 과금과 연결된 모든 한도는 "규칙 또는 함수"가 강제해야 한다.** 클라이언트 체크는 UX용 안내문일 뿐이다 — 이건 이미 보안에서 적용한 원칙이고, 과금에 똑같이 적용하면 된다.

---

## 7. 기술 부채 우선순위 (종합 랭킹)

| 순위 | 항목 | 분류 | 비용 | 리스크 방치 시 |
|---|---|---|---|---|
| 1 | 피드백 제출 거부(P0) — 집계를 Function으로 | 버그 | 중 | 핵심 기능("기여와 관계의 기록") 자체가 불능 |
| 2 | rooms 규칙 + 결정론적 DM ID (F1) | 보안 | 중 | DM 열람·위조 — 신뢰 상품에 치명타 |
| 3 | 에러 모니터링 부재 | 운영 | 소 | P0류가 또 생겨도 모름 (이번이 증거) |
| 4 | notifications 스팸 벡터(F3) | 보안 | 소 | 푸시 스팸 한 번이면 유저 신뢰 끝 |
| 5 | wrapups 전체 읽기(F2) | 프라이버시 | 소 | 서비스 철학과 정면 모순 |
| 6 | 플랜 강제 서버 이전(M1·M2·M4) | 수익 | 중 | 유료화 첫날부터 우회 가능 |
| 7 | KST 날짜 오차(todayStr/getWeekKey) | 버그 | 소 | 아침마다 D-day·주간목표 하루 어긋남 |
| 8 | matchPosts 배지 통구독(S1) → count() 집계 | 비용 | 소 | 유저 증가 시 읽기 비용 폭증 |
| 9 | 모놀리식 프로젝트 문서 분해(S2~S4) | 구조 | **대** | 장기 프로젝트 1MiB 도달 시 그 팀 전체 쓰기 불능 |
| 10 | 쓰기 로직 onCall API화 (앱 선행 조건) | 구조 | 대 | 앱 착수 시 로직 2벌 유지 |
| 11 | users PII 노출(F4)·projects 필드 무제한 update(F5) | 보안 | 중 | 크롤링·내부자 조작 |
| 12 | 거대 페이지 분해(Profile/Admin/Match 900줄대) | 품질 | 중 | 개발 속도 저하 |
| 13 | fcmToken 단일 → 다중 기기 | 기능 | 소 | 앱 나오면 웹/앱 푸시 중 하나 유실 |
| 14 | 어드민 limit(300)·채팅 과거 로드 | 기능 | 소 | 규모 도달 시 불편 |

---

# 실행 로드맵

## 🔴 지금 당장 (이번 주)

1. **피드백 P0 수습** — `addFeedback`의 타인 users 쓰기를 트랜잭션에서 분리하고, `onDocumentWritten(wrapups/{id})` 트리거(또는 onCall)로 flowerTagSummary·flowerSenderUids 집계를 서버에서 수행. *규칙을 여는 방식은 금지*(꽃다발 수 조작 가능해짐). 배포 후 일반 계정으로 피드백 제출 실측.
2. **실유저로 피드백 기능 동작 여부 즉시 확인** — 이미 받은 피드백 데이터가 있는지/유실됐는지 파악(있다면 트랜잭션 전체 실패라 wrapup 피드백도 함께 유실됐을 것).
3. **rooms 규칙 봉합(F1)** — 최소 수정: 메시지 read/write에 `roomId`→프로젝트 membership 또는 dmRooms participants 검증을 넣거나, 방 문서에 memberIds를 두고 검증. DM ID 결정론은 유지해도 규칙이 막으면 안전.
4. **notifications 생성 제한(F3)** — 최소한 `request.resource.data.fromUserId == request.auth.uid` 강제 + 푸시 함수에서 발신자 검증. (완전한 해법은 알림 생성 자체의 Function 이전 — 출시 직전 항목과 병합 가능)
5. **에러 모니터링 부착** — Sentry 무료 플랜이면 충분. `catch(() => {})` 중 사용자 영향 큰 곳(피드백·프로젝트 생성·채팅 전송)에 최소한 토스트+리포팅. *이게 있었으면 P0를 코드 리뷰가 아니라 대시보드가 알려줬다.*

## 🟡 출시 직전 (실유저 받기 전)

6. **wrapups 읽기 축소(F2)** — read를 memberIds(+어드민)로. 공개 프로필이 필요한 데이터는 이미 flowerTagSummary 캐싱으로 해결돼 있음(P0 수정과 같은 작업 묶음).
7. **users 읽기 축소(F4)** — 공개 필드(name·username·photoURL·flowerTagSummary)와 비공개(email·plan·fcmToken) 분리: `users/{uid}/private/profile` 서브문서 또는 공개 전용 `profiles` 컬렉션. 마이그레이션 동반이므로 출시 전이 가장 싸다.
8. **KST 날짜 수정** — `todayStr`/`getWeekKey`를 로컬 날짜 기반으로(Intl 또는 수동 오프셋). 테스트는 이미 그물에 있으니 케이스만 추가.
9. **matchPosts 배지 → `getCountFromServer()`** + 주기 갱신(또는 카운터 문서). 통구독 제거.
10. **projects update 필드 제한(F5)** — leaderId·memberIds 변경은 리더만, 등.
11. **자동 종료 잡 서버 이전(S5)** — scheduled function 1개(매일 1회 collecting+마감 지난 프로젝트 archive). 클라이언트 레이스 제거.
12. **fcmToken → fcmTokens 다중화** — 앱 나오기 전 마지막 기회(스키마 변경).

## 🟢 사용자 1,000명 넘어갈 때

13. **모놀리식 문서 분해(S2~S4)** — todos·announcements·events를 서브컬렉션으로. 단, **앱 착수가 먼저 오면 이 작업을 앞당겨라**(두 번째 클라이언트 전에 스키마를 끝내는 게 총비용 최소).
14. **쓰기 로직 onCall API화(앱 선행 조건과 동일 작업)** — 피드백·프로젝트 삭제·멤버 추방·닉네임 변경부터. 유료화 시 plan 변경·한도 강제도 이 레이어에 합류(M1~M4).
15. **결제 인프라** — 토스페이먼츠 웹훅 onRequest 함수, plan 변경 경로 전면 서버화, student 인증 절차(또는 student 혜택 분리). *사업자등록 후 착수라는 기존 결정과 정합.*
16. **운영 도구 보강** — 어드민 유저 검색/페이지네이션(limit 300 해제), 채팅 과거 메시지 페이지네이션, 스테이징 Firebase 프로젝트(규칙·함수 사전 검증), 분석 도구(M5).
17. **거대 페이지 분해** — 900줄대 3개 페이지부터. 신규 기능 속도가 떨어졌다고 느끼는 시점이 신호.

---

## 부록 — 이번 진단에서 실측·검증한 것

- 보안 규칙 P0: 에뮬레이터에서 일반 유저 → 타인 users 문서 `flowerTagSummary.increment` 쓰기 **DENIED 확정** (일회성 규칙 테스트, 실행 후 삭제)
- 구독 구조: `App.jsx` 5개 통구독 + `Layout/ChatPage/MessagesPage/WrapupPage/helpers/projectSlice` 부분 구독
- 쿼리에 limit 있는 곳: AdminPage(200~500)·ChatPage(limitToLast 100) — 그 외 통구독
- 플랜 강제 지점: 클라이언트 1곳(`CreateProjectModal`), 서버 0곳
- 테스트: unit 9 + rules 8, CI(unit·rules) 그린 — 이 리포트의 수정 작업들도 같은 그물에 테스트를 추가하며 진행할 것
