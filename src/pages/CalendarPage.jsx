import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import styles from './CalendarPage.module.css'

function parseISO(str) { return new Date(str) }
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function isToday(d) { return isSameDay(d, new Date()) }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }
function eachDayOfInterval({ start, end }) {
  const days = [], cur = new Date(start)
  while (cur <= end) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
  return days
}
function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function formatYearMonth(d) { return `${d.getFullYear()}년 ${d.getMonth()+1}월` }
function formatDayLabel(d) {
  return `${d.getMonth()+1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`
}

export default function CalendarPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { projects, currentUser, addEvent, removeEvent, canManage } = useStore()
  const project = projects.find((p) => p.id === projectId)

  const [current,  setCurrent]  = useState(new Date())
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newTime,  setNewTime]  = useState('09:00')
  const [scope,    setScope]    = useState('all')    // 'all' | 'room'
  const [targetRoom, setTargetRoom] = useState('')

  if (!project) return <div>프로젝트를 찾을 수 없어요</div>

  const iCanManage = canManage(project, currentUser.id)
  const monthStart = startOfMonth(current)
  const monthEnd   = endOfMonth(current)
  const days       = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad   = monthStart.getDay()

  const eventsOnDay = (day) => project.events.filter((e) => isSameDay(parseISO(e.date), day))
  const selectedEvents = selected ? eventsOnDay(selected) : []

  const getRoomColor = (roomId) => {
    const r = project.rooms.find((r) => r.id === roomId)
    return r ? { color: r.color, bg: r.colorBg } : { color: 'var(--primary)', bg: 'var(--primary-light)' }
  }

  const handleAdd = () => {
    if (!newTitle.trim() || !selected) return
    addEvent(project.id, {
      title: newTitle.trim(),
      date: formatDate(selected),
      time: newTime,
      scope,
      roomId: scope === 'room' ? targetRoom : null,
    })
    setNewTitle(''); setNewTime('09:00'); setScope('all'); setTargetRoom(''); setShowForm(false)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate(`/project/${projectId}`)}>← {project.name}</button>
        <h1 className={styles.title}>공용 캘린더</h1>
      </div>

      <div className={styles.body}>
        {/* 캘린더 */}
        <div className={styles.calWrap}>
          <div className={styles.calHeader}>
            <button className={styles.navBtn} onClick={() => setCurrent((d) => new Date(d.getFullYear(), d.getMonth()-1, 1))}>‹</button>
            <span className={styles.monthLabel}>{formatYearMonth(current)}</span>
            <button className={styles.navBtn} onClick={() => setCurrent((d) => new Date(d.getFullYear(), d.getMonth()+1, 1))}>›</button>
          </div>

          <div className={styles.weekRow}>
            {['일','월','화','수','목','금','토'].map((d) => <div key={d} className={styles.weekDay}>{d}</div>)}
          </div>

          <div className={styles.grid}>
            {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} className={styles.cellEmpty} />)}
            {days.map((day) => {
              const evs = eventsOnDay(day)
              const sel = selected && isSameDay(day, selected)
              return (
                <button key={day.toISOString()}
                  className={`${styles.cell} ${isToday(day) ? styles.cellToday : ''} ${sel ? styles.cellSelected : ''}`}
                  onClick={() => { setSelected(day); setShowForm(false) }}>
                  <span className={styles.dayNum}>{day.getDate()}</span>
                  {evs.slice(0, 2).map((e) => {
                    const rc = e.scope === 'room' ? getRoomColor(e.roomId) : null
                    return (
                      <span key={e.id} className={styles.eventDot}
                        style={rc ? { background: rc.bg, color: rc.color } : {}}>
                        {e.title}
                      </span>
                    )
                  })}
                  {evs.length > 2 && <span className={styles.moreDot}>+{evs.length - 2}</span>}
                </button>
              )
            })}
          </div>

          {/* 범례 */}
          <div className={styles.legend}>
            <div className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: 'var(--primary)' }} />
              <span>전체 일정</span>
            </div>
            {project.rooms.map((r) => (
              <div key={r.id} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: r.color }} />
                <span>{r.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 사이드 패널 */}
        <div className={styles.panel}>
          {selected ? (
            <>
              <div className={styles.panelHeader}>
                <span className={styles.panelDate}>{formatDayLabel(selected)}</span>
                {iCanManage && (
                  <button className={styles.addBtn} onClick={() => setShowForm(!showForm)}>
                    {showForm ? '취소' : '+ 추가'}
                  </button>
                )}
              </div>

              {showForm && (
                <div className={styles.form}>
                  <input className={styles.formInput} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="일정 제목" />
                  <input className={styles.formInput} type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                  <div className={styles.scopeRow}>
                    <label className={`${styles.scopeBtn} ${scope === 'all' ? styles.scopeActive : ''}`}>
                      <input type="radio" name="scope" value="all" checked={scope === 'all'} onChange={() => setScope('all')} />
                      전체 공지
                    </label>
                    <label className={`${styles.scopeBtn} ${scope === 'room' ? styles.scopeActive : ''}`}>
                      <input type="radio" name="scope" value="room" checked={scope === 'room'} onChange={() => setScope('room')} />
                      팀별 공지
                    </label>
                  </div>
                  {scope === 'room' && (
                    <select className={styles.formInput} value={targetRoom} onChange={(e) => setTargetRoom(e.target.value)}>
                      <option value="">채팅방 선택</option>
                      {project.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  )}
                  <p className={styles.formHint}>
                    {scope === 'all' ? '📢 등록 시 모든 채팅방에 알림이 가요' : '📌 선택한 팀 채팅방에만 알림이 가요'}
                  </p>
                  <button className={styles.formSubmit} onClick={handleAdd}>등록</button>
                </div>
              )}

              {selectedEvents.length === 0 && !showForm && (
                <p className={styles.noEvent}>이 날 일정이 없어요</p>
              )}

              <div className={styles.eventList}>
                {selectedEvents.map((e) => {
                  const rc = e.scope === 'room' ? getRoomColor(e.roomId) : null
                  const room = project.rooms.find((r) => r.id === e.roomId)
                  return (
                    <div key={e.id} className={styles.eventCard}
                      style={{ borderLeftColor: rc ? rc.color : 'var(--primary)' }}>
                      <div className={styles.eventMeta}>
                        <span className={styles.eventTime}>{e.time}</span>
                        <span className={styles.eventScope}
                          style={rc ? { background: rc.bg, color: rc.color } : {}}>
                          {e.scope === 'all' ? '전체' : `#${room?.name || ''}`}
                        </span>
                      </div>
                      <div className={styles.eventTitle}>{e.title}</div>
                      {iCanManage && (
                        <button className={styles.removeBtn} onClick={() => removeEvent(project.id, e.id)}>✕</button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className={styles.panelEmpty}>
              <p>날짜를 선택하면</p>
              <p>일정을 확인할 수 있어요</p>
            </div>
          )}

          <div className={styles.upcoming}>
            <p className={styles.upcomingTitle}>다가오는 일정</p>
            {project.events.length === 0 && <p className={styles.noEvent}>등록된 일정이 없어요</p>}
            {project.events.map((e) => {
              const room = project.rooms.find((r) => r.id === e.roomId)
              const rc = e.scope === 'room' ? getRoomColor(e.roomId) : null
              return (
                <div key={e.id} className={styles.upcomingItem}>
                  <div className={styles.upcomingDate}>{e.date}</div>
                  <div className={styles.upcomingInfo}>
                    <span className={styles.upcomingTitle2}>{e.title}</span>
                    <span className={styles.upcomingBadge} style={rc ? { background: rc.bg, color: rc.color } : {}}>
                      {e.scope === 'all' ? '전체' : `#${room?.name || ''}`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}