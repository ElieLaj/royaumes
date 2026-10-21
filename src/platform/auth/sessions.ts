import { lt } from 'drizzle-orm'
import type { Db } from '../db/client'
import { session } from './schema'

/**
 * Supprime les sessions expirées, avec l'adresse IP et le navigateur qu'elles conservent, et
 * renvoie leur nombre. Better Auth ne supprime une session expirée que lorsque son cookie est
 * présenté de nouveau : celle dont le cookie n'est plus jamais présenté resterait sinon dans la
 * base jusqu'à la suppression du compte. Tâche quotidienne, comme la conservation de la Taverne.
 */
export async function purgeExpiredSessions(db: Db, now = Date.now()) {
  const removed = await db
    .delete(session)
    .where(lt(session.expiresAt, new Date(now)))
    .returning({ id: session.id })
  return { sessions: removed.length }
}
