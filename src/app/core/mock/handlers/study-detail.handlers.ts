import { STUDY_DETAIL_TARGETS, type StudyDetailFields } from '../../data-access/diagnostics/study-detail.types';
import { IMAGING_BODY_STRUCTURE, IMAGING_BONE_TYPE, IMAGING_MODALITY, UNPAIRED_BODY_SITES } from '../fixtures/study-detail-concepts';
import { CODE_SYSTEM_VERSION_ID, LATERALITY, membersOf, record, SPECIMEN_TYPE, setByCode } from '../fixtures/concepts';
import { isMockReply, precondition, type MockHandler, type MockReply, type MockRequest, type MockRouter } from '../mock-router';
import { Coleccion, cuerpo, uuid } from '../mock-store';
import { categoriaDeLaOrden, esRechazo, resolverCategoria } from './service-request-category.mock';

/* ============================================================================
    DOBLE del detalle de la orden de estudios (muestra / región del cuerpo).

    La API de `dev` ya valida muestra, modalidad, región y lado (v4.2.82); la
    región 3D (estructura, malla, tipo de hueso) la agrega un trabajo en curso
    de la API y del modelo. Esto reproduce sus reglas con los mismos
    `details.reason` para poder ejercitar la pantalla en los tres niveles
    —correcto, límite e inválido— **sin presentarse como la API real**.

    Se engancha con `router.wrap` a las rutas que ya tienen dueño
    (`diagnostics.handlers.ts`, congelado en tamaño): valida el alta, guarda el
    detalle aparte y lo suma a las lecturas de la orden.
    ========================================================================== */

const STRUCTURE_PATTERN = /^(UBERON|FMA):\d{1,12}$/;
const MESH_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const DETAIL_KEYS = [
  'modalityConceptId',
  'bodySiteConceptId',
  'lateralityConceptId',
  'bodyStructureUberon',
  'bodyMeshId',
  'boneTypeConceptId',
] as const;

type Row = { readonly id: string } & StudyDetailFields;

/** El detalle guardado por orden. Sobrevive a F5 como el resto de las órdenes. */
const details = new Coleccion<Row>([], 'mock.studyDetail');

/** Para las pruebas: vuelve al arranque. */
export function resetStudyDetailMock(): void {
  details.reiniciar();
}

const SETS: Readonly<Record<string, readonly string[]>> = {
  specimen: Object.values(SPECIMEN_TYPE),
  modality: Object.values(IMAGING_MODALITY),
  bodySite: Object.values(IMAGING_BODY_STRUCTURE),
  laterality: Object.values(LATERALITY),
  boneType: Object.values(IMAGING_BONE_TYPE),
};

function fail(reason: string, field: string, message: string): MockReply {
  return precondition(message, reason, { reason, field });
}

const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);

