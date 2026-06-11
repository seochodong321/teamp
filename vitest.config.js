import { defineConfig } from 'vitest/config'

// 순수 로직 단위 테스트 — Java/에뮬레이터 불필요, node 환경에서 바로 실행.
// 규칙 테스트(에뮬레이터 필요)는 별도 test:rules 스크립트로.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
