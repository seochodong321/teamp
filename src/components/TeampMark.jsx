import React from 'react'

/**
 * T + 연결 노드 마크
 * T의 세 끝점(좌·우·하단)에 원형 노드 = "세 팀원이 연결된 구조"
 * SVG 자체에 배경 포함 → 어디서든 size prop 하나로 사용
 */
export default function TeampMark({ size = 40 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="teamp-mark-grad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6B5CE7" />
          <stop offset="100%" stopColor="#3D31B0" />
        </linearGradient>
      </defs>
      {/* 배경 */}
      <rect width="512" height="512" rx="115" fill="url(#teamp-mark-grad)" />
      {/* T 수평바 */}
      <rect x="88" y="136" width="336" height="60" rx="30" fill="white" />
      {/* T 수직바 */}
      <rect x="226" y="136" width="60" height="240" rx="30" fill="white" />
      {/* 노드: 좌 · 우 · 하단 */}
      <circle cx="118" cy="166" r="48" fill="white" />
      <circle cx="394" cy="166" r="48" fill="white" />
      <circle cx="256" cy="346" r="48" fill="white" />
    </svg>
  )
}
