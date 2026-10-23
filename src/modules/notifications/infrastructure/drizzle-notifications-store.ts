import { and, eq, gte } from 'drizzle-orm'
import type { Db } from '@/platform/db/client'
import type { ProjectionRunner } from '@/platform/projection/projection'
import type { NotificationsStore } from '../application/notifications-store'
import type { Notification } from '../domain/notification'
import { notificationsProjection } from './notifications-projection'
import { notifications } from './schema'

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
      return { position, notifications: rows as Notification[] }
    },
  }
}
