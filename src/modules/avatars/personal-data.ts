import { eq } from 'drizzle-orm'
import type { Db } from '@/platform/db/client'
import type { PersonalDataContributor } from '@/platform/privacy/privacy'
import { skins } from './infrastructure/schema'

/**
 * Données personnelles des Avatars : le personnage choisi par le joueur, et la date de son choix.
 * Le module n'enregistre pas d'événements : l'effacement est une simple suppression.
 */
export function createAvatarsPersonalData(db: Db): PersonalDataContributor {
  return {
    name: 'avatars',

    async export(playerId) {
      return {
        skins: await db
          .select({ skin: skins.skin, chosenAt: skins.chosenAt })
          .from(skins)
          .where(eq(skins.playerId, playerId)),
      }
    },

    async erase(playerId) {
      await db.delete(skins).where(eq(skins.playerId, playerId))
    },
  }
}
