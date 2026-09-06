import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],

  resolve: {
    alias: {
      'server-only': fileURLToPath(
        new URL('./tests/mocks/server-only.ts', import.meta.url),
      ),
    },
  },

  test: {
    environment: 'node',

    include: ['**/*.test.ts'],

    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
      ],
      exclude: [
        'lib/spotify/**/*.test.ts',
        'lib/spotify/types.ts',
      ],
    },
  },
})