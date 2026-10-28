import { describe, expect, it } from 'vitest'
import { BUBBLE_MAX_LENGTH, BUBBLE_MS, bubbleText, visibleBubble } from './bubble'

const T0 = Date.UTC(2026, 0, 1)

describe('Bulles - texte', () => {
  it('résume le message sur une seule ligne', () => {
    expect(bubbleText('  Bonsoir \n\n  à tous !  ')).toBe('Bonsoir à tous !')
  })

  it('raccourcit un message trop long, sans couper un symbole en deux', () => {
    const long = bubbleText('a'.repeat(200))
    expect([...long]).toHaveLength(BUBBLE_MAX_LENGTH)
    expect(long.endsWith('…')).toBe(true)

    const beers = bubbleText('🍺'.repeat(200))
    expect([...beers]).toHaveLength(BUBBLE_MAX_LENGTH)
    expect(beers).toBe(`${'🍺'.repeat(BUBBLE_MAX_LENGTH - 1)}…`)
  })
})

describe('Bulles - affichage', () => {
  const spoken = [
    { authorId: 'alice', body: 'Premier', receivedAt: T0 },
    { authorId: 'bob', body: 'Salut', receivedAt: T0 + 1000 },
    { authorId: 'alice', body: 'Second', receivedAt: T0 + 2000 },
  ]

  it('affiche le dernier message du joueur, et seulement le sien', () => {
    expect(visibleBubble(spoken, 'alice', T0 + 3000)).toBe('Second')
    expect(visibleBubble(spoken, 'bob', T0 + 3000)).toBe('Salut')
    expect(visibleBubble(spoken, 'carol', T0 + 3000)).toBeNull()
  })

  it('efface la bulle au bout de six secondes', () => {
    expect(visibleBubble(spoken, 'bob', T0 + 1000 + BUBBLE_MS - 1)).toBe('Salut')
    expect(visibleBubble(spoken, 'bob', T0 + 1000 + BUBBLE_MS)).toBeNull()
  })

  it("ne ressuscite pas un message ancien lorsqu'un message plus récent a expiré", () => {
    expect(visibleBubble(spoken, 'alice', T0 + 2000 + BUBBLE_MS)).toBeNull()
  })
})
