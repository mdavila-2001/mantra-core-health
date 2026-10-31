import type {
  AllowedBodySite,
  StudyCatalogDetail,
  StudyCatalogItem,
  StudyComponentNode,
  StudyFamily,
  StudyOption,
} from '../../data-access/study-catalog/study-catalog.types';
import { conjunto, define, ESTUDIO, LATERALITY, record } from './concepts';
import {
  IMAGING_LATERALITIES,
  IMAGING_MODALITIES,
  IMAGING_REGIONS,
  IMAGING_STUDIES,
  type ImagingRegionRow,
  type ImagingStudyRow,
} from './study-catalog-imaging.data';
import { LAB_ANALYSES, LAB_SPECIMENS, type LabAnalysisRow } from './study-catalog-lab.data';

/* ============================================================================
    El catálogo de estudios pedibles del simulador (H3.M2).

    Lo que la API publica en `GET /clinical/study-catalog`, armado desde los
    fixtures generados (`study-catalog-*.data.ts`, que salen de los JSON
    investigados). Los conceptos se registran en el catálogo de terminología
    del simulador con `define`, así `GET /terminology/concepts?ids=` los
    etiqueta como cualquier otro.

    ## La familia es explícita (B1)

    Los 24 estudios heredados del simulador se llaman `STUDY-*`: el prefijo no
    dice nada y `studyFamilyOf` los daba a todos por «otro». Acá cada uno tiene
    su familia en {@link FAMILIA_DE_ESTUDIO_HEREDADO}, y los del catálogo nuevo
    la llevan en su propio registro. Un estudio heredado cuenta como «sin
    detalle»: no exige componentes ni región (como en la API, familia `null`).
    ========================================================================== */

export const SISTEMA_DE_CODIGO = 'ALOVIDA-ESTUDIOS';

/** Familia de cada estudio heredado del simulador (`VS_DIAGNOSTIC_STUDY`). */
export const FAMILIA_DE_ESTUDIO_HEREDADO: Readonly<Record<string, StudyFamily>> = {
  'STUDY-HEMOGRAMA': 'LAB',
  'STUDY-GLUCOSA': 'LAB',
  'STUDY-PERFIL-LIPIDICO': 'LAB',
  'STUDY-TSH': 'LAB',
  'STUDY-ORINA': 'LAB',
  'STUDY-CREATININA': 'LAB',
  'STUDY-UREA': 'LAB',
  'STUDY-HBA1C': 'LAB',
  'STUDY-COAGULACION': 'LAB',
  'STUDY-HEPATICO': 'LAB',
  'STUDY-COPROLOGICO': 'LAB',
  'STUDY-CULTIVO': 'LAB',
  'STUDY-VITAMINA-D': 'LAB',
  'STUDY-RX-TORAX': 'IMAGING',
  'STUDY-ECO-ABD': 'IMAGING',
  'STUDY-RMN-RODILLA': 'IMAGING',
  'STUDY-TAC-CRANEO': 'IMAGING',
  'STUDY-MAMOGRAFIA': 'IMAGING',
  'STUDY-ECO-OBSTETRICA': 'IMAGING',
  'STUDY-RX-COLUMNA': 'IMAGING',
  'STUDY-TAC-ABDOMEN': 'IMAGING',
  'STUDY-RMN-CEREBRO': 'IMAGING',
  'STUDY-DENSITOMETRIA': 'IMAGING',
  'STUDY-ECG': 'CARDIO',
};

/* ---- conceptos ----------------------------------------------------------- */

conjunto('VS_STUDY_CATALOG', 'Estudios pedibles (catálogo)', 'service-request-code ampliado.');
conjunto('VS_STUDY_CATALOG_COMPONENT', 'Componentes de panel', 'Conceptos part-of de un estudio.');
conjunto('VS_STUDY_SPECIMEN', 'Muestras del catálogo', 'specimen-type del catálogo investigado.');
conjunto('VS_IMAGING_MODALITY', 'Modalidad de imagen', 'service-request-imaging-modality.');
conjunto('VS_IMAGING_BODY_STRUCTURE', 'Región corporal', 'imaging-body-structure.');
conjunto('VS_IMAGING_CONTRAST', 'Contraste', 'imaging-contrast.');

