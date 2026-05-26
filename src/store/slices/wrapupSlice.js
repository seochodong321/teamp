import {
  collection, doc, addDoc, getDocs, updateDoc, runTransaction, serverTimestamp, increment, arrayUnion,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { txProject } from '../helpers.js'

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
        if (msg.type === 'file') totalFiles++
        if (msg.senderId && msg.senderId !== 'system') {
          messageSenderCount[msg.senderId] = (messageSenderCount[msg.senderId] || 0) + 1
          const date = msg.createdAt?.toDate?.()?.toISOString?.()?.slice(0, 10) || null
          const time = msg.time || null
          if (date) {
            if (!messagesByDate[date]) messagesByDate[date] = { count: 0, latestTime: '00:00' }
            messagesByDate[date].count++
            if (time && time > messagesByDate[date].latestTime) messagesByDate[date].latestTime = time
          }
        }
      })
    })

    const totalTodos     = project.todos?.length ?? 0
    const completedTodos = project.todos?.filter((t) => t.status === 'done').length ?? 0

    const mostActiveUserId   = Object.keys(messageSenderCount).sort(
      (a, b) => (messageSenderCount[b] || 0) - (messageSenderCount[a] || 0)
    )[0] || null
    const mostActiveUserName = project.members.find((m) => m.id === mostActiveUserId)?.name || null

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
      summary: { totalMessages, totalTodos, completedTodos, totalFiles },
      highlights: {
        mostActiveUserId, mostActiveUserName,
        mostTodoCompletedUserId: null, mostTodoCompletedUserName: null,
        mostConnectedUserId: null, mostConnectedUserName: null,
        busiestDay,
        latestNightActivity,
        activityTrend,
      },
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

  addReflection: async (wrapupId, text) => {
    const { currentUser } = get()
    await runTransaction(db, async (tx) => {
      const ref  = doc(db, 'wrapups', wrapupId)
      const snap = await tx.get(ref)
      if (!snap.exists()) return
      const data = snap.data()
      const reflections = (data.reflections || []).filter((r) => r.userId !== currentUser.id)
      reflections.push({ userId: currentUser.id, name: currentUser.name, text, createdAt: new Date().toISOString() })
      tx.update(ref, { reflections })
    })
  },

  addFeedback: async (wrapupId, feedbackData) => {
    const { currentUser } = get()
    await runTransaction(db, async (tx) => {
      const ref  = doc(db, 'wrapups', wrapupId)
      const snap = await tx.get(ref)
      if (!snap.exists()) return
      const data = snap.data()

      // 이전 피드백 찾기 (태그 delta 계산용)
      const oldFeedback = (data.feedbacks || []).find(
        (f) => f.fromUserId === currentUser.id && f.toUserId === feedbackData.toUserId
      )
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
  },

  setWeeklyGoalSchedule: async (projectId, schedule) => {
    await updateDoc(doc(db, 'projects', projectId), { weeklyGoalSchedule: schedule })
  },

  addWeeklyGoal: async (projectId, text) => {
    const { currentUser } = get()
    const now    = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    const weekKey = monday.toISOString().split('T')[0]
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
