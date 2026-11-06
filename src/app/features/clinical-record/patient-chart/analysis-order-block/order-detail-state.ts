import { computed, inject, signal, type Signal, type WritableSignal } from '@angular/core';

import type { DiagnosticOrder, NewDiagnosticOrder } from '../../../../core/data-access/diagnostics/diagnostics.types';
import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import {
  BODY_REGIONS,
  CONTRAST_LABELS,
  IMAGING_GUIDANCE_NOTICE,
  IMAGING_MODALITIES,
  LATERALITY_LABELS,
  ORDER_KIND_OPTIONS,
  SPECIMEN_LABELS,
  bareCode,
  bodyRegionOfAtlas,
  bodyRegionOfCode,
  imagingModalityCodeOf,
  imagingModalityOf,
  imagingStudyOptions,
  labTreeFor,
  labTypesFor,
  labeledOptions,
  specimenFitsLabType,
  type LabTypeId,
  type OrderKind,
  type StudyOption,
} from './study-order-kind';

/* El detalle de la orden (v4.2.82). Cada uno es el binding de su columna: la
   API los publica por `dynamic-enums`, y sin binding el campo no se ofrece. */
export const TARGET_MUESTRA = 'clinical.service_requests.specimen_type_concept_id';
export const TARGET_MODALIDAD = 'clinical.service_requests.modality_concept_id';
export const TARGET_REGION = 'clinical.service_requests.body_site_concept_id';
export const TARGET_LATERALIDAD = 'clinical.service_requests.laterality_concept_id';
export const TARGET_CONTRASTE = 'clinical.service_requests.contrast_concept_id';

/** Una opción de un catálogo publicado, tal como la entrega `dynamic-enums`. */
export interface OpcionDeCatalogo {
  readonly conceptId: string;
  readonly code: string;
  readonly display: string;
  readonly displayEs?: string;
}

const ROTULOS_DE_MODALIDAD: Readonly<Record<string, string>> = Object.fromEntries(
  IMAGING_MODALITIES.map((m) => [m.code, m.label]),
);
const ROTULOS_DE_REGION: Readonly<Record<string, string>> = Object.fromEntries(BODY_REGIONS.map((r) => [r.code, r.label]));

/** Lo que el estado necesita del bloque que lo aloja. */
export interface OrderDetailInputs {
  /** El estudio elegido (`conceptId`); lo escribe el estado al cambiar de tipo. */
  readonly study: WritableSignal<string | null>;
  /** El catálogo de estudios, para armar el árbol y el filtro por tipo de imagen. */
  readonly studyTarget: string;
  /** La etiqueta de un concepto cuando el catálogo del detalle no lo trae. */
  readonly labelOf: (conceptId: string | undefined) => string;
}

/**
 * El tipo de orden y su detalle: laboratorio con tipo de análisis, árbol de
 * estudios y muestra; imagenología con tipo de imagen, región, lado y contraste.
 *
 * Es un estado y no código suelto en el bloque para que `AnalysisOrderBlock`
 * siga siendo el que pide, lee el histórico y ata el consentimiento, y no el que
 * además sabe qué le pregunta cada tipo. Se crea en el contexto de inyección del
 * componente, como el estado del selector de ejecutor.
 */
