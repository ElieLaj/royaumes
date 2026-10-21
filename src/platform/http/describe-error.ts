/**
 * Description d'une erreur destinée aux journaux : son nom, s'il n'est pas le nom ordinaire, et
 * la première ligne de son message, avec celle de sa cause. Une erreur de requête SQL porte ses
 * paramètres à partir de la seconde ligne, ainsi que dans sa trace : ils peuvent contenir des
 * données personnelles, et ne doivent jamais être journalisés ni conservés.
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const head = (e: Error) => e.message.split('\n')[0]
  const name = error.name === 'Error' ? '' : `${error.name} : `
  const cause = error.cause instanceof Error ? ` (cause : ${head(error.cause)})` : ''
  return `${name}${head(error)}${cause}`
}
