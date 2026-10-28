import { describe, expect, it } from 'vitest'
import { defaultSkin, isSkin, SKINS, skinOf } from './skin'

describe('Personnages - catalogue', () => {
  it('ne propose que les trois personnages du catalogue', () => {
    expect(SKINS).toEqual(['dwarf', 'elf', 'knight'])
    expect(isSkin('elf')).toBe(true)
    expect(isSkin('dragon')).toBe(false)
    expect(isSkin(undefined)).toBe(false)
  })
})

describe('Personnages - choix', () => {
  it('attribue à chaque joueur un personnage par défaut, toujours le même, tiré de son identifiant', () => {
    const ids = Array.from({ length: 300 }, (_, n) => `joueur-${n}`)
    for (const id of ids) {
      expect(isSkin(defaultSkin(id))).toBe(true)
      expect(defaultSkin(id)).toBe(defaultSkin(id))
    }
    expect(new Set(ids.map(defaultSkin))).toEqual(new Set(SKINS))
  })

  it("garde le personnage choisi, et retombe sur celui par défaut s'il a disparu du catalogue", () => {
    expect(skinOf('knight', 'alice')).toBe('knight')
    expect(skinOf(null, 'alice')).toBe(defaultSkin('alice'))
    expect(skinOf('dragon', 'alice')).toBe(defaultSkin('alice'))
  })
})
