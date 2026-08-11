import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ESTADOS_DE_CASO, resolverEstadosDeCaso } from '../../../testing/case-status';
import {
  CaseStatusCatalog,
  resetCaseStatusCatalog,
  toCaseStatusPresentation,
} from './case-status';

/**
 * Lo que estas pruebas fijan: que el estado de un caso se resuelve **contra
 * terminología** y no contra un mapa de UUID escritos a mano, que hasta que el
 * catálogo llega todo se ve en neutro en vez de romperse, y que las nueve
 * frases que ve el titular del trámite son las que decidió la interfaz —el
 * catálogo las trae en inglés, que es terminología técnica y no copy.
 */
describe('Estados de un caso de verificación', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    // El catálogo vive en una señal de módulo, así que **sobrevive a otros
    // specs**: si uno anterior lo resolvió, el servicio de acá no vuelve a
    // pedirlo y la prueba de «se pide una sola vez» ve cero peticiones. Se
    // arranca de un estado conocido para que el resultado no dependa del orden
    // en que vitest recorrió los archivos.
    resetCaseStatusCatalog();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('sin estado, o con uno que el catálogo no trae, degrada a neutro sin lanzar', () => {
    const neutro = { variant: 'unknown', label: 'Desconocido' };

    expect(toCaseStatusPresentation(undefined)).toEqual(neutro);
    expect(toCaseStatusPresentation(null)).toEqual(neutro);
    expect(toCaseStatusPresentation('00000000-0000-0000-0000-000000000000')).toEqual(neutro);
  });

  it('el catálogo se pide una sola vez aunque lo inyecten varias pantallas', () => {
    TestBed.inject(CaseStatusCatalog);

    const peticiones = http.match((p) => p.url.includes('/terminology/concepts'));
    expect(peticiones.length).toBe(1);
    expect(peticiones[0]?.request.method).toBe('GET');
    // Se piden por prefijo de código, que es lo que agrupa a los nueve.
    expect(peticiones[0]?.request.params.get('q')).toBe('identity_assurance:CASE_');

    peticiones[0]?.flush({ items: [], count: 0, limit: 50 });
  });

  it('resuelto el catálogo, cada estado se traduce a su variante y su palabra', () => {
    TestBed.inject(CaseStatusCatalog);
    resolverEstadosDeCaso(http);

    const esperado: readonly [string, string, string][] = [
      [ESTADOS_DE_CASO.CASE_OPEN, 'pending', 'Pendiente'],
      [ESTADOS_DE_CASO.CASE_IN_VERIFICATION, 'in-review', 'En revisión'],
      // A la persona verificada no se le revela la marca de riesgo: para ella
      // el caso sigue «en revisión».
      [ESTADOS_DE_CASO.CASE_AT_RISK, 'in-review', 'En revisión'],
      [ESTADOS_DE_CASO.CASE_MANUAL_REVIEW, 'in-review', 'En revisión'],
      [ESTADOS_DE_CASO.CASE_VERIFIED, 'approved', 'Aprobado'],
      [ESTADOS_DE_CASO.CASE_ASSERTED, 'approved', 'Aprobado'],
      [ESTADOS_DE_CASO.CASE_REJECTED, 'rejected', 'Rechazado'],
      [ESTADOS_DE_CASO.CASE_REVOKED, 'rejected', 'Revocado'],
      [ESTADOS_DE_CASO.CASE_EXPIRED, 'expired', 'Vencido'],
    ];

    for (const [conceptId, variant, label] of esperado) {
      expect(toCaseStatusPresentation(conceptId)).toEqual({ variant, label });
    }
  });

  it('un concepto del catálogo que la interfaz no sabe pintar queda en neutro', () => {
    TestBed.inject(CaseStatusCatalog);

    // El día que `identity_assurance` agregue un estado, llega en la respuesta
    // y esta versión no tiene frase para él: neutro, no una pantalla rota.
    http.match((p) => p.url.includes('/terminology/concepts'))[0]?.flush({
      items: [
        {
          conceptId: 'c0ffee00-0000-5000-8000-000000000000',
          code: 'identity_assurance:CASE_INVENTADO',
          display: 'Case invented',
          codeSystemVersionId: 'csv-terminologia',
        },
      ],
      count: 1,
      limit: 50,
    });

    expect(toCaseStatusPresentation('c0ffee00-0000-5000-8000-000000000000')).toEqual({
      variant: 'unknown',
      label: 'Desconocido',
    });
  });
});
