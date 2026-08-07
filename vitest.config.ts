import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'happy-dom',
    // Pinned so the all-day/DST cases in eventFormat.test.ts exercise a zone that
    // actually has a spring-forward change — under UTC they would pass vacuously.
    env: { TZ: 'Europe/Berlin' },
  },
})