const idDe = (valueSet: string, code: string, display: string): string =>
  define(valueSet, [[code, display]])[code]!;

const MUESTRAS = new Map(
  LAB_SPECIMENS.map((m) => [m.code, { ...m, conceptId: idDe('VS_STUDY_SPECIMEN', `SC_SPEC_${m.code}`, m.name) }]),
);
const MODALIDADES = new Map(
  IMAGING_MODALITIES.map((m) => [m.code, { ...m, conceptId: idDe('VS_IMAGING_MODALITY', `SC_MOD_${m.code}`, m.name) }]),
);
const REGIONES = new Map(
  IMAGING_REGIONS.map((r) => [r.code, { ...r, conceptId: idDe('VS_IMAGING_BODY_STRUCTURE', `SC_REG_${r.code}`, r.name) }]),
);

const LATERALIDAD_CONCEPTO: Readonly<Record<string, string>> = {
  IZQ: LATERALITY['COND_LAT_LEFT']!,
  DER: LATERALITY['COND_LAT_RIGHT']!,
  BIL: LATERALITY['COND_LAT_BILATERAL']!,
};

export const CONTRASTE = {
  sin: idDe('VS_IMAGING_CONTRAST', 'SC_CTR_SIN', 'Sin contraste'),
  con: idDe('VS_IMAGING_CONTRAST', 'SC_CTR_CON', 'Con contraste'),
  sin_y_con: idDe('VS_IMAGING_CONTRAST', 'SC_CTR_SIN_Y_CON', 'Sin y con contraste'),
} as const;

/* ---- el modelo ----------------------------------------------------------- */

export interface EstudioDelCatalogo {
  readonly item: StudyCatalogItem;
  /** Texto en minúsculas y sin tildes para la búsqueda (nombre, sinónimos, código, componentes). */
  readonly busqueda: string;
  readonly componentes: readonly StudyComponentNode[];
  readonly idsDeComponentes: ReadonlySet<string>;
  readonly detalle: Omit<StudyCatalogDetail, keyof StudyCatalogItem>;
  /** Regiones elegibles en un estudio de imagen. */
  readonly regionesPermitidas: ReadonlySet<string>;
}

/** Minúsculas y sin tildes. */
export function plegar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const ATRIBUCION_LOINC = {
  source: 'LOINC',
  url: 'https://loinc.org',
  license: 'LOINC License',
  text: 'Esta obra incluye contenido de LOINC® (c) Regenstrief Institute, Inc.',
};
const ATRIBUCION_DICOM = {
  source: 'DICOM',
  url: 'https://www.dicomstandard.org',
  license: 'DICOM Standard',
  text: 'Modalidades y regiones según DICOM PS3.16; estructuras según SNOMED CT.',
};

function opcion(conceptId: string, code: string, display: string, isDefault: boolean): StudyOption {
  return { conceptId, code, display, isDefault };
}

