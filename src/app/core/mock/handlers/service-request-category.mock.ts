import type { AnalysisCategory } from '../../data-access/diagnostics/diagnostics.types';
import { noteList } from '../fixtures/clinic';
import {
  DIAGNOSTIC_MODALITY,
  LATERALITY,
  ORDER_BODY_REGION,
  ORDER_CATEGORY,
  ORDER_CONTRAST,
  SPECIMEN_TYPE,
  STATUS,
} from '../fixtures/concepts';

/* ============================================================================
    P40 (carril C2) en el doble: la categoría textual de la orden de análisis y
    las notas que la motivan, con las mismas reglas que
    `POST /clinical/service-requests` de la API.

    - `category` es una vista de `categoryConceptId`: el texto se guarda como
      su concepto; si viajan los dos, tienen que coincidir (422
      `SERVICE_REQUEST_CATEGORY_MISMATCH`). Laboratorio e imagen se nombran;
      cualquier otra categoría declarada es `OTHER`; sin concepto, ausente.
    - `basedOnNoteIds`: cada nota existe y es del mismo paciente (si no, 422
      `BASED_ON_NOTE_NOT_FOUND`, igual para «no existe», «es de otro» o «es un borrador»)
      y, si la orden tiene encuentro, del mismo encuentro (422
      `BASED_ON_NOTE_ENCOUNTER_MISMATCH`).
    ========================================================================== */

const CONCEPTO_DE: Readonly<Record<AnalysisCategory, string>> = {
  LAB: ORDER_CATEGORY['SRQ-LAB']!,
  IMAGING: ORDER_CATEGORY['SRQ-IMAGING']!,
  OTHER: ORDER_CATEGORY['SRQ-OTHER']!,
};

const CATEGORIAS: readonly string[] = ['LAB', 'IMAGING', 'OTHER'];

/** Tope de notas por orden, el mismo que la API. */
export const TOPE_DE_NOTAS = 20;

/** La categoría textual de una orden, a partir de su concepto. */
export function categoriaDeLaOrden(
  categoryConceptId: string | undefined,
): AnalysisCategory | undefined {
  if (categoryConceptId === undefined || categoryConceptId === '') return undefined;
  if (categoryConceptId === CONCEPTO_DE.LAB) return 'LAB';
  if (categoryConceptId === CONCEPTO_DE.IMAGING) return 'IMAGING';
  return 'OTHER';
}

/** Un rechazo del alta: el estado y el cuerpo que daría la API. */
export interface RechazoDeOrden {
  readonly status: 400 | 422;
  readonly reason: string;
  readonly message: string;
}

/**
 * El `categoryConceptId` a guardar, o el rechazo.
 *
 * @param category - Lo que trajo el cuerpo en `category`.
 * @param categoryConceptId - Lo que trajo en `categoryConceptId`.
 */
export function resolverCategoria(
  category: unknown,
  categoryConceptId: string | undefined,
): { readonly conceptId: string | undefined } | RechazoDeOrden {
  if (category === undefined) return { conceptId: categoryConceptId };
  if (typeof category !== 'string' || !CATEGORIAS.includes(category)) {
    return {
      status: 400,
      reason: 'VALIDATION',
      message: 'category debe ser LAB, IMAGING u OTHER.',
    };
  }
  const texto = category as AnalysisCategory;
  if (categoryConceptId === undefined) return { conceptId: CONCEPTO_DE[texto] };
  if (categoriaDeLaOrden(categoryConceptId) !== texto) {
    return {
      status: 422,
      reason: 'SERVICE_REQUEST_CATEGORY_MISMATCH',
      message: 'La categoría indicada no corresponde al concepto de categoría',
    };
  }
  return { conceptId: categoryConceptId };
}

/**
 * Las notas validadas, o el rechazo.
 *
 * @param basedOnNoteIds - Lo que trajo el cuerpo.
 * @param patientProfileId - Paciente de la orden.
 * @param encounterId - Encuentro de la orden, si lo tiene.
 */
export function validarNotas(
  basedOnNoteIds: unknown,
  patientProfileId: string,
  encounterId: string | undefined,
): { readonly noteIds: readonly string[] } | RechazoDeOrden {
  if (basedOnNoteIds === undefined) return { noteIds: [] };
  if (
    !Array.isArray(basedOnNoteIds) ||
    basedOnNoteIds.length > TOPE_DE_NOTAS ||
    basedOnNoteIds.some((id) => typeof id !== 'string' || id === '') ||
    new Set(basedOnNoteIds).size !== basedOnNoteIds.length
  ) {
    return {
      status: 400,
      reason: 'VALIDATION',
      message: `basedOnNoteIds: hasta ${TOPE_DE_NOTAS} identificadores, sin repetidos.`,
    };
  }
  const ids = basedOnNoteIds as readonly string[];
  for (const noteId of ids) {
    const nota = noteList.filtrar((n) => n.noteId === noteId)[0];
    // Como la API: una nota en borrador todavía puede cambiar y no motiva una
    // orden; responde igual que una inexistente. (La custodia por tenant del
    // encuentro no se simula: el doble no guarda tenant en notas ni encuentros.)
    if (
      nota === undefined ||
      nota.patientProfileId !== patientProfileId ||
      nota.lifecycleStatusConceptId === STATUS['ST-DRAFT']
    ) {
      return {
        status: 422,
        reason: 'BASED_ON_NOTE_NOT_FOUND',
        message: 'La nota médica citada no existe en la historia de este paciente',
      };
    }
    if (encounterId !== undefined && nota.encounterId !== encounterId) {
      return {
        status: 422,
        reason: 'BASED_ON_NOTE_ENCOUNTER_MISMATCH',
        message: 'La nota médica citada pertenece a otra consulta',
      };
    }
  }
  return { noteIds: ids };
}

