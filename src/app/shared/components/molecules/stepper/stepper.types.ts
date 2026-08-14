/* ============================================================================
    Contratos del Stepper — indicador de avance por fases.

    El componente es **controlado**: no infiere el estado de cada paso, lo
    recibe ya resuelto. Quien lo use decide qué está hecho, qué se está
    haciendo y qué falta, porque esa lógica —qué fase persistió contra su API—
    vive en la pantalla, no en un indicador visual.
    ========================================================================== */

/** Los tres estados de un paso. Sin ámbar: no es el punto de acción. */
export const STEP_STATUSES = ['complete', 'current', 'upcoming'] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

/** Un paso del recorrido: su rótulo y en qué estado está. */
export interface StepperStep {
  readonly label: string;
  readonly status: StepStatus;
}
