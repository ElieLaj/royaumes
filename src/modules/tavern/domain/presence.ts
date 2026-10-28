/**
 * Règles de la présence dans la Taverne. Faute de connexion permanente, la présence repose
 * sur un signal envoyé régulièrement par le navigateur de chaque joueur.
 */

/** Intervalle entre deux signaux de présence, en millisecondes. */
export const HEARTBEAT_MS = 30_000

/**
 * Intervalle entre deux relectures de la liste des présents, en millisecondes. Un joueur qui
 * arrive ou qui part apparaît chez les autres à la relecture suivante, sans attendre leur
 * propre signal de présence.
 */
export const REFRESH_MS = 5_000

/** Vrai si deux listes de joueurs présents sont identiques : il n'y a alors rien à mettre à jour. */
export const samePlayers = (
  current: { id: string; name: string }[],
  next: { id: string; name: string }[],
) =>
  current.length === next.length &&
  current.every((player, i) => player.id === next[i].id && player.name === next[i].name)

/**
 * Délai, en millisecondes, au-delà duquel un joueur sans signal est considéré comme parti.
 * Il laisse passer trois signaux manqués : un navigateur peut ralentir les minuteries d'un
 * onglet en arrière-plan, jusqu'à un déclenchement par minute.
 */
export const PRESENCE_TTL_MS = 120_000

/**
 * Instant avant lequel un signal est trop ancien : un joueur dont le dernier signal
 * est antérieur à cet instant est parti.
 */
export const staleBefore = (now: number) => now - PRESENCE_TTL_MS
