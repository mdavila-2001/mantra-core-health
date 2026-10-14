/**
 * Limpia caracteres espurios en nombres importados de planillas y aseguradoras
 * (por ejemplo «, Marisol Antelo de Aguilera» o «Antelo de Aguilera,, Marisol»).
 */
export function cleanDisplayName(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/^[,.\s]+/, '')
    .replace(/[,.\s]+$/, '')
    .replace(/\s*,\s*,+\s*/g, ', ')
    .trim();
}
