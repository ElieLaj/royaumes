import { DrizzleQueryError } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { describeError } from './describe-error'

describe("Description d'une erreur pour les journaux", () => {
  it("ne retient d'une erreur de requête SQL que la requête, sans ses paramètres", () => {
    const cause = new Error('null value in column "body" violates not-null constraint')
    const error = new DrizzleQueryError(
      'insert into messages (author_name, body) values ($1, $2)',
      ['Zéphyrine', 'Message confidentiel'],
      cause,
    )

    const described = describeError(error)
    expect(described).toContain('insert into messages')
    expect(described).toContain('null value in column "body"')
    expect(described).not.toContain('Zéphyrine')
    expect(described).not.toContain('Message confidentiel')
  })

  it('conserve le message des erreurs ordinaires', () => {
    expect(describeError(new Error('panne passagère'))).toBe('panne passagère')
    expect(describeError('texte')).toBe('texte')
  })
})
