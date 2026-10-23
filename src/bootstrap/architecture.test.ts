import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { SOURCE_EVENTS } from '@/modules/notifications/contracts'
import { createTestDatabase } from '@/platform/db/client'

/** Répertoires des modules métier. */
const MODULES = readdirSync(path.join(process.cwd(), 'src/modules'))

/**
 * Fonctions d'aptitude (TD11) : des règles d'architecture que dependency-cruiser ne peut pas
 * vérifier, parce qu'elles ne portent pas sur les importations, sont vérifiées par des tests.
 */
describe("Fonctions d'aptitude", () => {
  it("range chaque table dans le schéma d'une brique de la plateforme ou d'un module", async () => {
    const db = await createTestDatabase()
    const result = await db.execute(sql`
      SELECT DISTINCT table_schema FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'drizzle')`)
    const schemas = (result as unknown as { rows: { table_schema: string }[] }).rows.map(
      (row) => row.table_schema,
    )

    const owners = ['platform', 'identity', ...MODULES]
    expect(schemas).not.toContain('public')
    for (const schema of schemas) expect(owners).toContain(schema)
  })

  it('déclare les données personnelles de chaque module qui conserve des données', () => {
    const withData = MODULES.filter((module) => module !== 'system')
    for (const module of withData) {
      const file = path.join(process.cwd(), 'src/modules', module, 'personal-data.ts')
      expect(existsSync(file), `${module} n'a pas de fichier personal-data.ts`).toBe(true)
    }
  })

  it('lit des événements que les modules sources publient encore', () => {
    for (const [module, types] of Object.entries(SOURCE_EVENTS)) {
      const dir = path.join(process.cwd(), 'src/modules', module, 'domain')
      const source = readdirSync(dir)
        .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
        .map((file) => readFileSync(path.join(dir, file), 'utf8'))
        .join('\n')
      for (const type of types) {
        expect(source, `${module} ne publie plus l'événement ${type}`).toContain(`type: '${type}'`)
      }
    }
  })
})
