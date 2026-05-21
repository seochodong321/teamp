import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  esbuild: {
    drop: ['debugger'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase-core': ['firebase/app', 'firebase/auth'],
          'firebase-db': ['firebase/firestore', 'firebase/storage'],
          'firebase-msg': ['firebase/messaging'],
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'zustand': ['zustand'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
})
