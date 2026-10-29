/**
 * Parte un texto en tramos que terminan en uno de los `separators`, para que el
 * navegador pueda cortarlo ahí (con `<wbr />`) y nunca a media palabra. El texto
 * no cambia: los tramos unidos lo reconstruyen, así copiar y pegar sigue entero.
 * `splitAfter('accounting.rules_x', './_')` → `['accounting.', 'rules_', 'x']`.
 */
export function splitAfter(text: string, separators: string): readonly string[] {
  const set = [...separators].map((c) => c.replace(/[\\\]^-]/g, (m) => `\\${m}`)).join('');
  return text.match(new RegExp(`[^${set}]*[${set}]|[^${set}]+`, 'g')) ?? [];
}

/**
 * Una ruta de la API se corta en las barras.
 * `/accounting/accounts` → `['/accounting/', 'accounts']`.
 */
export function routeSegments(route: string): readonly string[] {
  const segments = splitAfter(route, '/');
  // La barra inicial va pegada al primer tramo: una «/» sola en su renglón no dice nada.
  if (segments[0] !== '/' || segments.length < 2) return segments;
  const [slash, first, ...rest] = segments;
  return [slash! + first!, ...rest];
}
