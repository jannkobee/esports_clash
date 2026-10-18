import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve, sep } from 'node:path';

const dockerDev = process.env.DOCKER_DEV === '1';

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: { '/api': 'http://127.0.0.1:4174' },
    ...(dockerDev ? {
      origin: 'http://localhost:8088',
      cors: { origin: ['http://localhost:8089', 'http://127.0.0.1:8089'] },
      hmr: { clientPort: 8088 },
      watch: { usePolling: true, interval: 500 },
    } : {}),
  },
  plugins: [
    react(),
    tailwindcss(),
    ...(dockerDev ? [{
      name: 'laravel-dashboard-reload',
      configureServer(server: import('vite').ViteDevServer) {
        const backend = resolve(process.cwd(), '../EsportsClash.Api');
        // Watch only editable dashboard/API sources, never secrets or artifacts.
        for (const path of ['app', 'bootstrap/app.php', 'resources/views', 'public', 'routes', 'config']) {
          server.watcher.add(resolve(backend, path));
        }
        server.watcher.on('all', (event, file) => {
          if (['add', 'change', 'unlink'].includes(event) && file.startsWith(backend + sep)) {
            server.config.logger.info(`Laravel reload: ${file.slice(backend.length + 1)}`);
            server.ws.send({ type: 'full-reload', path: '*' });
          }
        });
      },
    }] : []),
  ],
});
