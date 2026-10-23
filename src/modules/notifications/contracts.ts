/**
 * Entrée publique « partagée » du module Notifications : utilisable par le serveur
 * comme par l'interface.
 */
import type { NotificationKind } from './domain/notification'

export type { NotificationKind } from './domain/notification'

/** Notification, telle que la reçoit le joueur : elle désigne une offre ou une expédition. */
export interface NotificationView {
  /** Position de l'événement à l'origine de la notification : elle l'ordonne et l'identifie. */
  position: number
  kind: NotificationKind
  /** Identifiant de l'offre ou de l'expédition concernée. */
  subjectId: string
  /** Résultat d'une expédition ; null pour les autres sortes. */
  outcome: 'won' | 'lost' | null
  occurredAt: number
}

/** Fil d'un joueur, avec la position du journal jusqu'à laquelle il est à jour. */
export interface Feed {
  position: number
  notifications: NotificationView[]
}
