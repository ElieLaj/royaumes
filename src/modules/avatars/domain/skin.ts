/**
 * Règles des personnages : chaque joueur présent dans la Taverne y est représenté par un
 * personnage, dont il choisit l'apparence parmi un catalogue. Le domaine ne connaît ni la
 * base ni les images : il désigne seulement le personnage de chacun.
 */

/** Catalogue des personnages. Chacun a ses deux images dans public/avatars. */
export const SKINS = ['dwarf', 'elf', 'knight'] as const

export type Skin = (typeof SKINS)[number]

/** Nombre maximal de joueurs dont on demande le personnage en une seule fois. */
export const LOOKUP_MAX = 50

export const isSkin = (value: unknown): value is Skin => SKINS.some((skin) => skin === value)

/** Empreinte de texte stable d'un appel à l'autre (FNV-1a, sur 32 bits). */
function fingerprint(text: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  }
  return hash >>> 0
}

/**
 * Personnage d'un joueur qui n'a rien choisi : il est tiré de son identifiant, de sorte que
 * chacun a un personnage dès sa première visite, et qu'il reste le même d'une visite à l'autre.
 */
export const defaultSkin = (playerId: string): Skin => SKINS[fingerprint(playerId) % SKINS.length]

/**
 * Personnage d'un joueur : celui qu'il a choisi, ou celui par défaut si son choix a disparu
 * du catalogue.
 */
export const skinOf = (chosen: string | null | undefined, playerId: string): Skin =>
  isSkin(chosen) ? chosen : defaultSkin(playerId)
