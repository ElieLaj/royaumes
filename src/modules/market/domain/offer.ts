/**
 * Domaine du Marché : une offre d'échange et son devenir, selon le modèle decider.
 * L'état d'une offre résume l'avancement de la saga d'échange (partie 1 du TD9).
 * Ce fichier est écrit en TypeScript pur : il n'importe aucun autre module.
 */

/** Quantités de ressources d'une offre, par nom de ressource (« wood », « stone », « gold »). */
export type Amounts = Partial<Record<string, number>>

/** Durée de validité d'une offre ouverte, en millisecondes. */
export const OFFER_TTL_MS = 24 * 60 * 60_000

/** États d'une offre ; les trois derniers sont finaux. */
export type OfferStatus = 'reserving' | 'open' | 'settling' | 'completed' | 'rejected' | 'withdrawn'

export interface OfferState {
  /** Faux tant que l'offre n'a pas été publiée. */
  exists: boolean
  offerId: string
  sellerId: string
  sellerName: string
  /** Ressources cédées par le vendeur, et ressources demandées en échange. */
  give: Amounts
  want: Amounts
  status: OfferStatus
  /** Acheteur dont le paiement est en cours, ou qui a conclu l'échange. */
  buyerId: string | null
  buyerName: string | null
  /** Numéro de la dernière tentative d'acceptation : chaque paiement a son propre mouvement. */
  attempt: number
  /** Dernier paiement refusé : l'acheteur concerné, et les quantités qui lui manquaient. */
  refusal: { buyerId: string; missing: Amounts } | null
  publishedAt: number
  expiresAt: number
  /** Motif du retrait d'une offre : décision du vendeur, ou expiration. */
  withdrawnBecause: 'seller' | 'expired' | null
}

export const initialState: OfferState = {
  exists: false,
  offerId: '',
  sellerId: '',
  sellerName: '',
  give: {},
  want: {},
  status: 'reserving',
  buyerId: null,
  buyerName: null,
  attempt: 0,
  refusal: null,
  publishedAt: 0,
  expiresAt: 0,
  withdrawnBecause: null,
}

export type OfferEvent =
  | {
      type: 'OfferPublished'
      data: {
        offerId: string
        sellerId: string
        sellerName: string
        give: Amounts
        want: Amounts
        at: number
        expiresAt: number
      }
    }
  | { type: 'OfferOpened'; data: { at: number } }
  | { type: 'OfferRejected'; data: { missing: Amounts; at: number } }
  | {
      type: 'OfferAccepted'
      data: { buyerId: string; buyerName: string; attempt: number; at: number }
    }
  | { type: 'PaymentRefused'; data: { buyerId: string; missing: Amounts; at: number } }
  | { type: 'TradeCompleted'; data: { at: number } }
  | { type: 'OfferWithdrawn'; data: { reason: 'seller' | 'expired'; at: number } }

export type OfferCommand =
  | {
      type: 'PublishOffer'
      offerId: string
      sellerId: string
      sellerName: string
      give: Amounts
      want: Amounts
    }
  | { type: 'AcceptOffer'; buyerId: string; buyerName: string }
  | { type: 'WithdrawOffer'; playerId: string }
  | {
      type: 'RecordTransferResult'
      transferId: string
      outcome: 'withdrawn' | 'refused' | 'deposited'
      missing?: Amounts
    }
  | { type: 'ExpireOffer' }

export type OfferError =
  | { code: 'OFFER_NOT_FOUND' }
  | { code: 'ALREADY_EXISTS' }
  | { code: 'NOT_OPEN'; status: OfferStatus }
  | { code: 'OWN_OFFER' }
  | { code: 'NOT_SELLER' }
  | { code: 'EXPIRED' }
  | { code: 'NOT_EXPIRED' }

export type Decision = { ok: true; events: OfferEvent[] } | { ok: false; error: OfferError }

const fail = (error: OfferError): Decision => ({ ok: false, error })
const accept = (...events: OfferEvent[]): Decision => ({ ok: true, events })

/**
 * Identifiant d'un mouvement de ressources : il est déterminé par l'offre et par l'étape
 * de la saga, et sert de clé d'idempotence au Village. Chaque tentative de paiement a le sien.
 */
export const transferIdOf = (offerId: string, step: string) => `${offerId}:${step}`

