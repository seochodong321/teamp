import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import styles from './CalendarPage.module.css'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const TYPE_ICON = { todo: '✅', event: '📅', milestone: '🏁' }
const PROJECT_COLORS = [
  '#4B41A6', '#0F6E56', '#6E4408', '#8A2A55',
  '#1565C0', '#6A1B9A', '#2E7D32', '#BF360C',
]

function getProjectColor(projectId, projectsColorMap) {
  return projectsColorMap[projectId] || '#4B41A6'
}

export default function CalendarPage() {
  const projects = useStore((s) => s.projects)
  const navigate = useNavigate()

  const [year, setYear]     = useState(() => new Date().getFullYear())
  const [month, setMonth]   = useState(() => new Date().getMonth())
  const [selected, setSelected] = useState(null) // 'YYYY-MM-DD'

  // 프로젝트별 색상 맵 (index 기반 고정 색상)
  const projectsColorMap = useMemo(() => {
    const map = {}
    projects.forEach((p, i) => {
      map[p.id] = p.color || PROJECT_COLORS[i % PROJECT_COLORS.length]
    })
    return map
  }, [projects])

  // 날짜 → 이벤트 목록 맵
  const eventMap = useMemo(() => {
    const map = {}
    const add = (dateStr, item) => {
      if (!dateStr) return
      const key = String(dateStr).slice(0, 10)
      ;(map[key] ??= []).push(item)
    }
    projects.forEach((p) => {
      const color = getProjectColor(p.id, projectsColorMap)
      p.todos?.forEach((t) => t.dueDate && add(t.dueDate, {
        type: 'todo', label: t.title, color, projectName: p.name, projectId: p.id,
      }))
      p.events?.forEach((e) => e.date && add(e.date, {
        type: 'event', label: e.title, color, projectName: p.name, projectId: p.id,
      }))
      p.milestones?.forEach((m) => m.targetDate && add(m.targetDate, {
        type: 'milestone', label: m.title, color, projectName: p.name, projectId: p.id,
      }))
    })
    return map
  }, [projects, projectsColorMap])

  const goMonth = (dir) => {
    setSelected(null)
    setMonth((m) => {
      const next = m + dir
      if (next < 0) { setYear((y) => y - 1); return 11 }
      if (next > 11) { setYear((y) => y + 1); return 0 }
      return next
    })
  }

  // 달력 날짜 배열 생성
  const calDays = useMemo(() => {
    const first = new Date(year, month, 1)
    const startDow = first.getDay()         // 0=일
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < startDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    // 6행 채우기
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [year, month])

  const todayStr = useMemo(() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  }, [])

  const toKey = (d) => d ? `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null

  const selectedEvents = selected ? (eventMap[selected] || []) : []

  // 이번 달 총 이벤트 수
  const monthTotal = useMemo(() => {
    let cnt = 0
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
    Object.entries(eventMap).forEach(([k, v]) => { if (k.startsWith(prefix)) cnt += v.length })
    return cnt
  }, [eventMap, year, month])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>통합 캘린더</h1>
        {monthTotal > 0 && (
          <span className={styles.monthTotal}>이번 달 {monthTotal}개</span>
        )}
      </div>

      <div className={styles.calCard}>
        {/* 월 네비게이션 */}
        <div className={styles.monthNav}>
          <button className={styles.monthBtn} onClick={() => goMonth(-1)}>‹</button>
          <span className={styles.monthLabel}>{year}년 {month + 1}월</span>
          <button className={styles.monthBtn} onClick={() => goMonth(1)}>›</button>
        </div>

        {/* 요일 헤더 */}
        <div className={styles.weekRow}>
          {DAYS.map((d, i) => (
            <div key={d} className={`${styles.weekDay} ${i === 0 ? styles.sun : i === 6 ? styles.sat : ''}`}>{d}</div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className={styles.grid}>
          {calDays.map((d, idx) => {
            const key = toKey(d)
            const events = key ? (eventMap[key] || []) : []
            const isToday = key === todayStr
            const isSelected = key === selected
            const dow = idx % 7
            return (
              <div
                key={idx}
                className={`${styles.cell} ${!d ? styles.cellEmpty : ''} ${isToday ? styles.cellToday : ''} ${isSelected ? styles.cellSelected : ''} ${d && events.length > 0 ? styles.cellHasEvent : ''}`}
                onClick={() => d && setSelected(isSelected ? null : key)}
              >
                {d && (
                  <>
                    <span className={`${styles.dayNum} ${dow === 0 ? styles.sunNum : dow === 6 ? styles.satNum : ''}`}>{d}</span>
                    {events.length > 0 && (
                      <div className={styles.dots}>
                        {events.slice(0, 3).map((ev, i) => (
                          <span key={i} className={styles.dot} style={{ background: ev.color }} />
                        ))}
                        {events.length > 3 && <span className={styles.dotMore}>+{events.length - 3}</span>}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 선택한 날짜 이벤트 목록 */}
      {selected && (
        <div className={styles.eventPanel}>
          <div className={styles.eventPanelHeader}>
            <span className={styles.eventPanelDate}>
              {parseInt(selected.split('-')[1])}월 {parseInt(selected.split('-')[2])}일
            </span>
            <button className={styles.eventPanelClose} onClick={() => setSelected(null)}>✕</button>
          </div>
          {selectedEvents.length === 0 ? (
            <p className={styles.eventEmpty}>일정이 없어요</p>
          ) : (
            <div className={styles.eventList}>
              {selectedEvents.map((ev, i) => (
                <div
                  key={i}
                  className={styles.eventItem}
                  style={{ borderLeftColor: ev.color }}
                  onClick={() => ev.projectId && navigate(`/project/${ev.projectId}`)}
                >
                  <span className={styles.eventIcon}>{TYPE_ICON[ev.type]}</span>
                  <div className={styles.eventInfo}>
                    <p className={styles.eventLabel}>{ev.label}</p>
                    <p className={styles.eventProject}>{ev.projectName}</p>
                  </div>
                  <span className={styles.eventType}>{ev.type === 'todo' ? '할 일' : ev.type === 'event' ? '이벤트' : '마일스톤'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 프로젝트 범례 */}
      {projects.filter((p) => !p.isTutorial).length > 0 && (
        <div className={styles.legend}>
          <p className={styles.legendTitle}>프로젝트</p>
          <div className={styles.legendList}>
            {projects.filter((p) => !p.isTutorial).map((p) => (
              <div key={p.id} className={styles.legendItem} onClick={() => navigate(`/project/${p.id}`)}>
                <span className={styles.legendDot} style={{ background: getProjectColor(p.id, projectsColorMap) }} />
                <span className={styles.legendName}>{p.emoji && `${p.emoji} `}{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
