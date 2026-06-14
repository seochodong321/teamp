import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

// 신호 위주 설정: no-undef(미정의 — topKeywords류 크래시 차단) · no-unused-vars ·
// react-hooks 규칙. 스타일 잡음은 끈다.
export default [
  { ignores: ['dist/**', 'node_modules/**', 'functions/**', 'public/**', '.claude/**', 'scripts/**', '*.config.js'] },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...js.configs.recommended.rules,
      'react/jsx-uses-vars': 'error',     // JSX에서 쓰는 import를 '미사용' 오탐하지 않게
      'react/jsx-uses-react': 'error',     // 명시적 import React 유지 코드 — '미사용' 오탐 방지
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: false }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['src/**/*.test.{js,jsx}'],
    languageOptions: { globals: { ...globals.node } },
  },
]
