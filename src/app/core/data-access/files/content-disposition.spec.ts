import { describe, expect, it } from 'vitest';

import { nombreDeContentDisposition } from './content-disposition';

/**
 * La regla que gobierna todo este archivo: **ante la duda, no hay nombre.**
 * Cada caso que no se puede decodificar con certeza devuelve `undefined` para
 * que la pantalla use su propio texto de reserva, nunca un nombre a medias.
 */
describe('nombreDeContentDisposition', () => {
  it('lee la forma extendida que emite esta API', () => {
    expect(
      nombreDeContentDisposition(
        "attachment; filename*=UTF-8''analisis-marzo.pdf",
      ),
    ).toBe('analisis-marzo.pdf');
  });

  it('decodifica Unicode percent-encodeado', () => {
    // «citología-año.pdf», que es como viaja un nombre real en castellano.
    expect(
      nombreDeContentDisposition(
        "attachment; filename*=UTF-8''citolog%C3%ADa-a%C3%B1o.pdf",
      ),
    ).toBe('citología-año.pdf');
  });

  it('acepta un nombre sin extensión', () => {
    // El sistema no exige extensión: el tipo sale de los bytes, no del nombre.
    expect(
      nombreDeContentDisposition("attachment; filename*=UTF-8''receta"),
    ).toBe('receta');
  });

  it('lee la forma heredada, con y sin comillas', () => {
    expect(nombreDeContentDisposition('attachment; filename="estudio.png"')).toBe(
      'estudio.png',
    );
    expect(nombreDeContentDisposition('attachment; filename=estudio.png')).toBe(
      'estudio.png',
    );
  });

  it.each([
    ['cabecera ausente', null],
    ['cabecera vacía', ''],
    ['undefined', undefined],
    ['sin filename', 'attachment'],
    ['filename vacío', 'attachment; filename=""'],
    ['sólo espacios', 'attachment; filename="   "'],
  ])('devuelve undefined con %s', (_caso, header) => {
    expect(nombreDeContentDisposition(header)).toBeUndefined();
  });

  it('no adivina cuando el percent-encoding está roto', () => {
    // Un `%` suelto hace reventar a `decodeURIComponent`. Antes que entregar
    // `an%lisis.pdf` a medias, no se entrega nada.
    expect(
      nombreDeContentDisposition("attachment; filename*=UTF-8''an%lisis.pdf"),
    ).toBeUndefined();
  });

  it('rechaza un juego de caracteres que no sabe decodificar', () => {
    expect(
      nombreDeContentDisposition("attachment; filename*=ISO-8859-1''caf%E9.pdf"),
    ).toBeUndefined();
  });

  it('no cae en la forma heredada si la extendida vino rota', () => {
    // Una cabecera que se contradice a sí misma no es fuente de verdad para
    // ninguna de sus dos mitades.
    expect(
      nombreDeContentDisposition(
        "attachment; filename=\"seguro.pdf\"; filename*=UTF-8''roto%",
      ),
    ).toBeUndefined();
  });

  it.each([
    ['ruta relativa', "attachment; filename*=UTF-8''..%2F..%2Fetc%2Fpasswd"],
    ['barra invertida', 'attachment; filename="..\\\\windows\\\\system32"'],
    ['salto de línea', "attachment; filename*=UTF-8''nombre%0Ainyectado"],
  ])('descarta un nombre con %s', (_caso, header) => {
    expect(nombreDeContentDisposition(header)).toBeUndefined();
  });
});
