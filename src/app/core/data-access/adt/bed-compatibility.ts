import type { CompatibilityRule } from './adt.types';

/* ============================================================================
    Compatibilidad cama ↔ paciente (F3.2): lo que la pantalla necesita para
    **nombrar** cada regla y pedir la justificación de un forzado.

    La regla la evalúa la API (`clinical/domain/inpatient/bed-compatibility.ts`);
    la copia que usa la maqueta para responder como ella vive en
    `core/mock/rules/bed-compatibility.ts` (M6: sólo la usa la maqueta).
    ========================================================================== */

export const RULE_LABEL: Readonly<Record<CompatibilityRule, string>> = {
  LIFECYCLE: 'Ciclo de vida',
  AVAILABILITY: 'Disponibilidad',
  OCCUPANCY: 'Ocupación',
  HYGIENE: 'Higiene',
  ISOLATION_AIRBORNE: 'Aislamiento aéreo',
  SEX: 'Sexo de la habitación',
  AGE: 'Grupo de edad',
  ISOLATION_COHORT: 'Cohorte de aislamiento',
  LEVEL_OF_CARE: 'Nivel de cuidado',
};

/** El nombre de una regla; una que la web no conoce se muestra con su código. */
export function ruleLabel(rule: string): string {
  return RULE_LABEL[rule as CompatibilityRule] ?? rule;
}

/** Mínimo de la justificación de un forzado (CHECK de `placement_incidents`). */
export const OVERRIDE_MIN_LENGTH = 20;
