/* ============================================================================
    El total «en literal» de la representación gráfica.

    El Art. 69 de la RND 102100000011 pide el total «numeral y literal», y los
    PDF de ejemplo oficiales lo imprimen como «Son: … Bolivianos». La forma de
    los centavos («00/100») es **INFERENCIA** de uso corriente, no se leyó en la
    norma.
    ========================================================================== */

const UNITS = ['', 'Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve'];
const TEN_TO_TWENTY_NINE = [
  'Diez', 'Once', 'Doce', 'Trece', 'Catorce', 'Quince', 'Dieciséis', 'Diecisiete', 'Dieciocho', 'Diecinueve',
  'Veinte', 'Veintiuno', 'Veintidós', 'Veintitrés', 'Veinticuatro', 'Veinticinco', 'Veintiséis', 'Veintisiete',
  'Veintiocho', 'Veintinueve',
];
const TENS = ['', '', '', 'Treinta', 'Cuarenta', 'Cincuenta', 'Sesenta', 'Setenta', 'Ochenta', 'Noventa'];
const HUNDREDS = [
  '', 'Ciento', 'Doscientos', 'Trescientos', 'Cuatrocientos', 'Quinientos', 'Seiscientos', 'Setecientos',
  'Ochocientos', 'Novecientos',
];

function upToNineHundredNinetyNine(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'Cien';
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (centena > 0) partes.push(HUNDREDS[centena]!);
  if (resto >= 10 && resto < 30) {
    partes.push(TEN_TO_TWENTY_NINE[resto - 10]!);
  } else if (resto >= 30) {
    const unidad = resto % 10;
    partes.push(unidad === 0 ? TENS[Math.floor(resto / 10)]! : `${TENS[Math.floor(resto / 10)]} y ${UNITS[unidad]}`);
  } else if (resto > 0) {
    partes.push(UNITS[resto]!);
  }
  return partes.join(' ');
}

/** «Uno» delante de «Mil»/«Millones» se apocopa: «Treinta y Un Mil», «Veintiún Mil». */
function apocopate(texto: string): string {
  return texto.replace(/Veintiuno$/, 'Veintiún').replace(/Uno$/, 'Un');
}

/** Entero no negativo en letras (hasta 999 999 999), con mayúscula inicial por palabra. */
export function integerInLetters(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999_999) {
    throw new Error(`Fuera de rango para el literal: ${n}`);
  }
  if (n === 0) return 'Cero';
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones > 0) {
    partes.push(millones === 1 ? 'Un Millón' : `${apocopate(upToNineHundredNinetyNine(millones))} Millones`);
  }
  if (miles > 0) {
    partes.push(miles === 1 ? 'Mil' : `${apocopate(upToNineHundredNinetyNine(miles))} Mil`);
  }
  if (resto > 0) partes.push(upToNineHundredNinetyNine(resto));
  return partes.join(' ');
}

/** `"250.50"` → `"Son: Doscientos Cincuenta 50/100 Bolivianos"`. */
export function amountLiteral(importe: string): string {
  const coincide = /^(\d+)(?:\.(\d{1,2}))?$/.exec(importe);
  if (coincide === null) throw new Error(`Importe inválido para el literal: ${importe}`);
  const centavos = (coincide[2] ?? '').padEnd(2, '0');
  return `Son: ${integerInLetters(Number(coincide[1]))} ${centavos}/100 Bolivianos`;
}
