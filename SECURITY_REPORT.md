# Teamp 보안 감사 리포트

작성: 2026-06-12 · 감사자: CTO(시니어 앱보안 관점) · 범위: 전체 코드베이스(클라이언트 + Firestore/Storage 규칙 + Cloud Functions)

> **권한 경계는 `firestore.rules`·`storage.rules`·`functions/index.js`입니다.** 클라이언트 체크(UI 비활성화 등)는 모두 우회 가능하므로, 이 리포트는 "공격자가 Firebase SDK를 직접 호출한다"는 전제로 규칙을 평가했습니다.
>
> **가입은 누구나 가능(이메일/비번 + Google, 이메일 인증 없음)** — 따라서 "인증된 유저(`request.auth != null`)"는 사실상 **누구나**입니다. 아래에서 "인증 유저면 가능"은 "임의의 공격자가 계정 하나 만들면 가능"으로 읽어야 합니다.

## 요약

| 등급 | 건수 | 핵심 |
|---|---|---|
| 🔴 Critical | 2 | 전 사용자 PII 무차별 노출 · 프로젝트 권한 상승(멤버→리더→삭제) |
| 🟠 High | 3 | 플랜/결제 우회 · 임의 푸시 피싱 · 레거시 방 메시지 노출 |
| 🟡 Medium | 5 | 매치 지원자 PII 공개 · Storage 쓰기 무차별 · 채팅 파일 read · 꽃다발 위조 · 미인증 가입 |
| ⚪ Low | 4 | 정리 규칙 부재 · 푸시 메타 스푸핑 · fcmToken 노출 · (XSS는 없음·확인됨) |

