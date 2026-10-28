import { bigint, pgSchema, text } from 'drizzle-orm/pg-core'

/**
 * Schéma PostgreSQL du module Avatars. Il ne contient que le choix de chaque joueur : le module
 * n'enregistre aucun événement, et sa table est sa seule source de vérité.
 */
export const avatars = pgSchema('avatars')

/** Personnage choisi par un joueur : une ligne par joueur qui a choisi, supprimée avec son compte. */
export const skins = avatars.table('skins', {
  playerId: text('player_id').primaryKey(),
  skin: text('skin').notNull(),
  chosenAt: bigint('chosen_at', { mode: 'number' }).notNull(),
})
