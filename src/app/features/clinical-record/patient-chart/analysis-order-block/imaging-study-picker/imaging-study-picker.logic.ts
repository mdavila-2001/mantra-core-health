/**
 * Lógica pura del selector de estudios de imagenología: sin Angular, sin DOM.
 *
 * Modelo mental
 * -------------
 * - El **estudio** del catálogo fija la modalidad, la región por defecto y el
 *   contraste. La persona puede cambiar la región, pero sólo dentro de las que
 *   el estudio permite (la suya y las que cuelgan de ella en el catálogo).
 * - **Lateralidad** exige región; si el estudio `requiereLateralidad` no hay
 *   selección válida sin ella. **Contraste** exige modalidad (regla V9 del
 *   modelo: `CONTRAST_REQUIRES_MODALITY`).
 * - El contraste lo define el estudio (`sin`, `con`, `sin_y_con`): sólo
 *   `opcional` deja elegir. En los demás casos el control se muestra con las
 *   otras opciones inhabilitadas, para que se vea qué se pide y por qué.
 *
 * Toda función devuelve objetos NUEVOS: la selección viaja por un `model()`.
 */

import type { Laterality } from '../../../../../core/data-access/anatomy-atlas/body-regions.types';

export type ContrastKind = 'sin' | 'con' | 'sin_y_con';
/** Lo que dice el catálogo de un estudio; `opcional` = la persona elige. */
export type StudyContrast = ContrastKind | 'opcional';

export interface ImagingModalityOption {
  readonly codigo: string;
  readonly nombre: string;
  readonly conceptId: string;
}

export interface ImagingStudyOption {
  readonly conceptId: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly sinonimos: readonly string[];
  readonly modalidad: string;
  /** Región por defecto del estudio (`regiones[].codigo`). */
  readonly region: string;
  /** Si el catálogo las da, anulan «la región y sus hijas». */
  readonly regionesPermitidas?: readonly string[];
  readonly requiereLateralidad: boolean;
  readonly contraste: StudyContrast;
  /** Vía del contraste («IV», «oral»…); sólo informativa. */
  readonly viaContraste?: string | null;
  readonly proyecciones: readonly string[];
  readonly preparacion: string | null;
}

export interface ImagingRegionOption {
  readonly codigo: string;
  readonly nombre: string;
  readonly padre: string | null;
  readonly admite_lateralidad: boolean;
}

export interface ContrastOption {
  readonly conceptId: string;
  readonly label: string;
  readonly isDefault: boolean;
  /** Qué significa; si falta se deduce del rótulo (`contrastKindOf`). */
  readonly kind?: ContrastKind;
}

/** Lo elegido. Los códigos son los del catálogo; los conceptId los pone el padre. */
export interface ImagingSelection {
  readonly studyConceptId: string;
  readonly modalityCode: string;
  readonly region: string | null;
  readonly laterality: Laterality | null;
  readonly contrastConceptId: string | null;
}

export interface ImagingLookups {
  readonly modalities: readonly ImagingModalityOption[];
  /** código de región -> conceptId */
  readonly regionConceptIds: Readonly<Record<string, string>>;
  /** `IZQ`/`DER`/`BIL`/`UNI` -> conceptId */
  readonly lateralityConceptIds: Readonly<Record<string, string>>;
}

/** El renglón de la requisición (`imaging` según C4 del plan). */
export interface ImagingRequestLine {
  readonly studyConceptId: string;
  readonly imaging: {
    readonly modalityConceptId: string;
    readonly bodySiteConceptId?: string;
    readonly lateralityConceptId?: string;
    readonly contrastConceptId?: string;
  };
}

export const CONTRAST_KINDS: readonly ContrastKind[] = ['sin', 'con', 'sin_y_con'];

export const CONTRAST_FALLBACK_LABEL: Readonly<Record<ContrastKind, string>> = {
  sin: 'Sin contraste',
  con: 'Con contraste',
  sin_y_con: 'Sin y con contraste',
};

export const LATERALITY_NAME: Readonly<Record<Laterality, string>> = {
  IZQ: 'Izquierda',
  DER: 'Derecha',
  BIL: 'Bilateral',
  UNI: 'Un lado (sin especificar)',
};

