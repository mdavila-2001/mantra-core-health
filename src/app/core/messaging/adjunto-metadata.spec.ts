import { describe, expect, it } from 'vitest';

import {
  archivoDeDataUrl,
  esPdf,
  metadatosDeDataUrl,
  nombreDelTipo,
} from './adjunto-metadata';

/** Un `data:` URL con estos bytes, como lo arma `FileReader.readAsDataURL`. */
function dataUrl(tipo: string, bytes: number[]): string {
  const binario = String.fromCharCode(...bytes);
  return `data:${tipo};base64,${btoa(binario)}`;
}

/**
 * Lo que estas pruebas fijan: el tipo y el tamaño salen del contenido que el
 * hilo ya bajó, **exactos**, y cualquier cosa que no tenga la forma esperada
 * devuelve `null` en vez de una metadata inventada.
 */
describe('metadatosDeDataUrl', () => {
  it('lee el tipo y el tamaño exacto de un PDF', () => {
    // 5 bytes → base64 de 8 caracteres con un `=` de relleno.
    expect(metadatosDeDataUrl(dataUrl('application/pdf', [37, 80, 68, 70, 45]))).toEqual({
      mimeType: 'application/pdf',
      sizeBytes: 5,
    });
  });

  it.each([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [1024, 1024],
  ])('calcula bien el relleno: %i bytes', (cantidad, esperado) => {
    const url = dataUrl('image/png', Array.from({ length: cantidad }, (_, i) => i % 256));
    expect(metadatosDeDataUrl(url)?.sizeBytes).toBe(esperado);
  });

  it('un archivo vacío pesa 0 bytes, no null', () => {
    expect(metadatosDeDataUrl('data:application/pdf;base64,')).toEqual({
      mimeType: 'application/pdf',
      sizeBytes: 0,
    });
  });

  it('conserva parámetros del tipo sin confundirlos con él', () => {
    expect(metadatosDeDataUrl('data:text/plain;charset=utf-8;base64,aG9sYQ==')).toEqual({
      mimeType: 'text/plain',
      sizeBytes: 4,
    });
  });

  it('un contenido sin tipo declarado deja el tipo vacío, no inventado', () => {
    expect(metadatosDeDataUrl('data:;base64,aG9sYQ==')?.mimeType).toBe('');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['vista previa local', 'blob:http://localhost/abc'],
    ['URL de red', 'https://ejemplo.test/a.pdf'],
    ['data: sin base64', 'data:text/plain,hola'],
    ['data: sin coma', 'data:application/pdf;base64'],
    ['longitud imposible', 'data:application/pdf;base64,abc'],
  ])('devuelve null con %s', (_caso, url) => {
    expect(metadatosDeDataUrl(url)).toBeNull();
  });
});

describe('esPdf / nombreDelTipo', () => {
  it('reconoce el PDF y sólo el PDF', () => {
    expect(esPdf({ mimeType: 'application/pdf', sizeBytes: 1 })).toBe(true);
    expect(esPdf({ mimeType: 'image/png', sizeBytes: 1 })).toBe(false);
    expect(esPdf(null)).toBe(false);
  });

  it('nombra los tipos admitidos y muestra crudo lo demás', () => {
    expect(nombreDelTipo('application/pdf')).toBe('PDF');
    expect(
      nombreDelTipo('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ).toBe('Documento Word');
    expect(nombreDelTipo('application/zip')).toBe('application/zip');
    expect(nombreDelTipo('')).toBe('Tipo desconocido');
  });
});

describe('archivoDeDataUrl', () => {
  it('reconstruye el archivo con sus bytes, su tipo y su nombre', async () => {
    const bytes = [37, 80, 68, 70, 45, 49, 46, 55];
    const archivo = archivoDeDataUrl(dataUrl('application/pdf', bytes), 'adjunto.pdf');

    expect(archivo).not.toBeNull();
    expect(archivo!.name).toBe('adjunto.pdf');
    expect(archivo!.type).toBe('application/pdf');
    expect(archivo!.size).toBe(bytes.length);
    expect([...new Uint8Array(await archivo!.arrayBuffer())]).toEqual(bytes);
  });

  it('con base64 corrupto no fabrica un archivo', () => {
    // Longitud válida (múltiplo de 4) pero caracteres que `atob` rechaza.
    expect(archivoDeDataUrl('data:application/pdf;base64,@@@@', 'x.pdf')).toBeNull();
  });

  it('con algo que no es data: URL devuelve null', () => {
    expect(archivoDeDataUrl('blob:http://localhost/abc', 'x.pdf')).toBeNull();
    expect(archivoDeDataUrl(null, 'x.pdf')).toBeNull();
  });
});
