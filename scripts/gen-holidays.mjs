// data.go.kr 한국천문연구원 특일정보(공휴일) → src/utils/holidays.js 생성.
// 공휴일 '날짜'는 공개정보라 정적 파일로 커밋(런타임 API·CORS 불필요).
// 인증키는 커밋하지 않음 — 환경변수로만 주입.
//   사용: DATAGOKR_KEY=<인증키> node scripts/gen-holidays.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const KEY = process.env.DATAGOKR_KEY
if (!KEY) { console.error('❌ DATAGOKR_KEY 환경변수가 필요해요'); process.exit(1) }

const YEARS = [2026, 2027, 2028]
const BASE = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo'
const out = {}

for (const year of YEARS) {
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0')
    const url = `${BASE}?serviceKey=${KEY}&solYear=${year}&solMonth=${mm}&_type=json&numOfRows=100`
    const res = await fetch(url)
    if (!res.ok) { console.error(`⚠️ ${year}-${mm} HTTP ${res.status}`); continue }
    const json = await res.json()
    const items = json?.response?.body?.items
    if (!items || !items.item) continue
    const arr = Array.isArray(items.item) ? items.item : [items.item]
    for (const it of arr) {
      if (it.isHoliday !== 'Y') continue
      const s = String(it.locdate)
      out[`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`] = it.dateName
    }
  }
}

const sorted = Object.keys(out).sort()
const body = sorted.map((k) => `  '${k}': '${out[k]}',`).join('\n')
const file = `// 한국 공휴일 ('YYYY-MM-DD': 이름) — scripts/gen-holidays.mjs가 data.go.kr
// 특일정보 API에서 생성. 직접 수정하지 말 것. 재생성: DATAGOKR_KEY=<키> node scripts/gen-holidays.mjs
export const HOLIDAYS = {
${body}
}

// 'YYYY-MM-DD' 포맷터 (Date → 키)
export const ymd = (d) =>
  \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-\${String(d.getDate()).padStart(2, '0')}\`
`
const target = resolve(dirname(fileURLToPath(import.meta.url)), '../src/utils/holidays.js')
writeFileSync(target, file)
console.log(`✅ ${sorted.length}개 공휴일 → src/utils/holidays.js`)
