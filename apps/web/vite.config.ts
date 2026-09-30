import vue from '@vitejs/plugin-vue';
import { quasar, transformAssetUrls } from '@quasar/vite-plugin';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000';
const quasarVariables = fileURLToPath(new URL('./src/css/quasar-variables.sass', import.meta.url));

export default defineConfig({
  plugins: [
    vue({
      template: { transformAssetUrls },
    }),
    quasar({
      sassVariables: quasarVariables,
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        target: apiProxyTarget,
      },
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/vitest.setup.ts'],
  },
});
