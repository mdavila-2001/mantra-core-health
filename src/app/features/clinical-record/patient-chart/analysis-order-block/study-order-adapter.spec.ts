import type { DiagnosticOrder } from '../../../../core/data-access/diagnostics/diagnostics.types';
import type { StudyCatalogDetail, StudyCatalogItem } from '../../../../core/data-access/study-catalog/study-catalog.types';
import { detalleDeLaOrden } from './analysis-order-block.helpers';
import {
  buildImagingCatalog,
  categoryOfFamily,
  leafComponents,
  requisitionFieldError,
  toLabAnalysis,
} from './study-order-adapter';

const ITEM = {
  conceptId: 'img-1',
  code: 'RX_MANO',
  display: 'Radiografía de mano',
  family: 'IMAGING',
  componentsSelectable: false,
  componentCount: 0,
  modalityConceptId: 'mod-rx',
  bodySiteConceptId: 'reg-mano',
} as unknown as StudyCatalogItem;

const DETALLE = {
  allowedModalities: [{ conceptId: 'mod-rx', code: 'RX', display: 'Radiografía', isDefault: true }],
  allowedBodySites: [
    { conceptId: 'reg-mano', code: 'MANO', display: 'Mano', parentConceptId: 'reg-ms', regionType: null, admitsLaterality: true, isDefault: true },
    { conceptId: 'reg-ms', code: 'MIEMBRO_SUPERIOR', display: 'Miembro superior', parentConceptId: null, regionType: 'grupo', admitsLaterality: false, isDefault: false },
  ],
  lateralityOptions: [{ conceptId: 'lat-izq', code: 'IZQ', display: 'Izquierda', isDefault: false }],
  contrastOptions: [{ conceptId: 'ctr-sin', code: 'SIN', display: 'Sin contraste', isDefault: true }],
  imaging: { requiresLaterality: true, contrast: 'sin', projections: ['PA'], contrastRoute: null, preparation: null },
} as unknown as StudyCatalogDetail;

describe('study-order-adapter', () => {
  it('la categoría sale de la familia del catálogo', () => {
    expect(categoryOfFamily('LAB')).toBe('LAB');
    expect(categoryOfFamily('IMAGING')).toBe('IMAGING');
    expect(categoryOfFamily('PROCEDURE')).toBe('OTHER');
  });

  it('un panel anidado se pide por sus analitos (hojas)', () => {
    const hoja = (id: string) => ({ conceptId: id, children: [] }) as never;
    const nodo = { conceptId: 'p', children: [hoja('a'), hoja('b')] } as never;
    expect(leafComponents([nodo, hoja('c')]).map((n) => n.conceptId)).toEqual(['a', 'b', 'c']);
  });

  it('un análisis sin detalle es simple y con detalle trae sus componentes', () => {
    const item = { conceptId: 'l', code: 'L', display: 'L', family: 'LAB', componentsSelectable: true } as unknown as StudyCatalogItem;
    expect(toLabAnalysis(item).components).toEqual([]);
    const detalle = {
      components: [{ conceptId: 'c1', code: 'C1', display: 'Uno', selectedByDefault: true, exampleUnits: ['g'], children: [] }],
      suggestedSpecimen: { conceptId: 's', display: 'Suero' },
      lab: { section: 'QUIM' },
    } as unknown as StudyCatalogDetail;
    const con = toLabAnalysis(item, detalle);
    expect(con.components[0]).toMatchObject({ conceptId: 'c1', label: 'Uno', defaultSelected: true, unit: 'g' });
    expect(con.specimen).toEqual({ conceptId: 's', label: 'Suero' });
    expect(con.section).toBe('QUIM');
  });

  it('imagen: con detalle usa los códigos del mapeo 3D y exige el lado; sin detalle, no inventa', () => {
    const sin = buildImagingCatalog([ITEM], new Map(), new Map());
    expect(sin.studies[0]).toMatchObject({ requiereLateralidad: false, contraste: 'opcional' });
    const con = buildImagingCatalog([ITEM], new Map(), new Map([['img-1', DETALLE]]));
    expect(con.studies[0]).toMatchObject({ modalidad: 'RX', region: 'MANO', requiereLateralidad: true, contraste: 'sin' });
    expect(con.modalities).toEqual([{ codigo: 'RX', nombre: 'Radiografía', conceptId: 'mod-rx' }]);
    expect(con.regionConceptIds['MANO']).toBe('reg-mano');
    expect(con.lateralityConceptIds['IZQ']).toBe('lat-izq');
    expect(con.regions.find((r) => r.codigo === 'MANO')).toMatchObject({ padre: 'MIEMBRO_SUPERIOR', admite_lateralidad: true });
  });

  it('el 422 se lleva al renglón y al campo, en castellano', () => {
    const e = requisitionFieldError({ reason: 'BODY_SITE_REQUIRED', field: 'imaging.bodySiteConceptId', itemIndex: 1 }, 'x', ['A', 'B']);
    expect(e).toMatchObject({ itemIndex: 1, field: 'imaging.bodySiteConceptId' });
    expect(e.message).toBe('B: falta la región del cuerpo.');
    const desconocido = requisitionFieldError({ reason: 'OTRA', field: 'componentConceptIds' }, 'Mensaje del servidor', []);
    expect(desconocido.message).toBe('Mensaje del servidor (los componentes)');
  });

  it('la línea de detalle del histórico resume componentes o región y lado', () => {
    const base = { id: 'o', patientProfileId: 'p', codeConceptId: 'c', statusConceptId: 's', createdAt: new Date() } as DiagnosticOrder;
    expect(detalleDeLaOrden(base)).toBeNull();
    const lab = {
      ...base,
      components: ['a', 'b', 'c', 'd', 'e'].map((display, i) => ({ conceptId: display, display, ordinal: i + 1 })),
      specimenTypeDisplay: 'Suero',
    };
    expect(detalleDeLaOrden(lab)).toBe('a, b, c, d y 1 más · Muestra: Suero');
    const img = {
      ...base,
      imaging: { modalityDisplay: 'RX', bodySiteDisplay: 'Mano', lateralityDisplay: 'Izquierda', contrastDisplay: null } as never,
    };
    expect(detalleDeLaOrden(img)).toBe('RX · Mano · Izquierda');
  });
});
