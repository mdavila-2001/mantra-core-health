/**
 * Las direcciones de la receta compartida (FAR-01), en un solo lugar para que
 * las rutas, las páginas y sus pruebas no las escriban cada una a su manera.
 */

/** A donde lleva el enlace que comparte el paciente: `${webAppBaseUrl}/rx/<token>`. */
export const SHARED_PRESCRIPTION_PATH = 'rx/:token';

/** A donde apunta el QR del PDF de la receta (`prescription-pdf.service.ts` de la API). */
export const PRESCRIPTION_VERIFY_PATH = 'verify/rx/:id';

/** «Mis recetas» del paciente: el dueño del enlace aterriza acá. */
export const MY_PRESCRIPTIONS_ROUTE = '/my-account/pharmacy/prescriptions';

/**
 * «Abrir receta» de la farmacia (FAR-02, REQ-FAR-02-008): la pantalla la
 * agrega ese carril; `/rx/:token` solo lleva hasta ella con el token detrás.
 */
export const PHARMACY_OPEN_PRESCRIPTION_ROUTE = '/administration/pharmacy-orders/rx';
