import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    fs: {
      allow: ['.', 'D:/mine/myprojects/杨高中路/frontend/node_modules']
    },
    proxy: {
      '/api': {
        target: 'http://120.55.70.218',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/api/, '/ygzl/api')
      },
      '/static/glb': {
        target: 'http://120.55.70.218',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/static\/glb/, '/ygzl/static/glb')
      },
      '/ygzl': {
        target: 'http://120.55.70.218',
        changeOrigin: true
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1200,
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('echarts')) return 'vendor-echarts'
          if (id.includes('leaflet')) return 'vendor-leaflet'
        }
      }
    }
  }
})
