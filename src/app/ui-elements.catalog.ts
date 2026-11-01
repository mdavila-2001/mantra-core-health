/**
 * El catálogo completo de elementos de interfaz que declara el código.
 *
 * Cada feature declara los suyos en un archivo `*.ui-elements.ts` (`declareUiElements`) y lo **importa acá**: la
 * declaración es un efecto de cargar el archivo, y las features se cargan de forma diferida, así que sin esta lista el
 * portal de administración sólo vería lo que el usuario ya abrió. Quien sincroniza el catálogo
 * (`POST /admin/ui-visibility/elements/sync`) importa este archivo antes de llamar a `buildUiElementDrafts()`:
 *
 * ```ts
 * await import('../../../ui-elements.catalog');
 * client.sync(buildUiElementDrafts());
 * ```
 *
 * **Visibilidad, no seguridad:** catalogar un elemento no lo protege; la API autoriza cada petición.
 */
import './features/dashboard/dashboard.ui-elements';
import './features/insurance/insurance-analytics/insurance-analytics.ui-elements';
