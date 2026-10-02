import type {
  DiagnosticStudy,
  DiagnosticUnitSearchItem,
  DiagnosticUnitSite,
} from '../data-access/diagnostic-units/diagnostic-units.types';
import {
  comparePatientStudiesWithCatalog,
  intersectStudySearchResults,
  type RequestedPatientStudy,
} from './patient-study-comparison';

const SITE_A = 'site-a';
const SITE_B = 'site-b';

const site = (id: string, name = id): DiagnosticUnitSite => ({
  id,
  code: id,
  name,
  role: { code: 'PRIMARY', display: 'Principal' },
  sampleCollectionAvailable: null,
  imagingAvailable: null,
});

const study = (code: string, siteId: string | null): DiagnosticStudy => ({
  id: `${code}-${siteId ?? 'unit'}`,
  code,
  name: code,
  description: null,
  siteId,
  modality: null,
  preparationInstructions: null,
  expectedDurationMinutes: null,
  expectedTurnaroundMinutes: null,
  requiresMedicalOrder: null,
  prices: [],
});

const requested = (code: string | null, name: string): RequestedPatientStudy => ({
  code,
  name,
  preparationInstructions: null,
});

const directoryUnit = (id: string): DiagnosticUnitSearchItem => ({
  id,
  tenantId: `tenant-${id}`,
  code: `unit-${id}`,
  name: `Centro ${id}`,
  type: { code: 'DU_TYPE_IMAGING', display: 'Imagenología' },
  siteCount: 1,
  equipmentCount: 0,
  studyCount: 3,
  acceptsExternalOrders: null,
  walkInAvailable: null,
  homeCollectionAvailable: null,
  rating: null,
  ratingCount: 0,
  minAmount: null,
});

describe('comparación frontend de estudios publicados por centro', () => {
  it('confirma catálogo completo sólo si todos los códigos comparten una sede identificada', () => {
    const result = comparePatientStudiesWithCatalog(
      [requested('US-ABD', 'Ecografía abdominal'), requested('RX-TORAX', 'Radiografía de tórax')],
      [study('US-ABD', SITE_A), study('RX-TORAX', SITE_A)],
      [site(SITE_A, 'Sede Centro')],
    );

    expect(result.status).toBe('complete-at-one-site');
    expect(result.sharedSiteNames).toEqual(['Sede Centro']);
    expect(result.studies.map((item) => item.siteNames)).toEqual([
      ['Sede Centro'],
      ['Sede Centro'],
    ]);
  });

  it('distingue estudios publicados en sedes diferentes de una oferta completa', () => {
    const result = comparePatientStudiesWithCatalog(
      [requested('US-ABD', 'Ecografía abdominal'), requested('RX-TORAX', 'Radiografía de tórax')],
      [study('US-ABD', SITE_A), study('RX-TORAX', SITE_B)],
      [site(SITE_A, 'Sede Norte'), site(SITE_B, 'Sede Sur')],
    );

    expect(result.status).toBe('different-sites');
    expect(result.sharedSiteNames).toEqual([]);
    expect(result.studies.map((item) => item.siteNames)).toEqual([
      ['Sede Norte'],
      ['Sede Sur'],
    ]);
  });

  it('mantiene la cobertura como desconocida si falta el código o la sede publicada', () => {
    const result = comparePatientStudiesWithCatalog(
      [requested(null, 'Estudio sin código'), requested('US-ABD', 'Ecografía abdominal')],
      [study('US-ABD', null)],
      [],
    );

    expect(result.status).toBe('needs-confirmation');
    expect(result.studies.map((item) => item.status)).toEqual([
      'code-unavailable',
      'site-unavailable',
    ]);
  });

  it('no confirma un paquete completo cuando otro estudio pedido no tiene código', () => {
    const result = comparePatientStudiesWithCatalog(
      [requested('US-ABD', 'Ecografía abdominal'), requested(null, 'Estudio sin código')],
      [study('US-ABD', SITE_A)],
      [site(SITE_A, 'Sede Centro')],
    );

    expect(result.status).toBe('needs-confirmation');
  });
});

describe('intersección de centros por código pedido', () => {
  it('conserva sólo los centros devueltos por todas las búsquedas y respeta el orden inicial', () => {
    const result = intersectStudySearchResults([
      [directoryUnit('a'), directoryUnit('b')],
      [directoryUnit('b'), directoryUnit('a')],
      [directoryUnit('a')],
    ]);

    expect(result.map((unit) => unit.id)).toEqual(['a']);
  });

  it('no llama completo a un conjunto vacío de búsquedas', () => {
    expect(intersectStudySearchResults([])).toEqual([]);
  });
});
