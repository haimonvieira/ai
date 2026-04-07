import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ===========================================
// Configuração Vite - MonitorCNJ Frontend
// ===========================================
// Build otimizado para produção, hot-reload para dev

export default defineConfig({
  plugins: [react()],
  
  server: {
    port: 5173,
    proxy: {
      // Proxy para API backend em desenvolvimento
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Code splitting para melhor performance
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  
  // Otimizações
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});
