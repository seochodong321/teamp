# Teamp 코드 개선 백로그 (코드 전반 스윕)

작성 2026-06-14 · 기준 `25532cc` · 보안(SECURITY_REPORT)·모바일(MOBILE_LAUNCH_REPORT)과 별개의 **코드 품질/부채** 관점.

우선순위 = 영향 × (1/난이도). 🔴 지금(저위험·고효과) · 🟡 곧 · 🟢 계획.

---

## 🔴 지금 (빠르고 안전, 권장 즉시)

### 1. KST 날짜 버그 6곳 잔존 — `toISOString().split('T')[0]`
보안 하드닝 때 `localDateStr`/`todayStr`로 옮겼는데 **일부가 누락**됨. UTC 기준이라 **KST 0~9시에 "오늘"이 하루 어긋남**(D-day·마감·정렬 오류).
- `src/pages/HomePage.jsx:126` `today`
- `src/pages/HomePage.jsx:400` `todayStr`
- `src/pages/HomePage.jsx:421` `tomorrow` (`Date.now()+86400000` → `localDateStr(new Date(Date.now()+864e5))`)
- `src/pages/MatchPage.jsx:88` `today`
- `src/pages/MatchPage.jsx:600` `min={...}` (날짜 input 최소값)
- `src/store/slices/authSlice.js:120` `connectedAt`
→ 전부 `helpers`의 `todayStr()`/`localDateStr()`로 교체. (이미 존재하는 헬퍼라 1줄씩.)

### 2. ESLint 게이트 부재 — `topKeywords` 크래시를 새게 한 근본 원인
설정·의존성 자체가 없음(`❌`). `no-undef`/`no-unused-vars`/`react-hooks`가 있었으면 회고 탭 크래시는 빌드 단계에서 잡혔다.
→ `eslint + @eslint/js + eslint-plugin-react(-hooks) + globals` 도입 + flat config + `npm run lint` + **CI에 lint job 추가**. 이 한 방이 "정의 지웠는데 참조 남음"·"useEffect 의존성 누락" 류를 원천 차단.

### 3. `ROLE_LABEL` 3중 정의 (CLAUDE.md "중복 금지" 위반)
- 정본 `src/constants.js:4` (이모지+텍스트)
- `src/pages/ChatPage.jsx:53` (이모지만, 변형)
- `src/pages/project/MembersTab.jsx:10` (로컬 재정의)
→ `constants.js`에 `ROLE_LABEL`(전체) + `ROLE_EMOJI`(짧은) 두 개로 정리하고 두 곳에서 import.

---

## 🟡 곧 (중간 난이도, 분명한 이득)

### 4. ProfilePage 꽃다발 재계산 = 불필요 + N+1
`src/pages/ProfilePage.jsx:38` `fetchFlowers`가 **아카이브된 모든 wrapup을 getDoc으로 다시 읽어** 꽃 태그/발신자수를 매번 재계산. 그런데 이제 서버 함수 `aggregateFlowerFeedback`가 `users.flowerTagSummary`/`flowerSenderUids`를 유지하고, PublicProfile은 이미 그걸 읽는다.
→ ProfilePage도 `currentUser.flowerTagSummary` + `flowerSenderUids.length`를 읽도록 바꾸면 **N+1 제거 + 로직 단순화**(M4에서 쓰기는 이미 제거함, 읽기 재계산만 남음).

### 5. 빈 `catch {}` 18곳 — Sentry가 못 보는 무성(無聲) 실패
Sentry는 `console.error`를 잡지만 **완전 빈 catch는 로그조차 없어 안 보임**. (프로젝트 합류 버그가 swallowed catch로 오래 숨었던 전례.)
→ 베스트-에포트 정리(파일 삭제 등)는 두되, **핵심 경로(쓰기·결제·인증)의 빈 catch는 `catch(e){ console.error(...) }`로** 전환해 Sentry 가시화.

### 6. 인라인 스타일 100+곳 / 하드코딩 hex 9곳 (CSS모듈·변수 원칙 위반)
핫스팟: `SetupUsernamePage`(22) · `HomePage`(18) · `ProjectPage`(14) · `AdminPage`(10, 이번 마이그레이션 버튼 포함).
→ 점진 이관(`*.module.css` + `global.css` 변수). 신규 코드부터 인라인 금지 룰 적용.

### 7. N+1 Firestore 읽기 (루프 내 getDoc)
- `src/App.jsx:105` 생일 체크 — 멤버 uid마다 getDoc → `getAll`/`where in` 배치로.
- `src/pages/MatchPage.jsx` — 모집글/지원자 프로필 per-item 읽기 → 배치 또는 캐시.
영향은 데이터량에 비례(유저 증가 시 커짐). J커브 전 정리 권장.

---

## 🟢 계획 (큰 부채, 점진/일정)

### 8. God 컴포넌트 분해
`ProfilePage`(953) · `AdminPage`(946) · `MatchPage`(864) · `ChatPage`(787) · `HomePage`(636). 렌더/유지보수·리뷰 비용↑.
→ 탭/모달/리스트를 서브컴포넌트 + 커스텀 훅으로 추출(특히 AdminPage 탭들, ProfilePage 편집 모달).

### 9. 번들 — `firebase-db` 청크 430KB(gz 107KB)가 최대
이미 청크 분리됨. 비핵심 Firestore 경로(매치·캘린더 등)를 지연 로드하면 초기 페이로드↓. (메모리 `project_perf_optimization`: firebase-db 지연은 한번 보류한 바 있음 — 모바일 WebView 성능 위해 재검토 가치.)

### 10. 과도기 보안 조항 제거 (전 클라 롤아웃 후)
`firestore.rules` `isLegacyRoom()` fallback + `storage.rules` 동일 fallback. PWA 갱신 충분히 퍼지면 제거하고 rules 테스트 반전. (SECURITY_REPORT·메모리에 기록됨.)

---

## 처리 제안
- **🔴 1·2·3은 지금 한 배치로** 끝낼 수 있음(저위험, 테스트/빌드로 검증). 특히 2(ESLint)는 같은 류 버그를 앞으로 자동 차단.
- 🟡는 다음 한 사이클.
- 🟢는 모바일 작업과 병행하며 점진.
