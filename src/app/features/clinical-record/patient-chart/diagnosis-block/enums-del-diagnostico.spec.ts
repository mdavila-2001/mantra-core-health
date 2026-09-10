import { HttpHeaders } from '@angular/common/http';

import { registrarVarios } from '../../../../core/mock/handlers/misc.handlers';
import { MockRouter } from '../../../../core/mock/mock-router';
import {
  TARGET_CATEGORIA,
  TARGET_CURSO_CLINICO,
  TARGET_DIAGNOSTICO,
  TARGET_LATERALIDAD,
  TARGET_SEVERIDAD,
} from './diagnosis-block';

/**
 * Cada `target` que una pantalla clínica pide tiene que resolver a **su**
 * conjunto de valores.
 *
 * Vive con la pantalla y no con el simulador porque cruza las dos capas, y
 * `core/` nunca importa de `features/` (`check-architecture.mjs`).
 *
 * El defecto que esto impide ya ocurrió: `misc.handlers.ts` resuelve el target
 * por expresión regular contra una tabla, y los cuatro catálogos del
 * diagnóstico no estaban. Caían en el default —`VS_RECORD_STATUS`— así que el
 * selector de «Curso clínico» ofrecía **Activo/Archivado**: «Crónico» no
 * existía en la maqueta, y el cliente lo pidió por nombre.
 *
 * Es la misma clase de defecto que ya mordió con los departamentos, las
 * especialidades y las ocupaciones: el simulador contestando otra cosa que la
 * que la pantalla pide.
 */
describe('los enums dinámicos de las pantallas clínicas', () => {
  const router = new MockRouter();
  registrarVarios(router);

  function enumDe(target: string): { name: string; options: readonly { code: string }[] } {
    const ruta = '/system-context/dynamic-enums';
    const encontrada = router.match('GET', ruta);
    if (encontrada === null) throw new Error(`El simulador no registra ${ruta}`);
    return encontrada.handler({
      method: 'GET',
      path: ruta,
      params: {},
      query: new URLSearchParams({ target }),
      body: null,
      headers: new HttpHeaders(),
      user: null,
    }) as { name: string; options: readonly { code: string }[] };
  }

  it('el curso clínico ofrece el crónico, no los estados del registro', () => {
    const curso = enumDe(TARGET_CURSO_CLINICO);
    expect(curso.name).toBe('Curso clínico');
    expect(curso.options.map((o) => o.code)).toContain('COND_COURSE_CHRONIC');
  });

  it('la categoría del diagnóstico distingue encuentro de problema de la lista', () => {
    const codigos = enumDe(TARGET_CATEGORIA).options.map((o) => o.code);
    expect(codigos).toEqual(['COND_DIAGNOSIS', 'COND_PROBLEM']);
  });

  it('la lateralidad ofrece los tres lados', () => {
    const codigos = enumDe(TARGET_LATERALIDAD).options.map((o) => o.code);
    expect(codigos).toEqual(['COND_LAT_LEFT', 'COND_LAT_RIGHT', 'COND_LAT_BILATERAL']);
  });

  /**
   * El candado: ninguno de los targets que el bloque de diagnóstico pide puede
   * caer en el conjunto por omisión. Si alguien agrega un `target` nuevo a la
   * pantalla y olvida su entrada en la tabla, esto lo dice.
   */
  it('ningún target del diagnóstico cae en el conjunto por omisión', () => {
    for (const target of [
      TARGET_DIAGNOSTICO,
      TARGET_CATEGORIA,
      TARGET_SEVERIDAD,
      TARGET_LATERALIDAD,
      TARGET_CURSO_CLINICO,
    ]) {
      expect(enumDe(target).name).not.toBe('Estado');
    }
  });
});
