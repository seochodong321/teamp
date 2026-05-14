export const createUiSlice = (set, get) => ({
  theme: (typeof window !== 'undefined' && localStorage.getItem('teamp-theme')) || 'light',
  errorToasts: [],
  chatToasts: [],

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

  setPinnedId: (id) => set({ pinnedId: id }),

  addChatToast: (toast) => {
    set((s) => ({ chatToasts: [toast, ...s.chatToasts].slice(0, 5) }))
  },
  removeChatToast: (id) =>
    set((s) => ({ chatToasts: s.chatToasts.filter((t) => t.id !== id) })),
  removeChatToastsByRoom: (roomId) =>
    set((s) => ({ chatToasts: s.chatToasts.filter((t) => t.roomId !== roomId) })),
  clearChatToasts: () => set({ chatToasts: [] }),
})
