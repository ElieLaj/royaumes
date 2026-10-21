import { sql } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestApi } from './testing'

afterEach(() => vi.restoreAllMocks())

describe('Journal des erreurs', () => {
  it("ne journalise ni le contenu d'un message, ni le nom de son auteur, lorsqu'une requête SQL échoue", async () => {
    const logged: string[] = []
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      logged.push(
        args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : String(a))).join(' '),
      )
    })
    const api = await createTestApi()
    await api.db.execute(sql`ALTER TABLE tavern.messages RENAME COLUMN body TO body_x`)

    const res = await api.post('/api/tavern/messages', { body: 'Message confidentiel' }, 'alice')

    expect(res.status).toBe(500)
    expect(logged.join('\n')).toContain('Failed query')
    expect(logged.join('\n')).not.toContain('Message confidentiel')
  })
})