/** Hasta cuántas modalidades caben en un control segmentado; más, un select. */
export const MODALITY_SEGMENTED_MAX = 6;

export function modalityControl(count: number): 'segmented' | 'select' {
  return count <= MODALITY_SEGMENTED_MAX ? 'segmented' : 'select';
}

// ---- Búsqueda -------------------------------------------------------------

const COMBINING_MARKS = /\p{M}/gu;

export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().trim();
}

export function queryTokens(query: string): readonly string[] {
  const normalized = normalizeText(query);
  return normalized === '' ? [] : normalized.split(/\s+/);
}

/** Texto normalizado donde se busca: nombre, sinónimos, proyecciones y código. */
export function buildStudyIndex(studies: readonly ImagingStudyOption[]): ReadonlyMap<string, string> {
  return new Map(
    studies.map((s) => [
      s.conceptId,
      normalizeText([s.nombre, ...s.sinonimos, ...s.proyecciones, s.codigo.replaceAll('_', ' ')].join(' | ')),
    ]),
  );
}

/**
 * Estudios de la modalidad (o de todas, si es `null`) que contienen TODAS las
 * palabras de la búsqueda. Primero los que las tienen en el nombre.
 */
export function filterStudies(
  studies: readonly ImagingStudyOption[],
  index: ReadonlyMap<string, string>,
  query: string,
  modalityCode: string | null,
): readonly ImagingStudyOption[] {
  const tokens = queryTokens(query);
  const pool = modalityCode === null ? studies : studies.filter((s) => s.modalidad === modalityCode);
  if (tokens.length === 0) return pool;
  const hits = pool.filter((s) => {
    const haystack = index.get(s.conceptId) ?? '';
    return tokens.every((t) => haystack.includes(t));
  });
  const inName = (s: ImagingStudyOption): boolean => {
    const name = normalizeText(s.nombre);
    return tokens.every((t) => name.includes(t));
  };
  return [...hits.filter(inName), ...hits.filter((s) => !inName(s))];
}

export function findStudy(
  studies: readonly ImagingStudyOption[],
  selection: ImagingSelection | null,
): ImagingStudyOption | null {
  if (selection === null) return null;
  return studies.find((s) => s.conceptId === selection.studyConceptId) ?? null;
}

// ---- Regiones --------------------------------------------------------------

/** La región del estudio y todas las que cuelgan de ella (a cualquier profundidad). */
export function allowedRegionsOf(study: ImagingStudyOption, regions: readonly ImagingRegionOption[]): readonly string[] {
  if (study.regionesPermitidas !== undefined && study.regionesPermitidas.length > 0) {
    return [...new Set([study.region, ...study.regionesPermitidas])];
  }
  const out = [study.region];
  const seen = new Set(out);
  // for-of sobre un arreglo que crece: recorre también lo agregado (recorrido en anchura).
  for (const current of out) {
    for (const r of regions) {
      if (r.padre === current && !seen.has(r.codigo)) {
        seen.add(r.codigo);
        out.push(r.codigo);
      }
    }
  }
  return out;
}

export function regionAdmitsLaterality(code: string | null, regions: readonly ImagingRegionOption[]): boolean {
  return code !== null && regions.find((r) => r.codigo === code)?.admite_lateralidad === true;
}

/** ¿Hay que pedir el lado con un control propio? (estudio que lo exige en una región que no lo ofrece). */
export function needsOwnLaterality(
  study: ImagingStudyOption,
  region: string | null,
  regions: readonly ImagingRegionOption[],
): boolean {
  return study.requiereLateralidad && !regionAdmitsLaterality(region, regions);
}

// ---- Contraste --------------------------------------------------------------

export function contrastKindOf(option: ContrastOption): ContrastKind | null {
  if (option.kind !== undefined) return option.kind;
  const label = normalizeText(option.label);
  if (/\b(sin y con|con y sin)\b/.test(label)) return 'sin_y_con';
  if (/^sin\b/.test(label)) return 'sin';
  if (/^con\b/.test(label)) return 'con';
  return null;
}

