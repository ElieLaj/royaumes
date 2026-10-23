import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import type { OfferView } from '@/modules/market/contracts'
import type { Feed } from '@/modules/notifications/contracts'
import { createTestApi } from './testing'

type TestApi = Awaited<ReturnType<typeof createTestApi>>

/** Fil de notifications d'un joueur, tel que l'API le renvoie. */
async function feedOf(api: TestApi, player: string) {
  const res = await api.get('/api/notifications', player)
  return ((await res.json()) as Feed).notifications.map(({ kind, outcome }) => ({ kind, outcome }))
}

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

  it('exporte les notifications du joueur, puis les efface avec son compte', async () => {
    const api = await withVillages()
    const { offerId } = await publish(api)
    await api.post(`/api/market/offers/${offerId}/accept`, {}, 'bob')

    const exported = await (await api.get('/api/account/export')).json()
    expect(exported.sections.notifications.notifications).toMatchObject([
      { kind: 'trade-completed', subjectId: offerId },
    ])

    await api.api.request('/api/account', { method: 'DELETE', headers: { 'x-test-user': 'alice' } })
    const result = await api.db.execute(sql`SELECT * FROM notifications.notifications`)
    expect((result as unknown as { rows: unknown[] }).rows).toEqual([])
  })
})
