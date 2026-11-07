import { computed, inject, signal, type Signal, type WritableSignal } from '@angular/core';

import type { DynamicEnumOption } from '../../../../core/data-access/system-context/system-context.types';
import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import {
  IMAGING_GUIDANCE_NOTICE,
  ORDER_KIND_OPTIONS,
  imagingModalityCodeOf,
  imagingModalityOf,
  imagingStudyOptions,
  labTreeFor,
  labTypesFor,
  modalityKey,
  specimenFitsLabType,
  bareCode,
  type LabTypeId,
  type OrderKind,
  type StudyOption,
} from './study-order-kind';

/** Lo que el estado necesita del bloque que lo aloja. */
export interface OrderKindInputs {
  /** El estudio elegido (`conceptId`); lo limpia el estado al cambiar de tipo. */
  readonly study: WritableSignal<string | null>;
  /** El catálogo de estudios, para armar el árbol y el filtro por tipo de imagen. */
  readonly studyTarget: string;
}

const TARGET_MODALIDAD = 'clinical.service_requests.modality_concept_id';

/**
 * El tipo de orden que se elige primero y lo que éste organiza (06/11/2026):
 *  - **Laboratorio**: el tipo de análisis arma el árbol de estudios y limita la muestra a las que ese tipo admite.
 *  - **Imagenología**: el tipo de imagen filtra los estudios y trae su ficha «qué hace / qué revisar».
 *  - **Otro estudio**: lo que ya se podía pedir (cardiología, anatomía patológica, procedimientos).
 *
 * Es sólo organización de lo que se pregunta: **no viaja nada de acá** excepto el tipo de imagen, que viaja como
 * `modalityConceptId` por la sección de detalle (`StudyDetailSection`), que sigue siendo la dueña de la muestra, la
 * región, el lado, el contraste y el tipo de hueso. Se crea en el contexto de inyección del componente.
 */
export function createOrderKindState(inputs: OrderKindInputs) {
  const systemContext = inject(SystemContextClient);

  const kind = signal<OrderKind | null>(null);
  /** El tipo de análisis de laboratorio: sólo organiza el árbol, no viaja. */
  const labType = signal<LabTypeId | null>(null);
  /** El tipo de imagen elegido: `conceptId` de `service-request-imaging-modality`. */
  const modality = signal<string | null>(null);

  const studies = signal<readonly DynamicEnumOption[]>([]);
  const modalities = signal<readonly DynamicEnumOption[]>([]);

  // Sin binding publicado la lista queda vacía: el bloque ya avisa cuando falta el catálogo de estudios.
  const load = (target: string, destino: WritableSignal<readonly DynamicEnumOption[]>): void => {
    systemContext.dynamicEnum(target).subscribe({
      next: (e) => destino.set(e.options),
      error: () => destino.set([]),
    });
  };
  load(inputs.studyTarget, studies);
  load(TARGET_MODALIDAD, modalities);

  const studyOptions = computed<readonly StudyOption[]>(() =>
    studies().map((o) => ({
      conceptId: o.conceptId,
      code: o.code,
      label: o.displayEs ?? o.display,
    })),
  );
  const chosenModality = computed(() => modalities().find((o) => o.conceptId === modality()));
  const guidance = computed(() => imagingModalityOf(chosenModality()?.code));

  const imagingStudies = computed(() =>
    imagingStudyOptions(studyOptions(), guidance()?.code ?? null),
  );

  /**
   * Si el estudio elegido primero fija el tipo de imagen y todavía no se eligió, se deduce de su código. Si el
   * catálogo no trae esa modalidad, el tipo queda sin elegir y la sección de detalle ofrece el campo de modalidad.
   */
  const deduceModalityFromStudy = (conceptId: string | null): void => {
    if (conceptId === null || modality() !== null) return;
    const code = studies().find((o) => o.conceptId === conceptId)?.code;
    const key = code === undefined ? null : imagingModalityCodeOf(code);
    const concept =
      key === null ? undefined : modalities().find((o) => modalityKey(o.code) === key);
    if (concept !== undefined) modality.set(concept.conceptId);
  };

  return {
    kindOptions: ORDER_KIND_OPTIONS,
    kind,
    labType,
    modality,
    guidanceNotice: IMAGING_GUIDANCE_NOTICE,
    guidance,
    labTypeOptions: computed(() =>
      labTypesFor(studyOptions()).map((t) => ({
        value: t.id,
        label: t.label,
        description: t.summary,
      })),
    ),
    labTypeSummary: computed(
      () => labTypesFor(studyOptions()).find((t) => t.id === labType())?.summary ?? null,
    ),
    labTree: computed(() => {
      const tipo = labType();
      return tipo === null ? [] : labTreeFor(tipo, studyOptions());
    }),
    /** Las muestras que admite el tipo de análisis elegido; sin tipo, todas. */
    specimenAccepts: computed<((code: string) => boolean) | null>(() => {
      const tipo = labType();
      return tipo === null ? null : (code: string) => specimenFitsLabType(tipo, bareCode(code));
    }),
    /** Los tipos de imagen del catálogo, con su nombre; los que tienen ficha propia primero. */
    modalityOptions: computed(() =>
      [...modalities()]
        .map((o) => ({
          value: o.conceptId,
          label: o.displayEs ?? o.display,
          ficha: imagingModalityOf(o.code) !== null,
        }))
        .sort((a, b) => Number(b.ficha) - Number(a.ficha))
        .map(({ value, label }) => ({ value, label })),
    ),
    imagingStudyOptions: imagingStudies,
    /** Hay catálogo de tipos de imagen (si no, el filtro no se ofrece y se pide por estudio). */
    hasModalities: computed(() => modalities().length > 0),

    /** Cambia el tipo de orden: lo que se había elegido para otro tipo no se arrastra. */
    chooseKind(tipo: OrderKind | null): boolean {
      if (tipo === kind()) return false;
      kind.set(tipo);
      inputs.study.set(null);
      labType.set(null);
      modality.set(null);
      return true;
    },
    /** Otro tipo de análisis, otro árbol: el estudio del anterior no vale. */
    chooseLabType(tipo: LabTypeId | null): void {
      labType.set(tipo);
      inputs.study.set(null);
    },
    /** Otro tipo de imagen: el estudio elegido sigue valiendo sólo si es de ese tipo. */
    chooseModality(conceptId: string | null): void {
      modality.set(conceptId);
      const actual = inputs.study();
      if (actual !== null && !imagingStudies().some((o) => o.value === actual))
        inputs.study.set(null);
    },
    /** Elegir el estudio de imagen primero deduce el tipo de imagen, si no se había elegido. */
    chooseImagingStudy(conceptId: string | null): void {
      inputs.study.set(conceptId);
      deduceModalityFromStudy(conceptId);
    },
    reset(): void {
      kind.set(null);
      labType.set(null);
      modality.set(null);
    },
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

export type OrderKindState = ReturnType<typeof createOrderKindState>;