export function contrastConceptOf(kind: ContrastKind, options: readonly ContrastOption[]): string | null {
  return options.find((o) => contrastKindOf(o) === kind)?.conceptId ?? null;
}

export function contrastKindOfConcept(conceptId: string | null, options: readonly ContrastOption[]): ContrastKind | null {
  if (conceptId === null) return null;
  const option = options.find((o) => o.conceptId === conceptId);
  return option === undefined ? null : contrastKindOf(option);
}

/** Las opciones que la persona puede elegir para el estudio. */
export function allowedContrastKinds(study: ImagingStudyOption): readonly ContrastKind[] {
  return study.contraste === 'opcional' ? CONTRAST_KINDS : [study.contraste];
}

/** El contraste con el que arranca: el del estudio o, si es opcional, el marcado por defecto del catálogo. */
export function defaultContrastConcept(study: ImagingStudyOption, options: readonly ContrastOption[]): string | null {
  if (study.contraste !== 'opcional') return contrastConceptOf(study.contraste, options);
  const marked = options.find((o) => o.isDefault);
  return (marked ?? options.find((o) => contrastKindOf(o) === 'sin') ?? null)?.conceptId ?? null;
}

// ---- Transiciones de la selección -------------------------------------------

export function initialSelection(study: ImagingStudyOption, contrastOptions: readonly ContrastOption[]): ImagingSelection {
  return {
    studyConceptId: study.conceptId,
    modalityCode: study.modalidad,
    region: study.region,
    laterality: null,
    contrastConceptId: defaultContrastConcept(study, contrastOptions),
  };
}

export interface RegionValue {
  readonly region: string | null;
  readonly laterality: Laterality | null;
}

/**
 * Aplica lo que emite el selector de región. Una región fuera de las permitidas
 * se ignora; el lado sólo se conserva si la región lo admite o el estudio lo exige.
 */
export function withRegion(
  selection: ImagingSelection,
  value: RegionValue,
  study: ImagingStudyOption,
  regions: readonly ImagingRegionOption[],
): ImagingSelection {
  if (value.region === null) return { ...selection, region: null, laterality: null };
  if (!allowedRegionsOf(study, regions).includes(value.region)) return selection;
  const keepSide = regionAdmitsLaterality(value.region, regions) || study.requiereLateralidad;
  return { ...selection, region: value.region, laterality: keepSide ? value.laterality : null };
}

export function withLaterality(selection: ImagingSelection, laterality: Laterality | null): ImagingSelection {
  return { ...selection, laterality };
}

export function withContrast(
  selection: ImagingSelection,
  kind: ContrastKind,
  study: ImagingStudyOption,
  options: readonly ContrastOption[],
): ImagingSelection {
  if (!allowedContrastKinds(study).includes(kind)) return selection;
  const conceptId = contrastConceptOf(kind, options);
  return conceptId === null ? selection : { ...selection, contrastConceptId: conceptId };
}

// ---- Validez ----------------------------------------------------------------

export type ImagingIssue =
  | 'study-mismatch'
  | 'region-required'
  | 'region-not-allowed'
  | 'laterality-needs-region'
  | 'laterality-required'
  | 'laterality-not-applicable'
  | 'contrast-needs-modality'
  | 'contrast-missing'
  | 'contrast-not-allowed';

export const ISSUE_MESSAGE: Readonly<Record<ImagingIssue, string>> = {
  'study-mismatch': 'La selección no corresponde al estudio elegido.',
  'region-required': 'Falta la región del cuerpo.',
  'region-not-allowed': 'Esa región no corresponde a este estudio.',
  'laterality-needs-region': 'No se puede indicar el lado sin una región.',
  'laterality-required': 'Falta indicar el lado: este estudio lo exige.',
  'laterality-not-applicable': 'Esa región no tiene lado.',
  'contrast-needs-modality': 'No se puede indicar contraste sin modalidad.',
  'contrast-missing': 'Falta indicar el contraste.',
  'contrast-not-allowed': 'Ese contraste no corresponde a este estudio.',
};

