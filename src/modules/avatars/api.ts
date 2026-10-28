import { Hono } from 'hono'
import type { AppEnv } from '@/platform/http/types'
import { validateJson } from '@/platform/http/validate'
import type { AvatarsService } from './application/avatars-service'
import { ChooseSkinInput, LookupInput } from './contracts'

/**
 * Sous-application Hono du module Avatars, montée sur /api/avatars.
 * Un joueur ne choisit que son propre personnage : le joueur est toujours celui que
 * l'authentification a identifié, et aucune route n'accepte son identifiant pour y écrire.
 */
export function createAvatarsApi(service: AvatarsService) {
  return new Hono<AppEnv>()
    .get('/me', async (c) => c.json(await service.mine(c.var.userId)))

    .put('/me', validateJson(ChooseSkinInput), async (c) =>
      c.json(await service.choose(c.var.userId, c.req.valid('json').skin)),
    )

    .post('/lookup', validateJson(LookupInput), async (c) =>
      c.json({ skins: await service.lookup(c.req.valid('json').playerIds) }),
    )
}

/** Type de la sous-application, utilisé par le client typé de l'interface. */
export type AvatarsApi = ReturnType<typeof createAvatarsApi>
