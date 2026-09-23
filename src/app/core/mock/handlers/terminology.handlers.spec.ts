import { HttpHeaders } from '@angular/common/http';

import { registrarTerminologia } from './terminology.handlers';
import { MEDICAMENTO } from '../fixtures/conceptos';
import { valorDeTexto } from '../../data-access/terminology/terminology.types';
import { MockRouter, type MockMethod } from '../mock-router';

/**
 * H4 (C-20) — la frecuencia por defecto de un medicamento viaja en
 * `properties.default_frequency`, sólo en la ficha (`GET
 * /terminology/concepts/:id`), nunca en la lista/búsqueda. Contrato real
 * citado: `search-concepts.dto.ts` (`properties: Record<string, unknown>`,
 * "va sólo en la ficha, no en la búsqueda").
 */
describe('handlers de terminología: propiedades de concepto (frecuencia por defecto)', () => {
  const router = new MockRouter();
  registrarTerminologia(router);

  function call<T>(method: MockMethod, path: string, query = new URLSearchParams()): T {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query,
      body: null,
      headers: new HttpHeaders(),
      user: null,
    }) as T;
  }

  it('la ficha de un medicamento CON la propiedad la trae, legible con valorDeTexto', () => {
    const ficha = call<{ properties: Readonly<Record<string, unknown>> }>(
      'GET',
      `/terminology/concepts/${MEDICAMENTO['MED-PARACETAMOL']}`,
    );
    expect(valorDeTexto(ficha.properties, 'default_frequency')).toBe(
      'Cada 8 horas — dato sintético de desarrollo, no apto para uso clínico',
    );
  });

  it('la ficha de un medicamento SIN la propiedad no la trae, y la lectura defensiva no rompe', () => {
    const ficha = call<{ properties: Readonly<Record<string, unknown>> }>(
      'GET',
      `/terminology/concepts/${MEDICAMENTO['MED-LOSARTAN']}`,
    );
    expect(ficha.properties['default_frequency']).toBeUndefined();
    expect(valorDeTexto(ficha.properties, 'default_frequency')).toBeUndefined();
  });

  it('inválido — un value_json mal formado (número) se lee como ausente, sin lanzar', () => {
    const ficha = call<{ properties: Readonly<Record<string, unknown>> }>(
      'GET',
      `/terminology/concepts/${MEDICAMENTO['MED-INSULINA-NPH']}`,
    );
    expect(ficha.properties['default_frequency']).toBe(42); // el dato crudo sigue ahí, mal formado a propósito
    expect(() => valorDeTexto(ficha.properties, 'default_frequency')).not.toThrow();
    expect(valorDeTexto(ficha.properties, 'default_frequency')).toBeUndefined();
  });

  it('la lista/búsqueda de conceptos NO trae `properties` — sólo la ficha, como en el contrato real', () => {
    const { items } = call<{ items: readonly Record<string, unknown>[] }>(
      'GET',
      '/terminology/concepts',
      new URLSearchParams({ ids: MEDICAMENTO['MED-PARACETAMOL']! }),
    );
    expect(items).toHaveLength(1);
    expect(Object.keys(items[0]!)).not.toContain('properties');
  });
});
