import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import type { BodyRegionCatalogEntry } from '../../../../core/data-access/anatomy-atlas/body-regions.types';
import type {
  AnalysisCategory,
  RequisitionItem,
} from '../../../../core/data-access/diagnostics/diagnostics.types';
import type {
  StudyCatalogDetail,
  StudyCatalogItem,
  StudyComponentNode,
  StudyFamily,
} from '../../../../core/data-access/study-catalog/study-catalog.types';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import type { ContrastOption, ImagingModalityOption, ImagingStudyOption, StudyContrast } from './imaging-study-picker/imaging-study-picker.logic';
import { CONTRAST_KINDS } from './imaging-study-picker/imaging-study-picker.logic';
import type { ContrastKind } from './imaging-study-picker/imaging-study-picker.logic';
import type { LabAnalysisOption, LabComponentOption, LabOrderLine } from './lab-analysis-picker/lab-analysis-picker.logic';

/* ============================================================================
    Adaptador entre el catálogo de estudios de la API (`StudyCatalogItem` y
    `StudyCatalogDetail`) y los dos selectores (`app-lab-analysis-picker`,
    `app-imaging-study-picker`), más el armado del cuerpo de la requisición.

    Puro: sin Angular, sin red. Lo que la lista no trae (componentes, región
    por defecto, lateralidad, contraste) llega con el detalle del estudio; hasta
    entonces el estudio se muestra con lo que hay y el bloque no deja pedirlo.
    ========================================================================== */

/** El tipo de pedido que el médico elige. Filtra el catálogo; no decide la categoría. */
export type StudyType = 'LAB' | 'IMAGING' | 'OTHER';

export const STUDY_TYPE_OPTIONS: readonly SegmentedOption<StudyType>[] = [
  { value: 'LAB', label: 'Laboratorio', description: 'Pedir análisis de laboratorio con sus componentes' },
  { value: 'IMAGING', label: 'Imagenología', description: 'Pedir un estudio de imagen: modalidad, región y lado' },
  { value: 'OTHER', label: 'Otros', description: 'Cardiología, patología y procedimientos diagnósticos' },
];

/** El único código de sección que el listado puede dar: el detalle trae la real. */
export const LAB_SECTION = 'LAB';

/** La categoría que viaja sale de la familia que el catálogo da al estudio, no de la pestaña. */
export function categoryOfFamily(family: StudyFamily): AnalysisCategory {
  return family === 'LAB' ? 'LAB' : family === 'IMAGING' ? 'IMAGING' : 'OTHER';
}

/* ---- laboratorio ---------------------------------------------------------- */

/** Las hojas de un árbol de componentes: un panel anidado se pide por sus analitos. */
export function leafComponents(nodes: readonly StudyComponentNode[]): readonly StudyComponentNode[] {
  return nodes.flatMap((n) => (n.children.length > 0 ? leafComponents(n.children) : [n]));
}

function toLabComponent(node: StudyComponentNode): LabComponentOption {
  return {
    conceptId: node.conceptId,
    code: node.code,
    label: node.display,
    defaultSelected: node.selectedByDefault,
    ...(node.exampleUnits.length > 0 ? { unit: node.exampleUnits[0] } : {}),
  };
}

/** Un análisis del selector. Sin detalle es «simple»: el bloque no deja pedirlo hasta tenerlo. */
export function toLabAnalysis(item: StudyCatalogItem, detail?: StudyCatalogDetail): LabAnalysisOption {
  const specimen = detail?.suggestedSpecimen ?? null;
  return {
    conceptId: item.conceptId,
    code: item.code,
    label: item.display,
    section: detail?.lab?.section ?? LAB_SECTION,
    ...(specimen === null ? {} : { specimen: { conceptId: specimen.conceptId, label: specimen.display } }),
    components:
      detail !== undefined && item.componentsSelectable ? leafComponents(detail.components).map(toLabComponent) : [],
  };
}

/** Las muestras que el catálogo permite, sin repetir, en el orden en que aparecen. */
export function specimenOptions(details: Iterable<StudyCatalogDetail>): readonly SelectOption<string>[] {
  const seen = new Map<string, SelectOption<string>>();
  for (const detail of details) {
    for (const s of detail.allowedSpecimenTypes) {
      if (!seen.has(s.conceptId)) seen.set(s.conceptId, { value: s.conceptId, label: s.display });
    }
  }
  return [...seen.values()];
}

/** El renglón de laboratorio de la requisición. Los opcionales sin valor se omiten. */
export function labRequisitionItem(line: LabOrderLine, item: StudyCatalogItem): RequisitionItem {
  return {
    codeConceptId: line.analysisConceptId,
    category: categoryOfFamily(item.family),
    ...(line.specimenConceptId === null ? {} : { specimenTypeConceptId: line.specimenConceptId }),
    ...(line.componentConceptIds.length === 0 ? {} : { componentConceptIds: line.componentConceptIds }),
  };
}

