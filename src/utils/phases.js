import { localDateStr, todayStr } from '../store/helpers.js'

const MS_DAY = 86400000

const toDate = (s) => new Date(s + 'T00:00:00')

function todayMidnight() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d
}

function addDays(dateStr, n) {
  const d = toDate(dateStr)
  d.setDate(d.getDate() + n)
  return localDateStr(d)
}

function daysBetween(fromStr, toStr) {
  return Math.round((toDate(toStr) - toDate(fromStr)) / MS_DAY)
}

// 오늘부터 dateStr까지 며칠 (양수 = 미래)
export function daysFromToday(dateStr) {
  return Math.round((toDate(dateStr) - todayMidnight()) / MS_DAY)
}

// 기존 startDate/endDate 필드와 호환되는 날짜 추출
function pDates(p) {
  const start   = p.projectStartDate || p.startDate   || ''
  const end     = p.projectEndDate   || p.endDate     || ''
  const postEnd = p.postEndDate      || (end ? addDays(end, 14) : '')
  const created = (p.createdAt?.slice?.(0, 10)) || start
  return { start, end, postEnd, created }
}

// 'pre' | 'project' | 'post'
export function getCurrentPhase(p) {
  const { start, end } = pDates(p)
  if (!start) return 'project'
  const now = todayMidnight()
  if (now < toDate(start)) return 'pre'
  if (end && now <= toDate(end)) return 'project'
  return 'post'
}

// 통합 D-Day 레이블 → { main, sub?, phase, cls }
export function getDDayLabel(p) {
  const { start, end } = pDates(p)
  const phase = getCurrentPhase(p)

  if (phase === 'pre') {
    const dStart = daysFromToday(start)
    const dEnd   = end ? daysFromToday(end) : null
    return {
      main: `🚀 시작 D-${dStart}`,
      sub:  dEnd != null ? `마감 D-${dEnd}` : null,
      phase, cls: 'ddayPre',
    }
  }

  if (phase === 'project') {
    if (!end) return { main: '진행 중', phase, cls: 'ddayNormal' }
    const d = daysFromToday(end)
    if (d < 0)   return { main: '기한 초과', phase, cls: 'ddayOver' }
    if (d === 0) return { main: '⏰ D-DAY',  phase, cls: 'ddayUrgent' }
    if (d <= 3)  return { main: `⏰ 마감 D-${d}`, phase, cls: 'ddayUrgent' }
    if (d <= 7)  return { main: `마감 D-${d}`, phase, cls: 'ddayWarning' }
    return { main: `진행 중 · D-${d}`, phase, cls: 'ddayNormal' }
  }

  // post
  const daysSince = end ? Math.max(0, -daysFromToday(end)) : 0
  return { main: '📝 포스트', sub: `마친 지 ${daysSince}일`, phase, cls: 'ddayPost' }
}

// 3분할 진행률 바 데이터
// null = 날짜 정보 부족 (폴백: 단순 진행률 바)
export function getPhaseBar(p) {
  const { start, end } = pDates(p)
  if (!start || !end) return null

  const todayS = todayStr()

  // pre-phase일 땐 오늘을 기준점으로 삼아야 프리 구간이 올바르게 표시됨
  // 이미 시작한 경우엔 start가 기준점 (pre 구간 = 0)
  const tlStart  = todayS < start ? todayS : start
  const preDays  = Math.max(0, daysBetween(tlStart, start))
  const projDays = Math.max(0, daysBetween(start, end))
  const total    = Math.max(1, preDays + projDays)

  // post는 고정 8% 슬리버 — 기간에 관계없이 항상 작게 표시
  const AVAIL  = 92
  const prePct  = Math.round((preDays / total) * AVAIL)
  const projPct = AVAIL - prePct  // 나머지 전부 (반올림 오차 흡수)

  // 오늘 점: post 구간에 있을 때는 pre+proj 끝 지점에 고정
  const elapsed = Math.max(0, daysBetween(tlStart, todayS))
  const pos     = todayS > end
    ? AVAIL
    : Math.min(AVAIL, Math.round((elapsed / total) * AVAIL))

  return { prePct, projPct, postPct: 100 - AVAIL, pos, phase: getCurrentPhase(p) }
}
