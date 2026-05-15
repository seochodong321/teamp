import React, { useState, useEffect } from 'react'
import { useStore } from '../../store/useStore.js'
import styles from '../ProjectPage.module.css'

export default function ManageTab({ project, currentUser, isLeader }) {
  const { updateMemberRole, setMemberRooms, addCoLeader, kickMember } = useStore()

  const [pendingRoles, setPendingRoles] = useState({})
  const [pendingRooms, setPendingRooms] = useState({})
  const [saveMsg, setSaveMsg]           = useState('')

  // 탭 진입 시 현재 상태로 초기화
  useEffect(() => {
    const roles = {}, rooms = {}
    project.members.filter((m) => m.id !== currentUser.id).forEach((m) => {
      roles[m.id] = m.role
      rooms[m.id] = [...(m.roomIds || [])]
    })
    setPendingRoles(roles)
    setPendingRooms(rooms)
  }, [project.id])

  const saveManage = () => {
    project.members.filter((m) => m.id !== currentUser.id).forEach((m) => {
      if (pendingRoles[m.id] && pendingRoles[m.id] !== m.role) {
        updateMemberRole(project.id, m.id, pendingRoles[m.id])
      }
      if (pendingRooms[m.id] && JSON.stringify(pendingRooms[m.id].sort()) !== JSON.stringify([...m.roomIds].sort())) {
        setMemberRooms(project.id, m.id, pendingRooms[m.id])
      }
    })
    setSaveMsg('저장됐어요!')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  return (
    <div className={styles.section}>
      <div className={styles.manageTopRow}>
        <p className={styles.hint}>변경 후 저장 버튼을 눌러야 적용돼요</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {saveMsg && <span className={styles.saveMsg}>{saveMsg}</span>}
          <button className={styles.saveBtn} onClick={saveManage}>저장하기</button>
        </div>
      </div>
      <div className={styles.manageList}>
        {project.members.filter((m) => m.id !== currentUser.id).map((m) => {
          const curRole  = pendingRoles[m.id] ?? m.role
          const curRooms = pendingRooms[m.id] ?? m.roomIds
          return (
            <div key={m.id} className={styles.manageCard}>
              <div className={styles.manageTop}>
                <div className={styles.memberAvatar}>{m.name.charAt(0)}</div>
                <div className={styles.memberInfo}>
                  <p className={styles.memberName}>{m.name}</p>
                  {m.affiliation && <p className={styles.memberAffil}>{m.affiliation}</p>}
                </div>
                <div className={styles.manageRight}>
                  {m.role === 'leader' ? (
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>🌟 공동리더</span>
                  ) : (
                    <select className={styles.roleSelect} value={curRole}
                      onChange={(e) => setPendingRoles((prev) => ({ ...prev, [m.id]: e.target.value }))}>
                      <option value="sub-leader">⭐ 부리더</option>
                      <option value="member">팀원</option>
                    </select>
                  )}
                  {isLeader && m.role !== 'leader' && (
                    <button className={styles.transferBtn}
                      onClick={() => { if (window.confirm(`${m.name} 님을 공동리더로 추가할까요?`)) addCoLeader(project.id, m.id) }}>
                      공동리더 추가
                    </button>
                  )}
                  {isLeader && (
                    <button className={styles.kickBtn}
                      onClick={() => { if (window.confirm(`${m.name} 님을 프로젝트에서 방출할까요?`)) kickMember(project.id, m.id) }}>
                      방출
                    </button>
                  )}
                </div>
              </div>
              {curRole === 'member' && (
                <div className={styles.roomAssign}>
                  <p className={styles.roomAssignLabel}>접근 가능한 채팅방</p>
                  <div className={styles.roomAssignList}>
                    {project.rooms.filter((r) => !r.isDm).map((r) => {
                      const checked = curRooms.includes(r.id)
                      return (
                        <label key={r.id}
                          className={`${styles.roomChip} ${checked ? styles.roomChipOn : ''}`}
                          style={checked ? { borderColor: r.color, background: r.colorBg, color: r.color } : {}}>
                          <input type="checkbox" checked={checked} onChange={() => {
                            const next = checked ? curRooms.filter((x) => x !== r.id) : [...curRooms, r.id]
                            setPendingRooms((prev) => ({ ...prev, [m.id]: next }))
                          }} />
                          # {r.name}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
