import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Source maps let Sentry show real file/line numbers in error reports
    sourcemap: true,
  },
})
