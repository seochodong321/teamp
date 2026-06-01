---
name: review
description: Teamp 코드 변경(diff)을 이 프로젝트의 단골 함정 체크리스트로 점검한다. 보안·모바일/PWA 회귀·중복·검증 누락 위주. 커밋/배포 전 빠른 셀프 리뷰용.
---

# Teamp 코드 리뷰

현재 변경분을 아래 체크리스트로 점검하고, 발견을 심각도순으로 보고한다.

## 1. 범위 파악
`git diff HEAD`(미커밋) + 직전 커밋(`git diff HEAD~1`)을 합쳐 리뷰 대상으로 삼는다.
인자로 파일/PR이 주어지면 그것만.

## 2. 체크리스트 (Teamp 단골 함정)

### 보안
- 하드코딩된 키·비밀(Firebase 등) — 전부 `VITE_*` env여야 함. `grep`으로 `AIza`·`apiKey:` 등 확인.
- Firestore에 쓰는 클라 코드가 `firestore.rules` 권한과 맞는가 — 본인 소유(`request.auth.uid`) 검증, plan/isAdmin 자가 변경 불가.
- 신규 컬렉션 쓰기는 규칙도 함께 갱신했는가.

### 모바일 / PWA 회귀
- `100vh` 새로 들어왔나 → `100dvh`로.
- 새 fixed 하단 요소가 탭바(`60px + safe-area`)를 안 가리는가.
- `interactive-widget=resizes-content` 등 전역 viewport 변경 — 금지(탭바 흰 공백 회귀 전례).
- 모바일 input `font-size: 16px`인가(iOS 줌), 터치 타깃 ≥ 44px인가.
- 빌드 스크립트에 `gen-assets.mjs`가 다시 추가됐는가 — 금지(커스텀 아이콘 덮어씀).

### 중복 / 재사용
- 역할 라벨 등 공유값을 새로 정의했나 → `src/constants.js`(`ROLE_LABEL`·`FLOWER_TAGS`).
- 주차 계산·트랜잭션 등 공유 로직 재구현 → `src/store/helpers.js`(`getWeekKey`·`txProject`).
- 프로젝트 한도 카운트는 `countOwnedProjects`(useStore) 사용, 튜토리얼 제외.

### 상태 / 동작
- 한글 입력 onKeyDown에 `e.nativeEvent.isComposing` 체크했는가(이중 제출 방지).
- Firestore 쓰기 후 로컬 상태 낙관적 업데이트 + 실패 시 rollback 있는가.
- 비동기 작업에 로딩/에러 표시, 빈 상태 안내가 있는가.

### 검증
- "다 됐다" 주장 전에 변경이 닿는 surface(전체 클릭 영역 / 즉시 state 갱신 / 모바일·webview)를 실제로 확인했는가.
- 코드 변경이면 `npm run build`로 컴파일 깨짐 없는지.

## 3. 보고
파일·라인·심각도(높음/중간/낮음)·한 줄 요약·구체적 영향으로 정리.
수정은 사용자가 요청할 때. 보안·회귀(높음)는 먼저 제안.
