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
export const CLINICAL_RECORD_ROUTE = '/clinico';

/** Expediente clínico de una persona concreta (UC-39-20 y UC-40-14). */
export function patientChartRoute(profileId: string): string {
  return `${CLINICAL_RECORD_ROUTE}/${profileId}`;
}

/**
 * El parámetro con el que la agenda precarga el motivo de consulta.
 *
 * Viaja el **texto** del motivo de la cita y no su identificador, y no es una
 * simplificación: `GET /scheduling/bookings` no expone `appointmentId`, y el
 * `appointmentId` del encuentro apunta a `clinical.appointments`, no a una
 * reserva de agenda. El texto es el único dato de la cita que el encuentro
 * puede recibir sin inventar una clave foránea. Ver P11 en
 * `PENDIENTES-BACKEND.md`.
 */
export const MOTIVO_QUERY_PARAM = 'motivo';
