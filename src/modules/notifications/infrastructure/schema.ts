import { bigint, index, pgSchema, primaryKey, text } from 'drizzle-orm/pg-core'

/**
 * Schéma PostgreSQL du module Notifications. Il ne contient que des modèles de lecture, tenus à
 * jour par une projection du journal : le module n'enregistre aucun événement.
 */
export const notificationsSchema = pgSchema('notifications')

/**
 * Fil des notifications, identifié par la position de l'événement et le destinataire : rejouer un
 * événement ne crée aucun doublon, et une reconstruction redonne les mêmes lignes.
 */
export const notifications = notificationsSchema.table(
  'notifications',
  {
    position: bigint('position', { mode: 'number' }).notNull(),
    recipientId: text('recipient_id').notNull(),
    kind: text('kind').notNull(),
    subjectId: text('subject_id').notNull(),
    outcome: text('outcome'),
    occurredAt: bigint('occurred_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.position, t.recipientId] }),
    index('notifications_recipient_idx').on(t.recipientId, t.position),
    index('notifications_occurred_at_idx').on(t.occurredAt),
  ],
)

/**
 * Vendeur de chaque offre en cours : l'événement final d'une offre ne le désigne pas. La ligne
 * est retenue jusqu'à la fin de l'offre ; createdAt est la date de l'événement qui l'a créée.
 */
export const offerParties = notificationsSchema.table(
  'offer_parties',
  {
    offerId: text('offer_id').primaryKey(),
    sellerId: text('seller_id').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [index('offer_parties_created_at_idx').on(t.createdAt)],
)

/** Joueurs de chaque expédition en cours, retenus jusqu'à sa fin, compagnons exclus. */
export const gameMembers = notificationsSchema.table(
  'game_members',
  {
    gameId: text('game_id').notNull(),
    playerId: text('player_id').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.gameId, t.playerId] }),
    index('game_members_created_at_idx').on(t.createdAt),
  ],
)
