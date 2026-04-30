import React, { useState } from 'react'
import { useStore } from '../store/useStore.js'
import styles from './TodoBoard.module.css'

const COLUMNS = [
  { key: 'todo',        label: '📋 할 일',    color: '#6B6B6B' },
  { key: 'in-progress', label: '🚀 진행 중',  color: '#534AB7' },
  { key: 'done',        label: '✅ 완료',    color: '#0F6E56' },
]

const PRIORITY = {
  high:   { label: '🔴 높음', color: '#E24B4A', bg: '#FCEBEB' },
  medium: { label: '🟡 보통', color: '#854F0B', bg: '#FAEEDA' },
  low:    { label: '🟢 낮음', color: '#0F6E56', bg: '#E1F5EE' },
}

export default function TodoBoard({ project, currentUser }) {
  const { addTodo, updateTodo, deleteTodo } = useStore()
  const todos = project.todos || []

  const [showForm, setShowForm]   = useState(false)
  const [title, setTitle]         = useState('')
  const [assignee, setAssignee]   = useState('')
  const [dueDate, setDueDate]     = useState('')
  const [priority, setPriority]   = useState('medium')
  const [draggedId, setDraggedId] = useState(null)

  const today = new Date().toISOString().split('T')[0]

  const handleAdd = () => {
    if (!title.trim()) return
    addTodo(project.id, { title: title.trim(), assignee: assignee || null, dueDate: dueDate || null, priority })
    setTitle(''); setAssignee(''); setDueDate(''); setPriority('medium'); setShowForm(false)
  }

  const handleDragStart = (id) => setDraggedId(id)
  const handleDrop = (status) => {
    if (!draggedId) return
    updateTodo(project.id, draggedId, { status })
    setDraggedId(null)
  }

  const isOverdue = (dueDate, status) => {
    if (!dueDate || status === 'done') return false
    return dueDate < today
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
            placeholder="할 일 제목" autoFocus />
          <div className={styles.formRow}>
            <select className={styles.formSelect} value={assignee}
              onChange={(e) => setAssignee(e.target.value)}>
              <option value="">담당자 (선택)</option>
              {project.members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <input className={styles.formSelect} type="date" value={dueDate}
              onChange={(e) => setDueDate(e.target.value)} />
            <select className={styles.formSelect} value={priority}
              onChange={(e) => setPriority(e.target.value)}>
              <option value="low">🟢 낮음</option>
              <option value="medium">🟡 보통</option>
              <option value="high">🔴 높음</option>
            </select>
          </div>
          <button className={styles.formSubmit} onClick={handleAdd} disabled={!title.trim()}>
            등록
          </button>
        </div>
      )}

      <div className={styles.board}>
        {COLUMNS.map((col) => {
          const colTodos = todos.filter((t) => t.status === col.key)
          return (
            <div key={col.key}
              className={styles.column}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.key)}>
              <div className={styles.columnHeader}>
                <span className={styles.columnLabel} style={{ color: col.color }}>
                  {col.label}
                </span>
                <span className={styles.columnCount}>{colTodos.length}</span>
              </div>
              <div className={styles.cards}>
                {colTodos.length === 0 ? (
                  <div className={styles.emptyCard}>비어있어요</div>
                ) : (
                  colTodos.map((todo) => {
                    const overdue = isOverdue(todo.dueDate, todo.status)
                    const member = getMember(todo.assignee)
                    const pri = PRIORITY[todo.priority]
                    return (
                      <div key={todo.id}
                        className={`${styles.card} ${overdue ? styles.cardOverdue : ''}`}
                        draggable
                        onDragStart={() => handleDragStart(todo.id)}>
                        <div className={styles.cardTop}>
                          <span className={styles.priority} style={{ background: pri.bg, color: pri.color }}>
                            {pri.label}
                          </span>
                          <button className={styles.delete}
                            onClick={() => deleteTodo(project.id, todo.id)}>✕</button>
                        </div>
                        <p className={styles.title}>{todo.title}</p>
                        <div className={styles.cardBottom}>
                          {member && (
                            <div className={styles.assignee}>
                              <div className={styles.avatar}>{member.name.charAt(0)}</div>
                              <span className={styles.assigneeName}>{member.name}</span>
                            </div>
                          )}
                          {todo.dueDate && (
                            <span className={`${styles.dueDate} ${overdue ? styles.dueDateOver : ''}`}>
                              📅 {todo.dueDate}{overdue && ' (지남)'}
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
