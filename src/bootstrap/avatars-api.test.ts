import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import type { MySkin } from '@/modules/avatars/contracts'
import { defaultSkin, LOOKUP_MAX } from '@/modules/avatars/contracts'
import { createTestApi } from './testing'

type TestApi = Awaited<ReturnType<typeof createTestApi>>

/** Choisit un personnage au nom d'un joueur, Alice par défaut. */
const choose = (api: TestApi, body: unknown, player: string | null = 'alice') =>
  api.api.request('/api/avatars/me', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...(player ? { 'x-test-user': player } : {}) },
    body: JSON.stringify(body),
  })

/** Personnage d'un joueur, tel que lui-même le consulte. */
async function mine(api: TestApi, player = 'alice') {
  return (await (await api.get('/api/avatars/me', player)).json()) as MySkin
}

/** Personnages des joueurs demandés, tels que les voit un autre joueur. */
const lookup = (api: TestApi, playerIds: string[], player = 'carol') =>
  api.post('/api/avatars/lookup', { playerIds }, player)

/** Lignes de la table des personnages. */
async function rows(api: TestApi) {
  const result = await api.db.execute(sql`SELECT player_id, skin FROM avatars.skins ORDER BY 1`)
  return (result as unknown as { rows: { player_id: string; skin: string }[] }).rows
}

describe('API du module Avatars', () => {
  it('refuse une requête anonyme (401)', async () => {
    const api = await createTestApi()
    expect((await api.get('/api/avatars/me', null)).status).toBe(401)
    expect((await choose(api, { skin: 'elf' }, null)).status).toBe(401)
    expect((await api.post('/api/avatars/lookup', { playerIds: ['alice'] }, null)).status).toBe(401)
  })

  it("attribue un personnage à un joueur qui n'a rien choisi, toujours le même", async () => {
    const api = await createTestApi()
    const first = await mine(api)

    expect(first).toEqual({ skin: defaultSkin('alice'), chosen: false })
    expect(await mine(api)).toEqual(first)
    expect(await rows(api)).toEqual([])
  })

  it('enregistre le personnage choisi, et le remplace à chaque nouveau choix', async () => {
    const api = await createTestApi()

    const res = await choose(api, { skin: 'knight' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ skin: 'knight', chosen: true })
    expect(await mine(api)).toEqual({ skin: 'knight', chosen: true })

    await choose(api, { skin: 'elf' })
    expect(await mine(api)).toEqual({ skin: 'elf', chosen: true })
    expect(await rows(api)).toEqual([{ player_id: 'alice', skin: 'elf' }])
  })

  it('refuse un personnage hors du catalogue, ou un corps invalide (400)', async () => {
    const api = await createTestApi()

    for (const body of [{ skin: 'dragon' }, {}, { skin: 42 }, { skin: null }, [1]]) {
      expect((await choose(api, body)).status).toBe(400)
    }
    expect(await rows(api)).toEqual([])
  })

  it("ne choisit qu'au nom du joueur connecté, quel que soit le corps envoyé", async () => {
    const api = await createTestApi()

    await choose(api, { skin: 'knight', playerId: 'alice' }, 'bob')

    expect(await rows(api)).toEqual([{ player_id: 'bob', skin: 'knight' }])
    expect(await mine(api)).toEqual({ skin: defaultSkin('alice'), chosen: false })
  })

  it('présente le personnage des seuls joueurs demandés, choisi ou attribué', async () => {
    const api = await createTestApi()
    await choose(api, { skin: 'elf' }, 'alice')
    await choose(api, { skin: 'knight' }, 'dave')

    const res = await lookup(api, ['alice', 'bob', 'alice'])

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ skins: { alice: 'elf', bob: defaultSkin('bob') } })
  })

  it('refuse une demande vide, ou de plus de cinquante joueurs (400)', async () => {
    const api = await createTestApi()
    const ids = (count: number) => Array.from({ length: count }, (_, n) => `joueur-${n}`)

    expect((await lookup(api, [])).status).toBe(400)
    expect((await lookup(api, ids(LOOKUP_MAX + 1))).status).toBe(400)
    expect((await lookup(api, [''])).status).toBe(400)
    expect((await lookup(api, ids(LOOKUP_MAX))).status).toBe(200)
  })

  it("exporte le personnage choisi par le joueur, puis l'efface avec son compte", async () => {
    const api = await createTestApi()
    await choose(api, { skin: 'knight' }, 'alice')
    await choose(api, { skin: 'elf' }, 'bob')

    const exported = await (await api.get('/api/account/export')).json()
    expect(exported.sections.avatars.skins).toMatchObject([{ skin: 'knight' }])
    expect(JSON.stringify(exported)).not.toContain('elf')

    await api.api.request('/api/account', { method: 'DELETE', headers: { 'x-test-user': 'alice' } })
    expect(await rows(api)).toEqual([{ player_id: 'bob', skin: 'elf' }])
  })
})
