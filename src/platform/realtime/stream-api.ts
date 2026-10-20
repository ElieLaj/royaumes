import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { EventStore, StoredEvent } from '../event-store/event-store'
import type { AppEnv } from '../http/types'
import { authorize, type ChannelPolicy } from './channel-policy'

export interface RealtimeOptions {
  /** Journal d'événements : un canal correspond à un flux du journal. */
  store: EventStore
  /** Règles d'accès aux canaux, fournies par les modules. */
  policies: ChannelPolicy[]
  /** Intervalle entre deux lectures du journal, en millisecondes. */
  pollMs?: number
  /** Durée maximale d'un flux avant sa fermeture volontaire, en millisecondes. */
  maxStreamMs?: number
  /** Délai de reconnexion conseillé au navigateur, en millisecondes. */
  retryMs?: number
  /** Intervalle maximal sans message avant l'envoi d'un signe de vie, en millisecondes. */
  pingMs?: number
}

/** Réponse commune aux deux routes lorsque le canal n'est pas autorisé. */
const FORBIDDEN = { error: { code: 'FORBIDDEN', message: 'Canal non autorisé' } } as const

/** Forme transmise d'un événement : sur un canal discret, ses données sont retirées. */
function present(event: StoredEvent, policy: ChannelPolicy) {
  if (!policy.redact) return event
  return { stream: event.stream, version: event.version, type: event.type, data: {} }
}

/**
 * Sous-application du temps réel, montée sur /api/stream.
 * Le flux ne conserve aucun état en mémoire : il relit le journal, et n'importe quelle
 * instance de l'application peut donc servir n'importe quel joueur. La version de chaque
 * événement sert d'identifiant SSE ; la reprise part de l'en-tête Last-Event-ID, ou du
 * paramètre after. Le flux se ferme de lui-même après maxStreamMs, et le navigateur se reconnecte.
 */
export function createRealtimeApi({
  store,
  policies,
  pollMs = 500,
  maxStreamMs = 240_000,
  retryMs = 1_000,
  pingMs = 15_000,
}: RealtimeOptions) {
  return new Hono<AppEnv>()
    .get('/:channel', async (c) => {
      const channel = c.req.param('channel')
      const policy = await authorize(policies, channel, c.var.userId)
      if (!policy) return c.json(FORBIDDEN, 403)

      let lastVersion = Number(c.req.header('last-event-id') ?? c.req.query('after') ?? 0) || 0

      return streamSSE(c, async (stream) => {
        let aborted = false
        stream.onAbort(() => {
          aborted = true
        })
        const deadline = Date.now() + maxStreamMs
        let lastWrite = Date.now()

        await stream.writeSSE({ event: 'ready', data: String(lastVersion), retry: retryMs })

        while (!aborted && Date.now() < deadline) {
          const fresh = await store.read(channel, lastVersion)
          for (const event of fresh) {
            await stream.writeSSE({
              id: String(event.version),
              event: 'domain-event',
              data: JSON.stringify(present(event, policy)),
            })
            lastVersion = event.version
            lastWrite = Date.now()
          }
          if (Date.now() - lastWrite > pingMs) {
            await stream.write(': ping\n\n')
            lastWrite = Date.now()
          }
          await stream.sleep(pollMs)
        }
      })
    })

    .get('/:channel/events', async (c) => {
      const channel = c.req.param('channel')
      const policy = await authorize(policies, channel, c.var.userId)
      if (!policy) return c.json(FORBIDDEN, 403)
      const after = Number(c.req.query('after') ?? 0) || 0
      const events = await store.read(channel, after)
      return c.json({ events: events.map((event) => present(event, policy)) })
    })
}
