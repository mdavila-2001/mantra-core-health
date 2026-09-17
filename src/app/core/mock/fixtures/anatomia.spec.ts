import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ENTRADAS,
  coincideAnatomia,
  entradaEnLinea,
  entradaPorId,
  entradaPorSlug,
  fichaAnatomicaEnLinea,
} from './anatomia';
import {
  DEFINICIONES_DE_TIPO,
  ENTRADAS_ANATOMICAS,
  LAMINAS_ANATOMICAS,
  REGIONES_ANATOMICAS,
  SUBREGIONES_ANATOMICAS,
} from './anatomia.generated';

/* ============================================================================
    La taxonomía anatómica del simulador sale de `data/netter-anatomia/`, y esta
    prueba es lo que impide que se separen — el mismo guardián que tiene el
    corpus de Bolivia.

    Pero acá hay algo más que contar registros. El corpus **no publica una
    definición por entrada**, y este archivo también vigila eso: que el texto
    que la maqueta muestra diga de quién es, y que nada complete lo que el Atlas
    no dice. Un glosario médico que inventa anatomía es peor que uno vacío.
    ========================================================================== */

const CORPUS = join(process.cwd(), 'data', 'netter-anatomia');

function leer<T>(nombre: string): T {
  return JSON.parse(readFileSync(join(CORPUS, `${nombre}.json`), 'utf8')) as T;
}

describe('la taxonomía anatómica de Netter portada al simulador', () => {
  it('trae tantos registros como declara su propio manifiesto', () => {
    const { counts } = leer<{ counts: Record<string, number> }>('manifest');

    expect(REGIONES_ANATOMICAS).toHaveLength(counts['regions']!);
    expect(SUBREGIONES_ANATOMICAS).toHaveLength(counts['subregions']!);
    expect(LAMINAS_ANATOMICAS).toHaveLength(counts['plates']!);
    expect(ENTRADAS_ANATOMICAS).toHaveLength(counts['entities']!);
    expect(DEFINICIONES_DE_TIPO).toHaveLength(counts['types']!);
  });

  it('no pierde ninguna entrada al indexarlas', () => {
    expect(ENTRADAS).toHaveLength(ENTRADAS_ANATOMICAS.length);
    expect(new Set(ENTRADAS.map((e) => e.id)).size).toBe(ENTRADAS.length);
    expect(new Set(ENTRADAS.map((e) => e.slug)).size).toBe(ENTRADAS.length);
  });

  it('cuelga cada subregión y cada lámina de algo que existe', () => {
    const regiones = new Set(REGIONES_ANATOMICAS.map((r) => r.id));
    const subregiones = new Set(SUBREGIONES_ANATOMICAS.map((s) => s.id));

    for (const subregion of SUBREGIONES_ANATOMICAS) {
      expect(regiones).toContain(subregion.regionId);
    }
    for (const lamina of LAMINAS_ANATOMICAS) {
      if (lamina.regionId !== null) expect(regiones).toContain(lamina.regionId);
      if (lamina.subregionId !== null) expect(subregiones).toContain(lamina.subregionId);
    }
  });

  it('mantiene las 548 láminas dentro del rango canónico del Atlas', () => {
    for (const lamina of LAMINAS_ANATOMICAS) {
      expect(lamina.plate).toBeGreaterThanOrEqual(1);
      expect(lamina.plate).toBeLessThanOrEqual(548);
    }
    for (const entrada of ENTRADAS_ANATOMICAS) {
      for (const plate of entrada.plates) {
        expect(plate).toBeGreaterThanOrEqual(1);
        expect(plate).toBeLessThanOrEqual(548);
      }
    }
  });

  it('resuelve una entrada por su identificador y por su slug', () => {
    const alguna = ENTRADAS[0]!;
    expect(entradaPorId(alguna.id)).toBe(alguna);
    expect(entradaPorSlug(alguna.slug)).toBe(alguna);
    expect(entradaPorId('no-existe')).toBeUndefined();
  });

  it('publica la entrada dentro de la categoría Anatomía del glosario', () => {
    const enLinea = entradaEnLinea(ENTRADAS[0]!);
    expect(enLinea.category.internalCode).toBe('glossary-category-anatomy');
    expect(enLinea.valueSets.map((v) => v.internalCode)).toContain('glossary-category-anatomy');
    expect(enLinea.code.startsWith('NETTER_')).toBe(true);
  });

  /* ---- los candados contra inventar anatomía ----------------------------- */

  it('dice que la definición es del TIPO y no de la entrada', () => {
    // Si alguien «mejora» el texto quitándole el rótulo, la maqueta pasaría a
    // afirmar que ésa es la definición de esta estructura. No la tiene.
    const conTipoConocido = ENTRADAS.find((e) => e.type === 'musculo')!;
    const ficha = fichaAnatomicaEnLinea(conTipoConocido);

    expect(ficha.clinicalDefinition.text).toContain('Qué es un «musculo»');
    expect(ficha.clinicalDefinition.text).toContain('no de');
    expect(ficha.clinicalDefinition.text).toContain(conTipoConocido.name);
  });

  it('no inventa sinónimos ni relaciones entre estructuras', () => {
    // El corpus lo prohíbe: compartir lámina es representación, no causalidad.
    for (const entrada of ENTRADAS.slice(0, 50)) {
      const ficha = fichaAnatomicaEnLinea(entrada);
      expect(ficha.synonyms).toHaveLength(0);
      expect(ficha.relations).toHaveLength(0);
    }
  });

  it('conserva la forma fuente del término, sin corregirla', () => {
    const conForma = ENTRADAS.find((e) => e.name.includes('('))!;
    const ficha = fichaAnatomicaEnLinea(conForma);
    expect(ficha.properties.source_form).toBe(conForma.name);
  });

  it('declara de dónde salió el nombre y con cuánto acuerdo de OCR', () => {
    const ficha = fichaAnatomicaEnLinea(ENTRADAS[0]!);
    expect(ficha.properties.provenance).toContain('OCR');
    expect(ficha.properties.provenance).toContain('revisión humana');
  });

  it('sólo usa los tres niveles de confianza que el corpus declara', () => {
    const conocidos = new Set(['consensus_high', 'consensus_medium', 'new_ocr_only']);
    for (const entrada of ENTRADAS_ANATOMICAS) {
      expect(conocidos).toContain(entrada.confidence);
    }
  });

  it('no trae ninguna definición por entrada: son las 27 de los tipos', () => {
    // El fixture pesaría 5,7 MB si las trajera. Que no aparezca un campo
    // `definition` en las entradas es lo que lo mantiene en 1 MB.
    for (const entrada of ENTRADAS_ANATOMICAS.slice(0, 100)) {
      expect(entrada).not.toHaveProperty('definition');
    }
    expect(new Set(DEFINICIONES_DE_TIPO.map((d) => d.definition)).size).toBe(
      DEFINICIONES_DE_TIPO.length,
    );
  });

  it('encuentra una entrada por nombre, por tipo y por región', () => {
    const entrada = ENTRADAS.find((e) => e.region === 'Tórax' && e.type === 'musculo')!;
    expect(coincideAnatomia(entrada, entrada.name.slice(0, 6).toLowerCase())).toBe(true);
    expect(coincideAnatomia(entrada, 'musculo')).toBe(true);
    expect(coincideAnatomia(entrada, 'tórax')).toBe(true);
    expect(coincideAnatomia(entrada, 'zzzz-no-existe')).toBe(false);
  });
});
