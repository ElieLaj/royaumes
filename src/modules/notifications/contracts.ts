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

/**
 * Types d'événements que le module lit dans le journal, par module d'origine : le langage publié
 * du Marché et du Donjon dont il dépend. Une fonction d'aptitude vérifie que ces modules les
 * publient encore, de sorte qu'un événement renommé ne rende pas le fil silencieusement muet.
 */
export const SOURCE_EVENTS = {
  market: ['OfferPublished', 'TradeCompleted', 'OfferWithdrawn', 'OfferRejected'],
  dungeon: ['GameCreated', 'PlayerJoined', 'GameEnded'],
} as const

/** Nom du canal temps réel du module, qui ne correspond à aucun flux du journal. */
export const NOTIFICATIONS_CHANNEL = 'notifications'

/** Corps attendu pour marquer des notifications comme lues : la position jusqu'où elles le sont. */
export const ReadInput = z.object({ upTo: z.number().int().nonnegative() })

/** Résultat d'un marquage : la nouvelle position de lecture, et les notifications non lues. */
export interface ReadResult {
  readUntil: number
  unread: number
}
