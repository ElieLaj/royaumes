/**
 * Règles des bulles : lorsqu'un joueur écrit dans la Taverne, son personnage affiche un
 * résumé de son message pendant quelques secondes. Les instants sont ceux de l'horloge du
 * navigateur qui reçoit le message : ils ne dépendent pas du décalage entre deux horloges.
 */

/** Nombre maximal de caractères d'une bulle, points de suspension compris. */
export const BUBBLE_MAX_LENGTH = 60

/** Durée d'affichage d'une bulle, en millisecondes. */
export const BUBBLE_MS = 6_000

/** Message reçu par le navigateur, avec l'instant de sa réception. */
export interface Spoken {
  authorId: string
  body: string
  receivedAt: number
}

/**
 * Texte d'une bulle : le message sur une seule ligne, raccourci avec des points de suspension
 * s'il dépasse la longueur maximale. Les caractères sont comptés un à un : un symbole comme
 * « 🍺 » n'est jamais coupé en deux.
 */
export function bubbleText(body: string) {
  const characters = [...body.replace(/\s+/g, ' ').trim()]
  if (characters.length <= BUBBLE_MAX_LENGTH) return characters.join('')
  return `${characters.slice(0, BUBBLE_MAX_LENGTH - 1).join('')}…`
}

/**
 * Bulle à afficher au-dessus d'un joueur : le résumé de son dernier message, tant que celui-ci
 * date de moins de six secondes. Les messages des autres joueurs ne le concernent pas.
 */
export function visibleBubble(spoken: Spoken[], authorId: string, now: number) {
  let latest: Spoken | null = null
  for (const entry of spoken) {
    if (entry.authorId !== authorId || now - entry.receivedAt >= BUBBLE_MS) continue
    if (!latest || entry.receivedAt >= latest.receivedAt) latest = entry
  }
  const text = latest ? bubbleText(latest.body) : ''
  return text === '' ? null : text
}
