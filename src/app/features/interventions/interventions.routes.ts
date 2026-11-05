/* ============================================================================
    Las rutas de intervenciones médicas, en un solo lugar.

    Mismo criterio que `diagnostics/diagnostics.routes.ts`: la constante vivía
    dentro del componente que pinta la sección, así que importarla desde otra
    pantalla arrastraría al bundle de esa pantalla el componente entero —y con
    él sus clientes de datos y su banco de componentes—, que es justo lo que la
    carga diferida de `app.routes.ts` evita.

    La sección padre la declara `core/navigation/navigation.map.ts`; ésta es su
    pantalla.
    ========================================================================== */

/** La agenda de intervenciones (M53). Coincide con la sección del menú. */
export const INTERVENTIONS_ROUTE = '/interventions';

/* ---- F4 · quirófanos (`CONTRATO-F2-F5.md` §F4.4) ---------------------------- */

/** Programar una intervención con su ventana reservada. */
export const SCHEDULE_CASE_ROUTE = '/interventions/new';

/** Agenda del día por sala, con bloques y casos. */
export const OPERATING_ROOMS_ROUTE = '/interventions/operating-rooms';

/** Gestión de bloques y series. */
export const OR_BLOCKS_ROUTE = '/interventions/blocks';

/** KPI de sala y de bloque. */
export const OR_UTILIZATION_ROUTE = '/interventions/utilization';

/** La ficha de un caso. */
export function caseRoute(caseId: string): string {
  return `${INTERVENTIONS_ROUTE}/${encodeURIComponent(caseId)}`;
}
