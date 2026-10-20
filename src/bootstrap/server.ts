import { createBetterAuth } from '@/platform/auth/better-auth'
import type { AuthPort, AuthUser } from '@/platform/auth/port'
import { createDatabase } from '@/platform/db/client'
import { createEventStore } from '@/platform/event-store/event-store'
import { type Api, createApi } from './create-api'

/** Ce que l'application expose à Next.js. */
interface Server {
  api: Api
  /** Authentification, utilisée aussi par les pages rendues sur le serveur. */
  auth: AuthPort
  /** Résolue lorsque la base de données est prête. */
  ready: Promise<void>
}

/**
 * L'instance est conservée dans l'objet global du processus.
 * En développement, Next.js recharge les modules à chaque modification :
 * une simple variable de module serait alors réinitialisée, et l'application
 * reconstruite à chaque fois, avec une nouvelle connexion à la base.
 */
const globalForServer = globalThis as unknown as { royaumes?: Server }

/**
 * Renvoie l'application, en la construisant à la première demande.
 * Cette construction paresseuse garantit qu'aucun code de l'application,
 * et en particulier aucune connexion à la base, ne s'exécute lorsque Next.js
 * analyse les fichiers pendant la construction.
 * La plateforme est assemblée ici : la base de données, puis les briques qui l'utilisent.
 */
export function getServer(): Server {
  if (!globalForServer.royaumes) {
    const { db, ready } = createDatabase()
    const store = createEventStore(db)
    const auth = createBetterAuth(db)
    /** Durée maximale d'un flux temps réel : 240 s par défaut, sous la limite de 300 s de Vercel. */
    const maxStreamMs = Number(process.env.STREAM_MAX_SECONDS ?? 240) * 1000
    globalForServer.royaumes = {
      api: createApi({ auth, store, ready, realtime: { maxStreamMs } }),
      auth,
      ready,
    }
  }
  return globalForServer.royaumes
}

/**
 * Joueur connecté, pour les pages rendues sur le serveur.
 * Les pages n'appellent pas l'API : elles interrogent directement le port d'authentification,
 * à partir des en-têtes de la requête reçue par Next.js.
 */
export async function currentUser(headers: Headers): Promise<AuthUser | null> {
  const { auth, ready } = getServer()
  await ready
  return auth.getUser(headers)
}