/** Identifiant de l'offre à laquelle se rapporte un mouvement. */
export const offerIdOf = (transferId: string) => transferId.slice(0, transferId.indexOf(':'))

export function evolve(state: OfferState, event: OfferEvent): OfferState {
  switch (event.type) {
    case 'OfferPublished':
      return {
        ...initialState,
        exists: true,
        offerId: event.data.offerId,
        sellerId: event.data.sellerId,
        sellerName: event.data.sellerName,
        give: event.data.give,
        want: event.data.want,
        publishedAt: event.data.at,
        expiresAt: event.data.expiresAt,
      }
    case 'OfferOpened':
      return { ...state, status: 'open' }
    case 'OfferRejected':
      return { ...state, status: 'rejected' }
    case 'OfferAccepted':
      return {
        ...state,
        status: 'settling',
        buyerId: event.data.buyerId,
        buyerName: event.data.buyerName,
        attempt: event.data.attempt,
      }
    case 'PaymentRefused':
      return {
        ...state,
        status: 'open',
        buyerId: null,
        buyerName: null,
        refusal: { buyerId: event.data.buyerId, missing: event.data.missing },
      }
    case 'TradeCompleted':
      return { ...state, status: 'completed' }
    case 'OfferWithdrawn':
      return { ...state, status: 'withdrawn', withdrawnBecause: event.data.reason }
  }
}

export const replay = (events: OfferEvent[]) => events.reduce(evolve, initialState)

export function decide(state: OfferState, command: OfferCommand, now: number): Decision {
  if (command.type === 'PublishOffer') {
    if (state.exists) return fail({ code: 'ALREADY_EXISTS' })
    const { offerId, sellerId, sellerName, give, want } = command
    return accept({
      type: 'OfferPublished',
      data: { offerId, sellerId, sellerName, give, want, at: now, expiresAt: now + OFFER_TTL_MS },
    })
  }

  if (!state.exists) return fail({ code: 'OFFER_NOT_FOUND' })

  switch (command.type) {
    case 'AcceptOffer':
      if (state.status !== 'open') return fail({ code: 'NOT_OPEN', status: state.status })
      if (command.buyerId === state.sellerId) return fail({ code: 'OWN_OFFER' })
      if (now >= state.expiresAt) return fail({ code: 'EXPIRED' })
      return accept({
        type: 'OfferAccepted',
        data: {
          buyerId: command.buyerId,
          buyerName: command.buyerName,
          attempt: state.attempt + 1,
          at: now,
        },
      })

    case 'WithdrawOffer':
      if (command.playerId !== state.sellerId) return fail({ code: 'NOT_SELLER' })
      if (state.status !== 'open') return fail({ code: 'NOT_OPEN', status: state.status })
      return accept({ type: 'OfferWithdrawn', data: { reason: 'seller', at: now } })

    case 'ExpireOffer':
      if (state.status !== 'open') return accept()
      if (now < state.expiresAt) return fail({ code: 'NOT_EXPIRED' })
      return accept({ type: 'OfferWithdrawn', data: { reason: 'expired', at: now } })

    case 'RecordTransferResult':
      return recordTransferResult(state, command, now)
  }
}

/**
 * Réponse du Village à un prélèvement. Seule la réponse attendue dans l'état courant
 * fait progresser la saga ; toute autre réponse (doublon, réponse tardive) est ignorée.
 */
function recordTransferResult(
  state: OfferState,
  result: Extract<OfferCommand, { type: 'RecordTransferResult' }>,
  now: number,
): Decision {
  const refused = result.outcome === 'refused'
  const missing = result.missing ?? {}

  if (
    state.status === 'reserving' &&
    result.transferId === transferIdOf(state.offerId, 'reserve')
  ) {
    return refused
      ? accept({ type: 'OfferRejected', data: { missing, at: now } })
      : accept({ type: 'OfferOpened', data: { at: now } })
  }

  const payment = transferIdOf(state.offerId, `pay-${state.attempt}`)
  if (state.status === 'settling' && result.transferId === payment && state.buyerId) {
    if (!refused) return accept({ type: 'TradeCompleted', data: { at: now } })
    const refusal: OfferEvent = {
      type: 'PaymentRefused',
      data: { buyerId: state.buyerId, missing, at: now },
    }
    return now >= state.expiresAt
      ? accept(refusal, { type: 'OfferWithdrawn', data: { reason: 'expired', at: now } })
      : accept(refusal)
  }

  return accept()
}
