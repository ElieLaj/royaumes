import { Hono } from 'hono'
import type { AppEnv } from '@/platform/http/types'
import { validateJson } from '@/platform/http/validate'
import type { NotificationsService } from './application/notifications-service'
import { ReadInput } from './contracts'

/**
 * Sous-application Hono du module Notifications, montée sur /api/notifications.
 * Le joueur est toujours celui que l'authentification a identifié : aucune route
 * n'accepte un identifiant de joueur.
 */
export function createNotificationsApi(service: NotificationsService) {
  return new Hono<AppEnv>()
    .get('/', async (c) => c.json(await service.feed(c.var.userId)))

    .post('/read', validateJson(ReadInput), async (c) =>
      c.json(await service.markRead(c.var.userId, c.req.valid('json').upTo)),
    )
}

/** Type de la sous-application, utilisé par le client typé de l'interface. */
export type NotificationsApi = ReturnType<typeof createNotificationsApi>
