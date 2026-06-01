#!/usr/bin/env bash
# Teamp 부팅 스모크 — 프로덕션 빌드가 컴파일되고, preview 서버가
# 앱 셸·진입 JS·manifest·SPA 폴백을 서빙하는지 검증한다.
# 배포 블로커(빌드 깨짐·컴포넌트 누락·에셋 경로 오류)를 푸시 전에 잡는 용도.
#
# 사용: bash .claude/skills/run-teamp/smoke.sh
# 종료코드: 모두 통과=0, 하나라도 실패=1
#
# ⚠️ 픽셀 단위 UI(로그인·클릭·렌더)는 검증하지 않음 — 그건 브라우저
#    자동화(chromium-cli/playwright)가 필요하고 이 harness 범위 밖.

set -uo pipefail
cd "$(dirname "$0")/../../.."   # → 레포 루트

PORT=4173
BASE="http://localhost:$PORT"
LOG=$(mktemp)
PASS=0; FAIL=0
ok()   { echo "✓ $1"; PASS=$((PASS+1)); }
bad()  { echo "✗ $1"; FAIL=$((FAIL+1)); }

cleanup() { pkill -f "vite preview" 2>/dev/null; rm -f "$LOG"; }
trap cleanup EXIT

echo "── 1/3 빌드 (gen-sw + vite build) ──"
# .env 필요 — gen-sw가 VITE_FIREBASE_* env를 요구함
if ! npm run build > "$LOG" 2>&1; then
  echo "빌드 실패:"; tail -20 "$LOG"; exit 1
fi
echo "✓ 빌드 성공"

echo "── 2/3 preview 서버 기동 ──"
npm run preview > "$LOG" 2>&1 &
for i in $(seq 1 20); do
  curl -sf -o /dev/null "$BASE/" && break
  sleep 0.5
  [ "$i" = 20 ] && { echo "서버 기동 실패:"; cat "$LOG"; exit 1; }
done
echo "✓ preview 기동 ($BASE)"

echo "── 3/3 부팅 스모크 ──"
# 1) 루트 셸 — 200 + #root 마운트 포인트
curl -sf "$BASE/" -o /tmp/teamp-root.html \
  && grep -q '<div id="root">' /tmp/teamp-root.html \
  && ok "루트 HTML 셸 + #root" || bad "루트 셸"

# 2) 진입 JS 에셋 도달
SCRIPT=$(grep -o '/assets/index-[A-Za-z0-9_-]*\.js' /tmp/teamp-root.html | head -1)
if [ -n "$SCRIPT" ] && curl -sf -o /dev/null "$BASE$SCRIPT"; then
  ok "진입 JS 에셋 ($SCRIPT)"
else
  bad "진입 JS 에셋"
fi

# 3) PWA manifest
curl -sf -o /dev/null "$BASE/manifest.json" && ok "manifest.json" || bad "manifest.json"

# 4) SPA 폴백 — 임의 라우트도 셸 반환 (vercel.json rewrites와 동일 동작)
curl -sf "$BASE/home" -o /tmp/teamp-route.html \
  && grep -q '<div id="root">' /tmp/teamp-route.html \
  && ok "SPA 폴백 (/home → 셸)" || bad "SPA 폴백"

echo "──────────────────────"
echo "통과 $PASS · 실패 $FAIL"
[ "$FAIL" -eq 0 ] && echo "✅ 부팅 스모크 통과" || { echo "❌ 실패 있음"; exit 1; }
