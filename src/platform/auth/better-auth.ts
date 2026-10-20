import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { Db } from '../db/client'
import type { AuthPort } from './port'
import { account, session, user, verification } from './schema'

/**
 * Domaines attribués par Vercel au déploiement en cours : production, branche et déploiement.
 * Vercel les fournit par des variables d'environnement, sans le préfixe https://.
 */
function vercelOrigins(): string[] {
  return [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_URL,
  ]
    .filter((host): host is string => Boolean(host))
    .map((host) => `https://${host}`)
}

/**
 * Adresse publique de l'application.
 * 1. BETTER_AUTH_URL, si elle est définie ;
 * 2. en production sur Vercel, le domaine de production du projet ;
 * 3. sur un autre déploiement Vercel (aperçu d'une branche), le domaine de ce déploiement ;
 * 4. en local, http://localhost:3000.
 */
function resolveBaseUrl(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

/**
 * Secret qui signe les cookies de session.
 * En production, il est obligatoire : son absence empêche le démarrage.
 * En développement, une valeur fixe est utilisée, qui ne protège rien.
 */
function resolveSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
    throw new Error('BETTER_AUTH_SECRET est obligatoire en production.')
  }
  return 'dev-only-secret-not-for-production-use-0123456789'
}

/**
 * Adaptateur Better Auth du port ; limites relevées car une classe partage une même adresse IP.
 */
export function createBetterAuth(db: Db): AuthPort {
  const auth = betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification },
    }),
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    secret: resolveSecret(),
    baseURL: resolveBaseUrl(),
    /** Origines autorisées : seules les adresses de ce projet peuvent envoyer le cookie de session. */
    trustedOrigins: [resolveBaseUrl(), ...vercelOrigins()],
    /**
     * DETTE TECHNIQUE DT-004 (docs/qualite/dette-technique.md) : les compteurs sont conservés
     * dans la mémoire de chaque instance, et ne sont donc pas partagés entre instances.
     */
    rateLimit: {
      enabled: process.env.AUTH_RATE_LIMIT !== 'off' || Boolean(process.env.VERCEL),
      customRules: {
        '/sign-up/email': { window: 60, max: 40 },
        '/sign-in/email': { window: 60, max: 60 },
      },
    },
  })

  return {
    handler: (request) => auth.handler(request),

    async getUser(headers) {
      const result = await auth.api.getSession({ headers })
      return result ? { id: result.user.id, name: result.user.name } : null
    },
  }
}
