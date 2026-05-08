import { useMemo } from 'react'
import { useStore } from '../store/useStore.js'

/** 특정 projectId의 프로젝트 객체를 메모이제이션해서 반환 */
export function useProject(projectId) {
  const projects = useStore((s) => s.projects)
  return useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId]
  )
}

/** 현재 유저가 해당 프로젝트를 관리할 수 있는지 (리더 or 부리더) */
export function useCanManage(projectId) {
  const currentUser = useStore((s) => s.currentUser)
  const project     = useProject(projectId)
  return useMemo(() => {
    if (!project || !currentUser) return false
    const me = project.members.find((m) => m.id === currentUser.id)
    return me?.role === 'leader' || me?.role === 'sub-leader'
  }, [project, currentUser])
}

/** 현재 유저의 해당 프로젝트 내 역할 */
export function useMyRole(projectId) {
  const currentUser = useStore((s) => s.currentUser)
  const project     = useProject(projectId)
  return useMemo(() => {
    if (!project || !currentUser) return null
    return project.members.find((m) => m.id === currentUser.id)?.role ?? null
  }, [project, currentUser])
}

/** 현재 유저가 볼 수 있는 채팅방 목록 */
export function useVisibleRooms(projectId) {
  const currentUser  = useStore((s) => s.currentUser)
  const getVisibleRooms = useStore((s) => s.getVisibleRooms)
  const project      = useProject(projectId)
  return useMemo(() => {
    if (!project || !currentUser) return []
    return getVisibleRooms(project, currentUser.id)
  }, [project, currentUser, getVisibleRooms])
}

/** 프로젝트의 할 일 목록 */
export function useTodos(projectId) {
  const project = useProject(projectId)
  return useMemo(() => project?.todos ?? [], [project])
}

/** 프로젝트의 캘린더 이벤트 목록 */
export function useEvents(projectId) {
  const project = useProject(projectId)
  return useMemo(() => project?.events ?? [], [project])
}