/** ¿Es un rechazo? */
export function esRechazo(valor: object): valor is RechazoDeOrden {
  return 'status' in valor;
}

/* ============================================================================
    El detalle de la orden (v4.2.82) en el doble: muestra en laboratorio; tipo
    de imagen, región, lado y contraste en imagenología. Las mismas reglas que
    la API (`service-request-detail.ts`): el cruce con la categoría, la
    pertenencia a su catálogo y las dos dependencias (lado ⇒ región, contraste
    ⇒ tipo de imagen). Cada una responde 422 con su `reason`.
    ========================================================================== */

export interface DetalleDeOrden {
  readonly specimenTypeConceptId?: string;
  readonly modalityConceptId?: string;
  readonly bodySiteConceptId?: string;
  readonly lateralityConceptId?: string;
  readonly contrastConceptId?: string;
}

const CAMPOS_DE_IMAGEN = ['modalityConceptId', 'bodySiteConceptId', 'lateralityConceptId', 'contrastConceptId'] as const;

const CATALOGOS_DEL_DETALLE: Readonly<Record<keyof DetalleDeOrden, ReadonlySet<string>>> = {
  specimenTypeConceptId: new Set(Object.values(SPECIMEN_TYPE)),
  // La modalidad de laboratorio no es un tipo de imagen.
  modalityConceptId: new Set(
    Object.entries(DIAGNOSTIC_MODALITY)
      .filter(([codigo]) => codigo !== 'DU_MODALITY_LAB')
      .map(([, id]) => id),
  ),
  bodySiteConceptId: new Set(Object.values(ORDER_BODY_REGION)),
  lateralityConceptId: new Set(Object.values(LATERALITY)),
  contrastConceptId: new Set(Object.values(ORDER_CONTRAST)),
};

/**
 * El detalle a guardar, o el rechazo.
 *
 * @param categoria - La categoría de la orden, o `undefined` si no la declara.
 * @param cuerpo - El cuerpo del alta.
 */
export function validarDetalle(
  categoria: AnalysisCategory | undefined,
  cuerpo: Readonly<Record<string, unknown>>,
): { readonly detalle: DetalleDeOrden } | RechazoDeOrden {
  const detalle: { -readonly [K in keyof DetalleDeOrden]: string } = {};
  for (const campo of Object.keys(CATALOGOS_DEL_DETALLE) as (keyof DetalleDeOrden)[]) {
    const valor = cuerpo[campo];
    if (valor === undefined) continue;
    if (typeof valor !== 'string') {
      return { status: 400, reason: 'VALIDATION_FAILED', message: `${campo} debe ser un uuid` };
    }
    detalle[campo] = valor;
  }
  const hayMuestra = detalle.specimenTypeConceptId !== undefined;
  const deImagen = CAMPOS_DE_IMAGEN.filter((c) => detalle[c] !== undefined);
  if (!hayMuestra && deImagen.length === 0) return { detalle };

  if ((hayMuestra && categoria !== 'LAB') || (deImagen.length > 0 && categoria !== 'IMAGING')) {
    return {
      status: 422,
      reason: 'SERVICE_REQUEST_DETAIL_NOT_FOR_CATEGORY',
      message: 'Esos datos no corresponden a la categoría de la orden',
    };
  }
  for (const [campo, valor] of Object.entries(detalle)) {
    if (!CATALOGOS_DEL_DETALLE[campo as keyof DetalleDeOrden].has(valor)) {
      return {
        status: 422,
        reason: 'SERVICE_REQUEST_DETAIL_NOT_IN_CATALOG',
        message: 'El valor no pertenece al catálogo de ese campo',
      };
    }
  }
  if (
    (detalle.lateralityConceptId !== undefined && detalle.bodySiteConceptId === undefined) ||
    (detalle.contrastConceptId !== undefined && detalle.modalityConceptId === undefined)
  ) {
    return {
      status: 422,
      reason: 'SERVICE_REQUEST_DETAIL_DEPENDENCY',
      message: 'La lateralidad necesita la región y el contraste necesita el tipo de imagen',
    };
  }
  return { detalle };
}
