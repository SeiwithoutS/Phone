import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { createStorageHandler } from './server/storage'
import { localAddress, loopbackAddress } from './server/local-address'

const { host, port } = localAddress()

export default defineConfig({
  base: './',
  optimizeDeps: { entries: ['index.html'] },
  plugins: [
    tailwindcss(),
    {
      name: 'eephone-local-storage',
      configureServer(server) {
        const directory = process.env.EEPHONE_DATA_DIR || fileURLToPath(new URL('./data/', import.meta.url))
        server.middlewares.use(createStorageHandler(directory, host))
      },
    },
  ],
  server: { host: loopbackAddress, allowedHosts: [host], port, strictPort: true },
})
