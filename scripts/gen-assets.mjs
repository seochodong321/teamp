/**
 * iOS 스플래시 스크린 + maskable 아이콘 생성
 * @resvg/resvg-js 사용 (폰트 의존 없음 — T를 rect로 구성)
 */

import { Resvg } from '@resvg/resvg-js'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ── T 아이콘 SVG 생성 (rect만 사용, 폰트 불필요) ──────────────────
function makeTIcon(s, bgFill = '#534AB7', opacity = 0.18) {
  const rx  = Math.round(s * 0.22)
  const bx  = Math.round(s * 0.08)  // 수평바 x
  const bw  = Math.round(s * 0.84)  // 수평바 너비
  const bh  = Math.round(s * 0.15)  // 수평바 높이
  const by  = Math.round(s * 0.15)  // 수평바 y
  const vx  = Math.round(s * 0.42)  // 수직바 x
  const vw  = Math.round(s * 0.16)  // 수직바 너비
  const vy  = by                    // 수직바 y (수평바와 동일)
  const vh  = Math.round(s * 0.70)  // 수직바 높이
  const rr  = Math.round(bh * 0.35) // 모서리 반경

  return `
    <rect x="0" y="0" width="${s}" height="${s}" fill="${bgFill}" rx="${rx}"/>
    <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${rr}" fill="white"/>
    <rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" rx="${rr}" fill="white"/>`
}

// ── 스플래시 SVG ──────────────────────────────────────────────────
function makeSplashSvg(w, h) {
  const iconSize = Math.round(Math.min(w, h) * 0.22)
  const ix = Math.round((w - iconSize) / 2)
  const iy = Math.round((h - iconSize) / 2)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="#534AB7"/>
  <g transform="translate(${ix},${iy})">${makeTIcon(iconSize, 'rgba(255,255,255,0.15)')}</g>
</svg>`
}

// ── maskable 아이콘 SVG (full-bleed, 모서리 없음) ────────────────
function makeMaskableSvg(s) {
  const bx  = Math.round(s * 0.10)
  const bw  = Math.round(s * 0.80)
  const bh  = Math.round(s * 0.14)
  const by  = Math.round(s * 0.18)
  const vx  = Math.round(s * 0.43)
  const vw  = Math.round(s * 0.14)
  const vy  = by
  const vh  = Math.round(s * 0.64)
  const rr  = Math.round(bh * 0.3)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
  <rect width="${s}" height="${s}" fill="#534AB7"/>
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${rr}" fill="white"/>
  <rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" rx="${rr}" fill="white"/>
</svg>`
}

// ── 렌더 헬퍼 ────────────────────────────────────────────────────
function render(svgStr, width) {
  const resvg = new Resvg(svgStr, { fitTo: { mode: 'width', value: width } })
  return resvg.render().asPng()
}

// ── 스플래시 크기 목록 ────────────────────────────────────────────
const SPLASHES = [
  [640,  1136],  // iPhone SE 1세대
  [750,  1334],  // iPhone 8/7/6
  [1242, 2208],  // iPhone 8+/7+/6+
  [1125, 2436],  // iPhone X/XS
  [828,  1792],  // iPhone XR/11
  [1242, 2688],  // iPhone XS Max/11 Pro Max
  [1170, 2532],  // iPhone 12/13/14
  [1284, 2778],  // iPhone 12 Pro Max/13 Pro Max/14 Plus
  [1179, 2556],  // iPhone 14 Pro/15/15 Pro
  [1290, 2796],  // iPhone 14 Pro Max/15 Plus/15 Pro Max
  [1536, 2048],  // iPad (레거시)
  [1668, 2388],  // iPad Air 4/5, iPad Pro 11"
  [2048, 2732],  // iPad Pro 12.9"
]

// ── 생성 실행 ────────────────────────────────────────────────────
mkdirSync(resolve(root, 'public/splash'), { recursive: true })
mkdirSync(resolve(root, 'public/icons'),  { recursive: true })

for (const [w, h] of SPLASHES) {
  const svg  = makeSplashSvg(w, h)
  const png  = render(svg, w)
  const name = `${w}x${h}.png`
  writeFileSync(resolve(root, `public/splash/${name}`), png)
  console.log(`✓ splash/${name}`)
}

// icon-180 (apple-touch-icon)
const icon180svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">
  ${makeTIcon(180)}
</svg>`
writeFileSync(resolve(root, 'public/icons/icon-180.png'), render(icon180svg, 180))
console.log('✓ icons/icon-180.png')

// icon-512-maskable
writeFileSync(resolve(root, 'public/icons/icon-512-maskable.png'), render(makeMaskableSvg(512), 512))
console.log('✓ icons/icon-512-maskable.png')

console.log('\n✅ 에셋 생성 완료')
