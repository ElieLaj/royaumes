import { Hono } from 'hono'
import { createDungeonModule } from '@/modules/dungeon'
import { createRankingModule } from '@/modules/ranking'
import { createRealmModule } from '@/modules/realm'
import { createSystemModule } from '@/modules/system'
import type { AuthPort } from '@/platform/auth/port'
import type { Db } from '@/platform/db/client'
import type { EventStore } from '@/platform/event-store/event-store'
import { requireUser } from '@/platform/http/require-user'
import type { AppEnv } from '@/platform/http/types'
import { createDispatchApi } from '@/platform/outbox/dispatch-api'
import { createDispatcher } from '@/platform/outbox/outbox'
import { createProjectionRunner } from '@/platform/projection/projection'
import type { ChannelPolicy } from '@/platform/realtime/channel-policy'
import { createRealtimeApi, type RealtimeOptions } from '@/platform/realtime/stream-api'

/** Dépendances fournies à l'application par son point d'entrée. */
export interface ApiDeps {
  /** Authentification : Better Auth en fonctionnement réel, un adaptateur simplifié en test. */
  auth: AuthPort
  /** Base de données, dans laquelle les modules tiennent leurs modèles de lecture. */
  db: Db
  /** Journal d'événements, transmis aux modules qui l'utilisent. */
  store: EventStore
  /** Attendue avant chaque requête : résolue lorsque la base est prête (migrations). */
  ready?: Promise<void>
  /** Horloge de référence ; l'heure réelle par défaut. Remplacée dans les tests. */
  clock?: () => number
  /** Réglages du temps réel (durée des flux, intervalle de lecture) ; raccourcis dans les tests. */
  realtime?: Partial<Omit<RealtimeOptions, 'store' | 'policies'>>
  /** Secret attendu de la tâche planifiée qui distribue la boîte d'envoi ; route fermée sans lui. */
  cronSecret?: string
}

/**
 * Racine de composition : le seul endroit du projet qui connaît à la fois
 * la plateforme technique et l'ensemble des modules.
 * Ajouter un module consiste à l'instancier ici, puis à monter son API.
 */
export function createApi({ auth, db, store, ready, clock, realtime, cronSecret }: ApiDeps) {
  const projections = createProjectionRunner(db)
  const dispatcher = createDispatcher(db)

  // 1. Instanciation des modules. Leurs dépendances (base de données,
  //    journal d'événements, authentification) leur seront fournies ici.
  const system = createSystemModule()
  const realm = createRealmModule({ store, clock })
  const dungeon = createDungeonModule({ store, db, projections, clock })
  const ranking = createRankingModule({ db, projections })

  /** Règles d'accès aux canaux temps réel, déclarées par les modules. */
  const policies: ChannelPolicy[] = [
    realm.channelPolicy,
    dungeon.channelPolicy,
    ranking.channelPolicy,
  ]

  // 2. Application principale : toutes ses routes sont préfixées par /api.
  const app = new Hono<AppEnv>().basePath('/api')

  /** Aucune requête n'est traitée avant que la base soit prête (migrations appliquées). */
  app.use(async (_c, next) => {
    await ready
    await next()
  })

  // 3. Toute erreur non prévue produit une réponse JSON uniforme,
  //    sans divulguer de détail technique au client.
  app.onError((error, c) => {
    console.error(error)
    return c.json({ error: { code: 'INTERNAL', message: 'Erreur interne' } }, 500)
  })

  // Une adresse inconnue produit elle aussi une réponse JSON, et non une page HTML.
  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route inconnue' } }, 404))

  /** Routes d'authentification, entièrement traitées par l'adaptateur d'authentification. */
  app.on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))

  app.route('/outbox', createDispatchApi(dispatcher, cronSecret))

  /** Routes réservées aux joueurs connectés : tout module protégé doit être ajouté ici. */
  app.use('/realm/*', requireUser(auth))
  app.use('/dungeon/*', requireUser(auth))
  app.use('/ranking/*', requireUser(auth))
  app.use('/stream/*', requireUser(auth))

  // 4. Montage des sous-applications : chaque module reçoit son propre préfixe.
  //    Les appels sont chaînés afin que TypeScript conserve le type de chaque route.
  return app
    .route('/system', system.api)
    .route('/realm', realm.api)
    .route('/dungeon', dungeon.api)
    .route('/ranking', ranking.api)
    .route('/stream', createRealtimeApi({ store, policies, ...realtime }))
}

/** Type de l'application complète, déduit de ses routes. */
export type Api = ReturnType<typeof createApi>
