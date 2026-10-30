/**
 * Quita las marcas de markdown liviano (`**negrita**`, `__negrita__`,
 * `*cursiva*`, `` `código` ``) que el inventario deja en las definiciones, y
 * devuelve el texto tal como se lee. No interpreta nada más: lo demás pasa igual.
 */
export function plainText(text: string): string {
  return text
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(?<![\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![\w*])/g, '$1')
    .replace(/`([^`]*)`/g, '$1');
}
