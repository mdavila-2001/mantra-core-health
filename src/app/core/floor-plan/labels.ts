/* Rótulos cortos para los locales del plano. Función pura. */

const ABBREVIATIONS: readonly (readonly [string, string])[] = [
  ['Habitación', 'Hab.'],
  ['Consultorio', 'Cons.'],
  ['Quirófano', 'Quir.'],
  ['Control de enfermería', 'Enfermería'],
  ['Sala de ', ''],
  ['Recepción de muestras', 'Recepción'],
  ['Observación', 'Observ.'],
  ['Administración', 'Admin.'],
];

/**
 * El nombre del local recortado a lo que cabe: «Consultorio 1 · Medicina
 * general» → «Consultorio 1» → «Cons. 1» → «1». Nunca deja una palabra cortada
 * a la mitad si hay una forma corta con sentido.
 */
export function shortName(name: string, maxChars: number): string {
  const head = name.split(' · ')[0]!.replace(/\s*\(.*\)\s*$/, '');
  if (head.length <= maxChars) return head;
  let abbreviated = head;
  for (const [from, to] of ABBREVIATIONS) abbreviated = abbreviated.replace(from, to);
  abbreviated = abbreviated.trim();
  if (abbreviated.length <= maxChars) return abbreviated;
  const last = abbreviated.split(' ').at(-1) ?? '';
  if (last.length > 0 && last.length <= maxChars && /\d/.test(last)) return last;
  if (maxChars < 4) return '';
  return `${abbreviated.slice(0, maxChars - 1).trimEnd()}…`;
}
