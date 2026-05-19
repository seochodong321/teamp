# Teamp · Brand drop (v0)

새 브랜드 자산입니다. 빠더너스(YouTube) 결의 통통한 italic + 더블 아웃라인 + 잔선 디테일.
색은 잉크 퍼플 그대로 유지.

**폰트**: Luckiest Guy (Google Fonts). SVG 안에 `@import` 인라인.  
프로덕션에 쓸 때는 텍스트를 outline 으로 변환하든가, 폰트를 self-host 하세요.

## 파일 인벤토리

| 파일 | 용도 | 사이즈 |
|---|---|---|
| `icon.svg` | PWA / favicon / apple-touch — 메인 앱 아이콘 | 512 × 512, squircle rx 115 |
| `icon-maskable.svg` | PWA `purpose: "maskable"` 용 — 안전영역 안에 워드마크 | 512 × 512, full bleed |
| `wordmark-main.svg` | 메인 워드마크 — 밝은 배경 위 | 820 × 280 |
| `wordmark-dark.svg` | 다크 워드마크 — 어두운 배경 위 (배경 rect 포함) | 820 × 280 |

---

## Claude Code 에게: 이거 해줘

### 1. 아이콘 교체

- 기존 `public/icon.svg` → 이 폴더의 `icon.svg` 로 덮어쓰기.
- `public/icons/` 의 PNG 4종 재생성:
  - `icon-180.png` (180×180) ← `icon.svg` 에서
  - `icon-192.png` (192×192) ← `icon.svg` 에서
  - `icon-512.png` (512×512) ← `icon.svg` 에서
  - `icon-512-maskable.png` (512×512) ← `icon-maskable.svg` 에서

> SVG → PNG 변환 시 주의: SVG 안에 Google Fonts `@import` 가 있어서, headless 브라우저로 rasterize (Puppeteer/Playwright/sharp+resvg w/ font-loading) 해야 폰트가 박힘. 단순 `sharp.svg2png` 는 폰트를 무시할 수 있으니, `npx @resvg/resvg-cli` 에 폰트 파일 직접 전달하거나, 다음 라운드에 우리가 SVG 텍스트를 path 로 미리 변환해 드릴 수 있어요.

### 2. 워드마크 배치

- `wordmark-main.svg`, `wordmark-dark.svg` 를 `public/brand/` (또는 `src/assets/brand/`) 로 복사.
- 랜딩 / 헤더 / OG 이미지 / README 등에서 import.

### 3. (선택) manifest.json 색상 정합성

- 현재 `background_color` / `theme_color` 가 `#6B5CE7`.
- 새 디자인 시스템과 정확히 맞추려면 `#534AB7` (또는 다크 시작점 `#2D2580`) 으로 검토.
- 다만 OS splash 화면과 시각 통일성이 더 중요하면 그대로 둬도 OK.

### 4. 검증

- iOS 홈스크린(180px) / Android(192/512) 둘 다 워드마크가 또렷이 보이는지.
- 다크/라이트 OS 테마에서 squircle 가독성.
- 기존 `assets/teamp-mark.svg`, `teamp-mark-gradient.svg`, `teamp-wordmark.svg` 가 다른 곳에서 쓰이고 있는지 grep 하고, 사용처 알려줘. 다음 라운드에 교체할지 결정.

---

## 색 슬롯 (SVG 직접 수정 시)

| 슬롯 | 값 | 어디 |
|---|---|---|
| 글자 채움 | `#FFFFFF` | `fill` of 최상위 text |
| 이너 아웃라인 | `#1A1450` | `stroke` of 최상위 text |
| 아우터 아웃라인 | `#7C6FDE` (메인) / `#B8AEF7` (아이콘) / `#1A1450` (다크) | `stroke` of outline text |
| 3D 추출 | `#2D2580` (메인) / `#1A1450` (아이콘·다크) | 6개(또는 5개) `fill` |
| 잔선 | 이너 아웃라인과 동일 | `<g fill="…">` 아래 9개 `<rect>` |
| Squircle BG | `#2D2580 → #534AB7 → #7C6FDE` | `<linearGradient id="bg">` |

## 자형 시스템

- 폰트: **Luckiest Guy**, font-size `200`, letter-spacing `−2`
- italic skew: `−10°`
- inner stroke `12` / outer stroke `30` (아이콘은 `11` / `26`)
- 3D 추출: 6단(메인) / 5단(아이콘·다크), 각 1.5–1.8px 씩 down-right
- 잔선 9개, 폭 16–30 / 높이 7–8, 회전 −6° ~ +1°

## 다음 라운드 후보

- 자형 커스텀 (Luckiest Guy → 팀프 전용)
- 모션 로고 (잔선이 위에서 흩날리며 등장)
- 굿즈/이모지/SNS 변형 패키지
- 국문 워드마크 (팀프) Black Han Sans 마감
- SVG path-conversion 버전 (폰트 의존성 제거)