긍정적으로 확인된 부분은 마지막 [잘 되어 있는 것](#잘-되어-있는-것) 절에 정리했습니다.

---

## 처리 현황 (2026-06-12 업데이트)

| 항목 | 상태 | 비고 |
|---|---|---|
| C2 권한 상승(projects 필드 단위) | ✅ **배포 완료** | 규칙 배포 + 테스트. **부수 발견**: 프로젝트 합류(초대 수락·코드 참여)가 규칙 때문에 그동안 막혀 있던 버그도 함께 복구. |
| H2 임의 푸시 피싱 | ✅ **배포 완료** | fromUserId 필수 + link 상대경로 강제(외부/`//` 링크 차단). |
| M2/M3 Storage 접근 제어 | ✅ **배포 완료** | 커버=멤버만 쓰기, 채팅 파일=방 접근 자격자만. DM 파일 기밀성 확보. |
| H1 플랜/결제 우회 | 🔧 진행 중 | rules+Cloud Function+클라 동시 배포 필요(코드 작업). |
| M4 꽃다발 위조 | 🔧 진행 중 | 서버 집계 일원화 + ProfilePage 자가 기록 제거와 함께 처리. |
| C1 전 사용자 PII 노출 | 🔧 진행 중 | users 민감필드 분리 — 클라 동시 배포 필요(가장 큰 작업). |
| H3 레거시 방 fallback | ⏳ 보류 | 메타 백필 후 제거(과도기). Storage도 동일 fallback 한 쌍. |
| M1 매치 지원자 PII | ⏳ 보류 | applicants 서브컬렉션 분리(다음 배치). |
| M5/L1~L3 | ⏳ 보류 | 개선 권장. |

> ✅ 배포된 항목은 `tests/rules.test.js`(26) + `tests/storage.rules.test.js`(5) 에뮬레이터 테스트로 검증 후 `teamp-7923c`에 배포했습니다.

---

# 🔴 Critical — 즉시 수정

## C1. 전 사용자 PII가 모든 로그인 유저에게 읽힘

- **문제 설명**: `users` 컬렉션 읽기 규칙이 `allow read: if request.auth != null` 한 줄입니다. 즉 **로그인한 누구나 모든 유저의 전체 문서**를 읽을 수 있습니다. 유저 문서에는 `email`·`phone`(전화번호)·`birthday`(생일)·`studentEmail`·`affiliation`·`fcmToken`·`blockedUsers`(차단 목록)·`plan`·`profiles`(서브 프로필) 등 민감 정보가 들어 있습니다.
- **공격 시나리오**: 공격자가 계정 하나를 만든 뒤, 알려진/추측 가능한 uid 또는 `usernames` 컬렉션(역시 전체 읽기 허용)으로 uid를 수집하고, `getDoc(users/{uid})`를 반복 호출해 **전 사용자의 전화번호·이메일·생일을 통째로 덤프**합니다. 클라이언트 UI는 거치지 않습니다.
- **영향도**: 최고. 전화번호·생일은 한국 개인정보보호법(PIPA)상 개인정보이며, 대량 유출 시 법적 책임 + 서비스 신뢰 붕괴. "기여와 관계의 기록"이라는 서비스 철학과 정면 충돌.
- **수정 방법**:
  1. 유저 문서를 **공개 필드**(name·username·photoURL·oneliner·bio·flowerTagSummary)와 **민감 필드**(email·phone·birthday·studentEmail·fcmToken·blockedUsers)로 분리. 민감 필드는 `users/{uid}/private/self` 서브문서로 옮기고 `allow read: if request.auth.uid == uid`로 잠금.
  2. 당장의 완화책으로도, 최소한 **읽기를 필요한 필드로 제한할 수 없는 Firestore 특성상** 문서 분리가 정석입니다(필드 단위 읽기 제한 불가).
  3. 공개 프로필(`PublicProfilePage`)·멤버 탭·채팅 팝업이 참조하는 필드가 공개 문서에만 의존하도록 클라이언트도 함께 조정.
- **관련 파일**: `firestore.rules:25-26`, `src/store/slices/authSlice.js:14-43`(저장 필드), `src/pages/ProfilePage.jsx`, `src/pages/PublicProfilePage.jsx`

## C2. 프로젝트 문서 필드 단위 권한 부재 → 권한 상승 + 강제 공개 + 한도 우회

- **문제 설명**: `projects` 수정 규칙이 `allow update: if request.auth.uid in resource.data.memberIds || isAdmin()`로, **멤버이기만 하면 문서의 어떤 필드든** 바꿀 수 있습니다. 필드 단위 제약이 없습니다.
- **공격 시나리오** (멤버 권한 보유자):
  - `updateDoc(projects/{id}, { leaderId: <내 uid> })` → 스스로 리더가 됨. 삭제 규칙은 `leaderId == uid`이므로 곧바로 **프로젝트 전체(모든 멤버의 작업·기록)를 삭제** 가능. → 권한 상승 + 파괴.
  - `updateDoc(projects/{id}, { isPublic: true })` → 비공개 프로젝트가 전체 인증 유저에게 공개됨(읽기 규칙 `isPublic == true`). 팀원 PII·게시판·할 일 노출.
  - `updateDoc(projects/{id}, { memberIds: [...], members: [...] })` → 다른 멤버를 명단에서 제거(강퇴)하거나 임의 uid 추가.
  - `updateDoc(projects/{id}, { isTutorial: true })` → 무료 플랜 한도 계산(`countOwnedProjects`가 `!isTutorial`만 카운트)에서 제외 → C2-연계 한도 우회.
- **영향도**: 최고. 멤버 한 명이 팀 전체 데이터를 파괴/탈취/공개할 수 있음. "함께 해낸 것은 사라지지 않아야 한다"는 핵심 약속을 깨뜨림.
- **수정 방법**: 수정 규칙을 **필드 단위로 분기**.
  - `leaderId`·`isPublic`·`isTutorial`·`plan류 필드` 변경은 **리더(현재 `resource.data.leaderId`)만** 허용:
    `request.resource.data.diff(resource.data).affectedKeys().hasAny(['leaderId','isPublic','isTutorial']) ? request.auth.uid == resource.data.leaderId : (멤버 허용)`
  - `memberIds`/`members` 변경(초대 수락·강퇴)도 리더 전용으로, 일반 멤버는 todos·announcements·rooms 등 협업 필드만 수정하도록 화이트리스트.
- **관련 파일**: `firestore.rules:72-75`, `src/store/helpers.js:131`(`txProject`), `src/store/slices/projectSlice.js:342`(`isPublic` 토글), `src/store/useStore.js:15`(`countOwnedProjects`)

---

# 🟠 High — 출시 전 반드시 수정

## H1. 플랜·결제 우회 (Student 자가 승급 + 프로젝트 한도 미강제)

- **문제 설명**: 두 경로로 유료 혜택을 무료로 취득 가능.
  1. `users` 수정 규칙이 `plan == 'student'`로의 자가 변경을 허용(`firestore.rules:36-37`). 서버단 학교 이메일 검증이 없습니다 — `StudentVerifyPage`의 도메인 체크는 클라이언트 전용이라, 공격자는 `updateDoc(users/{me}, { plan: 'student' })`를 직접 호출하면 됩니다. `student`는 `isPaidPlan` 목록(`['pro','team','admin','student']`)에 포함되어 Pro 혜택을 전부 받습니다.
  2. 무료 프로젝트 3개 한도는 `countOwnedProjects`(클라이언트)에서만 검사됩니다. 규칙에는 프로젝트 개수 제한이 없어 `createProject`를 직접 반복 호출하면 **무제한 생성**됩니다.
- **공격 시나리오**: 결제 없이 SDK 한 줄로 Pro 등급 획득, 또는 한도 우회로 무제한 프로젝트 생성.
- **영향도**: 결제 도입 시점에 매출 직결. 지금은 과금이 비활성이라 즉시 피해는 없으나, **유료화 착수 전 반드시 막아야** 함(메모리 `project_monetization`·M2 구멍).
- **수정 방법**:
  - `plan` 변경은 **어드민/서버(Cloud Function)만** 허용으로 규칙 강화. 학생 인증은 onCall 함수에서 학교 이메일 OTP/도메인 검증 후 서버가 `plan` 설정.
  - 프로젝트 생성 한도는 서버 enforce가 필요(예: onCall `createProject`에서 소유 개수 확인, 또는 유저 문서에 카운터 두고 규칙에서 검증). 클라 체크는 UX용으로만.
- **관련 파일**: `firestore.rules:32-37`, `src/pages/StudentVerifyPage.jsx:63-70`, `src/components/CreateProjectModal.jsx:60-62`, `src/store/useStore.js:14-16`

## H2. 임의 대상에게 푸시 알림 발송 가능 (스팸/피싱)

- **문제 설명**: `notifications` 생성 규칙이 `(!hasAny(['fromUserId']) || fromUserId == auth.uid)`만 검사합니다. **수신자(targetUserId)와 발신자의 관계를 전혀 검증하지 않습니다.** 또한 `fromUserId`를 아예 빼면(임시 호환 조항) 검증을 통째로 건너뜁니다. Cloud Function `pushOnNotification`은 생성된 알림 문서를 그대로 FCM 푸시로 발송하고, `link`를 푸시 클릭 목적지(`webpush.fcmOptions.link`)로 사용합니다.
- **공격 시나리오**: 공격자가 `addDoc(notifications, { targetUserId: <피해자>, text: "[Teamp] 계정 확인이 필요합니다", link: "https://evil.example", fromUserId: <내 uid> })`를 호출 → 피해자 기기에 **Teamp를 사칭한 푸시**가 뜨고, 클릭하면 외부 피싱 사이트로 이동. 대량 호출 시 알림 스팸.
- **영향도**: 높음. 신뢰된 앱 이름으로 임의 텍스트·외부 링크 푸시 = 효과적인 피싱 채널. 사용자 신뢰 훼손.
- **수정 방법**:
  - `fromUserId` 필수화(임시 호환 조항 제거 — 메모리 `project_security_hardening`에 이미 TODO로 기록됨).
  - 더 근본적으로, **알림 생성을 서버 함수로만** 허용하거나, 규칙에서 "발신자가 수신자에게 알림 보낼 자격(같은 프로젝트 멤버·DM 상대 등)"을 검증. 최소한 `link`는 **상대 경로(`/`로 시작)만** 허용하도록 제약해 외부 피싱 링크를 차단.
- **관련 파일**: `firestore.rules:153-161`, `functions/index.js:65-73`(발송), `src/store/helpers.js:77-90`(`notifyUser`)

## H3. 레거시 방 메시지 — 메타 없는 방은 누구나 read/write

- **문제 설명**: `canAccessRoom`의 `isLegacyRoom` fallback(`firestore.rules:95-101`)은 "dmRooms 문서도, rooms 메타도 없는 방"을 **모든 인증 유저에게 허용**합니다. 메타 자가치유(ChatPage 진입 시 생성) 이전의 옛 프로젝트 방이 여기 해당합니다.
- **공격 시나리오**: 공개(`isPublic`) 프로젝트나 유출된 roomId에 대해, 메타가 아직 생성되지 않은 방이면 비멤버가 `rooms/{roomId}/messages`를 **읽고 쓸 수** 있습니다. roomId는 멤버가 읽을 수 있는 프로젝트 문서(`projects.rooms[].id`)에 들어 있어, 한 번이라도 멤버였거나 공개 프로젝트면 확보 가능.
- **영향도**: 높음(과도기 한정). 레거시 방의 채팅 기록 노출 + 위조 메시지 주입.
- **수정 방법**: 전 클라이언트 배포 + PWA 갱신으로 모든 활성 방의 메타가 생성된 것을 확인한 뒤 `isLegacyRoom` 조항 제거(`tests/rules.test.js`의 대응 케이스도 반전). 그 전까지는 마이그레이션 스크립트로 기존 `projects.rooms[]`의 메타를 일괄 생성해 fallback 의존 구간을 0으로 줄이는 것을 권장.
- **관련 파일**: `firestore.rules:95-101, 120-126`, `src/pages/ChatPage.jsx`(메타 자가치유), `tests/rules.test.js`

---

# 🟡 Medium — 사용자 증가 전 수정 권장

## M1. 매치 모집글 지원자 PII가 전체 공개

- **문제 설명**: `matchPosts` 읽기 = `request.auth != null`(전체 공개). 지원 시 `applicants[]`에 `userName`·`affiliation`·`note`(지원 메시지)·`appliedAt`이 저장됩니다(`MatchPage.jsx:164-172`). 즉 **누가 어느 모집글에 지원했고 무슨 말을 썼는지** 모든 로그인 유저가 봅니다.
- **공격 시나리오**: 경쟁 지원자/제3자가 특정 모집글의 지원자 명단·소속·지원 사유를 열람. 지원 사실 자체가 민감(현 소속에 알리고 싶지 않은 이직성 지원 등).
- **영향도**: 중간. 프라이버시 + 매치 BM 신뢰도.
- **수정 방법**: `applicants`를 모집글 문서에서 분리해 **리더·해당 지원자만** 읽도록(서브컬렉션 `matchPosts/{id}/applicants/{uid}`, 읽기=리더 or 본인). 목록 화면의 "N명 지원" 배지는 별도 카운터 필드로.
- **관련 파일**: `firestore.rules:189-210`, `src/pages/MatchPage.jsx:156-184, 533-560`

## M2. Storage 쓰기가 무차별 — 프로젝트 커버·채팅 파일에 멤버십 검증 없음

- **문제 설명**: `storage.rules`의 프로젝트 커버(`projects/{projectId}/cover.jpg`)와 채팅 파일(`chat/{roomId}/{fileName}`) 쓰기 규칙이 **인증 + 용량/타입만** 검사하고 멤버십을 확인하지 않습니다(주석은 "멤버십은 Firestore에서"라고 하나, Storage 쓰기는 Firestore 규칙의 보호를 받지 않습니다).
- **공격 시나리오**: 임의 인증 유저가 `projects/<임의 id>/cover.jpg`를 덮어써 **타 프로젝트 커버를 변조(디페이스)**하거나, 임의 `chat/<roomId>/` 경로에 20MB 파일을 업로드해 스토리지를 오염/낭비.
- **영향도**: 중간. 변조·스토리지 비용 남용.
- **수정 방법**: Storage 규칙에서 `firestore.get()`으로 멤버십을 검증(예: 커버는 해당 프로젝트 `memberIds`에 포함, 채팅 파일은 방 접근 자격). Storage 규칙도 Firestore 문서를 읽을 수 있습니다.
- **관련 파일**: `storage.rules:24-40`

## M3. 채팅 파일 읽기 = 전체 인증 유저 (roomId 추측 의존)

- **문제 설명**: `chat/{roomId}/{fileName}` 읽기가 `request.auth != null`. roomId의 비밀성(UUID/결정론적 id)에만 의존합니다. 그런데 DM roomId는 `room_dm_{projectId}_{userId}`로 **결정론적**이고, 프로젝트 roomId는 멤버가 읽는 문서에 노출됩니다.
- **공격 시나리오**: 방을 나갔거나 강퇴된 유저, 또는 roomId를 확보한 제3자가 그 방에 올라온 사진·파일을 **영구적으로** 내려받음(권한 회수 안 됨).
- **영향도**: 중간. 채팅 첨부의 기밀성.
- **수정 방법**: 읽기도 방 접근 자격 검증(M2와 동일하게 `firestore.get()`). 최소한 DM 결정론적 id는 추측 방지가 안 되므로 멤버십 검증 필수.
- **관련 파일**: `storage.rules:36-40`, `src/store/helpers.js`(DM id 생성 규약)

## M4. 꽃다발 집계를 클라이언트가 위조 가능

- **문제 설명**: 두 경로로 위조 가능.
  1. `users` 자가 수정 규칙은 `isAdmin`·`plan` 외 **모든 필드**를 본인이 쓸 수 있게 허용 → 본인 `flowerTagSummary`·`flowerSenderUids`를 직접 임의 값으로 설정.
  2. `wrapups` 수정은 멤버 누구나 가능(`firestore.rules:223-224`). 서버 함수 `aggregateFlowerFeedback`은 `feedbacks`의 `fromUserId`/`toUserId`를 **검증 없이** diff해 increment합니다. 멤버가 `toUserId=본인`, `tags=다수`인 피드백을 주입하면 자기 꽃 수가 부풀려집니다.
- **공격 시나리오**: 사용자가 자기 팀프폴리오의 꽃다발 태그 수·발신자 수를 임의로 부풀림.
- **영향도**: 중간. 점수·순위가 없는 서비스에서 꽃다발은 유일한 정량 신호 → 위조는 핵심 신뢰(진정성)를 훼손.
- **수정 방법**:
  - `flowerTagSummary`·`flowerSenderUids`는 **서버 함수만** 쓰도록 규칙에서 자가 수정 차단(자가 update의 affectedKeys 화이트리스트에서 제외).
  - 서버 함수에서 새 피드백의 `fromUserId`가 실제 작성자(그 멤버)인지, `toUserId`가 같은 랩업 멤버인지 검증 후에만 반영.
- **관련 파일**: `firestore.rules:32-42, 218-225`, `functions/index.js:125-169`, `src/store/slices/wrapupSlice.js`

## M5. 이메일 미인증 가입 — "인증 유저" 신뢰도 낮음

- **문제 설명**: 가입 시 이메일 인증을 요구하지 않습니다. 위 모든 "인증 유저면 허용" 규칙의 신뢰 기반이 약합니다(공격자가 일회용 이메일로 무한 계정 생성).
- **공격 시나리오**: 봇이 계정을 대량 생성해 C1(PII 덤프)·H2(푸시 스팸)·M1(지원자 열람)을 자동화.
- **영향도**: 중간(증폭 요인). 단독으론 낮지만 다른 항목의 공격 난이도를 크게 낮춤.
- **수정 방법**: 이메일 인증(`sendEmailVerification`) 요구, 민감 행위(매치 지원·DM 시작)에 `email_verified` 게이트. 규칙에서 `request.auth.token.email_verified == true` 활용 가능.
- **관련 파일**: `src/pages/Login*`(가입 흐름), `src/firebase.js`

---

# ⚪ Low — 개선 권장

## L1. 정리(delete) 규칙 부재 — dmRooms·notes

- **문제**: `dmRooms`·`notes`에 delete 규칙이 없어 문서를 영구 삭제할 수 없습니다(나가기는 워터마크 방식으로 처리). 운영상 고아 데이터 누적.
- **영향/수정**: 낮음. 참가자 본인 또는 어드민의 정리 규칙 추가 검토.
- **관련 파일**: `firestore.rules:136-145, 232-237`

## L2. 푸시 라우팅이 클라 제공 필드를 신뢰

- **문제**: `pushOnChatMessage`가 메시지 문서의 `projectId`·`senderName`을 그대로 푸시 제목/링크에 사용. 메시지 생성 규칙은 `senderId`만 검증하므로 `senderName`·`projectId`는 위조 가능.
- **영향/수정**: 낮음(표시·라우팅 한정, 권한 영향 없음). 서버에서 방 메타로 projectId를 역참조하고 senderName은 발신자 문서에서 조회 권장.
- **관련 파일**: `functions/index.js:76-119`

## L3. fcmToken 평문 저장 + 전체 읽기

- **문제**: `users.fcmToken`이 평문으로 저장되고 C1에 의해 전체 읽힘. 토큰만으론 서버 키 없이 푸시 불가라 단독 악용도는 낮으나, 노출 자체는 바람직하지 않음.
- **영향/수정**: 낮음. C1 해결(민감 필드 분리) 시 함께 해소. 다중 기기 대비 `fcmTokens` 서브컬렉션으로 이동 권장.
- **관련 파일**: `functions/index.js:27-32`, C1과 동일.

## L4. (확인됨, 취약점 아님) 채팅 XSS 없음

- 채팅 메시지는 React가 자동 이스케이프하고, `linkify`는 `https?://`만 매칭(`ChatPage.jsx:42-51`)하여 `javascript:` 스킴 주입이 불가합니다. `dangerouslySetInnerHTML`·`eval`·`document.write` 사용처도 없습니다. **저장형/DOM XSS 위험 없음** — 현 상태 유지 권장.

---

# 잘 되어 있는 것

감사 중 확인된 견고한 설계 — 회귀 방지를 위해 명시합니다.

- **시크릿 미커밋**: `.env`는 gitignore, 추적되는 `.env.example`·`.env.production`은 공개값만. 소스에 하드코딩된 API 키·토큰 없음(Firebase 웹 키·Sentry DSN은 공개 식별자라 정상). `DATAGOKR_KEY`는 환경변수로만 참조.
- **규칙이 진짜 경계**: 클라 체크와 별개로 Firestore/Storage 규칙이 인증/소유권을 강제. `reports`(reporterId 본인 + reason enum + detail 길이), `usernames`(트랜잭션 선점), `adminLogs`(append-only), `projectInvites`/`notes`(참가자 한정)는 적절히 잠겨 있음.
- **메시지 발신자 위조 차단**: `rooms/*/messages` 생성이 `senderId == auth.uid`(또는 시스템 발신자 허용목록)를 검증.
- **어드민 권한 분리**: 부트스트랩 이메일 + `isAdmin` 승급 구조, `isAdmin` 자가 변경 차단, 어드민 완전 삭제는 Admin SDK(onCall)에서 호출자 어드민 검증 후 수행.
- **XSS 안전**: React 자동 이스케이프 + 스킴 제한 linkify(L4).
- **모니터링**: Sentry로 프로덕션 에러(삼켜진 catch 포함) 수집 중 — 위 항목 수정 후 악용 시도 탐지에 활용 가능.

---

# 권장 처리 순서

1. **C1, C2** — 즉시. 둘 다 규칙 수정만으로 막을 수 있고(문서 분리 + 필드 단위 권한), 클라 영향이 적음.
2. **H2, H3** — 출시 전. H3는 이미 메모리에 제거 TODO로 등록됨(마이그레이션 후).
3. **H1, M4** — 유료화 착수 **전**(매출/신뢰 직결).
4. **M1, M2, M3, M5** — 사용자 증가 전.
5. **L1–L3** — 여력 될 때. L4는 조치 불필요(현상 유지).

> 모든 수정은 `tests/rules.test.js`에 대응 케이스를 추가/반전한 뒤 `npm run test:rules`로 검증하고, 규칙 배포(`firebase-tools deploy --only firestore:rules,storage`)는 **구버전 클라이언트와의 호환성**을 확인하며 진행하세요(C1의 문서 분리는 클라 동시 배포 필요).
