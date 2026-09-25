import type {
  ChartNote,
  ClinicalSummary,
  Condition,
  Encounter,
  MedicationRequest,
} from '../../../core/data-access/clinical/clinical.types';
import type { Hecho } from '../../../shared/components/molecules/fact-list/fact-list.types';
import type {
  EncounterHeader,
  TimelineCondition,
  TimelineNote,
  TimelinePrescription,
} from '../../../shared/components/organisms/encounter-timeline/encounter-timeline.types';
import type { Tone } from '../../../shared/components/tone/tone.types';
import {
  CODIGO_ACTIVA,
  CODIGO_CONFIRMADO,
  CODIGO_DESCARTADO,
  diagnosisStateOf,
  type DiagnosisState,
  type ResolverCodigo,
} from '../../../shared/clinical/diagnosis-state';

/* ============================================================================
    «Lo registrado en este encuentro» — la línea del encuentro (C6) montada en
    la consulta del profesional (C8).

    ## Por qué el mapeo es propio y no el de la historia del paciente

    Porque las palabras no son las mismas. `history-view-model.ts` rotula la
    nota para quien fue atendido —«Lo que contaste», «Lo que se observó»— y acá
    la lee quien la escribió: el vocabulario es el clínico, y traducir hacia el
    paciente en la pantalla del médico sería cambiar el registro de una nota
    profesional por su versión divulgativa.

    Lo que **sí** se comparte es la clasificación del diagnóstico
    (`shared/clinical/diagnosis-state.ts`): dos criterios distintos para el
    mismo diagnóstico harían que una enfermedad descartada se viera activa en
    una de las dos superficies.

    ## Lo que esta línea NO lleva

    **Las órdenes de estudio.** La consulta no las lee: viven en
    `GET /diagnostic-results/me/orders`, que es la superficie del paciente, y
    pedirlas acá sería una lectura más por consulta para un dato que el bloque
    de diagnósticos ya muestra al abrirse. El organismo recibe la lista vacía y
    `loadingOrders` en falso, que es lo honesto: no las está trayendo.
   ========================================================================== */

/** El tono de cada bloque, el mismo que usa la historia del paciente. */
const TONO_DEL_ESTADO: Readonly<Record<DiagnosisState, Tone>> = Object.freeze({
  IN_STUDY: 'warning',
  ACTIVE: 'success',
  HISTORIC: 'info',
  REFUTED: 'info',
});

/** Resuelve un identificador de concepto a su etiqueta de pantalla. */
export type ResolverEtiqueta = (conceptId: string | undefined) => string;

/** Lo que quedó registrado en el encuentro en curso, listo para el organismo. */
export interface LoRegistrado {
  readonly encabezado: EncounterHeader;
  readonly notas: readonly TimelineNote[];
  readonly diagnosticos: readonly TimelineCondition[];
  readonly recetas: readonly TimelinePrescription[];
}

/**
 * Lo registrado en un encuentro, a partir de lo que la consulta ya leyó.
 *
 * Devuelve `null` cuando ese encuentro no está en el resumen: sin cabecera no
 * hay línea que dibujar, y una línea sin atención a la que pertenecer diría de
 * qué consulta se trata sin saberlo.
 *
 * Las notas van **todas**, liberadas al paciente o no: ésta es la pantalla de
 * quien las escribió, y esconderle su propio borrador sería esconderle trabajo
 * suyo. El filtro por `releasedToPatient` es de la historia del paciente, que
 * mira lo mismo desde el otro lado.
 */
export function loRegistradoEnElEncuentro(
  encounterId: string,
  resumen: ClinicalSummary,
  notas: readonly ChartNote[],
  etiqueta: ResolverEtiqueta,
  codigo: ResolverCodigo,
): LoRegistrado | null {
  const encuentro = resumen.encounters.find((fila) => fila.id === encounterId);
  if (encuentro === undefined) {
    return null;
  }

  return {
    encabezado: cabeceraDe(encuentro),
    notas: notas.filter((nota) => nota.encounterId === encounterId).map((nota) => notaDeLaLinea(nota)),
    diagnosticos: resumen.conditions
      .filter((condicion) => condicion.encounterId === encounterId)
      .map((condicion) => diagnosticoDeLaLinea(condicion, etiqueta, codigo)),
    recetas: resumen.medicationRequests
      .filter((receta) => receta.encounterId === encounterId)
      .map((receta) => recetaDeLaLinea(receta, resumen, etiqueta)),
  };
}