export function createOrderDetailState(inputs: OrderDetailInputs) {
  const systemContext = inject(SystemContextClient);

  const kind = signal<OrderKind | null>(null);
  /** El tipo de análisis de laboratorio: sólo organiza el árbol, no viaja. */
  const labType = signal<LabTypeId | null>(null);
  const specimen = signal<string | null>(null);
  /** El tipo de imagen: `conceptId` de `diagnostic-modality`. */
  const modality = signal<string | null>(null);
  /** La región elegida, por su código del atlas (`R01`…). */
  const region = signal<string | null>(null);
  const laterality = signal<string | null>(null);
  const contrast = signal<string | null>(null);

  const studies = signal<readonly OpcionDeCatalogo[]>([]);
  const specimens = signal<readonly OpcionDeCatalogo[]>([]);
  const modalities = signal<readonly OpcionDeCatalogo[]>([]);
  const regions = signal<readonly OpcionDeCatalogo[]>([]);
  const lateralities = signal<readonly OpcionDeCatalogo[]>([]);
  const contrasts = signal<readonly OpcionDeCatalogo[]>([]);

  // Sin binding publicado el campo simplemente queda vacío: no bloquea el pedido.
  const load = (target: string, destino: WritableSignal<readonly OpcionDeCatalogo[]>): void => {
    systemContext.dynamicEnum(target).subscribe({
      next: (e) => destino.set(e.options),
      error: () => destino.set([]),
    });
  };
  load(inputs.studyTarget, studies);
  load(TARGET_MUESTRA, specimens);
  load(TARGET_MODALIDAD, modalities);
  load(TARGET_REGION, regions);
  load(TARGET_LATERALIDAD, lateralities);
  load(TARGET_CONTRASTE, contrasts);

  const studyOptions = computed<readonly StudyOption[]>(() =>
    studies().map((o) => ({ conceptId: o.conceptId, code: o.code, label: o.displayEs ?? o.display })),
  );
  const labTypes = computed(() => labTypesFor(studyOptions()));
  const modalityCode = computed(() => imagingModalityOf(modalities().find((o) => o.conceptId === modality())?.code));
  const chosenRegion = computed(() => bodyRegionOfAtlas(region() ?? ''));

  /**
   * El detalle que viaja con la orden, según el tipo. Los vacíos se **omiten**
   * (el backend valida con `forbidNonWhitelisted`) y no se manda lo que la API
   * rechazaría por incoherente: lado sin región, contraste sin tipo de imagen, o
   * datos de imagen en una orden de laboratorio.
   */
  const fields = computed<Partial<NewDiagnosticOrder>>(() => {
    if (kind() === 'LAB') {
      const muestra = specimen();
      return muestra === null ? {} : { specimenTypeConceptId: muestra };
    }
    if (kind() !== 'IMAGING') {
      return {};
    }
    const tipoDeImagen = modality();
    const elegida = chosenRegion();
    const bodySite =
      elegida === null ? undefined : regions().find((o) => bodyRegionOfCode(o.code)?.atlas === elegida.atlas)?.conceptId;
    const lado = bodySite === undefined ? null : laterality();
    const medio = tipoDeImagen === null ? null : contrast();
    return {
      ...(tipoDeImagen === null ? {} : { modalityConceptId: tipoDeImagen }),
      ...(bodySite === undefined ? {} : { bodySiteConceptId: bodySite }),
      ...(lado === null ? {} : { lateralityConceptId: lado }),
      ...(medio === null ? {} : { contrastConceptId: medio }),
    };
  });

  const clearDetail = (): void => {
    labType.set(null);
    specimen.set(null);
    modality.set(null);
    region.set(null);
    laterality.set(null);
    contrast.set(null);
  };

  const estudiosDeImagen = computed(() => imagingStudyOptions(studyOptions(), modalityCode()?.code ?? null));

  /** El detalle de una orden como texto: «Sangre venosa» o «Rayos X · Miembro superior · Izquierdo». */
  const describe = (orden: DiagnosticOrder): string | null => {
    const rotulo = (
      id: string | undefined,
      opciones: readonly OpcionDeCatalogo[],
      rotulos: Readonly<Record<string, string>>,
    ): string | null => {
      if (id === undefined) {
        return null;
      }
      const opcion = opciones.find((o) => o.conceptId === id);
      return opcion === undefined ? inputs.labelOf(id) : (rotulos[bareCode(opcion.code)] ?? opcion.displayEs ?? opcion.display);
    };
    const partes = [
      rotulo(orden.specimenTypeConceptId, specimens(), SPECIMEN_LABELS),
      rotulo(orden.modalityConceptId, modalities(), ROTULOS_DE_MODALIDAD),
      rotulo(orden.bodySiteConceptId, regions(), ROTULOS_DE_REGION),
      rotulo(orden.lateralityConceptId, lateralities(), LATERALITY_LABELS),
      rotulo(orden.contrastConceptId, contrasts(), CONTRAST_LABELS),
    ].filter((p): p is string => p !== null);
    return partes.length === 0 ? null : partes.join(' · ');
  };

  return {
    kindOptions: ORDER_KIND_OPTIONS,
    kind,
    labType,
    specimen,
    modality,
    region,
    laterality,
    contrast,
    atlasRegions: BODY_REGIONS,
    guidanceNotice: IMAGING_GUIDANCE_NOTICE,
    labTypeOptions: computed(() => labTypes().map((t) => ({ value: t.id, label: t.label, description: t.summary }))),
    labTree: computed(() => {
      const tipo = labType();
      return tipo === null ? [] : labTreeFor(tipo, studyOptions());
    }),
    labTypeSummary: computed(() => labTypes().find((t) => t.id === labType())?.summary ?? null),
    specimenOptions: computed(() => {
      const tipo = labType();
      return labeledOptions(specimens(), SPECIMEN_LABELS, (code) => (tipo === null ? true : specimenFitsLabType(tipo, code)));
    }),
    modalityOptions: computed(() =>
      labeledOptions(modalities(), ROTULOS_DE_MODALIDAD, (code) => IMAGING_MODALITIES.some((m) => m.code === code)),
    ),
    /** La ficha del tipo de imagen elegido (o la que implica el estudio). */
    guidance: modalityCode,
    imagingStudyOptions: estudiosDeImagen,
    lateralityOptions: computed(() => labeledOptions(lateralities(), LATERALITY_LABELS)),
    contrastOptions: computed(() => labeledOptions(contrasts(), CONTRAST_LABELS)),
    chosenRegion,
    fields,
    describe,

    /** Cambia el tipo de orden: lo que se había elegido para otro tipo no se arrastra. */
    chooseKind(tipo: OrderKind | null): boolean {
      if (tipo === kind()) {
        return false;
      }
      kind.set(tipo);
      inputs.study.set(null);
      clearDetail();
      return true;
    },
    /** Otro tipo de análisis, otro árbol: el estudio y la muestra del anterior no valen. */
    chooseLabType(tipo: LabTypeId | null): void {
      labType.set(tipo);
      inputs.study.set(null);
      specimen.set(null);
    },
    /** Otro tipo de imagen: el estudio elegido sigue valiendo sólo si es de ese tipo. */
    chooseModality(conceptId: string | null): void {
      modality.set(conceptId);
      contrast.set(null);
      const actual = inputs.study();
      if (actual !== null && !estudiosDeImagen().some((o) => o.value === actual)) {
        inputs.study.set(null);
      }
    },
    /** Elegir el estudio de imagen primero deduce el tipo de imagen, si no se había elegido. */
    chooseImagingStudy(conceptId: string | null): void {
      inputs.study.set(conceptId);
      if (conceptId === null || modality() !== null) {
        return;
      }
      const codigo = studies().find((o) => o.conceptId === conceptId)?.code;
      const tipoDeImagen = codigo === undefined ? null : imagingModalityCodeOf(codigo);
      const concepto = modalities().find((o) => bareCode(o.code) === tipoDeImagen);
      if (concepto !== undefined) {
        modality.set(concepto.conceptId);
      }
    },
    /** Sin región no hay lateralidad: la API la rechazaría, así que no se arrastra. */
    chooseRegion(atlas: string | null): void {
      region.set(atlas);
      if (atlas === null) {
        laterality.set(null);
      }
    },
    reset: clearDetail,
    /** Si el tipo ofrece el selector de ejecutor: laboratorio e imagen. */
    performerApplies: computed(() => kind() === 'LAB' || kind() === 'IMAGING') as Signal<boolean>,
    performerTitle: computed(() => {
      switch (kind()) {
        case 'LAB':
          return 'Qué laboratorio lo realiza';
        case 'IMAGING':
          return 'Qué centro de imagen lo realiza';
        default:
          return 'Quién realiza el procedimiento';
      }
    }),
  };
}

export type OrderDetailState = ReturnType<typeof createOrderDetailState>;
