/* ============================================================================
    Las rutas del archivo clínico, en un solo lugar.

    Mismo criterio que `admin/patients/patients.routes.ts`, y una razón más:
    **la agenda enlaza acá**. La constante vivía dentro del componente que pinta
    la sección, así que importarla desde otra pantalla arrastraba al bundle de
    esa pantalla el componente entero —y con él sus clientes de datos y su banco
    de componentes—, que es justo lo que la carga diferida de `app.routes.ts`
    evita. Un archivo de datos puros no arrastra nada.

    La sección padre la declara `core/navigation/navigation.map.ts`; estas son
    sus pantallas.
    ========================================================================== */

/** Elección de persona (M08 + M15). Coincide con la sección del menú. */
export const CLINICAL_RECORD_ROUTE = '/medical-records';

/** Expediente clínico de una persona concreta (UC-39-20 y UC-40-14). */
export function patientChartRoute(profileId: string): string {
  return `${CLINICAL_RECORD_ROUTE}/${profileId}`;
}

/** El parámetro con el que la agenda precarga el motivo de consulta. */
export const MOTIVO_QUERY_PARAM = 'motivo';

/**
 * El parámetro que ata el encuentro al turno que lo originó.
 *
 * Lleva el `appointmentId` de la reserva —la cita clínica que la respalda—, que
 * es lo que acepta `POST /clinical/encounters/check-in`. **No** el `id` de la
 * reserva: apunta a otra tabla y violaría la clave foránea.
 *
 * Sólo viaja cuando la reserva tiene cita clínica detrás. Su ausencia es
 * corriente y no rompe nada: el encuentro se abre igual, sin el vínculo.
 */
export const CITA_QUERY_PARAM = 'cita';
