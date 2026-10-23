/**
 * Entrée publique « partagée » du module Notifications : utilisable par le serveur
 * comme par l'interface.
 */
import { z } from 'zod'
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
  /** Vrai si la notification n'est pas postérieure à la position de lecture du joueur. */
  read: boolean
}

/** Fil d'un joueur, avec la position du journal jusqu'à laquelle il est à jour. */
export interface Feed {
  position: number
  /** Position de lecture du joueur : ses notifications postérieures sont non lues. */
  readUntil: number
  /** Nombre de notifications non lues, y compris celles que le fil ne présente plus. */
  unread: number
  notifications: NotificationView[]
}

/** Corps attendu pour marquer des notifications comme lues : la position jusqu'où elles le sont. */
export const ReadInput = z.object({ upTo: z.number().int().nonnegative() })

/** Résultat d'un marquage : la nouvelle position de lecture, et les notifications non lues. */
export interface ReadResult {
  readUntil: number
  unread: number
}
