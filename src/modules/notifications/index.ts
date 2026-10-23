/**
 * Entrée publique « serveur » du module Notifications.
 * Avec contracts.ts et ui.tsx, c'est le seul fichier du module qui peut être
 * importé depuis l'extérieur.
 */
import type { Db } from '@/platform/db/client'
import type { ProjectionRunner } from '@/platform/projection/projection'
import { createNotificationsApi } from './api'
import { createNotificationsService } from './application/notifications-service'
import { createDrizzleNotificationsStore } from './infrastructure/drizzle-notifications-store'
import { createNotificationsPersonalData } from './personal-data'

export interface NotificationsModuleDeps {
  /** Base de données, dans laquelle le module tient son modèle de lecture. */
  db: Db
  /** Moteur des projections de la plateforme. */
  projections: ProjectionRunner
  /** Horloge de référence ; l'heure réelle par défaut. */
  clock?: () => number
}

/** Fabrique du module : assemble l'adaptateur, le service et l'API. */
export function createNotificationsModule({ db, projections, clock }: NotificationsModuleDeps) {
  const store = createDrizzleNotificationsStore(db, projections)
  const service = createNotificationsService(store, clock)

  return {
    api: createNotificationsApi(service),
    personalData: createNotificationsPersonalData(db, projections),
  }
}

export type { NotificationsApi } from './api'
