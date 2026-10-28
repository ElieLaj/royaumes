/**
 * Entrée publique « serveur » du module Avatars.
 * Avec contracts.ts et ui.tsx, c'est le seul fichier du module qui peut être
 * importé depuis l'extérieur.
 */
import type { Db } from '@/platform/db/client'
import { createAvatarsApi } from './api'
import { createAvatarsService } from './application/avatars-service'
import { createDrizzleSkinStore } from './infrastructure/drizzle-skin-store'
import { createAvatarsPersonalData } from './personal-data'

export interface AvatarsModuleDeps {
  /** Base de données, dans laquelle le module conserve le choix des joueurs. */
  db: Db
  /** Horloge de référence ; l'heure réelle par défaut. */
  clock?: () => number
}

/** Fabrique du module : assemble l'adaptateur, le service et l'API. */
export function createAvatarsModule({ db, clock }: AvatarsModuleDeps) {
  const service = createAvatarsService(createDrizzleSkinStore(db), clock)

  return {
    api: createAvatarsApi(service),
    personalData: createAvatarsPersonalData(db),
  }
}

export type { AvatarsApi } from './api'
