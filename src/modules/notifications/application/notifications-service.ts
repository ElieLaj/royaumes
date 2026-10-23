import type { Feed } from '../contracts'
import { expiredBefore, feedOf } from '../domain/notification'
import type { NotificationsStore } from './notifications-store'

/** Service applicatif des notifications. */
export function createNotificationsService(store: NotificationsStore, clock = () => Date.now()) {
  /** Fil d'un joueur : ses notifications conservées, les plus récentes d'abord. */
  async function feed(playerId: string): Promise<Feed> {
    const now = clock()
    const { position, notifications } = await store.forPlayer(playerId, expiredBefore(now))
    return {
      position,
      notifications: feedOf(notifications, now).map((n) => ({
        position: n.position,
        kind: n.kind,
        subjectId: n.subjectId,
        outcome: n.outcome,
        occurredAt: n.occurredAt,
      })),
    }
  }

  return { feed }
}

export type NotificationsService = ReturnType<typeof createNotificationsService>
