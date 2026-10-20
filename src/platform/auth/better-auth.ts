import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { Db } from '../db/client'
import type { AuthPort } from './port'
import { account, session, user, verification } from './schema'

/** Adresse publique de l'application : celle de BETTER_AUTH_URL, ou l'adresse locale. */
function resolveBaseUrl(): string {
  return process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
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
