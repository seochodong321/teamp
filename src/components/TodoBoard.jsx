import React, { useState } from 'react'
import { useStore } from '../store/useStore.js'
import styles from './TodoBoard.module.css'

const COLUMNS = [
  { key: 'todo',        label: '할 일',    emoji: '📋', color: '#6B6B6B' },
  { key: 'in-progress', label: '진행 중',  emoji: '🚀', color: '#534AB7' },
  { key: 'done',        label: '완료',     emoji: '✅', color: '#0F6E56' },
]

const PRIORITY = {
  high:   { label: '높음', color: '#E24B4A', bg: '#FCEBEB', dot: '🔴' },
  medium: { label: '보통', color: '#854F0B', bg: '#FAEEDA', dot: '🟡' },
  low:    { label: '낮음', color: '#0F6E56', bg: '#E1F5EE', dot: '🟢' },
}

function getDueDateInfo(dueDate, today, status) {
  if (!dueDate) return null
  const diff = Math.round((new Date(dueDate) - new Date(today)) / 86400000)
  const done = status === 'done'
  if (diff === 0) return { label: '오늘 마감', overdue: false, urgent: !done }
  if (diff > 0)   return { label: `D-${diff}`, overdue: false, urgent: diff <= 3 && !done }
  if (done)       return { label: `D+${-diff}`, overdue: false, urgent: false }
  return { label: `D+${-diff} 초과`, overdue: true, urgent: true }
}

// 구 assignee(단수) → assignees(복수) 하위호환
function getAssignees(todo) {
  if (Array.isArray(todo.assignees) && todo.assignees.length > 0) return todo.assignees
  if (todo.assignee) return [todo.assignee]
  return []
}

export default function TodoBoard({ project, currentUser }) {
  const { addTodo, updateTodo, deleteTodo } = useStore()
  const todos = project.todos || []

  const [showForm, setShowForm]       = useState(false)
  const [title, setTitle]             = useState('')
  const [assignees, setAssignees]     = useState([])
  const [dueDate, setDueDate]         = useState('')
  const [priority, setPriority]       = useState('medium')
  const [draggedId, setDraggedId]     = useState(null)

  const today = new Date().toISOString().split('T')[0]

  const toggleAssignee = (id) =>
    setAssignees((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id])

  const handleAdd = () => {
    if (!title.trim()) return
    addTodo(project.id, {
      title: title.trim(),
      assignees,
      dueDate: dueDate || null,
      priority,
    })
    setTitle(''); setAssignees([]); setDueDate(''); setPriority('medium'); setShowForm(false)
  }

  const handleDragStart = (id) => setDraggedId(id)
  const handleDrop = (status) => {
    if (!draggedId) return
    updateTodo(project.id, draggedId, { status })
    setDraggedId(null)
  }

  const getMember = (id) => project.members.find((m) => m.id === id)

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <p className={styles.desc}>드래그해서 상태를 바꿀 수 있어요</p>
        <button className={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? '취소' : '+ 할 일 추가'}
        </button>
      </div>

      {showForm && (
        <div className={styles.form}>
          <input className={styles.formInput} value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="할 일 제목을 입력하세요" autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAdd() }} />

          {/* 담당자 — 복수 선택 */}
          <div className={styles.assigneeSection}>
            <span className={styles.assigneeLabel}>담당자</span>
            <div className={styles.assigneeChips}>
              {project.members.map((m) => {
                const active = assignees.includes(m.id)
                return (
                  <button key={m.id} type="button"
                    className={`${styles.assigneeChip} ${active ? styles.assigneeChipActive : ''}`}
                    onClick={() => toggleAssignee(m.id)}>
                    <div className={`${styles.chipAvatar} ${active ? styles.chipAvatarActive : ''}`}>
                      {m.name.charAt(0)}
                    </div>
                    <span>{m.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formField}>
              <span className={styles.formFieldLabel}>마감일</span>
              <input className={styles.formSelect} type="date" value={dueDate}
                onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className={styles.formField}>
              <span className={styles.formFieldLabel}>우선순위</span>
              <select className={styles.formSelect} value={priority}
                onChange={(e) => setPriority(e.target.value)}>
                <option value="low">🟢 낮음</option>
                <option value="medium">🟡 보통</option>
                <option value="high">🔴 높음</option>
              </select>
            </div>
          </div>

          <button className={styles.formSubmit} onClick={handleAdd} disabled={!title.trim()}>
            등록하기
          </button>
        </div>
      )}

      <div className={styles.board}>
        {COLUMNS.map((col) => {
          const colTodos = todos.filter((t) => t.status === col.key)
          return (
            <div key={col.key} className={styles.column}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.key)}>
              <div className={styles.columnHeader}>
                <span className={styles.columnLabel} style={{ color: col.color }}>
                  {col.emoji} {col.label}
                </span>
                <span className={styles.columnCount}>{colTodos.length}</span>
              </div>
              <div className={styles.cards}>
                {colTodos.length === 0 ? (
                  <div className={styles.emptyCard}>
                    <span className={styles.emptyCardIcon}>{col.emoji}</span>
                    <span>{col.key === 'done' ? '완료된 할 일이 없어요' : '비어있어요'}</span>
                  </div>
                ) : (
                  colTodos.map((todo) => {
                    const todoAssignees = getAssignees(todo)
                    const pri = PRIORITY[todo.priority] || PRIORITY.medium
                    const dueDateInfo = getDueDateInfo(todo.dueDate, today, todo.status)
                    return (
                      <div key={todo.id}
                        className={`${styles.card} ${dueDateInfo?.overdue ? styles.cardOverdue : ''}`}
                        style={{ borderTop: `2px solid ${pri.color}` }}
                        draggable
                        onDragStart={() => handleDragStart(todo.id)}>
                        <div className={styles.cardTop}>
                          <span className={styles.priority} style={{ background: pri.bg, color: pri.color }}>
                            {pri.dot} {pri.label}
                          </span>
                          <button className={styles.delete}
                            onClick={() => deleteTodo(project.id, todo.id)}>✕</button>
                        </div>
                        <p className={styles.title}>{todo.title}</p>
                        <div className={styles.cardBottom}>
                          {todoAssignees.length > 0 && (
                            <div className={styles.assignees}>
                              {todoAssignees.map((id) => {
                                const m = getMember(id)
                                if (!m) return null
                                return (
                                  <div key={id} className={styles.assigneeItem} title={m.name}>
                                    <div className={styles.avatar}>{m.name.charAt(0)}</div>
                                    {todoAssignees.length === 1 && (
                                      <span className={styles.assigneeName}>{m.name}</span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                          {dueDateInfo && (
                            <span className={`${styles.dueDate} ${dueDateInfo.overdue ? styles.dueDateOver : ''} ${dueDateInfo.urgent && !dueDateInfo.overdue ? styles.dueDateUrgent : ''}`}>
                              📅 {dueDateInfo.label}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