function deLaboratorio(a: LabAnalysisRow): EstudioDelCatalogo {
  const conceptId = idDe('VS_STUDY_CATALOG', `SC_LAB_${a.code}`, a.name);
  const componentes: StudyComponentNode[] = a.components.map((c, i) => ({
    conceptId: idDe('VS_STUDY_CATALOG_COMPONENT', `SC_COMP_${a.code}_${c.code}`, c.name),
    code: c.code,
    display: c.name,
    ordinal: i + 1,
    selectedByDefault: c.byDefault,
    exampleUnits: c.unit === null ? [] : [c.unit],
    isPanel: false,
    loincCode: c.loinc,
    loincName: c.loincName,
    children: [],
  }));
  const muestra = a.specimen === null ? undefined : MUESTRAS.get(a.specimen);
  const selectable = a.isPanel;
  const sugerida =
    muestra === undefined ? null : opcion(muestra.conceptId, muestra.code, muestra.name, true);
  return {
    item: {
      conceptId,
      code: a.code,
      legacyCode: a.legacyCode,
      codeSystem: SISTEMA_DE_CODIGO,
      display: a.name,
      family: 'LAB',
      componentsSelectable: selectable,
      componentCount: componentes.length,
      specimenHint:
        muestra === undefined
          ? null
          : { text: muestra.name, code: muestra.code, hl7Code: muestra.hl7, snomedCode: muestra.snomed, source: 'hl7-v2-0487;snomed-ct-int' },
      modalityConceptId: null,
      bodySiteConceptId: null,
      provenance: { source: a.source, version: 'LOINC 2.83', sourceIds: a.loinc === null ? [] : [a.loinc] },
    },
    busqueda: plegar([a.name, a.code, a.legacyCode ?? '', ...a.synonyms, ...a.components.map((c) => c.name)].join(' ')),
    componentes,
    idsDeComponentes: new Set(componentes.map((c) => c.conceptId)),
    regionesPermitidas: new Set(),
    detalle: {
      components: componentes,
      suggestedSpecimen: sugerida,
      allowedSpecimenTypes: [...MUESTRAS.values()].map((m) =>
        opcion(m.conceptId, m.code, m.name, m.conceptId === sugerida?.conceptId),
      ),
      allowedModalities: [],
      allowedBodySites: [],
      lateralityOptions: [],
      contrastOptions: [],
      lab: { section: a.section, fasting: a.fasting, turnaroundHours: a.turnaroundHours, loincCode: a.loinc, loincName: a.loincName },
      imaging: null,
      attribution: [ATRIBUCION_LOINC],
    },
  };
}

/** La región del estudio, sus hijas y sus hermanas: lo que el médico puede elegir. */
function regionesDe(regionCode: string): readonly ImagingRegionRow[] {
  const propia = IMAGING_REGIONS.find((r) => r.code === regionCode);
  if (propia === undefined) return [];
  return IMAGING_REGIONS.filter(
    (r) => r.code === regionCode || r.parent === regionCode || (propia.parent !== null && r.parent === propia.parent),
  );
}

function deImagen(e: ImagingStudyRow): EstudioDelCatalogo {
  const conceptId = idDe('VS_STUDY_CATALOG', `SC_IMG_${e.code}`, e.name);
  const modalidad = MODALIDADES.get(e.modality)!;
  const region = REGIONES.get(e.region)!;
  const permitidas: AllowedBodySite[] = regionesDe(e.region).map((r) => {
    const concepto = REGIONES.get(r.code)!;
    return {
      conceptId: concepto.conceptId,
      code: r.code,
      display: r.name,
      parentConceptId: r.parent === null ? null : (REGIONES.get(r.parent)?.conceptId ?? null),
      regionType: r.type,
      admitsLaterality: r.paired,
      isDefault: r.code === e.region,
    };
  });
  const opcionesDeContraste = (['TC', 'RM'].includes(e.modality) && e.contrast === 'sin'
    ? (['sin', 'con', 'sin_y_con'] as const)
    : ([e.contrast] as const)
  ).map((c) =>
    opcion(CONTRASTE[c], `SC_CTR_${c.toUpperCase()}`, record.get(`SC_CTR_${c.toUpperCase()}`)!.display, c === e.contrast),
  );
  const lateralidades = IMAGING_LATERALITIES.map((l) => opcion(LATERALIDAD_CONCEPTO[l.code]!, l.code, l.name, false));
  return {
    item: {
      conceptId,
      code: e.code,
      legacyCode: e.legacyCode,
      codeSystem: SISTEMA_DE_CODIGO,
      display: e.name,
      family: 'IMAGING',
      componentsSelectable: false,
      componentCount: 0,
      specimenHint: null,
      modalityConceptId: modalidad.conceptId,
      bodySiteConceptId: region.conceptId,
      provenance: { source: e.source, version: 'LOINC 2.83', sourceIds: [e.loinc, e.radlex].filter((x): x is string => x !== null) },
    },
    busqueda: plegar([e.name, e.code, e.legacyCode ?? '', modalidad.name, region.name, ...e.projections].join(' ')),
    componentes: [],
    idsDeComponentes: new Set(),
    regionesPermitidas: new Set(permitidas.map((p) => p.conceptId)),
    detalle: {
      components: [],
      suggestedSpecimen: null,
      allowedSpecimenTypes: [],
      allowedModalities: [opcion(modalidad.conceptId, modalidad.code, modalidad.name, true)],
      allowedBodySites: permitidas,
      lateralityOptions: lateralidades,
      contrastOptions: opcionesDeContraste,
      lab: null,
      imaging: {
        projections: e.projections,
        contrast: e.contrast,
        contrastRoute: e.contrastRoute,
        preparation: e.preparation,
        requiresLaterality: e.requiresLaterality,
        loincCode: e.loinc,
        radlexRpid: e.radlex,
      },
      attribution: [ATRIBUCION_LOINC, ATRIBUCION_DICOM],
    },
  };
}

