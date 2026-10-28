import { describe, expect, it } from 'vitest'
import { MARGIN, PAUSE_MS, planMove, SPEED, STEP, startPosition } from './wander'

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('Déplacements - limites de la scène', () => {
  it('ne sort jamais de la scène, quelle que soit la position de départ', () => {
    const random = seeded(7)
    for (let n = 0; n < 2000; n++) {
      const x = startPosition(random)
      expect(x).toBeGreaterThanOrEqual(MARGIN)
      expect(x).toBeLessThanOrEqual(1 - MARGIN)
      const plan = planMove(x, random)
      expect(plan.to).toBeGreaterThanOrEqual(MARGIN)
      expect(plan.to).toBeLessThanOrEqual(1 - MARGIN)
    }
  })

  it('rebrousse chemin au bord de la scène, quel que soit le tirage', () => {
    for (const random of [() => 0, () => 0.25, () => 0.75, () => 0.999]) {
      expect(planMove(MARGIN, random).facing).toBe('right')
      expect(planMove(1 - MARGIN, random).facing).toBe('left')
    }
  })
})

describe('Déplacements - marche et pause', () => {
  it('marche à vitesse constante, en regardant du côté où elle va', () => {
    const random = seeded(11)
    for (let n = 0; n < 500; n++) {
      const x = startPosition(random)
      const plan = planMove(x, random)
      const distance = Math.abs(plan.to - x)
      expect(distance).toBeGreaterThanOrEqual(STEP.min - 1e-9)
      expect(distance).toBeLessThanOrEqual(STEP.max + 1e-9)
      expect(plan.facing).toBe(plan.to < x ? 'left' : 'right')
      expect(plan.walkMs).toBe(Math.round((distance / SPEED) * 1000))
    }
  })

  it('fait une pause comprise dans les bornes avant de repartir', () => {
    const random = seeded(3)
    for (let n = 0; n < 500; n++) {
      const { pauseMs } = planMove(0.5, random)
      expect(pauseMs).toBeGreaterThanOrEqual(PAUSE_MS.min)
      expect(pauseMs).toBeLessThanOrEqual(PAUSE_MS.max)
    }
  })

  it('est reproductible pour une même suite de tirages', () => {
    expect(planMove(0.4, seeded(5))).toEqual(planMove(0.4, seeded(5)))
    expect(planMove(0.4, seeded(5))).not.toEqual(planMove(0.4, seeded(6)))
  })
})
