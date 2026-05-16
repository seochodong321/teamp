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
  const [description, setDescription] = useState('')
  const [assignees, setAssignees]     = useState([])
  const [dueDate, setDueDate]         = useState('')
  const [priority, setPriority]       = useState('medium')
  const [draggedId, setDraggedId]     = useState(null)

  // 상세 팝업
  const [selectedTodo, setSelectedTodo] = useState(null)
  const [editing, setEditing]           = useState(false)
  const [editTitle, setEditTitle]       = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAssignees, setEditAssignees] = useState([])
  const [editDueDate, setEditDueDate]   = useState('')
  const [editPriority, setEditPriority] = useState('medium')

  const today = new Date().toISOString().split('T')[0]

  const toggleAssignee = (id) =>
    setAssignees((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id])

  const handleAdd = () => {
    if (!title.trim()) return
    addTodo(project.id, {
      title: title.trim(),
      description,
      assignees,
      dueDate: dueDate || null,
      priority,
    })
    setTitle(''); setDescription(''); setAssignees([]); setDueDate(''); setPriority('medium'); setShowForm(false)
  }

  const handleDragStart = (id) => setDraggedId(id)
  const handleDrop = (status) => {
    if (!draggedId) return
    updateTodo(project.id, draggedId, { status })
    setDraggedId(null)
  }

  const getMember = (id) => project.members.find((m) => m.id === id)

  const openDetail = (todo) => {
    setSelectedTodo(todo)
    setEditing(false)
  }

  const openEdit = () => {
    setEditTitle(selectedTodo.title)
    setEditDescription(selectedTodo.description || '')
    setEditAssignees(getAssignees(selectedTodo))
    setEditDueDate(selectedTodo.dueDate || '')
    setEditPriority(selectedTodo.priority || 'medium')
    setEditing(true)
  }

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return
    await updateTodo(project.id, selectedTodo.id, {
      title: editTitle.trim(),
      description: editDescription.trim(),
      assignees: editAssignees,
      dueDate: editDueDate || null,
      priority: editPriority,
    })
    setSelectedTodo((t) => ({ ...t, title: editTitle.trim(), description: editDescription.trim(), assignees: editAssignees, dueDate: editDueDate || null, priority: editPriority }))
    setEditing(false)
  }

  const handleDeleteFromModal = async () => {
    await deleteTodo(project.id, selectedTodo.id)
    setSelectedTodo(null)
  }

  const toggleEditAssignee = (id) =>
    setEditAssignees((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id])

  const me = project.members.find((m) => m.id === currentUser.id)
  const isLeaderOrSub = me?.role === 'leader' || me?.role === 'sub-leader'

  return (
    <div className={styles.wrap}>
      {/* 할 일 상세 팝업 */}
      {selectedTodo && (() => {
        const t = selectedTodo
        const tAssignees = getAssignees(t)
        const pri = PRIORITY[t.priority] || PRIORITY.medium
        const dueDateInfo = getDueDateInfo(t.dueDate, today, t.status)
        const colInfo = COLUMNS.find((c) => c.key === t.status) || COLUMNS[0]
        const canEdit = t.createdBy === currentUser.id || isLeaderOrSub
        const canDelete = t.createdBy === currentUser.id || me?.role === 'leader'
        const creator = getMember(t.createdBy)

        return (
          <div className={styles.backdrop} onClick={() => { setSelectedTodo(null); setEditing(false) }}>
            <div className={styles.detailModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.detailHeader}>
                <span className={styles.detailColBadge} style={{ color: colInfo.color }}>
                  {colInfo.emoji} {colInfo.label}
                </span>
                <button className={styles.detailClose} onClick={() => { setSelectedTodo(null); setEditing(false) }}>✕</button>
              </div>

              {editing ? (
                <div className={styles.editForm}>
                  <input
                    className={styles.editTitleInput}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSaveEdit() }}
                  />

                  <textarea
                    className={styles.editDescInput}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="설명 (선택)"
                    rows={2}
                  />

                  <div className={styles.editSection}>
                    <span className={styles.editLabel}>담당자</span>
                    <div className={styles.assigneeChips}>
                      {project.members.map((m) => {
                        const active = editAssignees.includes(m.id)
                        return (
                          <button key={m.id} type="button"
                            className={`${styles.assigneeChip} ${active ? styles.assigneeChipActive : ''}`}
                            onClick={() => toggleEditAssignee(m.id)}>
                            <div className={`${styles.chipAvatar} ${active ? styles.chipAvatarActive : ''}`}>{m.name.charAt(0)}</div>
                            <span>{m.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formField}>
                      <span className={styles.formFieldLabel}>마감일</span>
                      <input className={styles.formSelect} type="date" value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)} />
                    </div>
                    <div className={styles.formField}>
                      <span className={styles.formFieldLabel}>우선순위</span>
                      <select className={styles.formSelect} value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value)}>
                        <option value="low">🟢 낮음</option>
                        <option value="medium">🟡 보통</option>
                        <option value="high">🔴 높음</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.editActions}>
                    <button className={styles.editCancel} onClick={() => setEditing(false)}>취소</button>
                    <button className={styles.editSave} onClick={handleSaveEdit} disabled={!editTitle.trim()}>저장</button>
                  </div>
                </div>
              ) : (
                <div className={styles.detailBody}>
                  <p className={styles.detailTitle}>{t.title}</p>
                  {t.description && <p className={styles.detailDesc}>{t.description}</p>}

                  <div className={styles.detailMeta}>
                    <div className={styles.detailRow}>
                      <span className={styles.detailKey}>우선순위</span>
                      <span className={styles.priority} style={{ background: pri.bg, color: pri.color }}>{pri.dot} {pri.label}</span>
                    </div>
                    {dueDateInfo && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailKey}>마감일</span>
                        <span className={`${styles.dueDate} ${dueDateInfo.overdue ? styles.dueDateOver : ''} ${dueDateInfo.urgent && !dueDateInfo.overdue ? styles.dueDateUrgent : ''}`}>
                          📅 {t.dueDate} ({dueDateInfo.label})
                        </span>
                      </div>
                    )}
                    {tAssignees.length > 0 && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailKey}>담당자</span>
                        <div className={styles.detailAssignees}>
                          {tAssignees.map((id) => {
                            const m = getMember(id)
                            if (!m) return null
                            return (
                              <div key={id} className={styles.detailAssigneeItem}>
                                <div className={styles.avatar}>{m.name.charAt(0)}</div>
                                <span className={styles.assigneeName}>{m.name}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {creator && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailKey}>등록자</span>
                        <span className={styles.detailVal}>
                          {creator.id === currentUser.id ? (currentUser.name || creator.name) : creator.name} · {t.createdAt}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className={styles.detailFooter}>
                    {canDelete && (
                      <button className={styles.detailDelete} onClick={handleDeleteFromModal}>삭제</button>
                    )}
                    {canEdit && (
                      <button className={styles.detailEdit} onClick={openEdit}>✏️ 수정</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

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

          <textarea className={styles.formTextarea} value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="설명 (선택)" rows={2} />

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
                        onDragStart={() => handleDragStart(todo.id)}
                        onClick={() => openDetail(todo)}>
                        <div className={styles.cardTop}>
                          <span className={styles.priority} style={{ background: pri.bg, color: pri.color }}>
                            {pri.dot} {pri.label}
                          </span>
                          <button className={styles.delete}
                            onClick={(e) => { e.stopPropagation(); deleteTodo(project.id, todo.id) }}>✕</button>
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