/** El único estudio no de laboratorio ni de imagen del simulador: el ECG heredado. */
function electrocardiograma(): EstudioDelCatalogo {
  const conceptId = ESTUDIO['STUDY-ECG']!;
  return {
    item: {
      conceptId,
      code: 'ECG',
      legacyCode: 'STUDY-ECG',
      codeSystem: SISTEMA_DE_CODIGO,
      display: 'Electrocardiograma',
      family: 'CARDIO',
      componentsSelectable: false,
      componentCount: 0,
      specimenHint: null,
      modalityConceptId: null,
      bodySiteConceptId: null,
      provenance: { source: null, version: null, sourceIds: [] },
    },
    busqueda: plegar('Electrocardiograma ECG EKG'),
    componentes: [],
    idsDeComponentes: new Set(),
    regionesPermitidas: new Set(),
    detalle: {
      components: [],
      suggestedSpecimen: null,
      allowedSpecimenTypes: [],
      allowedModalities: [],
      allowedBodySites: [],
      lateralityOptions: [],
      contrastOptions: [],
      lab: null,
      imaging: null,
      attribution: [],
    },
  };
}

/** Los estudios del catálogo, en orden alfabético sin tildes (como la API). */
export const ESTUDIOS_DEL_CATALOGO: readonly EstudioDelCatalogo[] = [
  ...LAB_ANALYSES.map(deLaboratorio),
  ...IMAGING_STUDIES.map(deImagen),
  electrocardiograma(),
].sort(
  (a, b) =>
    plegar(a.item.display).localeCompare(plegar(b.item.display)) ||
    a.item.conceptId.localeCompare(b.item.conceptId),
);

const POR_ID = new Map(ESTUDIOS_DEL_CATALOGO.map((e) => [e.item.conceptId, e]));

export function estudioDelCatalogo(conceptId: string): EstudioDelCatalogo | undefined {
  return POR_ID.get(conceptId);
}

/**
 * La familia de un estudio: la del catálogo o, para los heredados, la del mapa
 * explícito. `null` si el simulador no conoce el estudio.
 */
export function familiaDeEstudio(conceptId: string): StudyFamily | null {
  const nuevo = POR_ID.get(conceptId);
  if (nuevo !== undefined) return nuevo.item.family;
  for (const [codigo, familia] of Object.entries(FAMILIA_DE_ESTUDIO_HEREDADO)) {
    if (ESTUDIO[codigo] === conceptId) return familia;
  }
  return null;
}

/** Si el estudio es uno de los heredados (sin detalle de catálogo). */
export function esEstudioHeredado(conceptId: string): boolean {
  return Object.keys(FAMILIA_DE_ESTUDIO_HEREDADO).some((c) => ESTUDIO[c] === conceptId);
}

/* ---- catálogos auxiliares para validar ---------------------------------- */

export const IDS_DE_MUESTRA: ReadonlySet<string> = new Set([...MUESTRAS.values()].map((m) => m.conceptId));
export const IDS_DE_MODALIDAD: ReadonlySet<string> = new Set([...MODALIDADES.values()].map((m) => m.conceptId));
export const IDS_DE_CONTRASTE: ReadonlySet<string> = new Set(Object.values(CONTRASTE));
export const IDS_DE_LATERALIDAD: ReadonlySet<string> = new Set(Object.values(LATERALIDAD_CONCEPTO));

/** La región (par o no) por su concepto, o `undefined` si no está en el catálogo. */
export function regionPorId(conceptId: string): { readonly paired: boolean } | undefined {
  for (const r of REGIONES.values()) if (r.conceptId === conceptId) return { paired: r.paired };
  return undefined;
}
