export const createUiSlice = (set, get) => ({
  theme: (typeof window !== 'undefined' && localStorage.getItem('teamp-theme')) || 'light',
  errorToasts: [],
  successToasts: [],
  chatToasts: [],
  confirmDialog: null, // { message, resolve }


  // 팀프 매치 새 게시글 감지 — matchPostCount: 실시간 count, matchSeenCount: 마지막으로 본 count
  matchPostCount: 0,
  matchSeenCount: typeof window !== 'undefined' ? parseInt(localStorage.getItem('teamp-match-seen') || '0', 10) : 0,
  setMatchPostCount: (n) => set({ matchPostCount: n }),
  markMatchSeen: () => {
    const n = get().matchPostCount
    if (typeof window !== 'undefined') localStorage.setItem('teamp-match-seen', String(n))
    set({ matchSeenCount: n })
  },

  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('teamp-theme', theme)
      const html = document.documentElement
      const body = document.body
      if (theme === 'dark') {
        html.setAttribute('data-theme', 'dark')
        body.setAttribute('data-theme', 'dark')
        html.classList.add('dark')
      } else {
        html.removeAttribute('data-theme')
        body.removeAttribute('data-theme')
        html.classList.remove('dark')
      }
    }
    set({ theme })
  },

  toggleTheme: () => {
    const current = get().theme
    get().setTheme(current === 'dark' ? 'light' : 'dark')
  },

  showError: (message) => {
    const id = `err_${Date.now()}`
    set((s) => ({ errorToasts: [...s.errorToasts, { id, message }].slice(-3) }))
    setTimeout(() => {
      set((s) => ({ errorToasts: s.errorToasts.filter((e) => e.id !== id) }))
    }, 4000)
  },

  dismissError: (id) =>
    set((s) => ({ errorToasts: s.errorToasts.filter((e) => e.id !== id) })),

  showSuccess: (message) => {
    const id = `suc_${Date.now()}`
    set((s) => ({ successToasts: [...s.successToasts, { id, message }].slice(-3) }))
    setTimeout(() => {
      set((s) => ({ successToasts: s.successToasts.filter((t) => t.id !== id) }))
    }, 3000)
  },
  dismissSuccess: (id) =>
    set((s) => ({ successToasts: s.successToasts.filter((t) => t.id !== id) })),

  setPinnedId: (id) => set({ pinnedId: id }),

  addChatToast: (toast) => {
    set((s) => ({ chatToasts: [toast, ...s.chatToasts].slice(0, 5) }))
  },
  removeChatToast: (id) =>
    set((s) => ({ chatToasts: s.chatToasts.filter((t) => t.id !== id) })),
  removeChatToastsByRoom: (roomId) =>
    set((s) => ({ chatToasts: s.chatToasts.filter((t) => t.roomId !== roomId) })),
  clearChatToasts: () => set({ chatToasts: [] }),

  showConfirm: (message) =>
    new Promise((resolve) => set({ confirmDialog: { message, resolve } })),
  dismissConfirm: (result) => {
    const { confirmDialog } = get()
    if (confirmDialog) confirmDialog.resolve(result)
    set({ confirmDialog: null })
  },
})
