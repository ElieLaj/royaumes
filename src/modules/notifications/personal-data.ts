import { asc, eq } from 'drizzle-orm'
import type { Db } from '@/platform/db/client'
import type { PersonalDataContributor } from '@/platform/privacy/privacy'
import type { ProjectionRunner } from '@/platform/projection/projection'
import { notificationsProjection } from './infrastructure/notifications-projection'
import { gameMembers, notifications, offerParties, readMarks } from './infrastructure/schema'

/**
 * Données personnelles des Notifications : les notifications du joueur, et l'identifiant retenu
 * dans les tables de correspondance tant que son offre ou son expédition n'est pas terminée,
 * et sa position de lecture.
 * Le module n'enregistre aucun événement : il n'a rien à réécrire dans le journal, et l'effacement
 * est une simple suppression. L'export rattrape d'abord la projection, comme toute lecture du fil.
 */
export function createNotificationsPersonalData(
  db: Db,
  projections: ProjectionRunner,
): PersonalDataContributor {
  return {
    name: 'notifications',

    async export(playerId) {
      await projections.catchUp(notificationsProjection)
      const [mark] = await db.select().from(readMarks).where(eq(readMarks.playerId, playerId))
      return {
        readUntil: mark?.readUntil ?? 0,
        notifications: await db
          .select({
            kind: notifications.kind,
            subjectId: notifications.subjectId,
            outcome: notifications.outcome,
            occurredAt: notifications.occurredAt,
          })
          .from(notifications)
          .where(eq(notifications.recipientId, playerId))
          .orderBy(asc(notifications.position)),
      }
    },

    async erase(playerId) {
      await db.delete(notifications).where(eq(notifications.recipientId, playerId))
      await db.delete(readMarks).where(eq(readMarks.playerId, playerId))
      await db.delete(offerParties).where(eq(offerParties.sellerId, playerId))
      await db.delete(gameMembers).where(eq(gameMembers.playerId, playerId))
    },
  }
}
