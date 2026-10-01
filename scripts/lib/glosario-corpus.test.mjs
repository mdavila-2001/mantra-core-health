/* ============================================================================
    Pruebas de `duplicadosEnIngles()`: la regla con la que el generador del
    glosario descarta la fila en inglés de un concepto que ya está escrito en
    castellano con el mismo código.

    Un bloque usa filas de prueba —para fijar la regla sin depender de los
    datos— y otro lee las capas REALES de `data/glossary/`: si alguien agrega
    otra enfermedad con el código exacto de una categoría ICD, la lista cambia y
    esta prueba tiene que cambiar con ella.

    Uso:  corepack yarn node --test scripts/lib/glosario-corpus.test.mjs
    ========================================================================== */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { duplicadosEnIngles, leerCapas } from './glosario-corpus.mjs';

const capa = (nombre, filas) => ({ nombre, filas, problemas: [] });

describe('duplicadosEnIngles', () => {
  it('descarta la fila en inglés cuyo sistema y código ya están en castellano', () => {
    const descartados = duplicadosEnIngles([
      capa('es', [
        { slug: 'hipertension', code: 'I10', codeSystem: 'icd10cm', lang: 'es' },
      ]),
      capa('en', [
        { slug: 'icd10cm-i10', code: 'I10', codeSystem: 'icd10cm', lang: 'en' },
        { slug: 'icd10cm-i11', code: 'I11', codeSystem: 'icd10cm', lang: 'en' },
      ]),
    ]);

    assert.deepEqual([...descartados], [['icd10cm-i10', 'I10']]);
  });

  it('un código más específico en castellano no descarta la categoría amplia', () => {
    // `R50.9` «Fiebre sin foco» no es lo mismo que `R50` «Fever of other and
    // unknown origin»: la categoría queda.
    const descartados = duplicadosEnIngles([
      capa('es', [{ slug: 'fiebre-sin-foco', code: 'R50.9', codeSystem: 'icd10cm', lang: 'es' }]),
      capa('en', [{ slug: 'icd10cm-r50', code: 'R50', codeSystem: 'icd10cm', lang: 'en' }]),
    ]);

    assert.equal(descartados.size, 0);
  });

  it('el mismo código en otro sistema no es el mismo concepto', () => {
    const descartados = duplicadosEnIngles([
      capa('es', [{ slug: 'algo', code: 'X1', codeSystem: 'loinc', lang: 'es' }]),
      capa('en', [{ slug: 'icd10cm-x1', code: 'X1', codeSystem: 'icd10cm', lang: 'en' }]),
    ]);

    assert.equal(descartados.size, 0);
  });

  it('nunca descarta una fila en castellano, aunque su código se repita', () => {
    const descartados = duplicadosEnIngles([
      capa('es', [
        { slug: 'a', code: 'J00', codeSystem: 'icd10cm', lang: 'es' },
        { slug: 'b', code: 'J00', codeSystem: 'icd10cm', lang: 'es' },
      ]),
    ]);

    assert.equal(descartados.size, 0);
  });

  it('sobre las capas reales descarta exactamente los 14 conceptos repetidos', () => {
    const descartados = duplicadosEnIngles(leerCapas());

    assert.deepEqual(
      [...descartados.values()].sort(),
      ['A09', 'A90', 'B20', 'B86', 'C61', 'C73', 'E46', 'I10', 'J00', 'J90', 'L22', 'N10', 'R32', 'R55'],
    );
    for (const [slug, codigo] of descartados) {
      assert.equal(slug, `icd10cm-${codigo.toLowerCase()}`);
    }
  });
});
