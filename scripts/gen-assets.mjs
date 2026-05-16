/**
 * iOS 스플래시 스크린 + 앱 아이콘 PNG 생성
 * 디자인: T + 연결 노드 (좌·우·하단 원형 노드)
 * @resvg/resvg-js 사용 (폰트 의존 없음)
 */

import { Resvg } from '@resvg/resvg-js'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ── T+노드 아이콘 body (배경 제외, 흰색 요소만) ──────────────────
function makeIconBody(s) {
  const P = (v) => Math.round(s * v / 512)

  const barH  = P(60)
  const barRx = Math.round(barH / 2)
  const hx    = P(88)
  const hw    = P(336)
  const hy    = P(136)
  const vx    = P(226)
  const vw    = P(60)
  const vh    = P(240)
  const nr    = P(48)

  const lnx = hx + barRx          // 좌측 노드 cx
  const rnx = hx + hw - barRx     // 우측 노드 cx
  const ny  = hy + barRx          // 수평 노드 cy
  const bny = hy + vh - barRx     // 하단 노드 cy
  const cx  = Math.round(s / 2)

  return `
    <rect x="${hx}" y="${hy}" width="${hw}" height="${barH}" rx="${barRx}" fill="white"/>
    <rect x="${vx}" y="${hy}" width="${vw}" height="${vh}" rx="${barRx}" fill="white"/>
    <circle cx="${lnx}" cy="${ny}" r="${nr}" fill="white"/>
    <circle cx="${rnx}" cy="${ny}" r="${nr}" fill="white"/>
    <circle cx="${cx}" cy="${bny}" r="${nr}" fill="white"/>`
}

// ── 그라디언트 배경 defs ──────────────────────────────────────────
function makeBgDefs(w, h, id = 'icon-bg') {
  return `<defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="${w}" y2="${h}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6B5CE7"/>
      <stop offset="100%" stop-color="#3D31B0"/>
    </linearGradient>
  </defs>`
}

// ── 아이콘 SVG (배경 포함) ────────────────────────────────────────
function makeIconSvg(s, maskable = false) {
  const rx = maskable ? 0 : Math.round(s * 115 / 512)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
  ${makeBgDefs(s, s)}
  <rect width="${s}" height="${s}" rx="${rx}" fill="url(#icon-bg)"/>
  ${makeIconBody(s)}
</svg>`
}

// ── 스플래시 SVG ──────────────────────────────────────────────────
function makeSplashSvg(w, h) {
  const iconSize = Math.round(Math.min(w, h) * 0.22)
  const ix = Math.round((w - iconSize) / 2)
  const iy = Math.round((h - iconSize) / 2)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  ${makeBgDefs(w, h, 'splash-bg')}
  <rect width="${w}" height="${h}" fill="url(#splash-bg)"/>
  <g transform="translate(${ix},${iy})">${makeIconBody(iconSize)}</g>
</svg>`
}

// ── 렌더 헬퍼 ────────────────────────────────────────────────────
function render(svgStr, width) {
  const resvg = new Resvg(svgStr, { fitTo: { mode: 'width', value: width } })
  return resvg.render().asPng()
}

// ── 스플래시 크기 목록 ────────────────────────────────────────────
const SPLASHES = [
  [640,  1136],
  [750,  1334],
  [1242, 2208],
  [1125, 2436],
  [828,  1792],
  [1242, 2688],
  [1170, 2532],
  [1284, 2778],
  [1179, 2556],
  [1290, 2796],
  [1536, 2048],
  [1668, 2388],
  [2048, 2732],
]

// ── 생성 실행 ────────────────────────────────────────────────────
mkdirSync(resolve(root, 'public/splash'), { recursive: true })
mkdirSync(resolve(root, 'public/icons'),  { recursive: true })

for (const [w, h] of SPLASHES) {
  writeFileSync(resolve(root, `public/splash/${w}x${h}.png`), render(makeSplashSvg(w, h), w))
  console.log(`✓ splash/${w}x${h}.png`)
}

writeFileSync(resolve(root, 'public/icons/icon-180.png'),         render(makeIconSvg(180),       180))
console.log('✓ icons/icon-180.png')

writeFileSync(resolve(root, 'public/icons/icon-192.png'),         render(makeIconSvg(192),       192))
console.log('✓ icons/icon-192.png')

writeFileSync(resolve(root, 'public/icons/icon-512.png'),         render(makeIconSvg(512),       512))
console.log('✓ icons/icon-512.png')

writeFileSync(resolve(root, 'public/icons/icon-512-maskable.png'), render(makeIconSvg(512, true), 512))
console.log('✓ icons/icon-512-maskable.png')

console.log('\n✅ 에셋 생성 완료')
