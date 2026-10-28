import { Hono } from 'hono'
import type { AppEnv } from '@/platform/http/types'
import { validateJson } from '@/platform/http/validate'
import type { TavernService } from './application/tavern-service'
import { type MessageError, PostMessageInput } from './contracts'

/** Code HTTP associé à chaque erreur. */
const STATUS: Record<MessageError['code'], 422 | 429> = {
  EMPTY_MESSAGE: 422,
  MESSAGE_TOO_LONG: 422,
  TOO_MANY_MESSAGES: 429,
}

/**
 * Sous-application Hono du module Taverne, montée sur /api/tavern.
 * L'auteur d'un message est toujours le joueur connecté. Un message refusé par la limitation
 * reçoit le code 429, avec l'en-tête Retry-After : le délai à attendre, en secondes.
 * Le signal de présence renvoie les joueurs présents. La liste n'est pas diffusée en temps réel,
 * pour ne pas ajouter de canal : l'interface la relit, sans signaler sa présence, toutes les cinq
 * secondes.
 */
export function createTavernApi(service: TavernService) {
  return new Hono<AppEnv>()
    .get('/messages', async (c) => c.json({ messages: await service.latest() }))

    .post('/messages', validateJson(PostMessageInput), async (c) => {
      const player = { id: c.var.userId, name: c.var.userName }
      const result = await service.post(player, c.req.valid('json').body)
      if (result.ok) return c.json({ message: result.message }, 201)
      if (result.error.code === 'TOO_MANY_MESSAGES') {
        c.header('Retry-After', String(Math.ceil(result.error.retryAfterMs / 1000)))
      }
      return c.json({ error: result.error }, STATUS[result.error.code])
    })

    .get('/presence', async (c) => c.json({ players: await service.present() }))

    .post('/presence', async (c) => {
      const players = await service.heartbeat({ id: c.var.userId, name: c.var.userName })
      return c.json({ players })
    })

    .post('/presence/leave', async (c) => {
      await service.leave(c.var.userId)
      return c.body(null, 204)
    })
}

export type TavernApi = ReturnType<typeof createTavernApi>