/* ---- imagenología ---------------------------------------------------------- */

export interface ImagingCatalogView {
  readonly modalities: readonly ImagingModalityOption[];
  readonly studies: readonly ImagingStudyOption[];
  readonly regions: readonly BodyRegionCatalogEntry[];
  readonly contrastOptions: readonly ContrastOption[];
  readonly regionConceptIds: Readonly<Record<string, string>>;
  readonly lateralityConceptIds: Readonly<Record<string, string>>;
}

function contrastOf(detail: StudyCatalogDetail | undefined): StudyContrast {
  if (detail === undefined) return 'opcional';
  const declared = detail.imaging?.contrast;
  if (detail.contrastOptions.length > 1) return 'opcional';
  return CONTRAST_KINDS.includes(declared as ContrastKind) ? (declared as ContrastKind) : 'opcional';
}

/**
 * Lo que el selector de imagen necesita, armado del listado y de los detalles
 * ya leídos.
 *
 * El listado trae el concepto de la modalidad y de la región por defecto, no
 * su código: el código sale primero de un detalle (que es el que usa el mapeo
 * del cuerpo 3D) y, mientras no hay, de las etiquetas de terminología. Así un
 * mismo estudio no cambia de clave entre filtrar y elegir.
 */
export function buildImagingCatalog(
  items: readonly StudyCatalogItem[],
  labels: ConceptLabels,
  details: ReadonlyMap<string, StudyCatalogDetail>,
): ImagingCatalogView {
  const detailCode = new Map<string, string>();
  const detailName = new Map<string, string>();
  const regionConceptIds: Record<string, string> = {};
  const lateralityConceptIds: Record<string, string> = {};
  const contrast = new Map<string, ContrastOption>();
  const regions = new Map<string, BodyRegionCatalogEntry>();

  for (const detail of details.values()) {
    for (const m of detail.allowedModalities) {
      detailCode.set(m.conceptId, m.code);
      detailName.set(m.conceptId, m.display);
    }
    for (const r of detail.allowedBodySites) {
      detailCode.set(r.conceptId, r.code);
    }
    for (const l of detail.lateralityOptions) lateralityConceptIds[l.code] = l.conceptId;
    for (const c of detail.contrastOptions) {
      if (!contrast.has(c.conceptId)) contrast.set(c.conceptId, { conceptId: c.conceptId, label: c.display, isDefault: c.isDefault });
    }
  }
  const codeOf = (conceptId: string): string => detailCode.get(conceptId) ?? labels.get(conceptId)?.code ?? conceptId;
  const nameOf = (conceptId: string): string => detailName.get(conceptId) ?? labels.get(conceptId)?.display ?? codeOf(conceptId);

  for (const detail of details.values()) {
    for (const r of detail.allowedBodySites) {
      const code = codeOf(r.conceptId);
      regionConceptIds[code] = r.conceptId;
      regions.set(code, {
        codigo: code,
        nombre: r.display,
        padre: r.parentConceptId === null ? null : codeOf(r.parentConceptId),
        ...(r.regionType === null ? {} : { tipo: r.regionType }),
        admite_lateralidad: r.admitsLaterality,
      });
    }
  }

  const modalities = new Map<string, ImagingModalityOption>();
  const studies: ImagingStudyOption[] = [];
  for (const item of items) {
    const detail = details.get(item.conceptId);
    const modalidad = item.modalityConceptId === null ? '' : codeOf(item.modalityConceptId);
    if (item.modalityConceptId !== null && !modalities.has(modalidad)) {
      modalities.set(modalidad, { codigo: modalidad, nombre: nameOf(item.modalityConceptId), conceptId: item.modalityConceptId });
    }
    const defaultSite = detail?.allowedBodySites.find((s) => s.isDefault);
    const region = defaultSite !== undefined ? codeOf(defaultSite.conceptId) : item.bodySiteConceptId === null ? '' : codeOf(item.bodySiteConceptId);
    if (item.bodySiteConceptId !== null && !regions.has(region)) {
      regions.set(region, { codigo: region, nombre: nameOf(item.bodySiteConceptId), padre: null, admite_lateralidad: false });
    }
    studies.push({
      conceptId: item.conceptId,
      codigo: item.code,
      nombre: item.display,
      sinonimos: [],
      modalidad,
      region,
      ...(detail === undefined ? {} : { regionesPermitidas: detail.allowedBodySites.map((s) => codeOf(s.conceptId)) }),
      requiereLateralidad: detail?.imaging?.requiresLaterality ?? false,
      contraste: contrastOf(detail),
      viaContraste: detail?.imaging?.contrastRoute ?? null,
      proyecciones: detail?.imaging?.projections ?? [],
      preparacion: detail?.imaging?.preparation ?? null,
    });
  }
  return {
    modalities: [...modalities.values()],
    studies,
    regions: [...regions.values()],
    contrastOptions: [...contrast.values()],
    regionConceptIds,
    lateralityConceptIds,
  };
}

