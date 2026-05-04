import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import styles from './SearchModal.module.css'

function highlight(text, query) {
  if (!query || !text) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className={styles.mark}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export default function SearchModal({ open, onClose }) {
  const { projects, messages } = useStore()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)

  // 모달 열릴 때 입력창 포커스
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const results = useCallback(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []

    const items = []

    projects.forEach((p) => {
      // 프로젝트명
      if (p.name.toLowerCase().includes(q)) {
        items.push({ type: 'project', label: p.name, sub: p.category || '', emoji: p.emoji || '📁', url: `/project/${p.id}` })
      }

      // 게시판 글
      ;(p.announcements || []).forEach((a) => {
        if (a.title?.toLowerCase().includes(q) || a.content?.toLowerCase().includes(q)) {
          const matchField = a.title?.toLowerCase().includes(q) ? a.title : a.content
          items.push({
            type: 'board', label: a.title, sub: p.name,
            emoji: a.isGlobal ? '📢' : '📝',
            url: `/project/${p.id}?tab=board`,
            matchText: matchField,
          })
        }
      })

      // 할 일
      ;(p.todos || []).forEach((t) => {
        if (t.title?.toLowerCase().includes(q)) {
          items.push({ type: 'todo', label: t.title, sub: p.name, emoji: '✅', url: `/project/${p.id}?tab=todo` })
        }
      })

      // 채팅 메시지 (로드된 것만)
      ;(p.rooms || []).forEach((r) => {
        const msgs = messages[r.id] || []
        msgs.forEach((m) => {
          if (m.type === 'text' && m.text?.toLowerCase().includes(q)) {
            items.push({
              type: 'message', label: m.text, sub: `${p.name} › ${r.name}`,
              emoji: '💬', url: `/project/${p.id}/chat/${r.id}`,
              sender: m.senderName,
            })
          }
        })
      })
    })

    return items.slice(0, 30)
  }, [query, projects, messages])

  const items = results()

  // 활성 인덱스 보정
  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  const go = (url) => {
    navigate(url)
    onClose()
  }

  const handleKey = (e) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (items[activeIdx]) go(items[activeIdx].url)
    }
  }

  // 활성 항목 스크롤
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  if (!open) return null

  const typeLabel = { project: '프로젝트', board: '게시판', todo: '할 일', message: '채팅' }

  // 결과를 타입별로 그룹핑
  const groups = ['project', 'board', 'todo', 'message']
  let flatIdx = 0
  const grouped = groups.map((t) => {
    const g = items.map((item, i) => ({ ...item, flatIdx: i })).filter((item) => item.type === t)
    return { type: t, items: g }
  }).filter((g) => g.items.length > 0)

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.inputRow}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="프로젝트, 게시판, 할 일, 채팅 검색..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          {query && (
            <button className={styles.clearBtn} onClick={() => { setQuery(''); inputRef.current?.focus() }}>✕</button>
          )}
        </div>

        {query.trim() && (
          <div className={styles.results} ref={listRef}>
            {grouped.length === 0 ? (
              <p className={styles.empty}>"{query}"에 대한 결과가 없어요</p>
            ) : (
              grouped.map((group) => (
                <div key={group.type} className={styles.group}>
                  <p className={styles.groupLabel}>{typeLabel[group.type]}</p>
                  {group.items.map((item) => (
                    <button
                      key={item.flatIdx}
                      data-idx={item.flatIdx}
                      className={`${styles.item} ${activeIdx === item.flatIdx ? styles.itemActive : ''}`}
                      onClick={() => go(item.url)}
                      onMouseEnter={() => setActiveIdx(item.flatIdx)}
                    >
                      <span className={styles.itemEmoji}>{item.emoji}</span>
                      <div className={styles.itemContent}>
                        <span className={styles.itemLabel}>
                          {highlight(item.label, query)}
                        </span>
                        <span className={styles.itemSub}>
                          {item.sender ? `${item.sender} · ` : ''}{item.sub}
                        </span>
                      </div>
                      <span className={styles.itemArrow}>↵</span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {!query.trim() && (
          <div className={styles.hint}>
            <p>↑↓ 이동 &nbsp;·&nbsp; Enter 선택 &nbsp;·&nbsp; Esc 닫기</p>
          </div>
        )}
      </div>
    </div>
  )
}
