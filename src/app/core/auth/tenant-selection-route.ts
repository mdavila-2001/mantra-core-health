/**
 * Ruta donde se elige organización cuando el token trae más de una.
 *
 * Vive en su propio archivo para que la puedan importar tanto el guard como el
 * interceptor sin que uno dependa del otro: el guard ya importa `LOGIN_ROUTE` del
 * interceptor, y el interceptor navega acá cuando la API dice que falta elegir
 * organización (`details.reason = TENANT_REQUIRED`).
 */
export const TENANT_SELECTION_ROUTE = '/auth/organization';
