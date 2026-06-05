import React, { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { HOLIDAYS, ymd } from '../utils/holidays.js'
import styles from './CalendarInline.module.css'

function isSameDay(a, b) {
  if (!a || !b) return false
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate()
}
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmtYM(d) { return `${d.getFullYear()}년 ${d.getMonth()+1}월` }
function fmtDay(d) { return `${d.getMonth()+1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})` }

export default function CalendarInline({ project, currentUser }) {
  const addEvent    = useStore((s) => s.addEvent)
  const removeEvent = useStore((s) => s.removeEvent)
  const canManage   = useStore((s) => s.canManage)

  const [current,    setCurrent]    = useState(new Date())
  const [selected,   setSelected]   = useState(null)
  const [showForm,   setShowForm]   = useState(false)
  const [newTitle,   setNewTitle]   = useState('')
  const [newTime,    setNewTime]    = useState('09:00')
  const [scope,      setScope]      = useState('all')
  const [selRooms,   setSelRooms]   = useState([])
  const [isPersonal, setIsPersonal] = useState(false)

  // 안전장치
  if (!project)      return <div style={{ padding: 20, color: 'var(--text-secondary)' }}>프로젝트 정보를 불러오는 중...</div>
  if (!currentUser)  return <div style={{ padding: 20, color: 'var(--text-secondary)' }}>사용자 정보를 불러오는 중...</div>

  const events = Array.isArray(project.events) ? project.events : []
  const rooms  = Array.isArray(project.rooms)  ? project.rooms  : []

  const iCanManage = (typeof canManage === 'function') ? canManage(project, currentUser.id) : false

  // 달력 날짜 계산
  const monthStart = startOfMonth(current)
  const monthEnd   = endOfMonth(current)
  const startPad   = monthStart.getDay()
  const days       = []
  const cur = new Date(monthStart)
  while (cur <= monthEnd) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }

  const eventsOnDay = (day) =>
    events.filter((e) => {
      if (!e || !e.date) return false
      const evDate = new Date(e.date)
      if (isNaN(evDate.getTime())) return false
      if (e.isPersonal && e.createdBy !== currentUser.id) return false
      return isSameDay(evDate, day)
    })

  const selectedEvents = selected ? eventsOnDay(selected) : []

  const getLabel = (e) => {
    if (e.isPersonal) return { text: '나만', bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' }
    if (e.scope === 'all') return { text: '전체', bg: 'var(--primary-light)', color: 'var(--primary)' }
    const r = rooms.find((r) => r.id === (e.roomIds && e.roomIds[0]))
    return r
      ? { text: `#${r.name}`, bg: r.colorBg || 'var(--primary-light)', color: r.color || 'var(--primary)' }
      : { text: '팀별', bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' }
  }

  const handleAdd = () => {
    if (!newTitle.trim() || !selected) return
    if (typeof addEvent !== 'function') return
    addEvent(project.id, {
      title: newTitle.trim(),
      date: fmtDate(selected),
      time: newTime,
      scope: isPersonal ? 'personal' : scope,
      roomIds: !isPersonal && scope === 'rooms' ? selRooms : [],
      isPersonal,
    })
    setNewTitle('')
    setNewTime('09:00')
    setScope('all')
    setSelRooms([])
    setIsPersonal(false)
    setShowForm(false)
  }

  const handleRemove = (eventId) => {
    if (typeof removeEvent !== 'function') return
    removeEvent(project.id, eventId)
  }

  const isToday = (d) => isSameDay(d, new Date())

  return (
    <div className={styles.wrap}>
      <div className={styles.body}>
        {/* 캘린더 */}
        <div className={styles.cal}>
          <div className={styles.calHeader}>
            <button className={styles.navBtn}
              onClick={() => setCurrent((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>‹</button>
            <span className={styles.monthLabel}>{fmtYM(current)}</span>
            <button className={styles.navBtn}
              onClick={() => setCurrent((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>›</button>
          </div>

          <div className={styles.weekRow}>
            {['일','월','화','수','목','금','토'].map((d, i) => (
              <div key={d} className={`${styles.weekDay} ${i === 0 ? styles.weekDaySun : i === 6 ? styles.weekDaySat : ''}`}>{d}</div>
            ))}
          </div>

          <div className={styles.grid}>
            {Array.from({ length: startPad }).map((_, i) => (
              <div key={`pad-${i}`} className={styles.cellEmpty} />
            ))}
            {days.map((day) => {
              const evs = eventsOnDay(day)
              const sel = selected && isSameDay(day, selected)
              const hol = HOLIDAYS[ymd(day)]
              const dow = day.getDay()
              const dayCls = (hol || dow === 0) ? styles.dayNumRed : dow === 6 ? styles.dayNumBlue : ''
              return (
                <button
                  key={day.toISOString()}
                  className={`${styles.cell} ${isToday(day) ? styles.cellToday : ''} ${sel ? styles.cellSelected : ''}`}
                  onClick={() => { setSelected(day); setShowForm(false) }}
                >
                  <span className={`${styles.dayNum} ${dayCls}`}>{day.getDate()}</span>
                  {hol && <span className={styles.holidayName}>{hol}</span>}
                  {evs.slice(0, 2).map((e) => {
                    const lbl = getLabel(e)
                    return (
                      <span key={e.id} className={styles.evDot}
                        style={{ background: lbl.bg, color: lbl.color }}>
                        {e.title}
                      </span>
                    )
                  })}
                  {evs.length > 2 && (
                    <span className={styles.moreDot}>+{evs.length - 2}</span>
                  )}
                </button>
              )
            })}
          </div>

          <div className={styles.legend}>
            <div className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: 'var(--primary)' }} />
              <span>전체</span>
            </div>
            {rooms.filter((r) => !r.isDm).map((r) => (
              <div key={r.id} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: r.color }} />
                <span>{r.name}</span>
              </div>
            ))}
            <div className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }} />
              <span>나만보기</span>
            </div>
          </div>
        </div>

        {/* 사이드 패널 */}
        <div className={styles.panel}>
          {selected ? (
            <>
              <div className={styles.panelHeader}>
                <span className={styles.panelDate}>{fmtDay(selected)}</span>
                <button className={styles.addBtn} onClick={() => setShowForm(!showForm)}>
                  {showForm ? '취소' : '+ 추가'}
                </button>
              </div>

              {showForm && (
                <div className={styles.form}>
                  <input className={styles.formInput} value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="일정 제목" autoFocus />
                  <input className={styles.formInput} type="time" value={newTime}
                    onChange={(e) => setNewTime(e.target.value)} />

                  <div className={styles.scopeWrap}>
                    <p className={styles.scopeLabel}>공개 범위</p>
                    <div className={styles.scopeRow}>
                      <label className={`${styles.scopeBtn} ${isPersonal ? styles.scopeOn : ''}`}>
                        <input type="radio" checked={isPersonal}
                          onChange={() => { setIsPersonal(true); setScope('personal') }} />
                        나만 보기
                      </label>
                      <label className={`${styles.scopeBtn} ${!isPersonal && scope === 'all' ? styles.scopeOn : ''}`}>
                        <input type="radio" checked={!isPersonal && scope === 'all'}
                          onChange={() => { setIsPersonal(false); setScope('all') }} />
                        전체 공개
                      </label>
                      <label className={`${styles.scopeBtn} ${!isPersonal && scope === 'rooms' ? styles.scopeOn : ''}`}>
                        <input type="radio" checked={!isPersonal && scope === 'rooms'}
                          onChange={() => { setIsPersonal(false); setScope('rooms') }} />
                        팀별
                      </label>
                    </div>

                    {!isPersonal && scope === 'rooms' && (
                      <div className={styles.roomPicks}>
                        {rooms.filter((r) => !r.isDm).map((r) => (
                          <label key={r.id}
                            className={`${styles.roomPick} ${selRooms.includes(r.id) ? styles.roomPickOn : ''}`}
                            style={selRooms.includes(r.id) ? { borderColor: r.color, background: r.colorBg, color: r.color } : {}}>
                            <input type="checkbox" checked={selRooms.includes(r.id)}
                              onChange={() => setSelRooms((p) =>
                                p.includes(r.id) ? p.filter((x) => x !== r.id) : [...p, r.id]
                              )} />
                            # {r.name}
                          </label>
                        ))}
                      </div>
                    )}

                    {!isPersonal && (
                      <p className={styles.scopeHint}>
                        {scope === 'all' ? '📢 전체 채팅방에 알림이 가요' : scope === 'rooms' ? '📌 선택한 팀에만 알림이 가요' : ''}
                      </p>
                    )}
                  </div>

                  <button className={styles.formSubmit} onClick={handleAdd} disabled={!newTitle.trim()}>
                    등록
                  </button>
                </div>
              )}

              {selectedEvents.length === 0 && !showForm && (
                <p className={styles.noEvent}>이 날 일정이 없어요</p>
              )}

              <div className={styles.evList}>
                {selectedEvents.map((e) => {
                  const lbl = getLabel(e)
                  return (
                    <div key={e.id} className={styles.evCard}
                      style={{ borderLeftColor: lbl.color }}>
                      <div className={styles.evTop}>
                        <span className={styles.evTime}>{e.time}</span>
                        <span className={styles.evBadge}
                          style={{ background: lbl.bg, color: lbl.color }}>{lbl.text}</span>
                      </div>
                      <span className={styles.evTitle}>{e.title}</span>
                      {(iCanManage || e.createdBy === currentUser.id) && (
                        <button className={styles.removeBtn}
                          onClick={() => handleRemove(e.id)}>✕</button>
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
            {events.filter((e) => !e.isPersonal || e.createdBy === currentUser.id).length === 0 ? (
              <p className={styles.noEvent}>등록된 일정이 없어요</p>
            ) : (
              events
                .filter((e) => !e.isPersonal || e.createdBy === currentUser.id)
                .map((e) => {
                  const lbl = getLabel(e)
                  return (
                    <div key={e.id} className={styles.upcomingItem}>
                      <span className={styles.upcomingDate}>{e.date}</span>
                      <div className={styles.upcomingInfo}>
                        <span className={styles.upcomingName}>{e.title}</span>
                        <span className={styles.upcomingBadge}
                          style={{ background: lbl.bg, color: lbl.color }}>{lbl.text}</span>
                      </div>
                    </div>
                  )
                })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}