import { and, eq, gte, sql } from 'drizzle-orm'
import type { Db } from '@/platform/db/client'
import type { ProjectionRunner } from '@/platform/projection/projection'
import type { NotificationsStore } from '../application/notifications-store'
import type { Notification } from '../domain/notification'
import { notificationsProjection } from './notifications-projection'
import { notifications, readMarks } from './schema'

/** Adaptateur du port NotificationsStore, fondé sur la table des notifications. */
export function createDrizzleNotificationsStore(
  db: Db,
  projections: ProjectionRunner,
): NotificationsStore {
  return {
    async forPlayer(playerId, since) {
      await projections.catchUp(notificationsProjection)

      const position = await projections.positionOf(notificationsProjection.name)
      const rows = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.recipientId, playerId), gte(notifications.occurredAt, since)))
      const [mark] = await db.select().from(readMarks).where(eq(readMarks.playerId, playerId))
      return {
        position,
        notifications: rows as Notification[],
        readUntil: mark?.readUntil ?? 0,
      }
    },

    async saveReadUntil(playerId, readUntil) {
      await db
        .insert(readMarks)
        .values({ playerId, readUntil })
        .onConflictDoUpdate({
          target: readMarks.playerId,
          set: { readUntil: sql`greatest(${readMarks.readUntil}, ${readUntil})` },
        })
    },
  }
}
