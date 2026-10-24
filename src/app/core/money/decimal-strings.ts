/**
 * Aritmética decimal exacta sobre cadenas, sin pasar por `Number`.
 *
 * Misma técnica que `sumarDecimales`/`mismosDecimales` de la API
 * (`src/common/money/decimal-money.ts`): se opera con `BigInt` sobre la
 * representación decimal literal, así que no hay redondeo de coma flotante
 * en ningún paso y una cantidad que no cabe en un `number` (> 2^53) se
 * conserva exacta. No existía un helper equivalente en el frontend:
 * `sameDecimal` (`features/insurance/insurance-claim-detail.ts`) sólo
 * compara, y ESLint prohíbe que `core/`/`shared/` importen de `features/`.
 */

/** `true` si el texto es un decimal válido (signo opcional, punto opcional). */
export function isDecimalString(value: string): boolean {
  return /^[+-]?\d+(?:\.\d+)?$/.test(value.trim());
}

interface ScaledDecimal {
  readonly value: bigint;
  readonly scale: number;
}

function scale(text: string): ScaledDecimal {
  const trimmed = text.trim();
  if (!isDecimalString(trimmed)) {
    throw new RangeError(`Importe no decimal: ${text}`);
  }
  const negative = trimmed.startsWith('-');
  const unsigned = trimmed.replace(/^[+-]/, '');
  const [integer, fraction = ''] = unsigned.split('.');
  const value = BigInt(`${integer}${fraction}`);
  return { value: negative ? -value : value, scale: fraction.length };
}

function unscale(value: bigint, scaleDigits: number): string {
  if (scaleDigits === 0) return value.toString();
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(scaleDigits + 1, '0');
  const cut = digits.length - scaleDigits;
  const result = `${digits.slice(0, cut)}.${digits.slice(cut)}`;
  return negative ? `-${result}` : result;
}

/**
 * Suma importes decimales exactos. La escala del resultado es la mayor de
 * las entradas (no se recorta a dos decimales). Con la lista vacía devuelve
 * `null`: «no hay importes» y «la suma dio cero» no son lo mismo.
 *
 * @param amounts - Importes como cadena; los nulos/vacíos se ignoran.
 * @returns La suma como cadena decimal, o `null` si no había ninguno.
 */
export function addDecimalStrings(
  amounts: readonly (string | null | undefined)[],
): string | null {
  const present = amounts.filter(
    (amount): amount is string => amount != null && amount.trim() !== '',
  );
  if (present.length === 0) return null;
  const scaled = present.map(scale);
  const decimals = scaled.reduce((max, item) => Math.max(max, item.scale), 0);
  const total = scaled.reduce((sum, item) => {
    const factor = 10n ** BigInt(decimals - item.scale);
    return sum + item.value * factor;
  }, 0n);
  return unscale(total, decimals);
}

/**
 * Compara dos importes decimales por valor, no por texto: `'1250.0'` y
 * `'1250.00'` son el mismo dinero.
 */
export function sameDecimalString(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (a == null || b == null) return a == null && b == null;
  const scaledA = scale(a);
  const scaledB = scale(b);
  const decimals = Math.max(scaledA.scale, scaledB.scale);
  const valueA = scaledA.value * 10n ** BigInt(decimals - scaledA.scale);
  const valueB = scaledB.value * 10n ** BigInt(decimals - scaledB.scale);
  return valueA === valueB;
}
