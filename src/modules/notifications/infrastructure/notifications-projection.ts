import { eq } from 'drizzle-orm'
import { GAME_CHANNEL_PREFIX } from '@/modules/dungeon/contracts'
import { OFFER_STREAM_PREFIX } from '@/modules/market/contracts'
import type { StoredEvent } from '@/platform/event-store/event-store'
import type { DbTransaction, Projection } from '@/platform/projection/projection'
import { SOURCE_EVENTS } from '../contracts'
import { type Fact, type Notification, notificationsFor } from '../domain/notification'
import { gameMembers, notifications, offerParties } from './schema'

/**
 * Données des événements lus par le module. Elles forment le « langage publié » du Marché et
 * du Donjon : le module en dépend, comme tout lecteur du journal. Seuls les champs utiles
 * sont décrits.
 */
interface OfferPublishedData {
  sellerId: string
}
interface OfferWithdrawnData {
  reason: 'seller' | 'expired'
}
interface GameCreatedData {
  hostId: string
}
interface PlayerJoinedData {
  playerId: string
}
interface GameEndedData {
  result: 'won' | 'lost'
}

/** Types d'événements qui produisent une notification : ce sont ceux que le canal annonce. */
export const NOTIFYING_TYPES = ['TradeCompleted', 'OfferWithdrawn', 'GameEnded']

/** Identifiant tiré du nom d'un flux : « market-7f3a » donne « 7f3a ». */
const idFrom = (event: StoredEvent, prefix: string) => event.stream.slice(prefix.length)

/** Date d'un événement : celle que le module d'origine lui a donnée, à défaut celle du journal. */
const atOf = (event: StoredEvent) =>
  typeof event.data.at === 'number' ? event.data.at : event.occurredAt.getTime()

/** Enregistre des notifications ; une notification déjà enregistrée est ignorée. */
async function save(tx: DbTransaction, produced: Notification[]) {
  if (produced.length === 0) return
  await tx.insert(notifications).values(produced).onConflictDoNothing()
}

/**
 * Projection des notifications : lit les événements du Marché et du Donjon, et en tire le fil de
 * chaque joueur. Les tables de correspondance retiennent le vendeur de chaque offre et les
 * joueurs de chaque expédition, que leur événement final ne désigne pas.
 */
export const notificationsProjection: Projection = {
  name: 'notifications',
  version: 1,
  eventTypes: [...SOURCE_EVENTS.market, ...SOURCE_EVENTS.dungeon],

  async apply(event, tx) {
    switch (event.type) {
      case 'OfferPublished': {
        const data = event.data as unknown as OfferPublishedData
        await tx
          .insert(offerParties)
          .values({
            offerId: idFrom(event, OFFER_STREAM_PREFIX),
            sellerId: data.sellerId,
            createdAt: atOf(event),
          })
          .onConflictDoNothing()
        return
      }

      case 'TradeCompleted':
      case 'OfferWithdrawn':
      case 'OfferRejected': {
        const offerId = idFrom(event, OFFER_STREAM_PREFIX)
        const [party] = await tx
          .select()
          .from(offerParties)
          .where(eq(offerParties.offerId, offerId))
        if (!party) return
        const base = {
          position: event.position,
          at: atOf(event),
          offerId,
          sellerId: party.sellerId,
        }
        if (event.type === 'TradeCompleted') {
          await save(tx, notificationsFor({ type: 'trade-completed', ...base }))
        } else if (event.type === 'OfferWithdrawn') {
          const { reason } = event.data as unknown as OfferWithdrawnData
          await save(tx, notificationsFor({ type: 'offer-withdrawn', reason, ...base }))
        }
        await tx.delete(offerParties).where(eq(offerParties.offerId, offerId))
        return
      }

      case 'GameCreated':
      case 'PlayerJoined': {
        const playerId =
          event.type === 'GameCreated'
            ? (event.data as unknown as GameCreatedData).hostId
            : (event.data as unknown as PlayerJoinedData).playerId
        await tx
          .insert(gameMembers)
          .values({ gameId: idFrom(event, GAME_CHANNEL_PREFIX), playerId, createdAt: atOf(event) })
          .onConflictDoNothing()
        return
      }

      case 'GameEnded': {
        const gameId = idFrom(event, GAME_CHANNEL_PREFIX)
        const members = await tx.select().from(gameMembers).where(eq(gameMembers.gameId, gameId))
        const { result } = event.data as unknown as GameEndedData
        const fact: Fact = {
          type: 'game-ended',
          position: event.position,
          at: atOf(event),
          gameId,
          memberIds: members.map((member) => member.playerId),
          result,
        }
        await save(tx, notificationsFor(fact))
        await tx.delete(gameMembers).where(eq(gameMembers.gameId, gameId))
        return
      }
    }
  },

  async reset(tx) {
    await tx.delete(notifications)
    await tx.delete(offerParties)
    await tx.delete(gameMembers)
  },
}
