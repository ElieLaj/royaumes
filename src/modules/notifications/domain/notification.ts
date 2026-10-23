/**
 * Règles des notifications. Le module n'enregistre aucun événement : ses règles se réduisent à
 * désigner qui est notifié d'un fait survenu dans un autre module, et à présenter le fil
 * d'un joueur. Le domaine ne connaît pas les événements du journal : la projection les traduit
 * en faits, qu'il examine.
 */

/** Nombre maximal de notifications présentées dans le fil d'un joueur. */
export const FEED_SIZE = 50

/** Durée de conservation d'une notification : trente jours, en millisecondes. */
export const RETENTION_MS = 30 * 24 * 60 * 60_000

/** Instant avant lequel une notification a dépassé sa durée de conservation. */
export const expiredBefore = (now: number) => now - RETENTION_MS

export type NotificationKind = 'trade-completed' | 'offer-expired' | 'game-ended'

/**
 * Notification d'un joueur. Elle désigne l'offre ou l'expédition concernée, jamais un autre
 * joueur. Sa position est celle de l'événement qui la produit : elle l'ordonne et l'identifie,
 * avec son destinataire.
 */
export interface Notification {
  position: number
  recipientId: string
  kind: NotificationKind
  /** Identifiant de l'offre ou de l'expédition concernée. */
  subjectId: string
  /** Résultat d'une expédition ; null pour les autres sortes. */
  outcome: 'won' | 'lost' | null
  occurredAt: number
}

/** Fait survenu dans un autre module, tel que la projection le décrit au domaine. */
export type Fact =
  | { type: 'trade-completed'; position: number; at: number; offerId: string; sellerId: string }
  | {
      type: 'offer-withdrawn'
      position: number
      at: number
      offerId: string
      sellerId: string
      reason: 'seller' | 'expired'
    }
  | {
      type: 'game-ended'
      position: number
      at: number
      gameId: string
      memberIds: string[]
      result: 'won' | 'lost'
    }

/**
 * Notifications produites par un fait. Une offre conclue notifie son vendeur seul, puisque
 * l'acheteur a reçu la réponse de sa propre action ; une offre expirée notifie son vendeur,
 * mais un retrait par le vendeur ne notifie personne ; une expédition terminée notifie chacun
 * de ses joueurs, une fois.
 */
export function notificationsFor(fact: Fact): Notification[] {
  switch (fact.type) {
    case 'trade-completed':
      return [
        {
          position: fact.position,
          recipientId: fact.sellerId,
          kind: 'trade-completed',
          subjectId: fact.offerId,
          outcome: null,
          occurredAt: fact.at,
        },
      ]
    case 'offer-withdrawn':
      if (fact.reason !== 'expired') return []
      return [
        {
          position: fact.position,
          recipientId: fact.sellerId,
          kind: 'offer-expired',
          subjectId: fact.offerId,
          outcome: null,
          occurredAt: fact.at,
        },
      ]
    case 'game-ended':
      return [...new Set(fact.memberIds)].map((recipientId) => ({
        position: fact.position,
        recipientId,
        kind: 'game-ended',
        subjectId: fact.gameId,
        outcome: fact.result,
        occurredAt: fact.at,
      }))
  }
}

/** Notifications qui n'ont pas dépassé leur durée de conservation. */
export const retained = (all: Notification[], now: number) =>
  all.filter((notification) => notification.occurredAt >= expiredBefore(now))

/** Fil présenté à un joueur : ses notifications conservées, les plus récentes d'abord, au plus 50. */
export const feedOf = (all: Notification[], now: number) =>
  retained(all, now)
    .sort((a, b) => b.position - a.position)
    .slice(0, FEED_SIZE)

/** Nombre de notifications postérieures à la position de lecture du joueur. */
export const unreadCount = (all: Notification[], readUntil: number) =>
  all.filter((notification) => notification.position > readUntil).length

/**
 * Nouvelle position de lecture. Elle ne recule jamais, et ne dépasse pas la dernière notification
 * du joueur : il ne peut marquer comme lues que ses propres notifications, et non celles à venir.
 */
export const advanceRead = (current: number, requested: number, latest: number) =>
  Math.max(current, Math.min(requested, latest))
