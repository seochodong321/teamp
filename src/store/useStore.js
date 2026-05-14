import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createAuthSlice }         from './slices/authSlice.js'
import { createProjectSlice }      from './slices/projectSlice.js'
import { createInviteSlice }       from './slices/inviteSlice.js'
import { createChatSlice }         from './slices/chatSlice.js'
import { createTaskSlice }         from './slices/taskSlice.js'
import { createWrapupSlice }       from './slices/wrapupSlice.js'
import { createNotificationSlice } from './slices/notificationSlice.js'
import { createUiSlice }           from './slices/uiSlice.js'

export const useStore = create(
  persist(
    (...a) => ({
      ...createAuthSlice(...a),
      ...createProjectSlice(...a),
      ...createInviteSlice(...a),
      ...createChatSlice(...a),
      ...createTaskSlice(...a),
      ...createWrapupSlice(...a),
      ...createNotificationSlice(...a),
      ...createUiSlice(...a),
    }),
    {
      name: 'teamp-storage',
      // projects/messages는 Firestore가 관리 — 나머지만 localStorage에 보관
      partialize: (state) => ({
        roomOrders:     state.roomOrders,
        dmRooms:        state.dmRooms,
        connects:       state.connects,
        notifications:  state.notifications,
        invites:        state.invites,
        theme:          state.theme,
        mutedProjects:  state.mutedProjects,
        hiddenProjects: state.hiddenProjects,
        dmUnreadCounts: state.dmUnreadCounts,
        pinnedId:       state.pinnedId,
      }),
    }
  )
)
