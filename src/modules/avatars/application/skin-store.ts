import type { Skin } from '../domain/skin'

/** Port de conservation des personnages choisis par les joueurs. */
export interface SkinStore {
  /** Personnages choisis par les joueurs demandés ; un joueur qui n'a rien choisi est absent. */
  chosen(playerIds: string[]): Promise<Map<string, string>>
  /** Enregistre le choix d'un joueur, en remplaçant le précédent. */
  save(playerId: string, skin: Skin, at: number): Promise<void>
}
