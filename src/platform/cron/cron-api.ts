import { Hono } from 'hono'
import type { AppEnv } from '../http/types'

/** Tâche quotidienne : elle renvoie un compte rendu de son exécution, par exemple des nombres. */
export type DailyTask = () => Promise<unknown>

/** Compte rendu d'une tâche : son résultat, ou le message de l'erreur qu'elle a levée. */
type TaskReport = { ok: true; result: unknown } | { ok: false; error: string }

/**
 * Sous-application des tâches planifiées, montée sur /api/cron.
 * La tâche planifiée de Vercel appelle chaque jour la route /daily, avec l'en-tête
 * « Authorization: Bearer <CRON_SECRET> » ; toute autre requête est refusée, et la route
 * reste fermée tant qu'aucun secret n'est configuré. Les tâches, fournies par la racine
 * de composition, sont exécutées l'une après l'autre : l'échec de l'une n'empêche pas
 * les suivantes, et le compte rendu de chacune figure dans la réponse.
 */
export function createCronApi(tasks: Record<string, DailyTask>, secret: string | undefined) {
  return new Hono<AppEnv>().get('/daily', async (c) => {
    /** DETTE TECHNIQUE DT-014 (docs/qualite/dette-technique.md) : la comparaison du secret n'est pas à temps constant. */
    if (!secret || c.req.header('authorization') !== `Bearer ${secret}`) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Accès refusé' } }, 401)
    }
    const reports: Record<string, TaskReport> = {}
    for (const [name, task] of Object.entries(tasks)) {
      try {
        reports[name] = { ok: true, result: await task() }
      } catch (error) {
        reports[name] = { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
    return c.json(reports)
  })
}
