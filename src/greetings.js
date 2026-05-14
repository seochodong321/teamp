// 날짜별 특수 인사말 — { before, after } 구조로 name <em>을 사이에 삽입
const SPECIAL = {
  '01-01': { before: '새해 복 많이 받으세요, ', after: '님 🎊' },
  '12-25': { before: '메리 크리스마스, ',       after: '님 🎄' },
  '12-31': { before: '올 한 해도 수고했어요, ', after: '님 🥂' },
}

export function getGreeting(birthday) {
  const now = new Date()
  const todayMD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  if (SPECIAL[todayMD]) return SPECIAL[todayMD]
  if (birthday) {
    // YYYY-MM-DD(길이 10) 또는 MM-DD(길이 5) 모두 지원
    const bMD = birthday.length >= 8 ? birthday.slice(5) : birthday
    if (bMD === todayMD) return { before: '', after: '님의 생일이에요 🎂' }
  }
  return { before: '안녕하세요, ', after: '님' }
}
