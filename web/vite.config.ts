import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量（用于开发代理目标）
  const env = loadEnv(mode, process.cwd(), '')
  // 后端 API 地址（开发环境用于代理 /api 请求到后端）
  // 默认 http://localhost:3000，可通过 web/.env 的 VITE_DEV_API_TARGET 覆盖
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:3000'

  return {
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: '2FA 两步验证工具',
        short_name: '2FA',
        description: '自托管、端到端加密、可同步的两步验证管理器',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // 提高 chunk 大小警告阈值（默认 500KB）
    chunkSizeWarningLimit: 1000,
    // 生产构建时移除 console 和 debugger
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        // 手动分割代码
        manualChunks: (id: string) => {
          // React 核心库
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor'
            }
            // UI 组件库
            if (id.includes('lucide-react') || id.includes('class-variance-authority') ||
                id.includes('clsx') || id.includes('tailwind-merge')) {
              return 'ui-vendor'
            }
            // 加密库
            if (id.includes('hash-wasm') || id.includes('otpauth')) {
              return 'crypto-vendor'
            }
            // 二维码相关
            if (id.includes('qr-scanner') || id.includes('qrcode')) {
              return 'qr-vendor'
            }
          }
        },
      },
    },
  },
  server: {
    port: 5555,
    host: '0.0.0.0', // 允许局域网访问
    allowedHosts: ['vault2fa.656.indevs.in'],
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
}
})
