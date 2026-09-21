import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Văn phòng số Nam Sài Gòn',
        short_name: 'QLVB NSG',
        description: 'Hệ thống Văn phòng số - Quản lý văn bản, lịch công tác và hồ sơ công vụ CĐ Nam Sài Gòn',
        theme_color: '#0f3a6d',
        background_color: '#f0f2f5',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/logo.webp',
            sizes: '192x192',
            type: 'image/webp',
            purpose: 'any maskable'
          },
          {
            src: '/logo.webp',
            sizes: '512x512',
            type: 'image/webp',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        navigateFallbackDenylist: [/^\/authen/, /^\/api/, /^\/documents/, /^\/drive/],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024
      }
    })

  ],
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

