import { describe, expect, it } from 'vitest'
import {
  advanceRead,
  expiredBefore,
  FEED_SIZE,
  feedOf,
  type Notification,
  notificationsFor,
  RETENTION_MS,
  unreadCount,
} from './notification'

const T0 = Date.UTC(2026, 0, 1)

/** Notification d'Alice, à la position donnée. */
const note = (position: number, occurredAt = T0): Notification => ({
  position,
  recipientId: 'alice',
  kind: 'trade-completed',
  subjectId: `offre-${position}`,
  outcome: null,
  occurredAt,
})

describe('Notifications - qui est notifié', () => {
  it("notifie le vendeur seul d'une offre conclue", () => {
    const notified = notificationsFor({
      type: 'trade-completed',
      position: 7,
      at: T0,
      offerId: 'o1',
      sellerId: 'alice',
    })

    expect(notified).toEqual([
      {
        position: 7,
        recipientId: 'alice',
        kind: 'trade-completed',
        subjectId: 'o1',
        outcome: null,
        occurredAt: T0,
      },
    ])
  })

  it("notifie le vendeur d'une offre expirée, mais pas lorsqu'il la retire lui-même", () => {
    const withdrawn = (reason: 'seller' | 'expired') =>
      notificationsFor({
        type: 'offer-withdrawn',
        position: 8,
        at: T0,
        offerId: 'o1',
        sellerId: 'alice',
        reason,
      })

    expect(withdrawn('expired')).toMatchObject([{ recipientId: 'alice', kind: 'offer-expired' }])
    expect(withdrawn('seller')).toEqual([])
  })

  it("notifie chaque joueur d'une expédition terminée, une fois, avec son résultat", () => {
    const notified = notificationsFor({
      type: 'game-ended',
      position: 9,
      at: T0,
      gameId: 'g1',
      memberIds: ['alice', 'bob', 'alice'],
      result: 'won',
    })

    expect(notified.map((n) => n.recipientId)).toEqual(['alice', 'bob'])
    expect(notified.every((n) => n.kind === 'game-ended' && n.outcome === 'won')).toBe(true)
  })

  it("ne notifie personne d'une expédition sans joueur", () => {
    expect(
      notificationsFor({
        type: 'game-ended',
        position: 9,
        at: T0,
        gameId: 'g1',
        memberIds: [],
        result: 'lost',
      }),
    ).toEqual([])
  })
})

describe('Notifications - le fil', () => {
  it('présente les notifications les plus récentes en premier, au plus cinquante', () => {
    const all = Array.from({ length: FEED_SIZE + 10 }, (_, i) => note(i + 1))
    const feed = feedOf(all, T0)

    expect(feed).toHaveLength(FEED_SIZE)
    expect(feed[0].position).toBe(FEED_SIZE + 10)
    expect(feed.at(-1)?.position).toBe(11)
  })

  it('ne présente plus une notification de plus de trente jours', () => {
    const old = note(1, T0)
    const recent = note(2, T0 + RETENTION_MS)
    const now = T0 + RETENTION_MS + 1

    expect(expiredBefore(now)).toBe(T0 + 1)
    expect(feedOf([old, recent], now).map((n) => n.position)).toEqual([2])
  })
})

describe('Notifications - la lecture', () => {
  it('compte les notifications postérieures à la position de lecture', () => {
    const all = [note(3), note(5), note(8)]

    expect(unreadCount(all, 0)).toBe(3)
    expect(unreadCount(all, 5)).toBe(1)
    expect(unreadCount(all, 8)).toBe(0)
  })

  it('ne recule jamais la position de lecture', () => {
    expect(advanceRead(8, 3, 10)).toBe(8)
    expect(advanceRead(8, 8, 10)).toBe(8)
    expect(advanceRead(8, 9, 10)).toBe(9)
  })

  it('ramène la position demandée à la dernière notification du joueur', () => {
    expect(advanceRead(0, 1_000_000, 8)).toBe(8)
    expect(advanceRead(0, 5, 0)).toBe(0)
  })
})
