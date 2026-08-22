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
