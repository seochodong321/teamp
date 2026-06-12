// 프로덕션 에러 모니터링 (Sentry)
// - DSN은 공개 식별자라 코드에 둬도 안전 (Sentry 공식 문서 — 시크릿 아님)
// - main.jsx에서 렌더 후 dynamic import로 로드 → FCP/번들 크리티컬 패스 영향 없음
// - 대시보드: sentry.io (계정: COO)
import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: 'https://2d4bda88b713f29c689e0357b6302316@o4511549604691968.ingest.us.sentry.io/4511549612687360',
  environment: 'production',
  // 이 코드베이스는 실패를 catch에서 console.error로 삼키는 패턴이 많음
  // (notifyUser·deleteProjectDeep 등) — console.error를 자동 수집해 그 실패들을 가시화
  integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],
  // 개인정보(IP 등) 기본 수집 안 함 — 유저 중심 철학
  sendDefaultPii: false,
})
