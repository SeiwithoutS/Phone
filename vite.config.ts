import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { createStorageHandler } from './server/storage'

export default defineConfig({
  base: './',
  optimizeDeps: { entries: ['index.html'] },
  plugins: [
    tailwindcss(),
    {
      name: 'eephone-local-storage',
      configureServer(server) {
        const directory = process.env.EEPHONE_DATA_DIR || fileURLToPath(new URL('./data/', import.meta.url))
        server.middlewares.use(createStorageHandler(directory))
      },
    },
  ],
  server: { host: '127.0.0.1', port: 8000, strictPort: true },
})
