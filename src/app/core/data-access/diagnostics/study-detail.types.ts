/* ============================================================================
    Detalle de la orden de estudios: qué muestra se analiza (laboratorio) o qué
    parte del cuerpo se estudia (imagen). Contrato común del front con la API
    (v4.2.82 + el trabajo de región corporal 3D):

      - Laboratorio: `specimenTypeConceptId`.
      - Imagen: `modalityConceptId`, `bodySiteConceptId`, `lateralityConceptId`,
        `bodyStructureUberon`, `bodyMeshId`, `boneTypeConceptId`.
      - **Excluyentes**: una orden lleva muestra o datos de imagen, nunca los dos
        (422 `SPECIMEN_AND_IMAGING_FIELDS_EXCLUSIVE`).

    La vista usa los siete campos **planos**. En el cable, la API de `dev` acepta
    los de imagen dentro de `imaging` (y el trabajo en curso también planos), así
    que este archivo es el ÚNICO lugar que sabe cómo viajan: si el contrato
    cambia de forma, se cambia acá y nada más.
    ========================================================================== */

/**
 * Los campos de `esquema.tabla.columna` que gobiernan cada catálogo. Un solo
 * archivo, a propósito: si un nombre cambia en el modelo, cambia acá.
 *
 *  - muestra, modalidad, región y lateralidad: confirmados contra
 *    `dynamic-enum-catalog.ts` de la API (`specimen-type`,
 *    `service-request-imaging-modality`, `imaging-body-structure`,
 *    `condition-laterality`).
 *  - tipo de hueso: **supuesto** (value set `imaging-bone-type`, que el modelo
 *    todavía no siembra). Si el destino real se llama distinto, se cambia acá.
 */
export const STUDY_DETAIL_TARGETS = {
  specimen: 'clinical.service_requests.specimen_type_concept_id',
  modality: 'clinical.service_requests.modality_concept_id',
  bodySite: 'clinical.service_requests.body_site_concept_id',
  laterality: 'clinical.service_requests.laterality_concept_id',
  boneType: 'clinical.service_requests.bone_type_concept_id',
  contrast: 'clinical.service_requests.contrast_concept_id',
} as const;

/** Los códigos de la lateralidad (`condition-laterality`) que corresponden a un lado del atlas. */
export const LATERALITY_CODE_BY_SIDE = {
  right: 'COND_LAT_RIGHT',
  left: 'COND_LAT_LEFT',
} as const;

/** Lo que el profesional indica al pedir el estudio. Todo opcional. */
export interface StudyDetailFields {
  /** Laboratorio: la muestra (`specimen-type`). */
  readonly specimenTypeConceptId?: string;
  /** Imagen: la región del catálogo (`imaging-body-structure`). */
  readonly bodySiteConceptId?: string;
  /** Imagen: la estructura marcada en el atlas 3D, `UBERON:<n>` o `FMA:<n>`. */
  readonly bodyStructureUberon?: string;
  /** Imagen: la malla marcada en el atlas 3D. */
  readonly bodyMeshId?: string;
  /** Imagen: izquierda, derecha o bilateral (`condition-laterality`). */
  readonly lateralityConceptId?: string;
  /** Imagen: la modalidad (`service-request-imaging-modality`). */
  readonly modalityConceptId?: string;
  /** Imagen: el tipo de hueso (`imaging-bone-type`), elegido por el médico. */
  readonly boneTypeConceptId?: string;
  /** Imagen: con o sin contraste (`imaging-contrast`); la API lo exige junto con la modalidad. */
  readonly contrastConceptId?: string;
}

/** Lo mismo, tal como vuelve de la API: con el nombre legible de cada concepto cuando lo trae. */
export interface StudyDetailRead extends StudyDetailFields {
  readonly specimenTypeDisplay?: string;
  readonly bodySiteDisplay?: string;
  readonly lateralityDisplay?: string;
  readonly modalityDisplay?: string;
  readonly boneTypeDisplay?: string;
  readonly contrastDisplay?: string;
}

/** Las claves que el simulador acepta en el alta aunque el contrato generado todavía no las declare. */
export const STUDY_DETAIL_CONTRACT_PENDING_KEYS: readonly string[] = [
  'specimenTypeConceptId',
  'imaging',
];

const IMAGING_KEYS = [
  'modalityConceptId',
  'bodySiteConceptId',
  'lateralityConceptId',
  'bodyStructureUberon',
  'bodyMeshId',
  'boneTypeConceptId',
  'contrastConceptId',
] as const satisfies readonly (keyof StudyDetailFields)[];

const DISPLAY_KEYS = [
  'specimenTypeDisplay',
  'bodySiteDisplay',
  'lateralityDisplay',
  'modalityDisplay',
  'boneTypeDisplay',
  'contrastDisplay',
] as const satisfies readonly (keyof StudyDetailRead)[];

type ImagingWire = Partial<Record<(typeof IMAGING_KEYS)[number], string>>;

/** Hay datos de imagen en lo que se va a mandar. */
export function hasImagingFields(fields: StudyDetailFields): boolean {
  return IMAGING_KEYS.some((key) => fields[key] !== undefined && fields[key] !== '');
}

/**
 * La orden con el detalle en la forma del cable: muestra plana, imagen en
 * `imaging`. Las claves sin valor no viajan (la API valida con
 * `forbidNonWhitelisted`) y, sin datos de imagen, tampoco `imaging`.
 */
export function toWireOrder<T extends StudyDetailFields>(
  order: T,
): Omit<T, (typeof IMAGING_KEYS)[number]> & { readonly imaging?: ImagingWire } {
  const rest: Record<string, unknown> = { ...(order as object) };
  const imaging: ImagingWire = {};
  for (const key of IMAGING_KEYS) {
    const value = order[key];
    delete rest[key];
    if (value !== undefined && value !== '') imaging[key] = value;
  }
  if (rest['specimenTypeConceptId'] === undefined || rest['specimenTypeConceptId'] === '') {
    delete rest['specimenTypeConceptId'];
  }
  return (Object.keys(imaging).length === 0 ? rest : { ...rest, imaging }) as Omit<
    T,
    (typeof IMAGING_KEYS)[number]
  > & {
    readonly imaging?: ImagingWire;
  };
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * Normaliza lo que llega de la API: la API manda `null` en lo no indicado y
 * puede traer el detalle de imagen en `imaging` (anidado) o en el nivel
 * superior; en la vista queda siempre plano y sin `null`. Lo plano manda sobre
 * lo anidado (la misma regla que la API al recibirlo).
 */
export function withStudyDetail<T extends object>(wire: T): Omit<T, 'imaging'> & StudyDetailRead {
  const { imaging, ...rest } = wire as T & { imaging?: Record<string, unknown> | null };
  const flat = rest as Record<string, unknown>;
  const nested = imaging ?? {};
  const out: Record<string, unknown> = { ...rest };
  for (const key of [...IMAGING_KEYS, 'specimenTypeConceptId', ...DISPLAY_KEYS]) {
    const value = text(flat[key]) ?? text(nested[key]);
    if (value === undefined) delete out[key];
    else out[key] = value;
  }
  return out as Omit<T, 'imaging'> & StudyDetailRead;
}
