import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, type Db } from '@/platform/db/client'
import {
  createEventStore,
  type EventStore,
  type NewEvent,
} from '@/platform/event-store/event-store'
import { createProjectionRunner } from '@/platform/projection/projection'
import type { NotificationsStore } from '../application/notifications-store'
import { createDrizzleNotificationsStore } from './drizzle-notifications-store'
import { notificationsProjection } from './notifications-projection'
import { gameMembers, offerParties } from './schema'

const T0 = Date.UTC(2026, 0, 1)

let db: Db
let store: EventStore
let notifications: NotificationsStore
let runner: ReturnType<typeof createProjectionRunner>
beforeEach(async () => {
  db = await createTestDatabase()
  store = createEventStore(db)
  runner = createProjectionRunner(db)
  notifications = createDrizzleNotificationsStore(db, runner)
})

const published = (sellerId: string): NewEvent => ({
  type: 'OfferPublished',
  data: { sellerId, at: T0 },
})
const completed: NewEvent = { type: 'TradeCompleted', data: { at: T0 + 1 } }
const withdrawn = (reason: 'seller' | 'expired'): NewEvent => ({
  type: 'OfferWithdrawn',
  data: { reason, at: T0 + 1 },
})
const created = (hostId: string): NewEvent => ({ type: 'GameCreated', data: { hostId, at: T0 } })
const joined = (playerId: string): NewEvent => ({
  type: 'PlayerJoined',
  data: { playerId, at: T0 },
})
const ended = (result: 'won' | 'lost'): NewEvent => ({
  type: 'GameEnded',
  data: { result, at: T0 + 1 },
})

/** Notifications d'un joueur, sans leur position. */
const feedOf = async (playerId: string) =>
  (await notifications.forPlayer(playerId, 0)).notifications.map(
    ({ kind, subjectId, outcome }) => ({ kind, subjectId, outcome }),
  )

describe('Projection des notifications', () => {
  it("notifie le vendeur seul d'une offre conclue, et oublie ensuite son vendeur", async () => {
    await store.append('market-o1', 0, [published('alice'), completed])

    expect(await feedOf('alice')).toEqual([
      { kind: 'trade-completed', subjectId: 'o1', outcome: null },
    ])
    expect(await feedOf('bob')).toEqual([])
    expect(await db.select().from(offerParties)).toEqual([])
  })

  it("notifie le vendeur d'une offre expirée, mais pas de son propre retrait", async () => {
    await store.append('market-o1', 0, [published('alice'), withdrawn('expired')])
    await store.append('market-o2', 0, [published('alice'), withdrawn('seller')])

    expect(await feedOf('alice')).toEqual([
      { kind: 'offer-expired', subjectId: 'o1', outcome: null },
    ])
  })

  it("ne notifie personne d'une offre refusée, et oublie son vendeur", async () => {
    await store.append('market-o1', 0, [published('alice'), { type: 'OfferRejected', data: {} }])

    expect(await feedOf('alice')).toEqual([])
    expect(await db.select().from(offerParties)).toEqual([])
  })

  it("notifie les joueurs d'une expédition terminée, compagnons exclus", async () => {
    await store.append('dungeon-g1', 0, [
      created('alice'),
      joined('bob'),
      { type: 'CompanionAdded', data: { companionId: 'companion-1' } },
      ended('won'),
    ])

    const expected = [{ kind: 'game-ended', subjectId: 'g1', outcome: 'won' }]
    expect(await feedOf('alice')).toEqual(expected)
    expect(await feedOf('bob')).toEqual(expected)
    expect(await feedOf('companion-1')).toEqual([])
    expect(await db.select().from(gameMembers)).toEqual([])
  })

  it('redonne le même fil lorsque la projection est reconstruite', async () => {
    await store.append('market-o1', 0, [published('alice'), completed])
    await store.append('dungeon-g1', 0, [created('alice'), joined('bob'), ended('lost')])
    const before = await notifications.forPlayer('alice', 0)

    await runner.rebuild(notificationsProjection)

    expect(await notifications.forPlayer('alice', 0)).toEqual(before)
    expect(before.notifications).toHaveLength(2)
  })
})