function cabeceraDe(encuentro: Encounter): EncounterHeader {
  return {
    id: encuentro.id,
    motivo: encuentro.reasonText ?? 'Consulta',
    cuando: encuentro.startAt ?? null,
    cerrada: encuentro.endAt !== undefined,
  };
}

/**
 * Una nota del expediente con sus apartados, en el vocabulario del profesional.
 *
 * Los cinco rótulos son los del contrato de `ChartNote` —el SOAP de toda la
 * vida— y no los de la historia del paciente. Un apartado sin texto viaja en
 * `null` en vez de omitirse: la lista de hechos ya sabe callar lo vacío, y
 * omitirlo acá haría que dos notas con distintos apartados se leyeran como si
 * el contrato fuera otro.
 */
function notaDeLaLinea(nota: ChartNote): TimelineNote {
  const filas: Hecho[] = [
    { etiqueta: 'Motivo de consulta', valor: nota.chiefComplaintText ?? null },
    { etiqueta: 'Subjetivo', valor: nota.subjectiveText ?? null },
    { etiqueta: 'Objetivo', valor: nota.objectiveText ?? null },
    { etiqueta: 'Evaluación', valor: nota.assessmentText ?? null },
    { etiqueta: 'Plan', valor: nota.planText ?? null },
  ];

  return {
    id: nota.noteId,
    // «Nota #a1b2»: cuatro caracteres distinguen dos notas del mismo día y no
    // son el identificador, que no se dibuja en ninguna de las dos pantallas.
    rotulo: `${nota.signedAt === undefined ? 'Borrador' : 'Nota'} #${nota.noteId.replace(/-/g, '').slice(-4)}`,
    cuando: nota.signedAt ?? nota.createdAt,
    filas,
  };
}

/** «Diagnóstico confirmado: Faringitis aguda». */
function diagnosticoDeLaLinea(
  condicion: Condition,
  etiqueta: ResolverEtiqueta,
  codigo: ResolverCodigo,
): TimelineCondition {
  return {
    id: condicion.id,
    nombre: etiqueta(condicion.codeConceptId),
    estado: etiqueta(condicion.verificationStatusConceptId),
    tono: TONO_DEL_ESTADO[diagnosisStateOf({
      ...condicion,
      verificationStatusConceptId: codigo(condicion.verificationStatusConceptId),
      clinicalStatusConceptId: codigo(condicion.clinicalStatusConceptId),
    }, { confirmed: CODIGO_CONFIRMADO, refuted: CODIGO_DESCARTADO, active: CODIGO_ACTIVA })],
    detalle: condicion.resolvedAt === undefined ? null : 'resuelto',
    cuando: condicion.createdAt,
  };
}

/**
 * «Receta: Amoxicilina — por Faringitis aguda».
 *
 * La indicación sale del diagnóstico que la justifica cuando la receta lo
 * declara; si no, del texto de la propia receta. Sin ninguno de los dos va en
 * `null`, que el organismo omite — inventarle un motivo a una prescripción es
 * exactamente lo que no se puede hacer.
 */
function recetaDeLaLinea(
  receta: MedicationRequest,
  resumen: ClinicalSummary,
  etiqueta: ResolverEtiqueta,
): TimelinePrescription {
  const diagnostico = resumen.conditions.find((fila) => fila.id === receta.indicationConditionId);
  const detalle = [receta.doseText, receta.frequencyText].filter(Boolean).join(' · ');

  return {
    id: receta.id,
    medicamento: etiqueta(receta.medicationConceptId),
    indicacion:
      diagnostico === undefined
        ? (receta.indicationText ?? null)
        : `por ${etiqueta(diagnostico.codeConceptId)}`,
    detalle: detalle === '' ? null : detalle,
    cuando: receta.createdAt,
  };
}
