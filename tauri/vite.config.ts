import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const parsedPort = Number.parseInt(process.env.TAURI_DEV_FRONTEND_PORT ?? '5173', 10);
const devPort = Number.isNaN(parsedPort) || parsedPort <= 0 ? 5173 : parsedPort;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../app/src'),
      react: path.resolve(__dirname, '../app/node_modules/react'),
      'react-dom': path.resolve(__dirname, '../app/node_modules/react-dom'),
      '@tanstack/react-query': path.resolve(__dirname, '../app/node_modules/@tanstack/react-query'),
      '@tanstack/react-query-devtools': path.resolve(
        __dirname,
        '../app/node_modules/@tanstack/react-query-devtools',
      ),
      zustand: path.resolve(__dirname, '../app/node_modules/zustand'),
    },
    dedupe: ['react', 'react-dom', '@tanstack/react-query', 'zustand'],
  },
  root: path.resolve(__dirname),
  clearScreen: false,
  server: {
    host: 'localhost',
    port: devPort,
    strictPort: true,
    // Watch files in the app directory for changes
    watch: {
      ignored: ['!**/../app/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'es2021',
    minify: !process.env.TAURI_DEBUG,
    sourcemap: !!process.env.TAURI_DEBUG,
    outDir: 'dist',
  },
});
