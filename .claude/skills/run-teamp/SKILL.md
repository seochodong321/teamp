---
name: run-teamp
description: Teamp 웹앱을 빌드·기동하고 부팅 스모크 + 실제 브라우저 렌더로 검증한다. "teamp 실행/빌드/preview/스모크 테스트/스크린샷", 푸시 전 빌드 깨짐·컴포넌트 누락·빈 화면·무한 로딩 확인 시 사용.
---

# run-teamp

Teamp는 Vite로 빌드하는 React SPA (Firebase 백엔드). 배포는 git push →
Vercel `build:ci`. 드라이버 두 개:

- **`smoke.sh`** — 빠른 부팅 스모크(curl). 빌드 깨짐·컴포넌트 누락·에셋 404를 잡음. 브라우저 불필요.
- **`browser.mjs`** — 실제 헤드리스 Chromium(Playwright)으로 렌더 검증 + 스크린샷. 빈 화면·무한 로딩 등 런타임/렌더 문제를 잡음.

모든 경로는 레포 루트 기준. (검증 환경: macOS / Node + npm.)

## 사전 조건
- Node + npm (설치돼 있음, `node_modules`에 vite 존재).
- **`.env` 필수** — `VITE_FIREBASE_*` 6개 키. `scripts/gen-sw.mjs`가 빌드 첫
  단계에서 이걸 읽어 FCM SW를 생성하며, 없으면 `❌ 환경 변수 누락`으로 빌드가
  종료된다. `.env`는 gitignore됨(키는 `.env.example` 참고).
- **browser.mjs용**: `npm i -D playwright`(설치됨) + `npx playwright install chromium`(헤드리스 셸 다운로드).

## 실행 (에이전트 경로 1) — 빠른 부팅 스모크
```bash
bash .claude/skills/run-teamp/smoke.sh
```
빌드 → `vite preview`(:4173) 백그라운드 기동 → curl 4종 검증 → 서버 정리 →
모두 통과 시 종료코드 0. 실제 출력:
```
✓ 빌드 성공
✓ preview 기동 (http://localhost:4173)
✓ 루트 HTML 셸 + #root
✓ 진입 JS 에셋 (/assets/index-XXXX.js)
✓ manifest.json
✓ SPA 폴백 (/home → 셸)
통과 4 · 실패 0
✅ 부팅 스모크 통과
```

## 실행 (에이전트 경로 2) — 브라우저 렌더 + 스크린샷
```bash
node .claude/skills/run-teamp/browser.mjs
```
빌드 → preview 기동 → 헤드리스 Chromium(390px 폭)으로 `/` 로드 → `#root`에
실제 콘텐츠가 마운트될 때까지 대기(빈 셸이면 실패) → 스크린샷 →
`.claude/skills/run-teamp/screenshot.png`. 실제 출력:
```
✓ 빌드 성공
✓ preview 기동 (http://localhost:4173/)
✓ #root 렌더됨 — title="Teamp — 기여와 관계의 기록"
✓ 화면 텍스트: "Teamp 로그인 기한이 있는 프로젝트를 위한 협업 플랫폼 …"
✓ 페이지 에러 없음
✅ 렌더 검증 통과
```
로그인 안 한 `/`는 랜딩 페이지를 렌더(인증 불필요) — 빈 화면/무한 로딩
회귀를 잡는 데 충분. 로그인 이후 플로우는 실제 Firebase 인증이 필요.

## 실행 (수동)
```bash
npm run build      # gen-sw + vite build → dist/
npm run preview    # dist/ 를 http://localhost:4173 에서 서빙
```
라이브 리로드가 필요하면 `npm run dev`(Vite dev 서버). 둘 다 `.env` 필요.

## Gotchas
- **smoke.sh(curl)는 부팅/서빙까지만** 본다 — 빈 `#root` 셸만 확인. 렌더/무한
  로딩은 **browser.mjs**로 검증. 로그인 이후 플로우는 실제 Firebase 자격증명 필요.
- **browser.mjs는 networkidle 대신 `#root` 콘텐츠 마운트를 기다린다** — Firebase가
  연결을 열어두면 networkidle이 영영 안 와서 멈추기 때문.
- `screenshot.png`는 산출물이라 gitignore됨 — 매 실행마다 새로 생성.
- **빌드에 `gen-assets.mjs` 다시 넣지 말 것.** 과거 빌드마다 `public/icons`·
  `splash`를 코드 생성본으로 덮어써 커스텀 아이콘이 사라졌다. 제거됨.
- **`gen-sw.mjs`는 빌드 필수** — FCM `firebase-messaging-sw.js` 생성. 빼면 푸시 깨짐.
- SPA 폴백은 `vercel.json`의 `rewrites`(`/(.*)` → `/`)와 동일 동작. preview도 동일하게 폴백함.

## Troubleshooting
- 빌드가 `❌ 환경 변수 누락: VITE_FIREBASE_...` 로 멈춤 → `.env` 없거나 키 누락.
  `.env.example`의 6개 키를 채운 `.env`를 레포 루트에 둘 것.
- `:4173` 이미 사용 중 → `pkill -f "vite preview"` 후 재실행 (드라이버는 종료 시 자동 정리).
