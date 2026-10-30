import { rolesAlcanzan } from '../../core/navigation/navigation.types';

/**
 * Quién entra a cada portal. Una sola fuente para el selector, el login y las
 * rutas: si cada uno llevara su lista, el día que alguien agregue un rol los
 * tres se desincronizarían y habría una tarjeta que rebota o una puerta sin
 * tarjeta.
 *
 * **Esto no autoriza nada.** Es la puerta del frente, igual que el menú: decide
 * qué se ofrece y adónde se redirige. La autoridad es la API, que valida el rol
 * en cada petición de reportería, y los guards de ruta que usan estas mismas
 * listas por su cuenta (`app.routes.ts`).
 *
 * `SUPERADMIN` no necesita figurar en las listas —`rolesAlcanzan` lo deja pasar
 * siempre—, pero se escribe igual: quien lea la constante ve de un vistazo que
 * es una de las cuentas con acceso, sin tener que conocer el comodín.
 */

/** Los roles que abren el portal de reportería. */
export const ROLES_REPORTERIA: readonly string[] = [
  'SUPERADMIN',
  'PLATFORM_ADMIN',
  'BUSINESS_ADMIN',
  'REPORTING_ADMIN',
  'REPORT_AUTHOR',
  'REPORT_VIEWER',
];

/**
 * Los roles de administración que dan acceso al portal de administración.
 *
 * Salen de las secciones del registro de navegación que cuelgan de
 * «Administración» y «Superadministración» y que declaran un rol *_ADMIN. No
 * incluye a quien ejerce (`PRACTITIONER`, `CLINICIAN`…) ni al paciente: el panel
 * de esas cuentas es el inicio de siempre, no un «portal» al que haya que elegir
 * entrar.
 */
export const ROLES_ADMINISTRACION: readonly string[] = [
  'SUPERADMIN',
  'SECURITY_ADMIN',
  'PLATFORM_ADMIN',
  'BUSINESS_ADMIN',
  'IDENTITY_ADMIN',
  'PAYMENTS_ADMIN',
  'PHARMA_LAB_ADMIN',
  'GOVERNANCE_ADMIN',
  'DATA_PLATFORM_ADMIN',
  'QA_ADMIN',
];

/** Lo que el selector y el login necesitan saber de una sesión. */
export interface AccesoAPortales {
  readonly administracion: boolean;
  readonly reporteria: boolean;
}

/** Si los roles de la sesión abren el portal de reportería. */
export function puedeVerReporteria(roles: readonly string[]): boolean {
  // Sin roles, `rolesAlcanzan` con una lista no vacía devuelve `false`: una
  // sesión sin roles no ve nada, que es lo que se quiere.
  return rolesAlcanzan(ROLES_REPORTERIA, roles);
}

/** Si los roles de la sesión abren el portal de administración. */
export function puedeVerAdministracion(roles: readonly string[]): boolean {
  return rolesAlcanzan(ROLES_ADMINISTRACION, roles);
}

/** Los dos accesos de una sesión, juntos. */
export function accesoAPortales(roles: readonly string[]): AccesoAPortales {
  return {
    administracion: puedeVerAdministracion(roles),
    reporteria: puedeVerReporteria(roles),
  };
}

/** Las dos direcciones de destino, para que nadie las escriba a mano. */
export const PORTAL_ADMINISTRACION_ROUTE = '/';
export const PORTAL_REPORTERIA_ROUTE = '/reports';
export const PORTAL_SELECTOR_ROUTE = '/portal-selector';
