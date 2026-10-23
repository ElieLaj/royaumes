import { and, eq, gte, lt, sql } from 'drizzle-orm'
import type { Db } from '@/platform/db/client'
import type { ProjectionRunner } from '@/platform/projection/projection'
import type { NotificationsStore } from '../application/notifications-store'
import type { Notification } from '../domain/notification'
import { notificationsProjection } from './notifications-projection'
import { gameMembers, notifications, offerParties, readMarks } from './schema'

/**
 * Adaptateur du port NotificationsStore, fondé sur la table des notifications.
 * DETTE TECHNIQUE DT-016 (docs/qualite/dette-technique.md) : cinq requêtes SQL par lecture du fil.
 */
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

    async removeOlderThan(before) {
      const removed = await db
        .delete(notifications)
        .where(lt(notifications.occurredAt, before))
        .returning({ position: notifications.position })
      const offers = await db
        .delete(offerParties)
        .where(lt(offerParties.createdAt, before))
        .returning({ id: offerParties.offerId })
      const games = await db
        .delete(gameMembers)
        .where(lt(gameMembers.createdAt, before))
        .returning({ id: gameMembers.gameId })
      return { notifications: removed.length, parties: offers.length + games.length }
    },
  }
}
