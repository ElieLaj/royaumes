/**
 * Entrée publique « partagée » du module Avatars : utilisable par le serveur comme par
 * l'interface.
 */
import { z } from 'zod'
import { LOOKUP_MAX, SKINS, type Skin } from './domain/skin'

export type { Skin } from './domain/skin'
export { defaultSkin, LOOKUP_MAX, SKINS } from './domain/skin'

/** Intervalle entre deux demandes des personnages des joueurs présents, en millisecondes. */
export const SKINS_REFRESH_MS = 30_000

/** Corps attendu pour choisir son personnage : un nom du catalogue, et rien d'autre. */
export const ChooseSkinInput = z.object({ skin: z.enum(SKINS) })

/** Corps attendu pour demander les personnages de plusieurs joueurs. */
export const LookupInput = z.object({
  playerIds: z.array(z.string().min(1).max(100)).min(1).max(LOOKUP_MAX),
})

/** Personnage du joueur connecté, et s'il l'a choisi lui-même ou s'il lui a été attribué. */
export interface MySkin {
  skin: Skin
  chosen: boolean
}

/** Image d'un personnage, avec la taille à laquelle l'afficher, en pixels de l'écran. */
export interface Sprite {
  src: string
  width: number
  height: number
}

/** Apparence d'un personnage : son nom, son image au repos et son image de marche. */
export interface SkinLook {
  label: string
  idle: Sprite
  walk: Sprite
}

/**
 * Apparence de chaque personnage. Les tailles compensent l'échelle propre à chaque image : un
 * pixel du sprite occupe quatre pixels de l'écran, au repos comme en marche.
 * DETTE TECHNIQUE DT-018 (docs/qualite/dette-technique.md) : ces tailles sont mesurées à la main.
 */
export const SKIN_LOOKS: Record<Skin, SkinLook> = {
  dwarf: {
    label: 'Nain',
    idle: { src: '/avatars/dwarf-idle.png', width: 66, height: 54 },
    walk: { src: '/avatars/dwarf-walk.gif', width: 67, height: 55 },
  },
  elf: {
    label: 'Elfe',
    idle: { src: '/avatars/elf-idle.png', width: 58, height: 66 },
    walk: { src: '/avatars/elf-walk.gif', width: 59, height: 67 },
  },
  knight: {
    label: 'Chevalier',
    idle: { src: '/avatars/knight-idle.png', width: 45, height: 66 },
    walk: { src: '/avatars/knight-walk.gif', width: 56, height: 68 },
  },
}
