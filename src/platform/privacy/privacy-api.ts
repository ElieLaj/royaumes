import { Hono } from 'hono'
import type { AppEnv } from '../http/types'
import type { PrivacyService } from './privacy'

/**
 * Sous-application des droits du joueur connecté, montée sur /api/account.
 * Comme ailleurs, le joueur est celui que l'authentification a identifié : personne
 * ne peut exporter ni effacer les données d'un autre joueur. L'export est servi avec
 * l'en-tête Content-Disposition, qui demande au navigateur de télécharger le fichier.
 */
export function createPrivacyApi(service: PrivacyService) {
  return new Hono<AppEnv>()
    .get('/export', async (c) => {
      const data = await service.exportData(c.var.userId)
      c.header('Content-Disposition', 'attachment; filename="royaumes-mes-donnees.json"')
      return c.json(data)
    })

    .delete('/', async (c) => c.json(await service.erase(c.var.userId)))
}
