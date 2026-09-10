import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'jsmediatags': 'jsmediatags/dist/jsmediatags.min.js',
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('lucide-react')) return 'lucide';
              if (id.includes('react-markdown') || id.includes('remark')) return 'markdown';
              if (id.includes('jszip')) return 'jszip';
              if (id.includes('jsmediatags')) return 'jsmediatags';
              if (id.includes('three')) return 'three';
              if (id.includes('motion')) return 'motion';
              return 'vendor';
            }
          }
        }
      }
    }
  };
});
