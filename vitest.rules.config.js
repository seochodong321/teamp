import { defineConfig } from 'vitest/config'

// Firestore 규칙 테스트 — 에뮬레이터(Java) 필요. `npm run test:rules`로만 실행.
// 순수 테스트(npm test)와 분리해, 에뮬레이터 없이도 npm test는 항상 돌게 함.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 15000,
    hookTimeout: 30000,
  },
})
