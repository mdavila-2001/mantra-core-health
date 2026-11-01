/**
 * Cambia por espacios duros (U+00A0) los espacios que no deben partir un dato
 * corto: los de una hora con su meridiano («12:00 a. m.») y, si se pide, todos.
 *
 * `toLocaleString('es-BO', { timeStyle: 'short' })` devuelve «12:00 a. m.» con
 * espacios comunes, y en una columna angosta eso se partía en «12:00 a.» /
 * «m.», que se lee como dos datos. CSS (`nowrap` de la columna) lo evita en la
 * tabla; esto lo evita en cualquier lugar donde el texto se dibuje.
 */
export function sinCortes(texto: string, todo = false): string {
  if (todo) return texto.replace(/ +/g, '\u00a0');
  return texto.replace(/(\d)\s([ap])\.\s?m\./gi, (_m, d: string, ap: string) => `${d}\u00a0${ap}.\u00a0m.`);
}
