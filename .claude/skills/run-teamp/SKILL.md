---
name: run-teamp
description: Teamp 웹앱을 빌드·기동하고 부팅 스모크로 검증한다. "teamp 실행/빌드/preview/스모크 테스트", 푸시 전 빌드 깨짐·컴포넌트 누락·에셋 경로 오류 확인 시 사용.
---

# run-teamp

Teamp는 Vite로 빌드하는 React SPA (Firebase 백엔드). 배포는 git push →
Vercel `build:ci`. 이 스킬의 드라이버 **`.claude/skills/run-teamp/smoke.sh`**
는 프로덕션 빌드가 컴파일되고 preview 서버가 앱 셸·진입 JS·manifest·SPA
폴백을 서빙하는지 검증한다 — 배포 블로커(빌드 깨짐·컴포넌트 누락·에셋 404)를
푸시 전에 잡는 레이어.

모든 경로는 레포 루트 기준. (검증 환경: macOS / Node + npm.)

## 사전 조건
- Node + npm (설치돼 있음, `node_modules`에 vite 존재).
- **`.env` 필수** — `VITE_FIREBASE_*` 6개 키. `scripts/gen-sw.mjs`가 빌드 첫
  단계에서 이걸 읽어 FCM SW를 생성하며, 없으면 `❌ 환경 변수 누락`으로 빌드가
  종료된다. `.env`는 gitignore됨(키는 `.env.example` 참고).

## 실행 (에이전트 경로) — 우선
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

## 실행 (수동)
```bash
npm run build      # gen-sw + vite build → dist/
npm run preview    # dist/ 를 http://localhost:4173 에서 서빙
```
라이브 리로드가 필요하면 `npm run dev`(Vite dev 서버). 둘 다 `.env` 필요.

## Gotchas
- **이 스모크는 부팅/서빙까지만 검증한다.** React가 클라이언트에서 렌더하므로
  curl은 빈 `#root` 셸만 본다 — 로그인·Firestore·"무한 로딩" 같은 런타임/렌더
  문제는 **안 잡힌다.** 그건 실제 Firebase 자격증명 + 브라우저 자동화가 필요.
  (이 스킬엔 chromium-cli/playwright 미포함 — 픽셀·상호작용 검증하려면 별도 추가.)
- **빌드에 `gen-assets.mjs` 다시 넣지 말 것.** 과거 빌드마다 `public/icons`·
  `splash`를 코드 생성본으로 덮어써 커스텀 아이콘이 사라졌다. 제거됨.
- **`gen-sw.mjs`는 빌드 필수** — FCM `firebase-messaging-sw.js` 생성. 빼면 푸시 깨짐.
- SPA 폴백은 `vercel.json`의 `rewrites`(`/(.*)` → `/`)와 동일 동작. preview도 동일하게 폴백함.

## Troubleshooting
- 빌드가 `❌ 환경 변수 누락: VITE_FIREBASE_...` 로 멈춤 → `.env` 없거나 키 누락.
  `.env.example`의 6개 키를 채운 `.env`를 레포 루트에 둘 것.
- `:4173` 이미 사용 중 → `pkill -f "vite preview"` 후 재실행 (드라이버는 종료 시 자동 정리).
