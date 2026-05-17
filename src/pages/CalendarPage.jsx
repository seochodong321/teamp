import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import styles from './CalendarPage.module.css'

const DAYS_SHORT = ['일', '월', '화', '수', '목', '금', '토']
const DAYS_FULL  = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
const MONTH_KO   = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

const PROJECT_COLORS = [
  '#4B41A6','#0F6E56','#C2410C','#9333EA',
  '#1D4ED8','#0F766E','#B45309','#BE185D',
]

const TYPE_LABEL = { todo: '할 일', event: '이벤트', milestone: '마일스톤' }
const TYPE_ICON  = { todo: '✅', event: '📅', milestone: '🏁' }

function toDateKey(dateStr) {
  if (!dateStr) return null
  return String(dateStr).slice(0, 10)
}

export default function CalendarPage() {
  const currentUser = useStore((s) => s.currentUser)
  const projects    = useStore((s) => s.projects)
  const navigate    = useNavigate()

  const [year, setYear]     = useState(() => new Date().getFullYear())
  const [month, setMonth]   = useState(() => new Date().getMonth())
  const [selected, setSelected] = useState(null) // 'YYYY-MM-DD' | null

  // 진행 중인 프로젝트만
  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === 'active' && !p.isTutorial),
    [projects]
  )

  // 프로젝트 색상 맵
  const colorMap = useMemo(() => {
    const map = {}
    activeProjects.forEach((p, i) => {
      map[p.id] = p.color || PROJECT_COLORS[i % PROJECT_COLORS.length]
    })
    return map
  }, [activeProjects])

  // 날짜 → 이벤트 목록 맵
  const eventMap = useMemo(() => {
    const map = {}
    const add = (dateStr, item) => {
      const key = toDateKey(dateStr)
      if (!key) return
      ;(map[key] ??= []).push(item)
    }
    activeProjects.forEach((p) => {
      const color = colorMap[p.id]

      // 할 일: 내게 배정된 것만, 완료되지 않은 것만
      p.todos?.forEach((t) => {
        if (!t.dueDate) return
        if (t.status === 'done') return
        const assignees = Array.isArray(t.assignees) ? t.assignees : (t.assignee ? [t.assignee] : [])
        if (assignees.length > 0 && !assignees.includes(currentUser?.id)) return
        add(t.dueDate, { type: 'todo', label: t.title, color, projectName: p.name, projectId: p.id, done: false })
      })

      // 이벤트 & 마일스톤: 전체 표시
      p.events?.forEach((e) => {
        if (!e.date) return
        add(e.date, { type: 'event', label: e.title, color, projectName: p.name, projectId: p.id })
      })
      p.milestones?.forEach((m) => {
        if (!m.targetDate) return
        add(m.targetDate, { type: 'milestone', label: m.title, color, projectName: p.name, projectId: p.id })
      })
    })
    return map
  }, [activeProjects, colorMap, currentUser?.id])

  // 이번 달 날짜 배열 (이전/다음 달 날짜 포함)
  const calDays = useMemo(() => {
    const firstDow   = new Date(year, month, 1).getDay()
    const lastDay    = new Date(year, month + 1, 0).getDate()
    const prevLastDay = new Date(year, month, 0).getDate()
    const cells = []
    for (let i = firstDow - 1; i >= 0; i--) cells.push({ d: prevLastDay - i, type: 'prev' })
    for (let d = 1; d <= lastDay; d++) cells.push({ d, type: 'cur' })
    let nextD = 1
    while (cells.length % 7 !== 0) cells.push({ d: nextD++, type: 'next' })
    return cells
  }, [year, month])

  const todayStr = useMemo(() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`
  }, [])

  const toKey = (cell) => cell.type === 'cur'
    ? `${year}-${String(month+1).padStart(2,'0')}-${String(cell.d).padStart(2,'0')}`
    : null

  const goMonth = (dir) => {
    setSelected(null)
    setMonth((m) => {
      const next = m + dir
      if (next < 0) { setYear((y) => y - 1); return 11 }
      if (next > 11) { setYear((y) => y + 1); return 0 }
      return next
    })
  }

  const goToday = () => {
    const now = new Date()
    setYear(now.getFullYear())
    setMonth(now.getMonth())
    setSelected(todayStr)
  }

  // 선택된 날짜 이벤트
  const selectedEvents = selected ? (eventMap[selected] || []) : []

  // 이번 달 + 다음 2주 예정 일정 (오늘 이후)
  const upcoming = useMemo(() => {
    const items = []
    const now = todayStr
    Object.entries(eventMap).forEach(([key, evs]) => {
      if (key >= now) evs.forEach((ev) => items.push({ ...ev, date: key }))
    })
    items.sort((a, b) => a.date.localeCompare(b.date))
    return items.slice(0, 20)
  }, [eventMap, todayStr])

  // 선택된 날짜의 요일 + 포맷
  const selectedLabel = useMemo(() => {
    if (!selected) return null
    const [y, m, d] = selected.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay()
    return `${m}월 ${d}일 ${DAYS_FULL[dow]}`
  }, [selected])

  return (
    <div className={styles.page}>

      {/* ── 헤더 ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>통합 캘린더</h1>
          <p className={styles.subtitle}>진행 중인 프로젝트의 내 일정</p>
        </div>
        <button className={styles.todayBtn} onClick={goToday}>오늘</button>
      </div>

      <div className={styles.layout}>

        {/* ── 왼쪽: 달력 ── */}
        <div className={styles.calendarSide}>
          <div className={styles.calCard}>

            {/* 월 네비게이션 */}
            <div className={styles.monthNav}>
              <button className={styles.navArrow} onClick={() => goMonth(-1)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className={styles.monthLabel}>{year}년 {MONTH_KO[month]}</span>
              <button className={styles.navArrow} onClick={() => goMonth(1)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {/* 요일 헤더 */}
            <div className={styles.weekRow}>
              {DAYS_SHORT.map((d, i) => (
                <div key={d} className={`${styles.weekDay} ${i===0?styles.sun:i===6?styles.sat:''}`}>{d}</div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className={styles.grid}>
              {calDays.map((cell, idx) => {
                const { d, type } = cell
                const isOverflow = type !== 'cur'
                const key    = toKey(cell)
                const events = key ? (eventMap[key] || []) : []
                const isToday    = key === todayStr
                const isSel      = key === selected
                const dow        = idx % 7
                const isPast     = key && key < todayStr
                const todoEvs    = events.filter((e) => e.type === 'todo')
                const otherEvs   = events.filter((e) => e.type !== 'todo')
                const allPills   = [...otherEvs, ...todoEvs]
                const visiblePills = allPills.slice(0, 2)
                const pillOverflow = allPills.length - visiblePills.length

                return (
                  <div
                    key={idx}
                    className={[
                      styles.cell,
                      isOverflow ? styles.cellOverflow : styles.cellCurrent,
                      isToday     ? styles.cellToday     : '',
                      isSel       ? styles.cellSelected  : '',
                      isPast && !isOverflow ? styles.cellPast : '',
                    ].filter(Boolean).join(' ')}
                    style={isOverflow ? { background: '#FFFFFF', border: 'none', cursor: 'default' } : undefined}
                    onClick={() => !isOverflow && setSelected(isSel ? null : key)}
                  >
                    <span className={[
                      styles.dayNum,
                      isOverflow  ? styles.dayNumOverflow : '',
                      dow===0 && !isOverflow ? styles.sunNum : dow===6 && !isOverflow ? styles.satNum : '',
                      isToday ? styles.dayNumToday : '',
                    ].filter(Boolean).join(' ')}>{d}</span>

                    {!isOverflow && (
                      <>
                        {/* 이벤트 pill (데스크탑) */}
                        <div className={styles.pills}>
                          {visiblePills.map((ev, i) => (
                            <span key={i} className={styles.pill} style={{ background: ev.color + '22', color: ev.color, borderColor: ev.color + '55' }}>
                              {TYPE_ICON[ev.type]} <span className={styles.pillLabel}>{ev.label}</span>
                            </span>
                          ))}
                          {pillOverflow > 0 && (
                            <span className={styles.pillMore}>+{pillOverflow}개</span>
                          )}
                        </div>

                        {/* 도트만 (모바일) */}
                        {events.length > 0 && (
                          <div className={styles.dots}>
                            {events.slice(0, 4).map((ev, i) => (
                              <span key={i} className={styles.dot} style={{ background: ev.color }} />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 프로젝트 범례 */}
          {activeProjects.length > 0 && (
            <div className={styles.legend}>
              {activeProjects.map((p) => (
                <button key={p.id} className={styles.legendItem} onClick={() => navigate(`/project/${p.id}`)}>
                  <span className={styles.legendDot} style={{ background: colorMap[p.id] }} />
                  <span className={styles.legendName}>{p.emoji && `${p.emoji} `}{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── 오른쪽: 사이드 패널 ── */}
        <div className={styles.sidePanel}>

          {selected ? (
            /* 선택된 날짜 상세 */
            <div className={styles.dayPanel}>
              <div className={styles.dayPanelHeader}>
                <div>
                  <p className={styles.dayPanelDate}>{selectedLabel}</p>
                  <p className={styles.dayPanelCount}>
                    {selectedEvents.length > 0 ? `${selectedEvents.length}개의 일정` : '일정 없음'}
                  </p>
                </div>
                <button className={styles.dayPanelClose} onClick={() => setSelected(null)}>✕</button>
              </div>

              {selectedEvents.length === 0 ? (
                <div className={styles.emptyDay}>
                  <span className={styles.emptyDayIcon}>📭</span>
                  <p>이 날은 일정이 없어요</p>
                </div>
              ) : (
                <div className={styles.dayEventList}>
                  {selectedEvents.map((ev, i) => (
                    <div
                      key={i}
                      className={styles.dayEventItem}
                      style={{ '--ev-color': ev.color }}
                      onClick={() => navigate(`/project/${ev.projectId}`)}
                    >
                      <span className={styles.dayEventBar} style={{ background: ev.color }} />
                      <div className={styles.dayEventBody}>
                        <div className={styles.dayEventTop}>
                          <span className={styles.dayEventIcon}>{TYPE_ICON[ev.type]}</span>
                          <span className={styles.dayEventLabel}>{ev.label}</span>
                        </div>
                        <div className={styles.dayEventMeta}>
                          <span className={styles.dayEventProject}>{ev.projectName}</span>
                          <span className={styles.dayEventType} style={{ color: ev.color }}>{TYPE_LABEL[ev.type]}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* 다가오는 일정 */
            <div className={styles.upcomingPanel}>
              <p className={styles.upcomingTitle}>다가오는 일정</p>
              {upcoming.length === 0 ? (
                <div className={styles.emptyDay}>
                  <span className={styles.emptyDayIcon}>🎉</span>
                  <p>예정된 일정이 없어요</p>
                </div>
              ) : (
                <div className={styles.upcomingList}>
                  {upcoming.map((ev, i) => {
                    const [, m, d] = ev.date.split('-').map(Number)
                    const dow = new Date(ev.date).getDay()
                    const isT = ev.date === todayStr
                    return (
                      <div key={i} className={styles.upcomingItem} onClick={() => { setSelected(ev.date); setYear(Number(ev.date.split('-')[0])); setMonth(Number(ev.date.split('-')[1]) - 1) }}>
                        <div className={`${styles.upcomingDateBox} ${isT ? styles.upcomingDateBoxToday : ''}`}>
                          <span className={styles.upcomingDay}>{d}</span>
                          <span className={styles.upcomingDow}>{DAYS_SHORT[dow]}</span>
                        </div>
                        <div className={styles.upcomingBar} style={{ background: ev.color }} />
                        <div className={styles.upcomingInfo}>
                          <p className={styles.upcomingLabel}>{TYPE_ICON[ev.type]} {ev.label}</p>
                          <p className={styles.upcomingProject}>{ev.projectName}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
