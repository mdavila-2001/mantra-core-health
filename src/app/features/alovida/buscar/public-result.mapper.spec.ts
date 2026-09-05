import { aTarjeta, inicialesDe, puntuacionDe, rutaDeFicha } from './public-result.mapper';
import type { PublicSearchResult } from '@core/data-access/public-directory/public-directory.types';

/**
 * Lo que estas pruebas fijan.
 *
 * El mapeador es lo único entre la respuesta de la API y lo que una persona sin
 * sesión lee en una tarjeta de salud. Los tres casos que importan son los tres
 * que se pueden escribir mal sin que nada falle: la puntuación sin reseñas, el
 * sello de lo declarado, y las iniciales de un directorio donde todos los
 * nombres empiezan con «Dr.».
 */
describe('mapeador de resultados públicos', () => {
  /** Una fila con los campos que la API sirve de verdad. */
  function fila(parcial: Partial<PublicSearchResult> = {}): PublicSearchResult {
    return {
      kind: 'PRACTITIONER',
      slug: 'dra-quispe',
      displayName: 'Dra. Marisol Quispe Ticona',
      headline: 'Cardióloga · Hospital del Norte',
      city: null,
      avatarUrl: null,
      verified: false,
      ratingAverage: null,
      ratingCount: 0,
      coverUrl: null,
      address: null,
      location: null,
      hasPublishedAgenda: false,
      nextAvailableDate: null,
      ...parcial,
    };
  }

  // ─── Iniciales ─────────────────────────────────────────────────────────────

  it('el tratamiento no aporta inicial', () => {
    // `DM` pondría la misma letra en media pantalla de un directorio médico.
    expect(inicialesDe('Dra. Marisol Quispe Ticona')).toBe('MQ');
    expect(inicialesDe('Dr. Iván Mamani Colque')).toBe('IM');
  });

  it('un nombre sin tratamiento usa sus dos primeras palabras', () => {
    expect(inicialesDe('Farmacia Chávez')).toBe('FC');
  });

  it('un nombre de una sola palabra da una inicial y no falla', () => {
    expect(inicialesDe('Farmacorp')).toBe('F');
  });

  // ─── Puntuación ────────────────────────────────────────────────────────────

  /**
   * `ratingCount: 0` con `ratingAverage: null` es el estado normal de un
   * directorio recién poblado. Pintarlo como «0,0» diría que la atención se
   * calificó mal cuando nadie la calificó.
   */
  it('sin reseñas no hay puntuación', () => {
    expect(puntuacionDe(fila())).toBeNull();
    expect(puntuacionDe(fila({ ratingAverage: 0, ratingCount: 0 }))).toBeNull();
  });

  it('con reseñas, la puntuación va con coma decimal', () => {
    expect(puntuacionDe(fila({ ratingAverage: 4.5, ratingCount: 12 }))).toBe('4,5');
  });

  it('la tarjeta no lleva línea de puntuación cuando no hay reseñas', () => {
    const tarjeta = aTarjeta(fila());

    expect(tarjeta.meta?.some((m) => m.text.includes('reseña'))).toBe(false);
  });

  it('la tarjeta pluraliza las reseñas', () => {
    expect(
      aTarjeta(fila({ ratingAverage: 5, ratingCount: 1 })).meta?.some((m) =>
        m.text.includes('1 reseña'),
      ),
    ).toBe(true);
    expect(
      aTarjeta(fila({ ratingAverage: 4.2, ratingCount: 9 })).meta?.some((m) =>
        m.text.includes('9 reseñas'),
      ),
    ).toBe(true);
  });

  // ─── Verificado y declarado ────────────────────────────────────────────────

  /**
   * La ficha V65 lo pide explícitamente: lo declarado se muestra **rotulado**
   * como declarado, nunca escondido. Una tarjeta sin sello se leería como
   * verificada por omisión.
   */
  it('lo no verificado se rotula «Declarado», no se calla', () => {
    expect(aTarjeta(fila({ verified: false })).seals).toEqual([
      { label: 'Declarado', tone: 'neutro' },
    ]);
  });

  it('lo verificado se rotula «Verificado»', () => {
    expect(aTarjeta(fila({ verified: true })).seals).toEqual([
      { label: 'Verificado', tone: 'ok' },
    ]);
  });

  // ─── Enlaces por vertical ──────────────────────────────────────────────────

  it('cada vertical lleva a su prefijo de ruta corta', () => {
    expect(rutaDeFicha(fila({ kind: 'PRACTITIONER', slug: 'a' }))).toBe('/p/a');
    expect(rutaDeFicha(fila({ kind: 'ORGANIZATION', slug: 'a' }))).toBe('/o/a');
    expect(rutaDeFicha(fila({ kind: 'PHARMACY', slug: 'a' }))).toBe('/f/a');
    expect(rutaDeFicha(fila({ kind: 'DIAGNOSTIC_UNIT', slug: 'a' }))).toBe('/l/a');
    expect(rutaDeFicha(fila({ kind: 'INSURER', slug: 'a' }))).toBe('/s/a');
  });

  /** Un medicamento no es un perfil y no tiene ficha: no puede llevar a `/p/`. */
  it('un medicamento no lleva a una ficha que no existe', () => {
    expect(rutaDeFicha(fila({ kind: 'MEDICATION', slug: 'losartan' }))).toBe('/search/medications');
  });

  // ─── Lo que no se inventa ──────────────────────────────────────────────────

  it('sin foto hay iniciales y no una imagen rota', () => {
    const tarjeta = aTarjeta(fila({ avatarUrl: null }));

    expect(tarjeta.figureImageUrl).toBeUndefined();
    expect(tarjeta.figureText).toBe('MQ');
  });

  it('la ciudad ausente no deja una línea vacía', () => {
    expect(aTarjeta(fila({ city: null })).meta?.every((m) => m.text !== '')).toBe(true);
  });

  it('el identificador distingue dos verticales con el mismo slug', () => {
    // El slug es único por perfil, no entre verticales: sin el tipo, dos filas
    // podrían compartir clave en el `@for` y Angular reusaría el nodo.
    expect(aTarjeta(fila({ kind: 'PHARMACY', slug: 'centro' })).id).not.toBe(
      aTarjeta(fila({ kind: 'ORGANIZATION', slug: 'centro' })).id,
    );
  });
});