export interface ValidityContext {
  /** Si se da, se verifican región permitida y lado aplicable. */
  readonly regions?: readonly ImagingRegionOption[];
  /** Si se da (y no está vacío), el contraste es obligatorio y se verifica. */
  readonly contrastOptions?: readonly ContrastOption[];
}

export function selectionIssues(
  selection: ImagingSelection | null,
  study: ImagingStudyOption | null,
  context: ValidityContext = {},
): readonly ImagingIssue[] {
  if (selection === null || study === null) return ['study-mismatch'];
  const issues: ImagingIssue[] = [];
  if (selection.studyConceptId !== study.conceptId || selection.modalityCode !== study.modalidad) {
    issues.push('study-mismatch');
  }
  const { regions, contrastOptions } = context;
  if (selection.region === null) issues.push('region-required');
  else if (regions !== undefined && !allowedRegionsOf(study, regions).includes(selection.region)) {
    issues.push('region-not-allowed');
  }
  if (selection.laterality !== null && selection.region === null) issues.push('laterality-needs-region');
  if (study.requiereLateralidad && selection.laterality === null) issues.push('laterality-required');
  if (
    selection.laterality !== null &&
    selection.region !== null &&
    regions !== undefined &&
    !study.requiereLateralidad &&
    !regionAdmitsLaterality(selection.region, regions)
  ) {
    issues.push('laterality-not-applicable');
  }
  if (selection.contrastConceptId !== null && selection.modalityCode === '') issues.push('contrast-needs-modality');
  if (contrastOptions !== undefined && contrastOptions.length > 0) {
    if (selection.contrastConceptId === null) issues.push('contrast-missing');
    else {
      const kind = contrastKindOfConcept(selection.contrastConceptId, contrastOptions);
      if (kind === null || !allowedContrastKinds(study).includes(kind)) issues.push('contrast-not-allowed');
    }
  }
  return issues;
}

export function isSelectionValid(
  selection: ImagingSelection | null,
  study: ImagingStudyOption | null,
  context: ValidityContext = {},
): boolean {
  return selectionIssues(selection, study, context).length === 0;
}

// ---- Serialización ----------------------------------------------------------

/**
 * El renglón de la requisición. `null` si la modalidad no tiene conceptId.
 * Los opcionales se OMITEN cuando no hay valor; el lado sólo viaja con región
 * (y la región con conceptId) y el contraste sólo con modalidad.
 */
export function serializeImaging(selection: ImagingSelection, lookups: ImagingLookups): ImagingRequestLine | null {
  const modalityConceptId = lookups.modalities.find((m) => m.codigo === selection.modalityCode)?.conceptId;
  if (modalityConceptId === undefined || modalityConceptId === '') return null;
  const bodySiteConceptId = selection.region === null ? undefined : lookups.regionConceptIds[selection.region];
  const lateralityConceptId =
    bodySiteConceptId === undefined || selection.laterality === null
      ? undefined
      : lookups.lateralityConceptIds[selection.laterality];
  return {
    studyConceptId: selection.studyConceptId,
    imaging: {
      modalityConceptId,
      ...(bodySiteConceptId !== undefined ? { bodySiteConceptId } : {}),
      ...(lateralityConceptId !== undefined ? { lateralityConceptId } : {}),
      ...(selection.contrastConceptId !== null ? { contrastConceptId: selection.contrastConceptId } : {}),
    },
  };
}

// ---- Texto -------------------------------------------------------------------

/** «RX · Mano · Izquierda · sin contraste», para el resumen y el lector de pantalla. */
export function describeSelection(
  selection: ImagingSelection,
  regions: readonly ImagingRegionOption[],
  contrastOptions: readonly ContrastOption[],
): string {
  const parts: string[] = [selection.modalityCode];
  const region = regions.find((r) => r.codigo === selection.region);
  if (region !== undefined) parts.push(region.nombre);
  if (selection.laterality !== null) parts.push(LATERALITY_NAME[selection.laterality]);
  const kind = contrastKindOfConcept(selection.contrastConceptId, contrastOptions);
  if (kind !== null) parts.push(CONTRAST_FALLBACK_LABEL[kind].toLowerCase());
  return parts.join(' · ');
}
