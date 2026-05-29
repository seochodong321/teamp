import React from 'react'

// Teamp 브랜드 마크 — squircle + TEAMP 워드마크.
// 폰트 독립(아웃라인 path), 잔선 없음. 설치 아이콘(icon.svg / icon-512)과 동일한 디자인.
const P = "M-297.66-139.45L-191.21-139.65L-192.19-98.24L-221.29-97.07L-228.71-4.49L-269.93-2.34L-269.73-94.92L-298.83-93.36L-297.66-139.45Z M-185.40-140.82L-95.36-140.82Q-95.95-131.64-96.44-122.66Q-96.93-113.67-97.71-104.49L-97.71-104.49L-139.11-102.34L-140.09-90.04L-110.99-90.04L-113.14-59.77L-142.43-58.79L-143.41-44.53L-119.19-44.53L-102.00-44.53Q-102.59-33.79-103.22-23.19Q-103.86-12.60-104.35-1.95L-104.35-1.95L-188.53 0L-185.40-140.82Z M-8.98-139.84L29.10-8.40L-19.34-2.15L-25.20-24.22L-47.46-24.22L-52.34-2.15L-102.15-7.03L-63.28-137.11L-8.98-139.84ZM-43.36-54.10L-28.71-54.10L-36.13-88.09L-43.36-54.10Z M127.59-142.38L180.13-142.38L171.14 0.98L126.61 2.93L127.00-72.66L106.89-11.72L89.70-11.72L74.27-66.21L74.07-2.93L28.96-1.56L30.91-136.52L81.11-138.48L101.03-73.83L127.59-142.38Z M299.03-93.95L299.03-93.95Q299.03-84.47 296.20-77.15Q293.36-69.82 288.43-64.36Q283.50-58.89 276.86-55.08Q270.22-51.27 262.65-48.88Q255.08-46.48 246.98-45.36Q238.87-44.24 231.06-44.14L231.06-44.14L231.06 1.37L185.55 1.37Q185.55-21.00 185.65-43.16Q185.75-65.33 185.94-87.89L185.94-87.89Q186.14-99.80 186.04-111.72Q185.94-123.63 186.53-135.74L186.53-135.74Q199.03-139.45 211.53-141.31Q224.03-143.16 237.31-143.16L237.31-143.16Q244.83-143.16 252.35-141.94Q259.87-140.72 266.75-138.09Q273.64-135.45 279.54-131.49Q285.45-127.54 289.75-122.07Q294.05-116.60 296.54-109.62Q299.03-102.64 299.03-93.95ZM255.67-90.63L255.67-90.63Q255.67-96.97 251.81-100.54Q247.95-104.10 241.80-104.10L241.80-104.10Q239.75-104.10 237.55-103.76Q235.36-103.42 233.40-102.93L233.40-102.93L232.23-74.41Q233.60-74.22 234.87-74.22Q236.14-74.22 237.50-74.22L237.50-74.22Q241.02-74.22 244.29-75.39Q247.56-76.56 250.10-78.76Q252.64-80.96 254.15-83.94Q255.67-86.91 255.67-90.63Z"

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
        <linearGradient id="tm-bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0"    stopColor="#332A86" />
          <stop offset="0.52" stopColor="#4B41A6" />
          <stop offset="1"    stopColor="#6E61D8" />
        </linearGradient>
        <radialGradient id="tm-hl" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
          gradientTransform="translate(70 70) rotate(45) scale(330)">
          <stop offset="0" stopColor="#9A8FF0" stopOpacity="0.55" />
          <stop offset="1" stopColor="#9A8FF0" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="512" height="512" rx="114" fill="url(#tm-bg)" />
      <rect width="512" height="512" rx="114" fill="url(#tm-hl)" />
      <rect x="1.5" y="1.5" width="509" height="509" rx="112.5" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="3" />

      <g transform="translate(256 296) scale(0.6)">
        <g transform="skewX(-10)">
          {/* 입체 그림자 — 동일 path를 대각선으로 5겹 쌓아 압출 효과 */}
          {[8.5, 6.8, 5.1, 3.4, 1.7].map((o) => (
            <path key={o} d={P} transform={`translate(${o} ${o})`} fill="#191247" />
          ))}
          <path d={P} fill="none" stroke="#191247" strokeWidth="48" strokeLinejoin="round" strokeLinecap="round" />
          <path d={P} fill="none" stroke="#D2CBFF" strokeWidth="34" strokeLinejoin="round" strokeLinecap="round" />
          <path d={P} fill="#FFFFFF" stroke="#191247" strokeWidth="13" strokeLinejoin="round" strokeLinecap="round" paintOrder="stroke" />
        </g>
      </g>
    </svg>
  )
}
