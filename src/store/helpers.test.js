import { describe, it, expect, vi } from 'vitest'

// firebase.js 모듈 초기화를 막아 순수 함수만 테스트 (db/storage는 이 테스트에서 안 씀)
vi.mock('../firebase.js', () => ({ db: {}, storage: {}, auth: {}, messaging: null }))

import { USERNAME_RE, formatUnread, calcProgress, getWeekKey, todayStr, localDateStr } from './helpers.js'

const daysFromNow = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)

describe('USERNAME_RE — 닉네임 형식 (소문자·숫자·_ , 3~20자)', () => {
  it('유효한 닉네임', () => {
    for (const u of ['abc', 'a_b_c', 'user123', 'a1_', '___', 'a'.repeat(20)]) {
      expect(USERNAME_RE.test(u), `valid: ${u}`).toBe(true)
    }
  })
  it('무효: 길이·대문자·특수문자·공백·빈값·한글', () => {
    for (const u of ['ab', '', 'a'.repeat(21), 'Abc', 'ABC', 'a-b', 'a.b', 'a b', 'a@b', '한글유저', 'user!']) {
      expect(USERNAME_RE.test(u), `invalid: ${u}`).toBe(false)
    }
  })
})

describe('formatUnread — 안 읽음 배지', () => {
  it('0 이하 / falsy → 0', () => {
    for (const n of [0, -1, null, undefined, NaN]) expect(formatUnread(n)).toBe(0)
  })
  it('1~99 → 그대로', () => {
    expect(formatUnread(1)).toBe(1)
    expect(formatUnread(99)).toBe(99)
  })
  it('100 이상 → "+99"', () => {
    expect(formatUnread(100)).toBe('+99')
    expect(formatUnread(9999)).toBe('+99')
  })
})

describe('calcProgress — 진행률 경계', () => {
  it('시작 전(미래) → 0', () => {
    expect(calcProgress(daysFromNow(30), daysFromNow(60))).toBe(0)
  })
  it('종료 후(과거) → 100', () => {
    expect(calcProgress(daysFromNow(-60), daysFromNow(-30))).toBe(100)
  })
  it('진행 중 → 0 < p < 100', () => {
    const p = calcProgress(daysFromNow(-10), daysFromNow(10))
    expect(p).toBeGreaterThan(0)
    expect(p).toBeLessThan(100)
  })
})

describe('getWeekKey — 같은 주의 어떤 요일이든 같은 월요일 키', () => {
  it('월~일이 동일한 주 키를 반환', () => {
    const keys = ['08', '09', '10', '11', '12', '13', '14']
      .map((d) => getWeekKey(new Date(`2026-06-${d}T12:00:00`)))
    expect(new Set(keys).size).toBe(1)
    expect(keys[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('KST 자정 직후·자정 직전도 같은 주 키 (UTC 변환 오차 없음)', () => {
    // 과거 toISOString() 구현은 TZ=Asia/Seoul에서 월요일 00:30 → 전주 일요일로 빠졌음
    expect(getWeekKey(new Date('2026-06-08T00:30:00'))).toBe('2026-06-08')
    expect(getWeekKey(new Date('2026-06-14T23:50:00'))).toBe('2026-06-08')
  })
})

describe('todayStr / localDateStr — 로컬(KST) 기준 날짜', () => {
  it('KST 자정 직후에도 "오늘"이 어제로 밀리지 않음', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-12T00:30:00')) // TZ=Asia/Seoul (vitest.config)
    expect(todayStr()).toBe('2026-06-12')
    vi.useRealTimers()
  })
  it('localDateStr — 임의 Date를 로컬 YYYY-MM-DD로', () => {
    expect(localDateStr(new Date('2026-01-05T08:00:00'))).toBe('2026-01-05')
    expect(localDateStr(new Date('2026-12-31T23:59:00'))).toBe('2026-12-31')
  })
})
