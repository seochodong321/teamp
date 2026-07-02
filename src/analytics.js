// 제품 분석 — PMF 퍼널 계측 (가입→생성→초대수락→첫메시지→할일→랩업→꽃→공유).
// 원칙: 계측은 절대 제품을 깨지 않는다 — 미지원 브라우저·measurementId 없음·
// 광고차단 등 어떤 실패도 조용히 no-op. 번들 hot path에도 안 얹음(동적 import).
let _logEvent = null
let _pending = []          // init 전 발생 이벤트 소량 버퍼 (새로고침 직후 액션 유실 방지)

export const initAnalytics = async () => {
  try {
    const { getAnalytics, logEvent, isSupported } = await import('firebase/analytics')
    if (!(await isSupported())) return
    const { app } = await import('./firebase.js')
    const analytics = getAnalytics(app)   // measurementId 없으면 throw → catch로 no-op
    _logEvent = (name, params) => logEvent(analytics, name, params)
    _pending.forEach(([n, p]) => _logEvent(n, p))
    _pending = []
  } catch { /* 측정 불가 환경 — 제품 동작에 영향 없음 */ }
}

export const track = (name, params = {}) => {
  try {
    if (_logEvent) _logEvent(name, params)
    else if (_pending.length < 20) _pending.push([name, params])
  } catch { /* no-op */ }
}
