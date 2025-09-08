import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
  include: ['dockview', 'three', '@react-three/fiber', '@react-three/drei', 'react-leaflet', 'leaflet']
  },
  define: {
    global: 'globalThis',
  },
  server: {
    host: true,
    port: 5173
  }
});