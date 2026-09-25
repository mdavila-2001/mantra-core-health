import type { Condition } from '../../../core/data-access/clinical/clinical.types';

/* ============================================================================
    En qué bloque de la historia entra un diagnóstico: **en estudio**,
    **enfermedad activa** o **histórico**.

    // TODO C8: unificar con `shared/clinical/diagnosis-state.ts` de C0 cuando
    // llegue. C0 no está publicado —no existe `src/app/shared/clinical/`— y
    // este carril no puede esperarlo. Vive acá y no en `shared/` a propósito:
    // crear la carpeta que C0 va a crear garantizaría el conflicto de merge que
    // C8 tendría que resolver a mano. Cuando C0 aterrice, esto se muda entero y
    // la pantalla sólo cambia de import.

    ## La decisión es por **código de catálogo**, nunca por etiqueta

    `DXV-CONFIRMED`, `DXV-REFUTED`, `COND-ACTIVE` son códigos publicados; las
    etiquetas —«Confirmado», «Descartado»— son metadato de presentación y pueden
    cambiar sin aviso. Ramificar por la etiqueta es lo que hace que un cambio de
    redacción en el catálogo mueva un diagnóstico de bloque.

    ## Por qué la clasificación es total

    Porque un diagnóstico que no cae en ningún bloque **desaparece** de la
    historia, y un registro clínico que desaparece es peor que uno mal
    clasificado: nadie lo va a buscar. Las cinco reglas cubren todos los casos,
    incluido el de un registro sin estado declarado.
    ========================================================================== */

/** Certeza diagnóstica: el diagnóstico quedó confirmado. */
export const CODIGO_CONFIRMADO = 'DXV-CONFIRMED';

/** Certeza diagnóstica: el profesional lo **descartó**. Es el kill-test de C6. */
export const CODIGO_DESCARTADO = 'DXV-REFUTED';

/** Estado clínico: la condición sigue activa. */
export const CODIGO_ACTIVA = 'COND-ACTIVE';

/** Estado clínico: la condición se resolvió. */
export const CODIGO_RESUELTA = 'COND-RESOLVED';

/** Estado clínico: la condición está en remisión — ya no es una enfermedad activa. */
export const CODIGO_REMISION = 'COND-REMISSION';

/** Curso clínico: la condición no tiene resolución esperada, se sigue de por vida. */
export const CODIGO_CURSO_CRONICO = 'COND_COURSE_CHRONIC';

/** Los tres bloques de la pestaña «Diagnósticos», en el orden en que se leen. */
export const DIAGNOSIS_STATES = ['en-estudio', 'activa', 'historico'] as const;

export type DiagnosisState = (typeof DIAGNOSIS_STATES)[number];

/**
 * Cómo se llama cada bloque para quien lee su historia.
 *
 * «En estudio» y no «Provisional»: el paciente no tiene por qué conocer la
 * escala de certeza diagnóstica, y lo que necesita saber es que todavía no hay
 * una respuesta cerrada.
 */
export const DIAGNOSIS_STATE_LABELS: Readonly<Record<DiagnosisState, string>> = Object.freeze({
  'en-estudio': 'En estudio',
  activa: 'Enfermedades activas',
  historico: 'Históricos',
});

/** Resuelve un identificador de concepto a su **código** de catálogo. */
export type ResolverCodigo = (conceptId: string | undefined) => string | undefined;

/**
 * En qué bloque entra el diagnóstico.
 *
 * Las reglas, en orden y excluyentes:
 *
 * 1. **Descartado** (`DXV-REFUTED`) → histórico. Va primero a propósito: si un
 *    diagnóstico rechazado apareciera como enfermedad activa, la historia
 *    estaría afirmando que la persona tiene algo que su médico descartó.
 * 2. **Resuelto** —`resolvedAt` o `COND-RESOLVED`— → histórico.
 * 3. **En remisión** (`COND-REMISSION`) → histórico: dejó de ser una enfermedad
 *    activa, y listarla entre las activas diría lo contrario.
 * 4. **Confirmado** (`DXV-CONFIRMED`) → enfermedad activa.
 * 5. Todo lo demás —provisional, diferencial, o sin certeza declarada— → en
 *    estudio, que es la afirmación más débil de las tres y la única honesta
 *    cuando el registro no dice nada.
 */
export function diagnosisStateOf(condicion: Condition, codigo: ResolverCodigo): DiagnosisState {
  const certeza = codigo(condicion.verificationStatusConceptId);
  const clinico = codigo(condicion.clinicalStatusConceptId);

  if (certeza === CODIGO_DESCARTADO) {
    return 'historico';
  }
  if (condicion.resolvedAt !== undefined || clinico === CODIGO_RESUELTA) {
    return 'historico';
  }
  if (clinico === CODIGO_REMISION) {
    return 'historico';
  }
  return certeza === CODIGO_CONFIRMADO ? 'activa' : 'en-estudio';
}

/** La condición se sigue de por vida: no hay «hasta» que mostrar. */
export function esCronica(condicion: Condition, codigo: ResolverCodigo): boolean {
  return codigo(condicion.clinicalCourseConceptId) === CODIGO_CURSO_CRONICO;
}

/** La condición está declarada activa por el catálogo. */
export function estaActiva(condicion: Condition, codigo: ResolverCodigo): boolean {
  return codigo(condicion.clinicalStatusConceptId) === CODIGO_ACTIVA;
}
