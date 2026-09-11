import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          antd: ['antd'],
          icons: ['@ant-design/icons', 'react-icons'],
          charts: ['recharts'],
          calendar: ['react-big-calendar', 'moment'],
          store: ['@reduxjs/toolkit', 'react-redux'],
          excel: ['xlsx'],
        }
      }
    },
    chunkSizeWarningLimit: 1200
  }
})
