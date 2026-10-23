import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import type { OfferView } from '@/modules/market/contracts'
import type { Feed, ReadResult } from '@/modules/notifications/contracts'
import { notificationsProjection } from '@/modules/notifications/infrastructure/notifications-projection'
import { createProjectionRunner } from '@/platform/projection/projection'
import { createTestApi } from './testing'

type TestApi = Awaited<ReturnType<typeof createTestApi>>

/** Fil de notifications d'un joueur, tel que l'API le renvoie. */
async function feedOf(api: TestApi, player: string) {
  const res = await api.get('/api/notifications', player)
  return ((await res.json()) as Feed).notifications.map(({ kind, outcome }) => ({ kind, outcome }))
}

/** Fil complet d'un joueur, avec sa position de lecture. */
async function feed(api: TestApi, player: string) {
  return (await (await api.get('/api/notifications', player)).json()) as Feed
}

/** Marque comme lues les notifications d'un joueur, jusqu'à la position indiquée. */
const markRead = (api: TestApi, upTo: unknown, player = 'alice') =>
  api.post('/api/notifications/read', { upTo }, player)

/** Application de test où Alice et Bob ont fondé leur village. */
async function withVillages() {
  const api = await createTestApi()
  for (const player of ['alice', 'bob']) {
    await api.post('/api/realm/village', { name: `Village de ${player}` }, player)
  }
  return api
}

/** Alice publie l'offre « 60 bois contre 30 pierre », ou une autre offre. */
async function publish(api: TestApi, give = { wood: 60 }, want = { stone: 30 }) {
  const res = await api.post('/api/market/offers', { give, want })
  return (await res.json()) as { offerId: string; view: OfferView }
}

describe('API du module Notifications', () => {
  it('refuse une requête anonyme (401)', async () => {
    const api = await createTestApi()
    expect((await api.get('/api/notifications', null)).status).toBe(401)
  })

  it("notifie le vendeur lorsque son offre est conclue, et non l'acheteur", async () => {
    const api = await withVillages()
    const { offerId } = await publish(api)
    await api.post(`/api/market/offers/${offerId}/accept`, {}, 'bob')

    expect(await feedOf(api, 'alice')).toEqual([{ kind: 'trade-completed', outcome: null }])
    expect(await feedOf(api, 'bob')).toEqual([])
  })

  it("notifie le vendeur d'une offre expirée, mais pas lorsqu'il la retire lui-même", async () => {
    const api = await withVillages()
    const expiring = await publish(api)
    const withdrawn = await publish(api, { wood: 10 }, { stone: 5 })
    expect([expiring.view.status, withdrawn.view.status]).toEqual(['open', 'open'])
    await api.post(`/api/market/offers/${withdrawn.offerId}/withdraw`, {})
    api.advance(24 * 60)
    await api.get('/api/market/offers', 'bob')

    expect(await feedOf(api, 'alice')).toEqual([{ kind: 'offer-expired', outcome: null }])
  })

  it("notifie chaque joueur d'une expédition terminée, avec son résultat", async () => {
    const api = await createTestApi()
    const { gameId } = await (await api.post('/api/dungeon/games', {})).json()
    await api.post(`/api/dungeon/games/${gameId}/join`, {}, 'bob')
    await api.post(`/api/dungeon/games/${gameId}/start`, {})
    api.advance(60)
    await api.post(`/api/dungeon/games/${gameId}/deadline`, {})

    const expected = [{ kind: 'game-ended', outcome: 'lost' }]
    expect(await feedOf(api, 'alice')).toEqual(expected)
    expect(await feedOf(api, 'bob')).toEqual(expected)
    expect(await feedOf(api, 'carol')).toEqual([])
  })

  it('ne présente plus une notification de plus de trente jours', async () => {
    const api = await withVillages()
    const { offerId } = await publish(api)
    await api.post(`/api/market/offers/${offerId}/accept`, {}, 'bob')
    expect(await feedOf(api, 'alice')).toHaveLength(1)

    api.advance(400 * 24 * 60)
    expect(await feedOf(api, 'alice')).toEqual([])
  })

  it('compte les non lues, puis marque comme lues sans reculer ni dépasser la dernière', async () => {
    const api = await withVillages()
    const { offerId } = await publish(api)
    await api.post(`/api/market/offers/${offerId}/accept`, {}, 'bob')

    const before = await feed(api, 'alice')
    expect(before).toMatchObject({ unread: 1, readUntil: 0 })
    expect(before.notifications[0].read).toBe(false)
    const last = before.notifications[0].position

    const read = (await (await markRead(api, 1_000_000)).json()) as ReadResult
    expect(read).toEqual({ readUntil: last, unread: 0 })
    expect(await (await markRead(api, 0)).json()).toEqual({ readUntil: last, unread: 0 })
    expect(await feed(api, 'alice')).toMatchObject({ unread: 0, readUntil: last })
    expect((await feed(api, 'alice')).notifications[0].read).toBe(true)
  })

  it("ne marque pas comme lues les notifications d'un autre joueur", async () => {
    const api = await createTestApi()
    const { gameId } = await (await api.post('/api/dungeon/games', {})).json()
    await api.post(`/api/dungeon/games/${gameId}/join`, {}, 'bob')
    await api.post(`/api/dungeon/games/${gameId}/start`, {})
    api.advance(60)
    await api.post(`/api/dungeon/games/${gameId}/deadline`, {})

    await markRead(api, 1_000_000, 'alice')

    expect((await feed(api, 'alice')).unread).toBe(0)
    expect((await feed(api, 'bob')).unread).toBe(1)
  })

  it('refuse une position invalide (400) et une requête anonyme (401)', async () => {
    const api = await createTestApi()
    expect((await markRead(api, -1)).status).toBe(400)
    expect((await markRead(api, 'tout')).status).toBe(400)
    expect((await markRead(api, 1, null as unknown as string)).status).toBe(401)
  })

  it('conserve la position de lecture lorsque la projection est reconstruite', async () => {
    const api = await withVillages()
    const { offerId } = await publish(api)
    await api.post(`/api/market/offers/${offerId}/accept`, {}, 'bob')
    await markRead(api, 1_000_000)
    const before = await feed(api, 'alice')

    await createProjectionRunner(api.db).rebuild(notificationsProjection)

    expect(await feed(api, 'alice')).toEqual(before)
    expect(before.unread).toBe(0)
  })

  it('exporte les notifications du joueur, puis les efface avec son compte', async () => {
    const api = await withVillages()
    const { offerId } = await publish(api)
    await api.post(`/api/market/offers/${offerId}/accept`, {}, 'bob')

    await markRead(api, 1_000_000)

    const exported = await (await api.get('/api/account/export')).json()
    expect(exported.sections.notifications.notifications).toMatchObject([
      { kind: 'trade-completed', subjectId: offerId },
    ])
    expect(exported.sections.notifications.readUntil).toBeGreaterThan(0)

    await api.api.request('/api/account', { method: 'DELETE', headers: { 'x-test-user': 'alice' } })
    for (const table of ['notifications', 'read_marks']) {
      const result = await api.db.execute(sql.raw(`SELECT * FROM notifications.${table}`))
      expect((result as unknown as { rows: unknown[] }).rows).toEqual([])
    }
  })
})
