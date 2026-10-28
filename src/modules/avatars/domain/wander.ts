/**
 * Règles de déplacement : un personnage alterne les pauses et les marches, au hasard, sans sortir
 * de la scène. La position s'exprime en fraction de la largeur de la scène, de 0 à 1 : elle ne
 * dépend ni de la taille de l'écran ni des autres joueurs. Le hasard est fourni par l'appelant,
 * ce qui rend chaque déplacement reproductible.
 */

export type Facing = 'left' | 'right'

/** Marche d'un personnage : où il va, vers quel côté il regarde, combien de temps il marche. */
export interface Plan {
  to: number
  facing: Facing
  walkMs: number
  pauseMs: number
}

/** Distance minimale entre un personnage et le bord de la scène. */
export const MARGIN = 0.08

/** Vitesse de marche, en largeurs de scène par seconde. */
export const SPEED = 0.05

/** Longueur d'une marche, en largeurs de scène. */
export const STEP = { min: 0.08, max: 0.3 }

/** Durée de la pause qui précède une marche, en millisecondes. */
export const PAUSE_MS = { min: 1_500, max: 6_000 }

const between = (range: { min: number; max: number }, random: () => number) =>
  range.min + random() * (range.max - range.min)

/** Position de départ d'un personnage, tirée dans la scène. */
export const startPosition = (random: () => number) =>
  between({ min: MARGIN, max: 1 - MARGIN }, random)

/**
 * Prochaine marche d'un personnage placé en `x`. Elle part dans une direction tirée au sort, et
 * rebrousse chemin si elle sortait de la scène. Le personnage regarde du côté où il marche, et
 * marche à vitesse constante : sa durée se déduit de la distance.
 */
export function planMove(x: number, random: () => number): Plan {
  const length = between(STEP, random)
  let direction = random() < 0.5 ? -1 : 1
  const reach = x + direction * length
  if (reach < MARGIN || reach > 1 - MARGIN) direction = -direction

  const to = Math.min(1 - MARGIN, Math.max(MARGIN, x + direction * length))
  return {
    to,
    facing: to < x ? 'left' : 'right',
    walkMs: Math.round((Math.abs(to - x) / SPEED) * 1000),
    pauseMs: Math.round(between(PAUSE_MS, random)),
  }
}
