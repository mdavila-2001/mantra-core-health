import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { FICHAS_ESTANDAR } from './fichas-estandar.generated';
import { PLANTILLAS_DE_EXPEDIENTE } from '../handlers/clinical.handlers';

/**
 * Las fichas del simulador salen del backend, y esta prueba es lo que impide
 * que se separen.
 *
 * El defecto que evita ya ocurrió: el simulador servía **cuatro** plantillas
 * escritas a mano con códigos que no coincidían con los del catálogo sembrado
 * —`CARDIO-BASE` contra `CARDIO_FICHA_BASE`—, así que el selector de
 * «Formulario clínico» estaba vacío para casi toda especialidad. Es la misma
 * clase de defecto que ya mordió con los departamentos, las especialidades y
 * las ocupaciones: el simulador inventando códigos que las pantallas no
 * reconocen.
 *
 * Si alguien agrega una ficha al backend y no corre `yarn mock:chart-templates`,
 * el conteo deja de cuadrar y esta prueba lo dice.
 */
describe('las fichas clínicas estándar del simulador', () => {
  /** Los JSON del backend, contados desde el disco. */
  function fichasDelBackend(): readonly string[] {
    const raiz = join(
      process.cwd(),
      '..',
      'mantra-core-health-api',
      'src',
      'common',
      'seed',
      'data',
      'clinical-forms',
    );
    return readdirSync(raiz, { withFileTypes: true })
      .filter((entrada) => entrada.isDirectory())
      .flatMap((carpeta) =>
        readdirSync(join(raiz, carpeta.name))
          .filter((archivo) => archivo.endsWith('.json'))
          .map((archivo) => join(carpeta.name, archivo)),
      );
  }

  it('son tantas como los JSON que siembra el backend', () => {
    expect(FICHAS_ESTANDAR.length).toBe(fichasDelBackend().length);
  });

  it('cada ficha llega al catálogo que sirve `GET /charts/templates`', () => {
    expect(PLANTILLAS_DE_EXPEDIENTE.length).toBe(FICHAS_ESTANDAR.length);
    const codigos = new Set(PLANTILLAS_DE_EXPEDIENTE.map((p) => p.code));
    for (const ficha of FICHAS_ESTANDAR) {
      expect(codigos.has(ficha.code)).toBe(true);
    }
  });

  it('ninguna queda sin campos ni sin nombre', () => {
    for (const ficha of FICHAS_ESTANDAR) {
      expect(ficha.name.length).toBeGreaterThan(0);
      expect(ficha.fields.length).toBeGreaterThan(0);
    }
  });

  /**
   * La procedencia es el dato que distingue una ficha estándar de una
   * inventada. El catálogo del backend la exige por norma; acá se comprueba que
   * el porte no la perdió.
   */
  it('conservan su procedencia: norma, organismo y URL', () => {
    for (const ficha of FICHAS_ESTANDAR) {
      expect(ficha.provenance?.sourceTitle?.length ?? 0).toBeGreaterThan(0);
      expect(ficha.provenance?.organization?.length ?? 0).toBeGreaterThan(0);
      expect(ficha.provenance?.url ?? '').toMatch(/^https?:\/\//);
    }
  });

  /**
   * Las cuatro transversales comparten un concepto que **no** es una
   * especialidad: es lo que el bloque clínico usa para dejarlas siempre a mano,
   * y lo reconoce por el prefijo de su código.
   */
  it('las transversales comparten un concepto propio, distinto de toda especialidad', () => {
    const transversales = PLANTILLAS_DE_EXPEDIENTE.filter((p) => p.code.startsWith('TRANSV_'));
    expect(transversales.length).toBe(4);
    const conceptos = new Set(transversales.map((p) => p.specialtyConceptId));
    expect(conceptos.size).toBe(1);

    const deEspecialidad = PLANTILLAS_DE_EXPEDIENTE.filter((p) => !p.code.startsWith('TRANSV_'));
    for (const plantilla of deEspecialidad) {
      expect(plantilla.specialtyConceptId).not.toBe([...conceptos][0]);
    }
  });

  /** Odontología trae dos, y una de ellas es el odontograma. */
  it('odontología trae su anamnesis y su odontograma', () => {
    const odonto = PLANTILLAS_DE_EXPEDIENTE.filter((p) => p.code.startsWith('ODONTO_'));
    expect(odonto.map((p) => p.code).sort()).toEqual([
      'ODONTO_ANAMNESIS',
      'ODONTO_ODONTOGRAMA_OMS',
    ]);
  });
});
