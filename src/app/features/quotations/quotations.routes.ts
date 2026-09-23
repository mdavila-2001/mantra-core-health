/* ============================================================================
    Las rutas de cotizaciones (FT-24), en un solo lugar.

    Mismo criterio que `clinical-record.routes.ts` y
    `admin/patients/patients.routes.ts`: un archivo de datos puros, sin
    componentes, para que enlazar desde otra pantalla no arrastre el bundle
    del formulario entero.

    ## Por qué la sección se llama `my-quotations` y no `quotations`

    El backend de FT-24 (en desarrollo en paralelo) expone sus
    endpoints bajo el prefijo `/quotations` (`POST /quotations`,
    `GET /quotations/:id`,
    `GET /quotations?patientProfileId=`). El proxy de `ng serve` compara por
    **inicio de ruta** (ver el comentario de `proxy.conf.json` y
    `scripts/check-route-prefixes.mjs`): una sección de Angular llamada
    `quotations` colisionaría carácter a carácter con ese prefijo apenas se
    agregue a la lista de proxy, exactamente el defecto que ya rompió
    `administracion/pacientes` contra `/admin`. `my-quotations` sigue además
    la convención ya usada para las pantallas propias de quien atiende
    (`my-services`, `my-visits`, `my-organizations`): es la cotización que
    arma un profesional, no un catálogo administrado.
    ========================================================================== */

/** Listado de cotizaciones. Coincide con la sección del menú. */
export const QUOTATIONS_ROUTE = '/my-quotations';

/** Alta de una cotización nueva. */
export const QUOTATION_NEW_ROUTE = `${QUOTATIONS_ROUTE}/new`;

/**
 * El paciente con el que abre el alta, cuando se llega desde la consulta. Lo
 * que viaja es el `profileId`; el nombre lo relee el formulario.
 */
export const QUOTATION_PATIENT_QUERY_PARAM = 'patient';