/* ---- errores 422 ----------------------------------------------------------- */

/** Cada `details.reason` de la API, en castellano y en palabras de quien pide. */
const REASON_MESSAGE: Readonly<Record<string, string>> = {
  STUDY_NOT_IN_CATALOG: 'este estudio ya no está en el catálogo de estudios pedibles.',
  SERVICE_REQUEST_CATEGORY_STUDY_MISMATCH: 'la categoría no corresponde al tipo de estudio.',
  SPECIMEN_NOT_ALLOWED_FOR_CATEGORY: 'la muestra sólo se pide en laboratorio.',
  SPECIMEN_TYPE_NOT_IN_CATALOG: 'la muestra elegida no está en el catálogo de muestras.',
  COMPONENTS_EMPTY: 'marque al menos un componente del panel.',
  COMPONENT_NOT_IN_PANEL: 'uno de los componentes no pertenece a este panel.',
  COMPONENTS_NOT_SELECTABLE: 'este estudio no se pide por componentes.',
  IMAGING_FIELDS_NOT_ALLOWED: 'la región, el lado y el contraste sólo se piden en imagenología.',
  MODALITY_NOT_IN_CATALOG: 'la modalidad no está en el catálogo.',
  MODALITY_STUDY_MISMATCH: 'la modalidad no es la de este estudio.',
  MODALITY_REQUIRED: 'falta la modalidad.',
  BODY_SITE_NOT_IN_CATALOG: 'la región del cuerpo no está en el catálogo.',
  BODY_SITE_REQUIRED: 'falta la región del cuerpo.',
  BODY_SITE_NOT_ALLOWED: 'esa región no corresponde a este estudio.',
  LATERALITY_NOT_IN_CATALOG: 'el lado elegido no está en el catálogo.',
  LATERALITY_REQUIRES_BODY_SITE: 'para indicar el lado hace falta una región.',
  LATERALITY_NOT_APPLICABLE: 'esa región no tiene lado.',
  LATERALITY_REQUIRED: 'falta indicar el lado.',
  CONTRAST_NOT_IN_CATALOG: 'el contraste no está en el catálogo.',
  CONTRAST_REQUIRES_MODALITY: 'para indicar el contraste hace falta la modalidad.',
  DUPLICATE_STUDY_NOT_FOUND: 'el informe previo elegido ya no existe.',
  DUPLICATE_STUDY_MISMATCH: 'el informe previo ya no es el que cubre este pedido.',
};

/** El campo del cuerpo (`details.field`) en palabras. */
const FIELD_NAME: Readonly<Record<string, string>> = {
  codeConceptId: 'el estudio',
  category: 'la categoría',
  specimenTypeConceptId: 'la muestra',
  componentConceptIds: 'los componentes',
  'imaging.modalityConceptId': 'la modalidad',
  'imaging.bodySiteConceptId': 'la región',
  'imaging.lateralityConceptId': 'el lado',
  'imaging.contrastConceptId': 'el contraste',
  'duplicateDecision.previousDiagnosticReportId': 'el informe previo',
};

export interface RequisitionFieldError {
  /** El renglón (base 0) que falla, o `null` si el error es de toda la requisición. */
  readonly itemIndex: number | null;
  readonly field: string | null;
  readonly reason: string | null;
  readonly message: string;
}

/**
 * Un 422 `PRECONDITION_FAILED` de la requisición, llevado a su renglón y campo.
 * `details` es lo que la API manda en `details` (nunca el `reason` de primer nivel).
 */
export function requisitionFieldError(
  details: Readonly<Record<string, unknown>> | undefined,
  serverMessage: string,
  labels: readonly string[],
): RequisitionFieldError {
  const reason = typeof details?.['reason'] === 'string' ? details['reason'] : null;
  const field = typeof details?.['field'] === 'string' ? details['field'] : null;
  const index = typeof details?.['itemIndex'] === 'number' ? details['itemIndex'] : null;
  const known = reason === null ? undefined : REASON_MESSAGE[reason];
  const where = index === null ? '' : `${labels[index] ?? `Estudio ${index + 1}`}: `;
  const about = known === undefined && field !== null && FIELD_NAME[field] !== undefined ? ` (${FIELD_NAME[field]})` : '';
  const text = known ?? `${serverMessage || 'No se pudo registrar el pedido.'}${about}`;
  return { itemIndex: index, field, reason, message: `${where}${text}` };
}
