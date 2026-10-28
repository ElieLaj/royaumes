import type { MySkin } from '../contracts'
import { isSkin, type Skin, skinOf } from '../domain/skin'
import type { SkinStore } from './skin-store'

/** Service applicatif des personnages. */
export function createAvatarsService(store: SkinStore, clock = () => Date.now()) {
  /** Personnage du joueur : celui qu'il a choisi, ou celui qui lui est attribué. */
  async function mine(playerId: string): Promise<MySkin> {
    const chosen = (await store.chosen([playerId])).get(playerId)
    return { skin: skinOf(chosen, playerId), chosen: isSkin(chosen) }
  }

  /** Enregistre le personnage choisi par le joueur, qui ne peut choisir que le sien. */
  async function choose(playerId: string, skin: Skin): Promise<MySkin> {
    await store.save(playerId, skin, clock())
    return { skin, chosen: true }
  }

  /**
   * Personnage de chaque joueur demandé, tel que le voient les autres : le choix du joueur, ou le
   * personnage attribué. Seuls les joueurs demandés sont renvoyés, sans distinguer ceux qui ont
   * choisi de ceux qui n'ont rien choisi.
   */
  async function lookup(playerIds: string[]): Promise<Record<string, Skin>> {
    const unique = [...new Set(playerIds)]
    const chosen = await store.chosen(unique)
    return Object.fromEntries(unique.map((id) => [id, skinOf(chosen.get(id), id)]))
  }

  return { mine, choose, lookup }
}

export type AvatarsService = ReturnType<typeof createAvatarsService>
