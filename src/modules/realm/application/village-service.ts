import { withOptimisticRetry } from '@/platform/event-store/retry'
import type { NewMessage } from '@/platform/outbox/outbox'
import type { TransferResult } from '../contracts'
import {
  type DomainError,
  decide,
  type TransferCommand,
  toView,
  type VillageCommand,
  type VillageEvent,
  type VillageView,
} from '../domain/village'
import type { VillageRepository } from './village-repository'

/** Résultat d'une commande : la vue mise à jour, ou l'erreur métier. */
export type CommandResult = { ok: true; view: VillageView } | { ok: false; error: DomainError }

/** Réponse correspondant à l'événement d'un mouvement de ressources ; null pour un autre événement. */
function resultOf(event: VillageEvent): TransferResult | null {
  switch (event.type) {
    case 'ResourcesWithdrawn':
      return { transferId: event.data.transferId, outcome: 'withdrawn' }
    case 'WithdrawalRefused':
      return { transferId: event.data.transferId, outcome: 'refused', missing: event.data.missing }
    case 'ResourcesDeposited':
      return { transferId: event.data.transferId, outcome: 'deposited' }
    default:
      return null
  }
}

/**
 * Service applicatif du Village : orchestre le domaine et la persistance.
 * Il reçoit ses dépendances en paramètre : le port de persistance et l'horloge.
 */
export function createVillageService(repo: VillageRepository, clock = () => Date.now()) {
  /**
   * Traite une commande : charger, décider, enregistrer, puis renvoyer la vue.
   * L'horloge est lue une fois par tentative, pour que la décision et la vue portent sur le
   * même instant. En cas de conflit d'écriture (ConcurrencyError), l'ensemble du traitement
   * est rejoué sur l'état à jour.
   */
  function execute(userId: string, command: VillageCommand): Promise<CommandResult> {
    return withOptimisticRetry(async () => {
      const { state, version } = await repo.load(userId)
      const now = clock()

      const decision = decide(state, command, now)
      if (!decision.ok) return decision

      await repo.save(userId, version, decision.events)

      const updated = await repo.load(userId)
      return { ok: true, view: toView(updated.state, now) }
    })
  }

  /** Renvoie la vue du village d'un joueur, ou null s'il n'en a pas encore fondé. */
  async function getView(userId: string): Promise<VillageView | null> {
    const { state } = await repo.load(userId)
    return state.founded ? toView(state, clock()) : null
  }

  /**
   * Traite un mouvement de ressources demandé par un autre module. La réponse éventuelle est
   * enregistrée dans la boîte d'envoi, au sujet replyTo, dans la même transaction que l'événement
   * du mouvement. Un mouvement déjà traité ne produit ni événement ni réponse. Une erreur métier
   * est une anomalie, et non un refus : elle est levée, et le message sera retenté puis abandonné.
   */
  function transfer(userId: string, command: TransferCommand, replyTo?: string) {
    return withOptimisticRetry(async () => {
      const { state, version } = await repo.load(userId)
      const decision = decide(state, command, clock())
      if (!decision.ok) {
        throw new Error(`Mouvement ${command.transferId} impossible : ${decision.error.code}`)
      }
      const messages: NewMessage[] = []
      for (const event of decision.events) {
        const result = resultOf(event)
        if (result && replyTo) messages.push({ topic: replyTo, payload: { ...result } })
      }
      await repo.save(userId, version, decision.events, messages)
    })
  }

  return { execute, transfer, getView }
}

/** Type du service, déduit de sa fabrique : utilisé par l'API du module. */
export type VillageService = ReturnType<typeof createVillageService>
