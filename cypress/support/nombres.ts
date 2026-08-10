/**
 * Nombres de archivo seguros y legibles.
 *
 * Vive aparte porque lo usan **los dos lados**: la prueba, que en el navegador
 * arma el nombre de la captura que le pide a Cypress, y el arnés de Node, que
 * reubica el archivo y lo anota en el manifiesto. Si cada uno tuviera su propia
 * versión, un acento tratado distinto dejaría la anotación apuntando a un
 * archivo que no existe.
 */

/** Sin acentos, sin espacios, en minúscula y acotado. */
export function nombreSeguro(texto: string, largoMaximo = 80): string {
  const limpio = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return limpio.slice(0, largoMaximo) || 'estado';
}
