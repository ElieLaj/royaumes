import { Hono } from 'hono'
import { createRealmModule } from '@/modules/realm'
import { VILLAGE_CHANNEL_PREFIX } from '@/modules/realm/contracts'
import type { Db } from '@/platform/db/client'
import { createEventStore } from '@/platform/event-store/event-store'
import { playerFromHeaders, requireServiceSecret } from '@/platform/http/service-auth'
import type { AppEnv } from '@/platform/http/types'
import { createInboxApi, forwardTo } from '@/platform/outbox/inbox-api'
import { createDispatcher } from '@/platform/outbox/outbox'
import { createPrivacyService } from '@/platform/privacy/privacy'

export interface VillageServiceDeps {
  /** Base du service : son propre journal et sa propre boîte d'envoi. */
  db: Db
  /** Secret partagé avec l'application. */
  secret: string
  /** Adresse de l'application, à laquelle le service transmet ses réponses. */
  appUrl: string
  /** Horloge de référence ; l'heure réelle par défaut. */
  clock?: () => number
  /** Fonction d'envoi des requêtes vers l'application ; remplacée dans les tests. */
  fetch?: typeof fetch
}

/**
 * Racine de composition du service Village extrait (TD11). Elle assemble le module Village,
 * inchangé, avec sa propre plateforme : journal, boîte d'envoi et droits des joueurs.
 * Toutes les routes exigent le secret partagé : seule l'application peut appeler le service.
 *
 * Les messages du Village sont traités dans la boîte d'envoi du service ; tous les autres,
 * c'est-à-dire les réponses adressées au Marché, sont transmis à l'application, aussitôt après
 * chaque message reçu. Le flux publié renvoie les événements du Village postérieurs à une
 * position : c'est le langage publié du TD8, devenu une interface explicite.
 */
export function createVillageServiceApp({ db, secret, appUrl, clock, fetch }: VillageServiceDeps) {
  const store = createEventStore(db)
  const realm = createRealmModule({ store, clock })

  const dispatcher = createDispatcher(db)
  dispatcher.register(realm.handlers)
  dispatcher.registerFallback(forwardTo(`${appUrl}/api/internal`, secret, fetch))

  const privacy = createPrivacyService(db, [realm.personalData], clock)

  return new Hono<AppEnv>()
    .use(requireServiceSecret(secret))

    .use('/realm/*', playerFromHeaders)
    .route('/realm', realm.api)

    .route(
      '/',
      createInboxApi(dispatcher, secret, () => dispatcher.dispatch()),
    )

    .get('/events', async (c) => {
      const after = Number(c.req.query('after') ?? 0) || 0
      const events = await store.readAll({
        streamPrefix: VILLAGE_CHANNEL_PREFIX,
        afterPosition: after,
      })
      return c.json({ events })
    })

    .get('/personal-data/:playerId', async (c) => {
      const data = await privacy.exportData(c.req.param('playerId'))
      return c.json(data.sections.realm ?? null)
    })
    .delete('/personal-data/:playerId', async (c) =>
      c.json(await privacy.erase(c.req.param('playerId'))),
    )
}
