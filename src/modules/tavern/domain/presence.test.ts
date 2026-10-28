import { describe, expect, it } from 'vitest'
import { HEARTBEAT_MS, PRESENCE_TTL_MS, REFRESH_MS, samePlayers, staleBefore } from './presence'

describe('Taverne - présence', () => {
  it('considère comme parti un joueur sans signal depuis le délai de présence', () => {
    const now = Date.UTC(2026, 0, 1, 12)
    expect(staleBefore(now)).toBe(now - PRESENCE_TTL_MS)
  })

  it('tolère plusieurs signaux manqués avant de déclarer un joueur parti', () => {
    expect(PRESENCE_TTL_MS).toBeGreaterThanOrEqual(2 * 60_000)
    expect(PRESENCE_TTL_MS / HEARTBEAT_MS).toBeGreaterThanOrEqual(3)
  })

  it("relit la liste des présents bien plus souvent qu'un joueur ne signale sa présence", () => {
    expect(REFRESH_MS).toBeLessThan(HEARTBEAT_MS)
  })

  it('reconnaît une liste de présents inchangée, et toute arrivée, tout départ ou changement de nom', () => {
    const alice = { id: 'a', name: 'Alice' }
    const bob = { id: 'b', name: 'Bob' }
    expect(samePlayers([alice, bob], [{ ...alice }, { ...bob }])).toBe(true)
    expect(samePlayers([alice], [alice, bob])).toBe(false)
    expect(samePlayers([alice, bob], [alice])).toBe(false)
    expect(samePlayers([alice, bob], [alice, { ...bob, name: 'Robert' }])).toBe(false)
  })
})
