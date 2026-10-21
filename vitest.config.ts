import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Même alias que dans tsconfig.json : « @/ » désigne le répertoire src/.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    // Les tests s'exécutent dans Node.js, sans navigateur simulé.
    environment: 'node',
    // Seuls les fichiers de test placés dans src/ sont exécutés.
    include: ['src/**/*.test.ts'],
    /** Toujours en environnement de test, même lorsque Vercel définit NODE_ENV=production. */
    env: { NODE_ENV: 'test' },
    testTimeout: 60_000,
    hookTimeout: 60_000,
    /** Chaque processus charge PGlite, en WebAssembly : trop de processus simultanés épuisent la mémoire. */
    maxWorkers: 4,
    /** Couverture du code du projet par les tests, hors tests eux-mêmes ; mesurée par pnpm test:coverage. */
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text-summary', 'html'],
      reportsDirectory: 'coverage',
    },
  },
})
