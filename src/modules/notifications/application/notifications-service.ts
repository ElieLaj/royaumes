import type { Feed, ReadResult } from '../contracts'
import { advanceRead, expiredBefore, feedOf, retained, unreadCount } from '../domain/notification'
import type { NotificationsStore } from './notifications-store'

/** Service applicatif des notifications. */
export function createNotificationsService(store: NotificationsStore, clock = () => Date.now()) {
  /** Fil d'un joueur : ses notifications conservées, les plus récentes d'abord. */
  async function feed(playerId: string): Promise<Feed> {
    const now = clock()
    const { position, notifications, readUntil } = await store.forPlayer(
      playerId,
      expiredBefore(now),
    )
    return {
      position,
      readUntil,
      unread: unreadCount(retained(notifications, now), readUntil),
      notifications: feedOf(notifications, now).map((n) => ({
        position: n.position,
        kind: n.kind,
        subjectId: n.subjectId,
        outcome: n.outcome,
        occurredAt: n.occurredAt,
        read: n.position <= readUntil,
      })),
    }
  }

  /**
   * Marque comme lues les notifications d'un joueur jusqu'à la position indiquée. Elle est
   * ramenée à celle de sa dernière notification : il ne peut marquer que les siennes.
   */
  async function markRead(playerId: string, upTo: number): Promise<ReadResult> {
    const now = clock()
    const { notifications, readUntil } = await store.forPlayer(playerId, expiredBefore(now))
    const kept = retained(notifications, now)
    const latest = Math.max(0, ...kept.map((n) => n.position))
    const next = advanceRead(readUntil, upTo, latest)
    if (next !== readUntil) await store.saveReadUntil(playerId, next)
    return { readUntil: next, unread: unreadCount(kept, next) }
  }

  /**
   * Tâche quotidienne : applique la durée de conservation, même si personne ne consulte son fil,
   * et supprime les lignes de correspondance d'offres ou d'expéditions restées sans fin.
   * Renvoie le nombre de lignes supprimées.
   */
  const purge = () => store.removeOlderThan(expiredBefore(clock()))

  return { feed, markRead, purge }
}

export type NotificationsService = ReturnType<typeof createNotificationsService>