/** Las siete claves del detalle de un cuerpo, planas o dentro de `imaging` (lo plano manda, como en la API). */
function detailOf(body: Record<string, unknown>): StudyDetailFields {
  const nested = typeof body['imaging'] === 'object' && body['imaging'] !== null ? (body['imaging'] as Record<string, unknown>) : {};
  const out: Record<string, string> = {};
  for (const key of ['specimenTypeConceptId', ...DETAIL_KEYS]) {
    const value = text(body[key]) ?? text(nested[key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** El rechazo que daría la API, o `null` si el detalle es válido. Las reglas siguen el orden V3–V9 de la API. */
export function rejectStudyDetail(detail: StudyDetailFields, category: 'LAB' | 'IMAGING' | 'OTHER' | undefined): MockReply | null {
  const hasImaging = DETAIL_KEYS.some((key) => detail[key] !== undefined);
  const specimen = detail.specimenTypeConceptId;
  if (specimen !== undefined && hasImaging) {
    return fail('SPECIMEN_AND_IMAGING_FIELDS_EXCLUSIVE', 'specimenTypeConceptId', 'Una orden lleva muestra (laboratorio) o datos de imagen, no las dos cosas');
  }
  if (specimen !== undefined) {
    if (category !== undefined && category !== 'LAB') {
      return fail('SPECIMEN_NOT_ALLOWED_FOR_CATEGORY', 'specimenTypeConceptId', 'La muestra sólo se pide en laboratorio');
    }
    if (!SETS['specimen']!.includes(specimen)) {
      return fail('SPECIMEN_TYPE_NOT_IN_CATALOG', 'specimenTypeConceptId', 'La muestra no es de `specimen-type`');
    }
  }
  if (category === 'IMAGING' && detail.bodySiteConceptId === undefined) {
    return fail('BODY_SITE_REQUIRED', 'imaging.bodySiteConceptId', 'Un estudio de imagen exige región corporal');
  }
  if (!hasImaging) return null;
  if (category !== undefined && category !== 'IMAGING') {
    return fail('IMAGING_FIELDS_NOT_ALLOWED', 'imaging', 'Los datos de imagen sólo van en estudios de imagen');
  }
  const { modalityConceptId: modality, bodySiteConceptId: site, lateralityConceptId: side, bodyStructureUberon: uberon, bodyMeshId: mesh, boneTypeConceptId: bone } = detail;
  if (modality !== undefined && !SETS['modality']!.includes(modality)) {
    return fail('MODALITY_NOT_IN_CATALOG', 'imaging.modalityConceptId', 'La modalidad no es de `service-request-imaging-modality`');
  }
  if (site !== undefined && !SETS['bodySite']!.includes(site)) {
    return fail('BODY_SITE_NOT_IN_CATALOG', 'imaging.bodySiteConceptId', 'La región no es de `imaging-body-structure`');
  }
  if (side !== undefined) {
    if (!SETS['laterality']!.includes(side)) return fail('LATERALITY_NOT_IN_CATALOG', 'imaging.lateralityConceptId', 'El lado no es de `condition-laterality`');
    // La API pide la región para el lado (no basta la estructura del 3D).
    if (site === undefined) return fail('BODY_SITE_REQUIRED', 'imaging.lateralityConceptId', 'El lado exige indicar la región');
    if (UNPAIRED_BODY_SITES.some((code) => record.get(code)?.id === site)) {
      return fail('LATERALITY_NOT_APPLICABLE', 'imaging.lateralityConceptId', 'La región no admite lateralidad');
    }
  }
  if (uberon !== undefined && !STRUCTURE_PATTERN.test(uberon)) {
    return fail('BODY_STRUCTURE_FORMAT_INVALID', 'imaging.bodyStructureUberon', 'La estructura debe tener la forma UBERON:<n> o FMA:<n>');
  }
  if (mesh !== undefined && !MESH_PATTERN.test(mesh)) {
    return fail('BODY_MESH_ID_FORMAT_INVALID', 'imaging.bodyMeshId', 'La malla debe ser alfanumérica (hasta 64 caracteres)');
  }
  if (bone !== undefined) {
    if (site === undefined && uberon === undefined) {
      return fail('BONE_TYPE_REQUIRES_BODY_STRUCTURE', 'imaging.boneTypeConceptId', 'El tipo de hueso exige la región o la estructura (UBERON)');
    }
    if (!SETS['boneType']!.includes(bone)) return fail('BONE_TYPE_NOT_IN_CATALOG', 'imaging.boneTypeConceptId', 'El tipo de hueso no es de `imaging-bone-type`');
  }
  return null;
}

/** El nombre legible de un concepto de la maqueta. */
function displayOf(id: string | undefined): string | undefined {
  if (id === undefined) return undefined;
  for (const concept of record.values()) if (concept.id === id) return concept.display;
  return undefined;
}

/** Lo que la API suma a una orden leída: los siete campos planos y el nombre de cada concepto. */
export function studyDetailOfOrder(orderId: string): Record<string, string> {
  const row = details.get(orderId);
  if (row === undefined) return {};
  const { id: _id, ...detail } = row;
  return {
    ...detail,
    ...(detail.specimenTypeConceptId === undefined ? {} : { specimenTypeDisplay: displayOf(detail.specimenTypeConceptId) ?? '' }),
    ...(detail.bodySiteConceptId === undefined ? {} : { bodySiteDisplay: displayOf(detail.bodySiteConceptId) ?? '' }),
    ...(detail.lateralityConceptId === undefined ? {} : { lateralityDisplay: displayOf(detail.lateralityConceptId) ?? '' }),
    ...(detail.modalityConceptId === undefined ? {} : { modalityDisplay: displayOf(detail.modalityConceptId) ?? '' }),
    ...(detail.boneTypeConceptId === undefined ? {} : { boneTypeDisplay: displayOf(detail.boneTypeConceptId) ?? '' }),
  };
}

/** La respuesta de `GET /system-context/dynamic-enums` para un destino de este detalle. */
function enumOf(target: string, valueSet: string, name: string) {
  const set = setByCode(valueSet);
  return {
    code: target,
    name,
    description: `Valores admitidos por ${target}.`,
    definitionId: uuid(`enum-def-${target}`),
    valueSetId: set?.id ?? '',
    versionId: set?.defaultVersionId ?? CODE_SYSTEM_VERSION_ID,
    cacheToken: `v1-${valueSet}`,
    allowCustomValue: false,
    options: membersOf(valueSet).map((c, i) => ({ conceptId: c.id, code: c.code, display: c.display, ordinal: c.ordinal, isDefault: i === 0 })),
  };
}

const IMAGING_STUDIES = ['RX-TORAX', 'ECO-ABD', 'RMN-RODILLA', 'TAC-CRANEO', 'MAMOGRAFIA', 'ECO-OBSTETRICA', 'RX-COLUMNA', 'TAC-ABDOMEN', 'RMN-CEREBRO', 'DENSITOMETRIA'];

/** `STUDY-HEMOGRAMA` → `LAB_HEMOGRAMA`, `STUDY-RX-TORAX` → `IMG_RX_TORAX`, `STUDY-ECG` → `CAR_ECG`. */
export function realCodeOfStudy(code: string): string {
  if (!code.startsWith('STUDY-')) return code;
  const name = code.slice('STUDY-'.length);
  const prefix = name === 'ECG' ? 'CAR' : IMAGING_STUDIES.includes(name) ? 'IMG' : 'LAB';
  return `${prefix}_${name.replace(/-/g, '_')}`;
}

function bodyOf(result: unknown): unknown {
  return isMockReply(result) ? result.body : result;
}

function withBody(result: unknown, body: unknown): unknown {
  return isMockReply(result) ? { ...result, body } : body;
}

/** Suma el detalle a cada fila de `list(body)`, que identifica con `idOf`. */
function enrich(list: (body: Record<string, unknown>) => unknown, idOf: (row: Record<string, unknown>) => string) {
  return (request: MockRequest, next: MockHandler): unknown => {
    const result = next(request);
    const body = bodyOf(result);
    if (typeof body !== 'object' || body === null) return result;
    const rows = list(body as Record<string, unknown>);
    if (!Array.isArray(rows)) return result;
    const extended = rows.map((row: Record<string, unknown>) => ({ ...row, ...studyDetailOfOrder(idOf(row)) }));
    return withBody(result, { ...body, [rowsKeyOf(body as Record<string, unknown>)]: extended });
  };
}

function rowsKeyOf(body: Record<string, unknown>): string {
  return Array.isArray(body['orders']) ? 'orders' : 'items';
}

export function registrarDetalleDeEstudio(router: MockRouter): void {
  router.wrap('POST', '/clinical/service-requests', (request, next) => {
    const body = cuerpo<Record<string, unknown>>(request) as Record<string, unknown>;
    const detail = detailOf(body);
    const categoria = resolverCategoria(body['category'], text(body['categoryConceptId']));
    const category = esRechazo(categoria) ? undefined : categoriaDeLaOrden(categoria.conceptId);
    // Una orden de imagen sin región también se rechaza (la API la exige en los estudios del catálogo).
    if (Object.keys(detail).length > 0 || category === 'IMAGING') {
      const rejection = rejectStudyDetail(detail, category);
      if (rejection !== null) return rejection;
    }
    const result = next(request);
    const created = bodyOf(result);
    const id = typeof created === 'object' && created !== null ? text((created as Record<string, unknown>)['id']) : undefined;
    if (isMockReply(result) && result.status === 201 && id !== undefined && Object.keys(detail).length > 0) {
      details.agregar({ id, ...detail });
    }
    return result;
  });

  router.wrap('GET', '/diagnostics/patients/:id/orders', enrich((b) => b['orders'], (row) => String(row['id'])));
  router.wrap('GET', '/diagnostic-results/me/orders', enrich((b) => b['items'], (row) => String(row['id'])));
  router.wrap('POST', '/diagnostics/service-requests/inbox', enrich((b) => b['items'], (row) => String(row['serviceRequestId'])));

  /** Los catálogos del detalle: los de la maqueta que ya existían y los sintéticos de arriba. */
  router.wrap('GET', '/system-context/dynamic-enums', (request, next) => {
    const target = request.query.get('target') ?? '';
    const code = {
      [STUDY_DETAIL_TARGETS.specimen]: ['VS_SPECIMEN_TYPE', 'Tipo de espécimen'],
      [STUDY_DETAIL_TARGETS.modality]: ['VS_SERVICE_REQUEST_IMAGING_MODALITY', 'Modalidad del estudio de imagen'],
      [STUDY_DETAIL_TARGETS.bodySite]: ['VS_IMAGING_BODY_STRUCTURE', 'Región del cuerpo del estudio de imagen'],
      [STUDY_DETAIL_TARGETS.laterality]: ['VS_CONDITION_LATERALITY', 'Lateralidad'],
      [STUDY_DETAIL_TARGETS.boneType]: ['VS_IMAGING_BONE_TYPE', 'Tipo de hueso'],
    }[target];
    if (code !== undefined) return enumOf(target, code[0]!, code[1]!);
    if (target !== 'clinical.service_requests.code_concept_id') return next(request);
    // Los estudios de la maqueta se llaman `STUDY-X`; el catálogo real agrupa por prefijo (`LAB_`, `IMG_`, `CAR_`),
    // y de ese prefijo sale si el estudio es de laboratorio o de imagen. Sin esto, todo se vería como «otro estudio».
    const result = next(request);
    const catalogo = bodyOf(result) as { options?: { code: string }[] };
    if (catalogo.options === undefined) return result;
    return withBody(result, { ...catalogo, options: catalogo.options.map((o) => ({ ...o, code: realCodeOfStudy(o.code) })) });
  });
}
