import { HttpHeaders } from '@angular/common/http';

import { ESTUDIO, ORDER_CATEGORY } from '../fixtures/concepts';
import { MockRouter, type MockReply } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { searchByCoverage } from './diagnostic-coverage.handlers';
import { registrarDiagnostico } from './diagnostics.handlers';

/**
 * `GET /diagnostic-units/search` con `studyConceptIds`: la búsqueda por
 * cobertura que usa «Dónde conseguir lo de mi receta». Lo que fijan estas
 * pruebas es el contrato de `DiagnosticUnitCoveragePage`: los campos de
 * cobertura, el orden (completos primero, después por distancia) y que sin
 * `studyConceptIds` la respuesta sea la del directorio, sin esos campos.
 */
describe('GET /diagnostic-units/search con studyConceptIds', () => {
  const router = new MockRouter();
  registrarDiagnostico(router);

  const ECO = ESTUDIO['STUDY-ECO-ABD']!;
  const ECG = ESTUDIO['STUDY-ECG']!;
  const HEMOGRAM = ESTUDIO['STUDY-HEMOGRAMA']!;

  interface CoverageWire {
    readonly name: string;
    readonly kind?: unknown;
    readonly complete: boolean;
    readonly missingStudyConceptIds: readonly string[];
    readonly distanceKm: number | null;
    readonly addressText: string | null;
    readonly latitude: number | null;
    readonly longitude: number | null;
  }

  interface PageWire {
    readonly items: readonly CoverageWire[];
    readonly total: number;
    readonly limit: number;
    readonly offset: number;
  }

  function call(
    path: string,
    query: Record<string, string>,
    user = buscarUsuario('paciente') ?? null,
  ): unknown {
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    return match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body: undefined,
      headers: new HttpHeaders(),
      user,
    });
  }

  function search(query: Record<string, string>): PageWire {
    return call('/diagnostic-units/search', query) as PageWire;
  }

  const SANTA_CRUZ_CENTER = { lat: '-17.7833', lng: '-63.1821' };
  const IMAGING = { kind: 'IMAGING' };

  it('aceptado: cada centro trae complete, faltantes, distancia, dirección y coordenadas', () => {
    const { items, total } = search({
      ...IMAGING,
      studyConceptIds: `${ECO},${ECG}`,
      ...SANTA_CRUZ_CENTER,
    });

    expect(items.length).toBeGreaterThan(0);
    expect(total).toBe(items.length);
    for (const item of items) {
      expect(typeof item.complete).toBe('boolean');
      expect(item.complete).toBe(item.missingStudyConceptIds.length === 0);
      for (const field of ['distanceKm', 'addressText', 'latitude', 'longitude']) {
        expect(item).toHaveProperty(field);
      }
    }
  });

  describe('con unidades propias del test (centros completos y parciales)', () => {
    interface TestUnit {
      readonly code: string;
      readonly kind: string;
      readonly name: string;
      readonly offers: readonly string[];
      readonly lat: number | null;
    }

    const units: readonly TestUnit[] = [
      { code: 'FAR-PARTIAL', kind: 'IMAGING', name: 'Parcial cercano', offers: [ECO], lat: -17.78 },
      {
        code: 'FAR-COMPLETE',
        kind: 'IMAGING',
        name: 'Completo lejano',
        offers: [ECO, ECG],
        lat: -17.9,
      },
      {
        code: 'NO-SITE',
        kind: 'IMAGING',
        name: 'Completo sin sede',
        offers: [ECO, ECG],
        lat: null,
      },
      { code: 'NONE', kind: 'IMAGING', name: 'No ofrece nada', offers: [HEMOGRAM], lat: -17.78 },
    ];

    function searchUnits(query: Record<string, string>) {
      return searchByCoverage(new URLSearchParams(query), units, {
        card: (unit) => ({ name: unit.name }),
        studies: (unit) => unit.offers.map((conceptId) => ({ conceptId })),
        sites: (unit) =>
          unit.lat === null
            ? []
            : [{ latitude: unit.lat, longitude: -63.18, addressText: unit.name }],
      }) as PageWire;
    }

    it('aceptado: separa completos de parciales y nombra lo que falta', () => {
      const { items } = searchUnits({ studyConceptIds: `${ECO},${ECG}` });

      expect(items.map((item) => [item.name, item.complete])).toEqual([
        ['Completo lejano', true],
        ['Completo sin sede', true],
        ['Parcial cercano', false],
      ]);
      expect(items[2]!.missingStudyConceptIds).toEqual([ECG]);
      expect(items[0]!.missingStudyConceptIds).toEqual([]);
    });

    it('aceptado: completos primero aunque el parcial esté más cerca; sin sede al final de su grupo', () => {
      const { items } = searchUnits({
        studyConceptIds: `${ECO},${ECG}`,
        lat: '-17.78',
        lng: '-63.18',
      });

      expect(items.map((item) => item.name)).toEqual([
        'Completo lejano',
        'Completo sin sede',
        'Parcial cercano',
      ]);
      expect(items[0]!.distanceKm).not.toBeNull();
      expect(items[1]!.distanceKm).toBeNull();
      expect(items[1]!.latitude).toBeNull();
    });
  });

  it('aceptado: con origen, dentro de cada grupo van del más cercano al más lejano y sin distancia al final', () => {
    const { items } = search({ ...IMAGING, studyConceptIds: ECO, ...SANTA_CRUZ_CENTER });

    const withDistance = items.filter((item) => item.distanceKm !== null);
    expect(withDistance.length).toBeGreaterThan(1);
    const distances = withDistance.map((item) => item.distanceKm!);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    const firstWithout = items.findIndex((item) => item.distanceKm === null);
    if (firstWithout !== -1) {
      expect(items.slice(firstWithout).every((item) => item.distanceKm === null)).toBe(true);
    }
  });

  it('aceptado: sin origen, distanceKm es null en todos', () => {
    const { items } = search({ ...IMAGING, studyConceptIds: ECO });

    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.distanceKm === null)).toBe(true);
  });

  it('aceptado: la distancia lleva un decimal y sale de las coordenadas de la sede', () => {
    const { items } = search({ ...IMAGING, studyConceptIds: ECO, ...SANTA_CRUZ_CENTER });

    for (const item of items.filter((i) => i.distanceKm !== null)) {
      expect(item.latitude).not.toBeNull();
      expect(item.longitude).not.toBeNull();
      expect(item.distanceKm).toBe(Math.round(item.distanceKm! * 10) / 10);
    }
  });

  it('aceptado: no entran los centros que no ofrecen ninguno de los estudios pedidos', () => {
    const { items } = search({ ...IMAGING, studyConceptIds: HEMOGRAM });

    expect(items).toEqual([]);
  });

  it('aceptado: el tipo de centro acota la búsqueda', () => {
    const { items } = search({ kind: 'LABORATORY', studyConceptIds: HEMOGRAM });

    expect(items.length).toBeGreaterThan(0);
    const imaging = search({ ...IMAGING, studyConceptIds: HEMOGRAM });
    expect(imaging.items.length).toBe(0);
  });

  it('aceptado: limit y offset paginan sobre el total ya ordenado', () => {
    const all = search({ ...IMAGING, studyConceptIds: ECO });
    const page = search({ ...IMAGING, studyConceptIds: ECO, limit: '1', offset: '1' });

    expect(page.total).toBe(all.total);
    expect(page.limit).toBe(1);
    expect(page.offset).toBe(1);
    expect(page.items.map((item) => item.name)).toEqual([all.items[1]!.name]);
  });

  it('rechazado: lat sin lng devuelve 400', () => {
    const response = call('/diagnostic-units/search', {
      studyConceptIds: ECO,
      lat: '-17.78',
    }) as MockReply;

    expect(response.status).toBe(400);
  });

  it('rechazado: studyConceptIds vacío o con más de 50 estudios devuelve 400', () => {
    const empty = call('/diagnostic-units/search', { studyConceptIds: '' }) as MockReply;
    const tooMany = call('/diagnostic-units/search', {
      studyConceptIds: Array.from({ length: 51 }, (_, i) => `concept-${i}`).join(','),
    }) as MockReply;

    expect(empty.status).toBe(400);
    expect(tooMany.status).toBe(400);
  });

  it('sin studyConceptIds sigue siendo el directorio, sin campos de cobertura', () => {
    const { items } = search({ ...IMAGING });

    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect('complete' in item).toBe(false);
      expect('missingStudyConceptIds' in item).toBe(false);
      expect('distanceKm' in item).toBe(false);
    }
  });

  describe('con las órdenes de imagenología del paciente simulado', () => {
    interface OrderWire {
      readonly codeConceptId: string;
      readonly categoryConceptId: string;
      readonly hasReleasedResult: boolean;
    }

    function pendingImagingConcepts(): readonly string[] {
      const { items } = call('/diagnostic-results/me/orders', {}) as { items: OrderWire[] };
      return items
        .filter((order) => !order.hasReleasedResult)
        .filter(
          (order) =>
            order.categoryConceptId === ORDER_CATEGORY['SRQ-IMAGING'] ||
            order.codeConceptId === ECG,
        )
        .map((order) => order.codeConceptId);
    }

    it('aceptado: con su único estudio de imagen pendiente, todos los centros que lo ofrecen quedan completos', () => {
      const concepts = pendingImagingConcepts();
      expect(concepts).toEqual([ECO]);

      const { items } = search({
        ...IMAGING,
        studyConceptIds: concepts.join(','),
        ...SANTA_CRUZ_CENTER,
      });

      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.complete)).toBe(true);
    });
  });
});
