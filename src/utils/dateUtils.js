export function getYearRange() {
  const current = new Date().getFullYear()
  return Array.from({ length: current - 1939 }, (_, i) => current - i)
}

export function relativeTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000)     return '방금'
  if (diff < 3600000)   return `${Math.floor(diff / 60000)}분 전`
  if (diff < 86400000)  return `${Math.floor(diff / 3600000)}시간 전`
  if (diff < 172800000) return '어제'
  const d = new Date(iso)
  const thisYear = new Date().getFullYear()
  if (d.getFullYear() === thisYear) return `${d.getMonth() + 1}월 ${d.getDate()}일`
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}
