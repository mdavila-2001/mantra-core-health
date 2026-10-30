import { computed, inject, signal, type Signal } from '@angular/core';

import type { AnalysisCategory } from '../../../../core/data-access/diagnostics/diagnostics.types';
import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';

/**
 * Las familias de estudio que la orden distingue.
 *
 * Cada una nombra a quién va la orden. Las tres primeras se mandan como texto
 * (`category`) y la API las resuelve a su concepto; las otras tres no tienen
 * texto en el contrato y viajan como `categoryConceptId`.
 */
export type StudyFamily = 'LAB' | 'IMAGING' | 'CARDIO' | 'PATHOLOGY' | 'PROCEDURE' | 'OTHER';

/** La familia en palabras, para quien pide. */
export const STUDY_FAMILY_LABELS: Readonly<Record<StudyFamily, string>> = {
  LAB: 'Laboratorio',
  IMAGING: 'Imagenología',
  CARDIO: 'Estudio cardiológico',
  PATHOLOGY: 'Anatomía patológica',
  PROCEDURE: 'Procedimiento diagnóstico',
  OTHER: 'Otro estudio',
};

/**
 * El prefijo con que el catálogo de estudios agrupa sus códigos
 * (`LAB_HEMOGRAMA`, `IMG_RX_TORAX`, `CAR_ECG`, `PAT_BIOPSIA`, `PRO_EEG`).
 */
const FAMILY_BY_STUDY_PREFIX: Readonly<Record<string, StudyFamily>> = {
  LAB: 'LAB',
  IMG: 'IMAGING',
  CAR: 'CARDIO',
  PAT: 'PATHOLOGY',
  PRO: 'PROCEDURE',
};

/** El código de categoría de cada familia que no viaja como texto. */
const CATEGORY_CODE_BY_FAMILY: Readonly<Partial<Record<StudyFamily, string>>> = {
  CARDIO: 'CARDIO',
  PATHOLOGY: 'PATHOLOGY',
  PROCEDURE: 'PROCEDURE',
};

/** `clinical:SR_X` → `SR_X`: el catálogo nombra con y sin el módulo delante. */
function withoutModule(code: string): string {
  const cut = code.indexOf(':');
  return cut === -1 ? code : code.slice(cut + 1);
}

/**
 * La familia de un estudio, por el prefijo de su código.
 *
 * Un estudio que no lleva un prefijo conocido es «otro estudio», no un error:
 * el catálogo puede crecer con estudios que no son de ninguna de las cinco.
 */
export function studyFamilyOf(studyCode: string | null | undefined): StudyFamily | null {
  if (studyCode === null || studyCode === undefined || studyCode === '') {
    return null;
  }
  const prefix = withoutModule(studyCode).split(/[_-]/)[0].toUpperCase();
  return FAMILY_BY_STUDY_PREFIX[prefix] ?? 'OTHER';
}

/** El código de categoría (`SR_PROCEDURE`, `SRQ-PROCEDURE`…) sin prefijos: `PROCEDURE`. */
function categoryKey(code: string): string {
  return withoutModule(code).replace(/^(SRQ?[_-]|SERVICE_REQUEST_CATEGORY_)/, '');
}

/** Lo que la orden manda como categoría. */
export type StudyCategoryFields =
  | { readonly category: AnalysisCategory }
  | { readonly categoryConceptId: string };

/** El tipo de la orden, deducido del estudio que se pide. */
export interface StudyCategoryState {
  /** La familia del estudio elegido, o `null` sin estudio. */
  readonly family: Signal<StudyFamily | null>;
  /** La familia en palabras, o `null` sin estudio. */
  readonly label: Signal<string | null>;
  /** El concepto de la categoría, para quien necesita saber si es un procedimiento. */
  readonly conceptId: Signal<string | null>;
  /** Lo que viaja en el alta, o `null` si todavía no hay estudio. */
  readonly fields: Signal<StudyCategoryFields | null>;
}

/**
 * El tipo de la orden sale del estudio, no de un segundo selector.
 *
 * Con dos selectores, «Hemograma» se podía pedir como «Imagenología» y la orden
 * se iba a la cola equivocada. Peor: la imagen elegida a mano se guardaba con
 * el concepto de `clinical`, que la ficha no lista, y la orden desaparecía del
 * histórico. Mandando `category: 'IMAGING'` la API escribe el concepto que el
 * circuito diagnóstico lee.
 *
 * Se crea en el contexto de inyección del componente, como el estado del
 * selector de ejecutor.
 */
export function createStudyCategoryState(inputs: {
  readonly study: Signal<string | null>;
  readonly studyTarget: string;
  readonly categoryTarget: string;
}): StudyCategoryState {
  const systemContext = inject(SystemContextClient);
  const studyCodes = signal<ReadonlyMap<string, string>>(new Map());
  const categoryConcepts = signal<ReadonlyMap<string, string>>(new Map());

  // El cliente memoiza por target: son las mismas peticiones que hacen los selectores.
  systemContext.dynamicEnum(inputs.studyTarget).subscribe({
    next: (e) => studyCodes.set(new Map(e.options.map((o) => [o.conceptId, o.code]))),
    error: () => studyCodes.set(new Map()),
  });
  systemContext.dynamicEnum(inputs.categoryTarget).subscribe({
    next: (e) => categoryConcepts.set(new Map(e.options.map((o) => [categoryKey(o.code), o.conceptId]))),
    error: () => categoryConcepts.set(new Map()),
  });

  const family = computed<StudyFamily | null>(() => {
    const study = inputs.study();
    return study === null ? null : (studyFamilyOf(studyCodes().get(study)) ?? 'OTHER');
  });

  const conceptId = computed<string | null>(() => {
    const chosen = family();
    if (chosen === null) {
      return null;
    }
    return categoryConcepts().get(CATEGORY_CODE_BY_FAMILY[chosen] ?? chosen) ?? null;
  });

  const fields = computed<StudyCategoryFields | null>(() => {
    const chosen = family();
    if (chosen === null) {
      return null;
    }
    if (chosen === 'LAB' || chosen === 'IMAGING' || chosen === 'OTHER') {
      return { category: chosen };
    }
    // Sin el concepto publicado no se inventa uno: la orden sale como «otro
    // estudio», que la ficha lista y el paciente ve.
    const id = conceptId();
    return id === null ? { category: 'OTHER' } : { categoryConceptId: id };
  });

  return {
    family,
    label: computed(() => {
      const chosen = family();
      return chosen === null ? null : STUDY_FAMILY_LABELS[chosen];
    }),
    conceptId,
    fields,
  };
}
