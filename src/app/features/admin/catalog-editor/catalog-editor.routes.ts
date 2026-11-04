/* ============================================================================
    La ruta del editor de catálogos globales (H3), en un solo lugar.

    `app.routes.ts` registra rutas como un mapa `path → cargador` (ver
    `superadmin/measurement`). Quien integre esta pantalla agrega UNA línea:

        [CATALOG_EDITOR_PATH]: CATALOG_EDITOR_LOADER,

    y la entrada de menú en `navigation.platform.ts` con ese mismo `path`
    (grupo «Superadministración», roles `SUPERADMIN` y `SECURITY_ADMIN`: los que
    la API deja leer `/admin/catalogs/*`; la escritura del glosario es sólo
    `SUPERADMIN`). La autoridad la tiene la API, no el menú.
    ========================================================================== */

/** Ruta pública de la pantalla, sin barra inicial (como el resto del mapa). */
export const CATALOG_EDITOR_PATH = 'superadmin/catalog-editor';

/** Cargador diferido del componente de la pantalla. */
export const CATALOG_EDITOR_LOADER = () =>
  import('./catalog-editor').then((m) => m.CatalogEditor);
