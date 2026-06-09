import {
  collection, doc, addDoc, getDocs, updateDoc, runTransaction, serverTimestamp, increment, arrayUnion,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { txProject, getWeekKey, notifyUser } from '../helpers.js'

export const createWrapupSlice = (set, get) => ({
  saveWrapupNote: async (projectId, note) => {
    await txProject(projectId, () => ({ wrapupNote: note }))
  },

  endProject: async (projectId, { collectFeedback, feedbackDuration }) => {
    const { projects, currentUser } = get()
    const project = projects.find((p) => p.id === projectId)
    if (!project) return

    // 통계 집계 — 모든 방을 병렬 조회 (N+1 → Promise.all)
    const allRoomIds = project.rooms.map((r) => r.id)
    let totalMessages = 0
    let totalFiles = 0
    const messageSenderCount = {}

    const messagesByDate = {}  // { 'YYYY-MM-DD': { count, latestTime } }

    const snaps = await Promise.all(
      allRoomIds.map((rid) =>
        getDocs(collection(db, 'rooms', rid, 'messages')).catch(() => null)
      )
    )
    snaps.forEach((snap) => {
      if (!snap) return
      snap.forEach((d) => {
        const msg = d.data()
        totalMessages++
        if (msg.type === 'file' || msg.type === 'image') totalFiles++
        if (msg.senderId && msg.senderId !== 'system') {
          messageSenderCount[msg.senderId] = (messageSenderCount[msg.senderId] || 0) + 1
          // 날짜·시각은 createdAt(현지 시각)에서 직접 계산.
          // msg.time은 'PM 11:30'/'오후 11:30' 같은 현지화 문자열이라 '22:00' 비교가 깨짐.
          const dt = msg.createdAt?.toDate?.()
          if (dt) {
            const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
            const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
            if (!messagesByDate[date]) messagesByDate[date] = { count: 0, latestTime: '00:00' }
            messagesByDate[date].count++
            if (time > messagesByDate[date].latestTime) messagesByDate[date].latestTime = time
          }
        }
      })
    })

    const totalTodos     = project.todos?.length ?? 0
    const completedTodos = project.todos?.filter((t) => t.status === 'done').length ?? 0

    // 멤버별 집계 — 명단·역할용. 개인 순위/시상은 만들지 않는다 (점수·순위 없음 철학).
    const memberStats = project.members.map((m) => {
      const assignedTodos = (project.todos || []).filter((t) => {
        const assignees = Array.isArray(t.assignees) ? t.assignees : (t.assignee ? [t.assignee] : [])
        return assignees.length === 0 ? false : assignees.includes(m.id)
      })
      return {
        userId:             m.id,
        name:               m.name,
        role:               m.role,
        messageCount:       messageSenderCount[m.id] || 0,
        todoCount:          assignedTodos.length,
        todoCompletedCount: assignedTodos.filter((t) => t.status === 'done').length,
      }
    })
    // 주간 목표 달성률
    const weeklyGoals = project.weeklyGoals || []
    const weeklyGoalsTotal    = weeklyGoals.length
    const weeklyGoalsAchieved = weeklyGoals.filter((g) => g.achieved).length

    // 인사이트 — 활발했던 날
    const dateEntries = Object.entries(messagesByDate)
    const busiestEntry = [...dateEntries].sort((a, b) => b[1].count - a[1].count)[0]
    const busiestDay = busiestEntry ? { date: busiestEntry[0], count: busiestEntry[1].count } : null

    // 인사이트 — 밤까지 활동한 날 (22:00 이후)
    const lateEntry = dateEntries
      .filter(([, v]) => v.latestTime >= '22:00')
      .sort((a, b) => b[1].latestTime.localeCompare(a[1].latestTime))[0]
    const latestNightActivity = lateEntry ? { date: lateEntry[0], time: lateEntry[1].latestTime } : null

    // 인사이트 — 전반·후반 에너지 흐름
    let activityTrend = null
    if (project.startDate && project.endDate && dateEntries.length > 0) {
      const mid = (new Date(project.startDate).getTime() + new Date(project.endDate).getTime()) / 2
      let firstHalf = 0, secondHalf = 0
      dateEntries.forEach(([date, { count }]) => {
        if (new Date(date).getTime() <= mid) firstHalf += count
        else secondHalf += count
      })
      activityTrend = { firstHalf, secondHalf }
    }

    const feedbackDeadline = collectFeedback
      ? new Date(Date.now() + feedbackDuration * 24 * 60 * 60 * 1000).toISOString()
      : null

    const wrapupData = {
      projectId,
      leaderId: project.leaderId,
      memberIds: project.members.map((m) => m.id),
      projectName: project.name,
      projectEmoji: project.emoji || '',
      createdAt: serverTimestamp(),
      summary: { totalMessages, totalTodos, completedTodos, totalFiles, weeklyGoalsTotal, weeklyGoalsAchieved },
      highlights: {
        busiestDay,
        latestNightActivity,
        activityTrend,
      },
      memberStats,
      members: project.members.map((m) => ({ userId: m.id, name: m.name, role: m.role })),
      reflections: [],
      feedbacks: [],
    }

    const wrapupRef = await addDoc(collection(db, 'wrapups'), wrapupData)

    await updateDoc(doc(db, 'projects', projectId), {
      status: collectFeedback ? 'collecting' : 'archived',
      collectFeedback: !!collectFeedback,
      feedbackDeadline,
      wrapupId: wrapupRef.id,
    })

    get().addNotification({
      type: 'system',
      text: `🏁 "${project.name}" 프로젝트가 마무리됐어요`,
      projectId,
    })
  },

  addReflection: async (wrapupId, payload) => {
    // payload: string(레거시) or { q1, q2, q3 }
    const { currentUser } = get()
    const isStructured = typeof payload === 'object'
    const text = isStructured
      ? [`잘 한 점: ${payload.q1}`, `개선할 점: ${payload.q2}`, `의미 있었던 순간: ${payload.q3}`]
          .filter((l) => !l.endsWith(': ')).join('\n')
      : payload
    await runTransaction(db, async (tx) => {
      const ref  = doc(db, 'wrapups', wrapupId)
      const snap = await tx.get(ref)
      if (!snap.exists()) return
      const data = snap.data()
      const reflections = (data.reflections || []).filter((r) => r.userId !== currentUser.id)
      reflections.push({
        userId: currentUser.id,
        name: currentUser.name,
        text,
        prompts: isStructured ? payload : null,
        createdAt: new Date().toISOString(),
      })
      tx.update(ref, { reflections })
    })
  },

  addFeedback: async (wrapupId, feedbackData) => {
    const { currentUser } = get()
    let isNewFeedback = false
    await runTransaction(db, async (tx) => {
      const ref  = doc(db, 'wrapups', wrapupId)
      const snap = await tx.get(ref)
      if (!snap.exists()) return
      const data = snap.data()

      // 이전 피드백 찾기 (태그 delta 계산용)
      const oldFeedback = (data.feedbacks || []).find(
        (f) => f.fromUserId === currentUser.id && f.toUserId === feedbackData.toUserId
      )
      isNewFeedback = !oldFeedback
      const feedbacks = (data.feedbacks || []).filter(
        (f) => !(f.fromUserId === currentUser.id && f.toUserId === feedbackData.toUserId)
      )
      feedbacks.push({
        fromUserId: currentUser.id,
        fromUserName: feedbackData.isAnonymous ? '익명' : currentUser.name,
        toUserId: feedbackData.toUserId,
        toUserName: feedbackData.toUserName,
        tags: feedbackData.tags || [],
        comment: feedbackData.comment || '',
        isAnonymous: feedbackData.isAnonymous,
        createdAt: new Date().toISOString(),
      })
      tx.update(ref, { feedbacks })

      // flowerTagSummary 실시간 동기화 — 추가/제거된 태그만 increment
      const newTagIds = new Set((feedbackData.tags || []).map((t) => t.id))
      const oldTagIds = new Set((oldFeedback?.tags || []).map((t) => t.id))
      const tagUpdates = {}
      newTagIds.forEach((id) => { if (!oldTagIds.has(id)) tagUpdates[`flowerTagSummary.${id}`] = increment(1) })
      oldTagIds.forEach((id) => { if (!newTagIds.has(id)) tagUpdates[`flowerTagSummary.${id}`] = increment(-1) })
      tx.update(doc(db, 'users', feedbackData.toUserId), {
        ...tagUpdates,
        flowerSenderUids: arrayUnion(feedbackData.fromUserId),
      })
    })

    // 새 피드백일 때만 받는 사람에게 알림 (수정 시 재알림 방지, 본인 제외, 익명 존중)
    if (isNewFeedback && feedbackData.toUserId !== currentUser.id) {
      const who = feedbackData.isAnonymous ? '누군가가' : `${currentUser.name}님이`
      await notifyUser(feedbackData.toUserId, {
        type: 'flower',
        text: `🌷 ${who} 당신에게 꽃과 피드백을 남겼어요`,
        link: '/profile',
      })
    }
  },

  setWeeklyGoalSchedule: async (projectId, schedule) => {
    await updateDoc(doc(db, 'projects', projectId), { weeklyGoalSchedule: schedule })
  },

  setWeeklyGoalAchieved: async (projectId, weekKey, achieved) => {
    await txProject(projectId, (data) => ({
      weeklyGoals: (data.weeklyGoals || []).map((g) =>
        g.week === weekKey ? { ...g, achieved } : g
      ),
    }))
  },

  addWeeklyGoal: async (projectId, text) => {
    const { currentUser } = get()
    const weekKey = getWeekKey()
    await txProject(projectId, (data) => {
      const goals = (data.weeklyGoals || []).filter((g) => g.week !== weekKey)
      return {
        weeklyGoals: [...goals, {
          id: `wg_${Date.now()}`,
          week: weekKey,
          text,
          authorId: currentUser.id,
          authorName: currentUser.name,
          createdAt: new Date().toISOString(),
        }],
      }
    })
  },
})
