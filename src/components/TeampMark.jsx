import React from 'react'

// 새 브랜드 아이콘 — squircle + TEAMP 워드마크 (Luckiest Guy, index.html에서 로드)
export default function TeampMark({ size = 40 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <style>{`.tm{font-family:'Luckiest Guy','Arial Black',sans-serif;font-size:200px;text-anchor:middle;letter-spacing:-2px;}`}</style>
      <defs>
        <linearGradient id="tm-bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0"    stopColor="#2D2580" />
          <stop offset="0.55" stopColor="#534AB7" />
          <stop offset="1"    stopColor="#7C6FDE" />
        </linearGradient>
        <radialGradient id="tm-hl" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
          gradientTransform="translate(72 72) rotate(45) scale(320)">
          <stop offset="0" stopColor="#9A8FF0" stopOpacity="0.5" />
          <stop offset="1" stopColor="#9A8FF0" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="512" height="512" rx="115" fill="url(#tm-bg)" />
      <rect width="512" height="512" rx="115" fill="url(#tm-hl)" />
      <rect width="512" height="512" rx="115" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />

      <g transform="translate(256 316) scale(0.68)">
        <g transform="skewX(-10)">
          <text className="tm" x="8"   y="8"   fill="#1A1450">TEAMP</text>
          <text className="tm" x="6.4" y="6.4" fill="#1A1450">TEAMP</text>
          <text className="tm" x="4.8" y="4.8" fill="#1A1450">TEAMP</text>
          <text className="tm" x="3.2" y="3.2" fill="#1A1450">TEAMP</text>
          <text className="tm" x="1.6" y="1.6" fill="#1A1450">TEAMP</text>
          <text className="tm" x="0" y="0" fill="none" stroke="#B8AEF7" strokeWidth="26"
            strokeLinejoin="round" strokeLinecap="round" paintOrder="stroke">TEAMP</text>
          <text className="tm" x="0" y="0" fill="#FFFFFF" stroke="#1A1450" strokeWidth="11"
            strokeLinejoin="round" strokeLinecap="round" paintOrder="stroke">TEAMP</text>
        </g>
        <g fill="#1A1450">
          <rect x="-250" y="38" width="30" height="8" rx="4" transform="rotate(-6 -235 42)" />
          <rect x="-218" y="50" width="18" height="7" rx="3.5" transform="rotate(-6 -209 53.5)" />
          <rect x="-140" y="42" width="24" height="7" rx="3.5" transform="rotate(-4 -128 45.5)" />
          <rect x="-54"  y="44" width="28" height="8" rx="4"   transform="rotate(-3 -40 48)" />
          <rect x="-18"  y="56" width="18" height="7" rx="3.5" transform="rotate(-3 -9 59.5)" />
          <rect x="60"   y="42" width="30" height="8" rx="4"   transform="rotate(-2 75 46)" />
          <rect x="100"  y="54" width="16" height="7" rx="3.5" transform="rotate(-2 108 57.5)" />
          <rect x="188"  y="44" width="26" height="8" rx="4"   transform="rotate(1 201 48)" />
          <rect x="222"  y="56" width="18" height="7" rx="3.5" transform="rotate(1 231 59.5)" />
        </g>
      </g>
    </svg>
  )
}
