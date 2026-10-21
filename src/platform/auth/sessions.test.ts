import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, type Db } from '../db/client'
import { session, user } from './schema'
import { purgeExpiredSessions } from './sessions'

const NOW = Date.UTC(2026, 0, 1)

let db: Db
beforeEach(async () => {
  db = await createTestDatabase()
  await db.insert(user).values({ id: 'alice', name: 'alice', email: 'alice@example.com' })
})

/** Session de la joueuse alice, qui expire à l'instant donné. */
const sessionOf = (token: string, expiresAt: number) => ({
  id: token,
  token,
  userId: 'alice',
  expiresAt: new Date(expiresAt),
})

describe('Sessions expirées', () => {
  it('supprime les sessions expirées, avec leur adresse IP, et conserve les autres', async () => {
    await db
      .insert(session)
      .values([
        { ...sessionOf('expiree', NOW - 1), ipAddress: '203.0.113.7' },
        sessionOf('valide', NOW + 86_400_000),
      ])

    expect(await purgeExpiredSessions(db, NOW)).toEqual({ sessions: 1 })
    expect((await db.select().from(session)).map((row) => row.token)).toEqual(['valide'])
    expect(await purgeExpiredSessions(db, NOW)).toEqual({ sessions: 0 })
  })
})
