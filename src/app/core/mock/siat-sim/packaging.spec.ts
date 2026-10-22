import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

import {
  aBase64,
  crc32,
  fromBase64,
  unpackageFile,
  packageXml,
  PackagingError,
  gunzipWithoutCompression,
  gzipWithoutCompression,
} from './packaging';

/**
 * El empaquetado se verifica contra implementaciones **independientes** de
 * Node (`zlib`, `crypto`): si el gzip o el hash fueran inventados, estas
 * pruebas no los reconocerían.
 */
describe('empaquetado SIAT · gzip + base64 + SHA-256', () => {
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<raiz><cabecera><a>Ñandú & café</a></cabecera></raiz>';

  it('el gzip lo abre zlib de Node y devuelve el XML exacto', () => {
    const gzip = gzipWithoutCompression(new TextEncoder().encode(xml));
    expect(gunzipSync(gzip).toString('utf8')).toBe(xml);
  });

  it('parte en varios bloques stored cuando el contenido supera 65 535 bytes', () => {
    const grande = new Uint8Array(150_000).map((_, i) => i % 251);
    const gzip = gzipWithoutCompression(grande);
    expect(Buffer.from(gunzipSync(gzip)).equals(Buffer.from(grande))).toBe(true);
    expect(Buffer.from(gunzipWithoutCompression(gzip)).equals(Buffer.from(grande))).toBe(true);
  });

  it('un contenido vacío sigue siendo un gzip válido', () => {
    expect(gunzipSync(gzipWithoutCompression(new Uint8Array())).length).toBe(0);
  });

  it('el CRC-32 coincide con el valor de referencia de "123456789"', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('hashArchivo es el SHA-256 del gzip, no del XML', () => {
    const paquete = packageXml(xml);
    const gzip = Buffer.from(paquete.archivo, 'base64');
    expect(paquete.hashArchivo).toBe(createHash('sha256').update(gzip).digest('hex'));
    expect(paquete.hashArchivo).not.toBe(createHash('sha256').update(xml).digest('hex'));
    expect(paquete.bytesComprimidos).toBe(gzip.length);
  });

  it('ida y vuelta: empaquetar y desempaquetar devuelve el mismo XML', () => {
    const paquete = packageXml(xml);
    expect(unpackageFile(paquete.archivo, paquete.hashArchivo)).toBe(xml);
  });

  it('rechaza un hash que no corresponde', () => {
    const paquete = packageXml(xml);
    expect(() => unpackageFile(paquete.archivo, '0'.repeat(64))).toThrow(PackagingError);
  });

  it('rechaza base64 inválido', () => {
    expect(() => fromBase64('no es base64!')).toThrow(/BASE64/);
  });

  it('rechaza un gzip comprimido de verdad: el simulador sólo abre bloques stored', () => {
    const comprimido = new Uint8Array(gzipSync(Buffer.from(xml.repeat(20))));
    expect(() => gunzipWithoutCompression(comprimido)).toThrow(/stored/);
  });

  it('rechaza un gzip con el CRC alterado', () => {
    const gzip = gzipWithoutCompression(new TextEncoder().encode(xml));
    gzip[gzip.length - 8] = gzip[gzip.length - 8]! ^ 0xff;
    expect(() => gunzipWithoutCompression(gzip)).toThrow(/CRC/);
  });

  it('base64 coincide con el de Node', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(aBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
    expect(Array.from(fromBase64(aBase64(bytes)))).toEqual(Array.from(bytes));
  });
});
