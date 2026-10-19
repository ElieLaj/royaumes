import { bigserial, integer, jsonb, pgSchema, text, timestamp, unique } from 'drizzle-orm/pg-core'

/** Schéma PostgreSQL de la plateforme technique. */
export const platform = pgSchema('platform')

/**
 * Journal d'événements, en ajout seul : aucune ligne n'est jamais modifiée ni supprimée.
 * - position : ordre global de tous les événements, attribué par la base ;
 * - stream   : flux auquel appartient l'événement (par exemple « village-<joueur> ») ;
 * - version  : rang de l'événement dans son flux, à partir de 1 ;
 * - type et data : l'événement lui-même, que la plateforme n'interprète pas.
 * - unicité de (stream, version) : c'est elle qui garantit la concurrence optimiste.
 */
export const events = platform.table(
  'events',
  {
    position: bigserial('position', { mode: 'number' }).primaryKey(),
    stream: text('stream').notNull(),
    version: integer('version').notNull(),
    type: text('type').notNull(),
    data: jsonb('data').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('events_stream_version').on(t.stream, t.version)],
)
