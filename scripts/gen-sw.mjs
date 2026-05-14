/**
 * firebase-messaging-sw.js 생성 스크립트
 * 템플릿의 플레이스홀더를 환경 변수로 교체해서 public/ 에 씁니다.
 *
 * 사용:
 *   node scripts/gen-sw.mjs               (로컬: .env 파일 읽기)
 *   node scripts/gen-sw.mjs --production  (Vercel: 시스템 env 사용)
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const root  = resolve(__dir, '..')

// --production 플래그가 없으면 로컬 .env 파일에서 로드
if (!process.argv.includes('--production')) {
  try {
    const envRaw = readFileSync(resolve(root, '.env'), 'utf-8')
    for (const line of envRaw.split('\n')) {
      const [k, ...rest] = line.trim().split('=')
      if (k && rest.length) process.env[k] = rest.join('=').replace(/^["']|["']$/g, '')
    }
  } catch { /* .env 없으면 시스템 환경 변수 사용 */ }
}

const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

const missing = required.filter((k) => !process.env[k])
if (missing.length) {
  console.error('❌ 환경 변수 누락:', missing.join(', '))
  process.exit(1)
}

const template = readFileSync(resolve(root, 'public/firebase-messaging-sw.template.js'), 'utf-8')

const output = template
  .replace('__FIREBASE_API_KEY__',            process.env.VITE_FIREBASE_API_KEY)
  .replace('__FIREBASE_AUTH_DOMAIN__',        process.env.VITE_FIREBASE_AUTH_DOMAIN)
  .replace('__FIREBASE_PROJECT_ID__',         process.env.VITE_FIREBASE_PROJECT_ID)
  .replace('__FIREBASE_STORAGE_BUCKET__',     process.env.VITE_FIREBASE_STORAGE_BUCKET)
  .replace('__FIREBASE_MESSAGING_SENDER_ID__',process.env.VITE_FIREBASE_MESSAGING_SENDER_ID)
  .replace('__FIREBASE_APP_ID__',             process.env.VITE_FIREBASE_APP_ID)

writeFileSync(resolve(root, 'public/firebase-messaging-sw.js'), output)
console.log('✓ firebase-messaging-sw.js 생성 완료')
