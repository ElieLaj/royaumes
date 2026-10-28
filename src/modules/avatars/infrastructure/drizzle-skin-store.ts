import { inArray } from 'drizzle-orm'
import type { Db } from '@/platform/db/client'
import type { SkinStore } from '../application/skin-store'
import { skins } from './schema'

/** Adaptateur du port SkinStore, fondé sur la table avatars.skins. */
export function createDrizzleSkinStore(db: Db): SkinStore {
  return {
    async chosen(playerIds) {
      if (playerIds.length === 0) return new Map()
      const rows = await db
        .select({ playerId: skins.playerId, skin: skins.skin })
        .from(skins)
        .where(inArray(skins.playerId, playerIds))
      return new Map(rows.map((row) => [row.playerId, row.skin]))
    },

    async save(playerId, skin, at) {
      await db
        .insert(skins)
        .values({ playerId, skin, chosenAt: at })
        .onConflictDoUpdate({ target: skins.playerId, set: { skin, chosenAt: at } })
    },
  }
}
