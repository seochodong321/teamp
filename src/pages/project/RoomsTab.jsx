import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import styles from '../ProjectPage.module.css'

export default function RoomsTab({ project, currentUser, visibleRooms, iCanManage }) {
  const navigate = useNavigate()
  const { addRoom, reorderRooms, formatUnread } = useStore()

  const [dragIdx, setDragIdx]     = useState(null)
  const [dragOrder, setDragOrder] = useState(null)
  const [showAddRoom, setShowAddRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')

  const handleDragStart = (i) => { setDragIdx(i); setDragOrder(visibleRooms) }
  const handleDragOver  = (e, i) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i || !dragOrder) return
    const next = [...dragOrder]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(i, 0, moved)
    setDragIdx(i)
    setDragOrder(next)
  }
  const handleDragEnd = () => {
    if (dragOrder) reorderRooms(project.id, dragOrder.map((r) => r.id))
    setDragIdx(null)
    setDragOrder(null)
  }

  const handleAddRoom = () => {
    if (!newRoomName.trim()) return
    addRoom(project.id, newRoomName.trim())
    setNewRoomName('')
    setShowAddRoom(false)
  }

  return (
    <div className={styles.section}>
      <p className={styles.hint}>드래그해서 순서를 바꿀 수 있어요</p>
      <div className={styles.roomList}>
        {(dragOrder || visibleRooms).map((room, i) => {
          const unread = formatUnread(room.unread || 0)
          return (
            <div key={room.id}
              className={`${styles.roomCard} ${dragIdx === i ? styles.roomCardDragging : ''}`}
              draggable onDragStart={() => handleDragStart(i)} onDragOver={(e) => handleDragOver(e, i)} onDragEnd={handleDragEnd}
              onClick={() => navigate(`/project/${project.id}/chat/${room.id}`)}>
              <div className={styles.dragHandle}>⠿</div>
              <div className={styles.roomIcon} style={{ background: room.colorBg, color: room.color }}>
                {room.isDm ? '💬' : `#${room.name.charAt(0)}`}
              </div>
              <div className={styles.roomBody}>
                <div className={styles.roomTop}>
                  <span className={styles.roomName}>{room.isDm ? room.name : `# ${room.name}`}</span>
                  {unread > 0 ? <span className={styles.unreadBadge}>{unread}</span> : <span className={styles.roomTime}>{room.time}</span>}
                </div>
                <span className={styles.roomLast}>{room.lastMessage || '아직 메시지가 없어요'}</span>
              </div>
            </div>
          )
        })}
      </div>

      {iCanManage && (
        <div className={styles.addRoomWrap}>
          {showAddRoom ? (
            <div className={styles.addRoomForm}>
              <input
                className={styles.addRoomInput}
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="채팅방 이름을 입력하세요"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddRoom()
                }}
              />
              <button className={styles.addRoomConfirm} onClick={handleAddRoom}>추가</button>
              <button className={styles.addRoomCancel} onClick={() => { setShowAddRoom(false); setNewRoomName('') }}>취소</button>
            </div>
          ) : (
            <button className={styles.addRoomTrigger} onClick={() => setShowAddRoom(true)}>
              + 팀 채팅방 추가
            </button>
          )}
        </div>
      )}
    </div>
  )
}
