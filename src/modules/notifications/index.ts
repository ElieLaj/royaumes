/**
 * Entrée publique « serveur » du module Notifications.
 * Avec contracts.ts et ui.tsx, c'est le seul fichier du module qui peut être
 * importé depuis l'extérieur.
 */
import type { Db } from '@/platform/db/client'
import type { ProjectionRunner } from '@/platform/projection/projection'
import type { ChannelPolicy } from '@/platform/realtime/channel-policy'
import { createNotificationsApi } from './api'
import { createNotificationsService } from './application/notifications-service'
import { NOTIFICATIONS_CHANNEL } from './contracts'
import { createDrizzleNotificationsStore } from './infrastructure/drizzle-notifications-store'
import { NOTIFYING_TYPES } from './infrastructure/notifications-projection'
import { createNotificationsPersonalData } from './personal-data'

export interface NotificationsModuleDeps {
  /** Base de données, dans laquelle le module tient son modèle de lecture. */
  db: Db
  /** Moteur des projections de la plateforme. */
  projections: ProjectionRunner
  /** Horloge de référence ; l'heure réelle par défaut. */
  clock?: () => number
}

/** Fabrique du module : assemble l'adaptateur, le service, l'API et la règle du canal. */
export function createNotificationsModule({ db, projections, clock }: NotificationsModuleDeps) {
  const store = createDrizzleNotificationsStore(db, projections)
  const service = createNotificationsService(store, clock)

  /**
   * Canal des notifications, ouvert à tout joueur connecté. Il est global et discret, comme celui
   * du Classement : il annonce les événements qui produisent une notification, sans données ni
   * destinataire, et chaque navigateur relit son propre fil, que le serveur filtre.
   * DETTE TECHNIQUE DT-015 (docs/qualite/dette-technique.md) : le canal n'est pas propre à un
   * joueur, car la source d'un canal ne reçoit pas son nom ; chaque joueur connecté relit son fil
   * à chaque notification, quel qu'en soit le destinataire.
   */
  const channelPolicy: ChannelPolicy = {
    prefix: NOTIFICATIONS_CHANNEL,
    canSubscribe: (channel) => channel === NOTIFICATIONS_CHANNEL,
    redact: true,
    global: { types: NOTIFYING_TYPES },
  }

  return {
    api: createNotificationsApi(service),
    channelPolicy,
    dailyTask: service.purge,
    personalData: createNotificationsPersonalData(db, projections),
  }
}

export type { NotificationsApi } from './api'
