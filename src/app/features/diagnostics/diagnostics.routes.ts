/* ============================================================================
    Las rutas de laboratorio e imagenología, en un solo lugar.

    Mismo criterio que `clinical-record/clinical-record.routes.ts`: la constante
    vivía dentro del componente que pinta la sección, así que importarla desde
    otra pantalla arrastraría al bundle de esa pantalla el componente entero —y
    con él sus clientes de datos y su banco de componentes—, que es justo lo que
    la carga diferida de `app.routes.ts` evita.

    La sección padre la declara `core/navigation/navigation.map.ts`; ésta es su
    pantalla.
    ========================================================================== */

/** La cola de trabajo del laboratorio (M20). Coincide con la sección del menú. */
export const DIAGNOSTICS_ROUTE = '/diagnostics';
