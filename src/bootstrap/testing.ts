import type { AuthPort } from '@/platform/auth/port'
import { createTestDatabase } from '@/platform/db/client'
import { createEventStore } from '@/platform/event-store/event-store'
import { createVillageServiceApp } from '@/services/village/village-service'
import { createApi } from './create-api'

/** Secret de test de la tâche planifiée qui exécute les tâches quotidiennes. */
export const TEST_CRON_SECRET = 'secret-de-test'

/** Secret partagé avec le service Village extrait, dans les tests. */
export const TEST_SERVICE_SECRET = 'secret-de-service'

/**
 * Adaptateur d'authentification réservé aux tests : le joueur est identifié par
 * l'en-tête x-test-user, sans compte ni cookie. Il n'est jamais utilisé par server.ts.
 */
export const testAuth: AuthPort = {
  handler: async () => new Response(null, { status: 404 }),
  getUser: async (headers) => {
    const id = headers.get('x-test-user')
    return id ? { id, name: id } : null
  },
}

/** Joueur au nom duquel une requête de test est envoyée ; null pour une requête anonyme. */
type TestUser = string | null

/**
 * Application complète, assemblée sur une base de test vidée, avec une horloge contrôlée
 * et l'adaptateur d'authentification de test. La base est aussi renvoyée : certains tests
 * lisent directement les tables, pour vérifier par exemple qu'une donnée a été supprimée.
 * Avec villageService, le Village est extrait dans un service distinct (TD11), doté de sa
 * propre base. L'application et le service s'appellent sans réseau : chacun transmet ses
 * requêtes directement à l'autre, par la méthode request de Hono.
 */
export async function createTestApi({ villageService = false } = {}) {
  const start = Date.UTC(2026, 0, 1)
  let now = start
  const db = await createTestDatabase()
  const store = createEventStore(db)

  const serviceDb = villageService ? await createTestDatabase('village') : null
  let serviceUp = true
  const service = serviceDb
    ? createVillageServiceApp({
        db: serviceDb,
        secret: TEST_SERVICE_SECRET,
        appUrl: 'http://app.test',
        clock: () => now,
        fetch: async (input, init) => api.request(String(input), init),
      })
    : null

  const api = createApi({
    auth: testAuth,
    db,
    store,
    cronSecret: TEST_CRON_SECRET,
    outbox: { now: () => Date.now() + (now - start) },
    clock: () => now,
    realtime: { pollMs: 20, maxStreamMs: 150 },
    realmService: service
      ? {
          url: 'http://village.test',
          secret: TEST_SERVICE_SECRET,
          fetch: async (input, init) => {
            if (!serviceUp) throw new TypeError('fetch failed : service Village injoignable')
            return service.request(String(input), init)
          },
        }
      : undefined,
  })

  /** En-têtes identifiant le joueur, ou aucun en-tête pour une requête anonyme. */
  const as = (user: TestUser): Record<string, string> => (user ? { 'x-test-user': user } : {})

  /** Envoie une requête GET, au nom d'alice par défaut. */
  const get = (path: string, user: TestUser = 'alice') => api.request(path, { headers: as(user) })

  /** Envoie une requête POST avec un corps JSON, au nom d'alice par défaut. */
  const post = (path: string, body: unknown, user: TestUser = 'alice') =>
    api.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...as(user) },
      body: JSON.stringify(body),
    })

  /** Fait avancer l'horloge de l'application. */
  const advance = (minutes: number) => {
    now += minutes * 60_000
  }

  /** Simule la panne du service Village extrait, ou son rétablissement. */
  const setServiceUp = (up: boolean) => {
    serviceUp = up
  }

  return { api, db, service, serviceDb, get, post, advance, setServiceUp }
}
