export const createNotificationSlice = (set, get) => ({
  notifications: [],

  addNotification: (noti) => {
    const { mutedProjects, mutedDms } = get()
    if (noti.projectId && mutedProjects.includes(noti.projectId)) return
    // 음소거된 1:1 대화 알림 차단 — dm 링크(.../chat/{roomId})에서 방 id 추출
    if (noti.type === 'dm' && noti.link) {
      const rid = noti.link.split('/chat/')[1]
      if (rid && (mutedDms || []).includes(rid)) return
    }
    set((s) => ({
      notifications: [
        { id: `noti_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, read: false, createdAt: Date.now(), ...noti },
        ...s.notifications,
      ].slice(0, 100),
    }))
  },

  markNotificationRead: (notiId) =>
    set((s) => ({ notifications: s.notifications.map((n) => n.id === notiId ? { ...n, read: true } : n) })),

  markAllNotificationsRead: () =>
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

  removeNotification: (notiId) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== notiId) })),

  clearAllNotifications: () => set({ notifications: [] }),
})
