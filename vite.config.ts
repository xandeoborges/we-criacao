import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    server: {
      host: '::',
      port: 8082,
      hmr: { overlay: false },
      proxy: {
        '/taskrow-api': {
          target: env.VITE_TASKROW_URL || 'https://we.taskrow.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/taskrow-api/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('__identifier', env.VITE_TASKROW_API_KEY || '');
              proxyReq.setHeader('Accept', 'application/json');
            });
          },
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
  };
});
