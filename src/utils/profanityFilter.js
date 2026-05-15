// 레엣스피크 정규화: 숫자/기호 → 알파벳 (f4ck → fuck 등 우회 방지)
function normalizeLeet(str) {
  return str
    .replace(/4/g, 'a')
    .replace(/3/g, 'e')
    .replace(/1/g, 'i')
    .replace(/0/g, 'o')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/\$/g, 's')
    .replace(/@/g, 'a')
}

// ── 서브스트링으로 차단 ────────────────────────────────────────
// 4자 이상 위주. 오탐(classic → 통과, asshole → 차단)이 적은 단어만 포함.
const SUBSTR_BLOCKED = [
  // 영어 욕설
  'fuck', 'fuk', 'fck', 'fucker', 'fuckin', 'fucked',
  'shit', 'shxt', 'shitt',
  'bitch', 'btch',
  'cunt', 'kunt',
  'cock', 'cok',
  'dick', 'dik',
  'pussy', 'puss1',
  'whore', 'wh0re',
  'bastard',
  'nigger', 'nigg', 'nigga',
  'faggot', 'fagot',
  'slut', 'sl0t',
  // 성적 단어
  'penis', 'pen1s',
  'vagina', 'vag1na',
  'porn', 'porno', 'p0rn',
  'tits', 'titty', 'titt',
  'boobs', 'boob',
  'anal', 'an4l',
  'horny', 'h0rny',
  'dildo', 'd1ldo',
  'hentai', 'hent4i',
  'cumshot',
  'asshole', 'assh0le',
  'masturbat',
  'orgasm',
  'erection',
  'boner', 'b0ner',
  'sex', 'sexy', 's3x', 's3xy',
  'nude', 'nud3',
  // 한국어 로마자 욕설 (영문 아이디 우회 시도 대응)
  'sibal', 'shibal', 'shival', 'ssibal',
  'byeongsin', 'byungsin', 'byongsin',
  'gaesaek', 'gaeseg', 'geseki', 'gaeseki',
  'jiral', 'jirar',
  'changnyeo', 'changnyo',
  'boji', // 보지
  'jaji', // 자지
]

// ── 세그먼트(언더스코어 단위)로만 차단 ────────────────────────
// classic → ass 포함이지만 통과. ass_master → ass 세그먼트 차단.
const SEGMENT_BLOCKED = [
  'ass', 'asse', 'asses',
  'fag', 'fags',
  'cum',
  'tit',
  'rape', 'rapist',
  'jot', // 좆 로마자
]

/**
 * @param {string} username  — @ 제외한 raw 아이디 (예: "teampuser123")
 * @returns {boolean}  true면 차단
 */
export function containsProfanity(username) {
  const base = username.toLowerCase().replace(/_/g, '')
  const leet = normalizeLeet(base)

  for (const w of SUBSTR_BLOCKED) {
    if (base.includes(w) || leet.includes(w)) return true
  }

  // 언더스코어로 구분된 각 토큰에서 숫자 제거 후 검사
  const segments = username.toLowerCase().split('_').map((s) => s.replace(/\d/g, ''))
  for (const seg of segments) {
    if (!seg) continue
    const segLeet = normalizeLeet(seg)
    for (const w of SEGMENT_BLOCKED) {
      if (seg === w || segLeet === w) return true
    }
  }

  return false
}
