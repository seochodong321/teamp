import { defineConfig } from 'vitest/config'

// 순수 로직 단위 테스트 — Java/에뮬레이터 불필요, node 환경에서 바로 실행.
// 규칙 테스트(에뮬레이터 필요)는 별도 test:rules 스크립트로.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    // 한국 유저 기준 시간대 — UTC 러너(CI)에서도 KST 자정 경계 버그를 잡기 위함
    env: { TZ: 'Asia/Seoul' },
  },
})
