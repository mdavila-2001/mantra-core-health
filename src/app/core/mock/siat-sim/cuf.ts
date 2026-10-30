/* ============================================================================
    El CUF (Código Único de Factura), con el algoritmo oficial del SIN.

    Fuentes (leídas el 2026-09-26):
    - Generación del CUF:
      https://siatinfo.impuestos.gob.bo/index.php/facturacion-en-linea/algoritmos-utilizados/generacion-cuf
    - Módulo 11:
      https://siatinfo.impuestos.gob.bo/index.php/facturacion-en-linea/algoritmos-utilizados/algoritmo-modulo-11
    - Base 16:
      https://siatinfo.impuestos.gob.bo/index.php/facturacion-en-linea/algoritmos-utilizados/base-16

    El algoritmo es el real y la prueba lo ata al ejemplo oficial. Lo que entra
    en el simulador —NIT, CUFD, `codigoControl`— es **sintético**: el CUF que sale
    tiene la forma de uno real y no identifica ninguna factura del SIN.
    ========================================================================== */

/** Campos del CUF en el orden y con el ancho de la tabla oficial. */
export interface CamposCuf {
  readonly nit: string;
  /** `yyyyMMddHHmmssSSS` — ver {@link fechaHoraParaCuf}. */
  readonly fechaHora: string;
  readonly sucursal: number;
  /** 1 Electrónica en Línea · 2 Computarizada en Línea · 3 Portal Web. */
  readonly modalidad: number;
  /** 1 En línea · 2 Fuera de línea · 3 Masiva. */
  readonly tipoEmision: number;
  /** 1 Con derecho a crédito fiscal · 2 Sin derecho · 3 Documento de ajuste. */
  readonly tipoFactura: number;
  readonly tipoDocumentoSector: number;
  readonly numeroFactura: number;
  readonly puntoVenta: number;
}

const ANCHOS: readonly (readonly [keyof CamposCuf, number])[] = [
  ['nit', 13],
  ['fechaHora', 17],
  ['sucursal', 4],
  ['modalidad', 1],
  ['tipoEmision', 1],
  ['tipoFactura', 1],
  ['tipoDocumentoSector', 2],
  ['numeroFactura', 10],
  ['puntoVenta', 4],
];

/** La cadena de 53 dígitos, antes del autoverificador. */
export function cadenaCuf(campos: CamposCuf): string {
  return ANCHOS.map(([campo, ancho]) => {
    const valor = String(campos[campo]);
    if (!/^\d+$/.test(valor)) {
      throw new Error(`CUF: «${campo}» tiene que ser numérico (${valor})`);
    }
    if (valor.length > ancho) {
      throw new Error(`CUF: «${campo}» excede ${ancho} dígitos (${valor})`);
    }
    return valor.padStart(ancho, '0');
  }).join('');
}

/**
 * Dígito autoverificador Módulo 11, como `calculaDigitoMod11(cadena, 1, 9,
 * false)` del ejemplo oficial en Java: pesos 2..9 de derecha a izquierda y
 * cíclicos; el dígito es `suma % 11`, con 10 → «1» (y 11 → «0», rama que el
 * código oficial conserva aunque `suma % 11` no pueda valer 11).
 */
export function modulo11(cadena: string): string {
  let suma = 0;
  let peso = 2;
  for (let i = cadena.length - 1; i >= 0; i--) {
    suma += peso * Number(cadena[i]);
    peso = peso === 9 ? 2 : peso + 1;
  }
  const digito = suma % 11;
  if (digito === 10) return '1';
  if (digito === 11) return '0';
  return String(digito);
}

/** Base 16 de la cadena decimal completa, como un solo entero, en mayúsculas. */
export function base16(cadenaDecimal: string): string {
  if (!/^\d+$/.test(cadenaDecimal)) {
    throw new Error('Base16: la cadena tiene que ser decimal');
  }
  return BigInt(cadenaDecimal).toString(16).toUpperCase();
}

/** CUF = Base16(cadena + Módulo11(cadena)) + `codigoControl` del CUFD. */
export function generarCuf(campos: CamposCuf, codigoControl: string): string {
  const cadena = cadenaCuf(campos);
  return base16(cadena + modulo11(cadena)) + codigoControl;
}

/**
 * `2021-10-06T16:03:48.675` → `20211006160348675`. Recibe la `fechaEmision`
 * tal como va en el XML (sin zona, «UTC extendido» en la documentación
 * oficial), así que el CUF y el XML no pueden divergir.
 */
export function fechaHoraParaCuf(fechaEmision: string): string {
  const coincide = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/.exec(fechaEmision);
  if (coincide === null) {
    throw new Error(`CUF: fechaEmision con formato inesperado (${fechaEmision})`);
  }
  return coincide.slice(1).join('');
}
