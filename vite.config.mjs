import { defineConfig } from 'vite';
import { createOfficeApi } from './server/api.mjs';
import { loadEnv } from './server/env.mjs';

const env = loadEnv();
const lan = process.argv.includes('--host');
if (lan && !env.OFFICE_PASSWORD) {
  console.error('\n  Refusing to open the office to your network without a password.');
  console.error('  Set OFFICE_PASSWORD in .env.local first (see .env.example).\n');
  process.exit(1);
}

function officeApi() {
  let api;
  const use = (server) => { api ??= createOfficeApi(); server.middlewares.use(api); };
  return { name: 'office-api', configureServer: use, configurePreviewServer: use };
}

export default defineConfig({
  plugins: [officeApi()],
  server: { port: Number(env.OFFICE_PORT) || 5180, strictPort: true },
  preview: { port: Number(env.OFFICE_PORT) || 5180, strictPort: true },
  // the office, the Wardrobe and the Team page
  // scan every page up front, so the very first visit isn't interrupted by a dependency reload
  optimizeDeps: { entries: ['index.html', 'team.html', 'agents.html'] },
  build: { chunkSizeWarningLimit: 1500, rollupOptions: { input: { main: 'index.html', agents: 'agents.html', team: 'team.html' } } },
});
