/* ============================================================================
    Empaquetar el XML como lo pide el SIAT: gzip → base64 → SHA-256.

    Fuente: «Emisión y envío»,
    https://siatinfo.impuestos.gob.bo/index.php/facturacion-en-linea/emision-y-envio-de-facturas/emision-y-envio
    (leída el 2026-09-26): el XML se comprime con **Gzip**, va en `archivo`
    (`base64Binary` en el WSDL) y `hashArchivo` es el **SHA-256 del archivo
    comprimido**.

    ## Por qué un gzip propio

    Los manejadores del backend simulado son síncronos, y `CompressionStream`
    no lo es. Este gzip es **válido** según RFC 1952/1951 —cualquier `gunzip`
    lo abre— pero usa bloques *stored*: no comprime, sólo empaqueta. El
    desempaquetador del simulador acepta únicamente esos bloques; lo que el SIN
    real acepte es otra cosa, y no se afirma acá.
    ========================================================================== */

import { sha256HexBytes } from '../sha256';

export interface PackagedFile {
  /** El gzip en base64, como viaja en `archivo`. */
  readonly archivo: string;
  /** SHA-256 hexadecimal del gzip (no del XML). */
  readonly hashArchivo: string;
  readonly bytesComprimidos: number;
}

export class PackagingError extends Error {
  constructor(
    readonly motivo: 'BASE64' | 'GZIP' | 'HASH',
    detalle: string,
  ) {
    super(`Archivo inválido (${motivo}): ${detalle}`);
    this.name = 'ErrorDeEmpaquetado';
  }
}

// ---- CRC-32 (IEEE 802.3), el que exige el trailer gzip ----------------------

const TABLE_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

export function crc32(datos: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of datos) crc = TABLE_CRC[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ---- gzip con bloques stored -------------------------------------------------

const MAX_PER_BLOCK = 0xffff;

function writeU32Le(destino: number[], valor: number): void {
  destino.push(valor & 0xff, (valor >>> 8) & 0xff, (valor >>> 16) & 0xff, (valor >>> 24) & 0xff);
}

/** gzip válido (RFC 1952) con deflate de bloques stored (RFC 1951 §3.2.4). */
export function gzipWithoutCompression(datos: Uint8Array): Uint8Array {
  // ID1 ID2 CM=8 (deflate) FLG=0 MTIME=0 XFL=0 OS=255 (desconocido).
  const salida: number[] = [0x1f, 0x8b, 0x08, 0x00, 0, 0, 0, 0, 0x00, 0xff];
  let offset = 0;
  do {
    const largo = Math.min(MAX_PER_BLOCK, datos.length - offset);
    const final = offset + largo >= datos.length;
    // BFINAL en el bit 0, BTYPE=00; el resto del byte es relleno hasta alinear.
    salida.push(final ? 0x01 : 0x00, largo & 0xff, largo >>> 8, ~largo & 0xff, (~largo >>> 8) & 0xff);
    for (let i = 0; i < largo; i++) salida.push(datos[offset + i]!);
    offset += largo;
  } while (offset < datos.length);
  writeU32Le(salida, crc32(datos));
  writeU32Le(salida, datos.length >>> 0);
  return Uint8Array.from(salida);
}

/** Abre un gzip de bloques stored y verifica CRC-32 y tamaño. */
export function gunzipWithoutCompression(gzip: Uint8Array): Uint8Array {
  if (gzip.length < 18 || gzip[0] !== 0x1f || gzip[1] !== 0x8b || gzip[2] !== 0x08) {
    throw new PackagingError('GZIP', 'no es un gzip deflate');
  }
  if (gzip[3] !== 0x00) throw new PackagingError('GZIP', 'cabecera gzip con campos opcionales no soportados');
  const bytes: number[] = [];
  let i = 10;
  for (;;) {
    const cabeceraBloque = gzip[i];
    if (cabeceraBloque === undefined) throw new PackagingError('GZIP', 'datos truncados');
    if (((cabeceraBloque >>> 1) & 0b11) !== 0) {
      throw new PackagingError('GZIP', 'el simulador sólo abre bloques stored (sin compresión)');
    }
    const largo = gzip[i + 1]! | (gzip[i + 2]! << 8);
    const complemento = gzip[i + 3]! | (gzip[i + 4]! << 8);
    if ((largo ^ 0xffff) !== complemento) throw new PackagingError('GZIP', 'LEN/NLEN inconsistentes');
    i += 5;
    if (i + largo > gzip.length - 8) throw new PackagingError('GZIP', 'datos truncados');
    for (let k = 0; k < largo; k++) bytes.push(gzip[i + k]!);
    i += largo;
    if (cabeceraBloque & 1) break;
  }
  const datos = Uint8Array.from(bytes);
  const leerU32 = (p: number) => (gzip[p]! | (gzip[p + 1]! << 8) | (gzip[p + 2]! << 16) | (gzip[p + 3]! << 24)) >>> 0;
  if (leerU32(i) !== crc32(datos)) throw new PackagingError('GZIP', 'CRC-32 no coincide');
  if (leerU32(i + 4) !== datos.length >>> 0) throw new PackagingError('GZIP', 'ISIZE no coincide');
  return datos;
}

// ---- base64 ------------------------------------------------------------------

export function aBase64(bytes: Uint8Array): string {
  let binario = '';
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario);
}

export function fromBase64(texto: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(texto) || texto.length % 4 !== 0) {
    throw new PackagingError('BASE64', 'no es base64 válido');
  }
  const binario = atob(texto);
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

// ---- el paquete completo -----------------------------------------------------

export function packageXml(xml: string): PackagedFile {
  const gzip = gzipWithoutCompression(new TextEncoder().encode(xml));
  return { archivo: aBase64(gzip), hashArchivo: sha256HexBytes(gzip), bytesComprimidos: gzip.length };
}

/** El XML de un `archivo`, comprobando antes el `hashArchivo`. */
export function unpackageFile(archivo: string, hashArchivo: string): string {
  const gzip = fromBase64(archivo);
  if (sha256HexBytes(gzip) !== hashArchivo.toLowerCase()) {
    throw new PackagingError('HASH', 'hashArchivo no es el SHA-256 del archivo comprimido');
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(gunzipWithoutCompression(gzip));
}
