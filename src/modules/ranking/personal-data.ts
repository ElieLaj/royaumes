import { and, eq, isNotNull } from 'drizzle-orm'
import type { Db } from '@/platform/db/client'
import {
  ERASED_NAME,
  ERASED_VILLAGE,
  type PersonalDataContributor,
} from '@/platform/privacy/privacy'
import type { ProjectionRunner } from '@/platform/projection/projection'
import { rankingProjection } from './infrastructure/ranking-projection'
import { players } from './infrastructure/schema'

/**
 * Données personnelles du Classement : le nom du joueur et celui de son village, copiés
 * par la projection. Le Classement n'a pas d'événements propres : il n'a rien à réécrire.
 * Ses totaux restent, sous un nom neutre : ce sont exactement les valeurs qu'une
 * reconstruction produirait à partir du journal réécrit. L'export rattrape d'abord la
 * projection, comme toute lecture du classement.
 */
export function createRankingPersonalData(
  db: Db,
  projections: ProjectionRunner,
): PersonalDataContributor {
  return {
    name: 'ranking',

    async export(playerId) {
      await projections.catchUp(rankingProjection)
      const [row] = await db.select().from(players).where(eq(players.playerId, playerId))
      return row ?? null
    },

    async erase(playerId) {
      await db
        .update(players)
        .set({ name: ERASED_NAME })
        .where(and(eq(players.playerId, playerId), isNotNull(players.name)))
      await db
        .update(players)
        .set({ village: ERASED_VILLAGE })
        .where(and(eq(players.playerId, playerId), isNotNull(players.village)))
    },
  }
}
