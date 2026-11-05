import { environment } from '../../../environments/environment';
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
 * Los roles que pueden consultar el alcance «Plataforma» (todas las organizaciones). El resto de los
 * roles de reportería solo ve «Mi organización». Es lo que se ofrece, no lo que se autoriza: la API
 * decide qué devuelve para cada alcance.
 */
export const ROLES_PLATAFORMA: readonly string[] = ['SUPERADMIN', 'PLATFORM_ADMIN'];

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

/**
 * Los roles que abren AloVida Insights (inteligencia de marketing). Es el portal de marketing, de alcance
 * plataforma: nunca `BUSINESS_ADMIN`. Es la tercera tarjeta del selector y cuenta como un acceso más
 * para el login.
 */
export const ROLES_INSIGHTS: readonly string[] = [
  'SUPERADMIN',
  'PLATFORM_ADMIN',
  'DATA_PLATFORM_ADMIN',
  'MARKETING_MANAGER',
];

/** Lo que el selector y el login necesitan saber de una sesión. */
export interface AccesoAPortales {
  readonly administracion: boolean;
  readonly reporteria: boolean;
  readonly insights: boolean;
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

/** Si los roles de la sesión abren AloVida Insights. */
export function puedeVerInsights(roles: readonly string[]): boolean {
  return rolesAlcanzan(ROLES_INSIGHTS, roles);
}

/** Si los roles de la sesión pueden elegir el alcance «Plataforma». */
export function puedeVerPlataforma(roles: readonly string[]): boolean {
  return rolesAlcanzan(ROLES_PLATAFORMA, roles);
}

/**
 * Los tres accesos de una sesión, juntos. El de reportería exige además la bandera
 * `environment.reportingMockEnabled` (apagada por defecto): sin ella la maqueta no se ofrece a nadie.
 * `mockEnabled` existe para probar las dos ramas; en la aplicación se lee del entorno.
 */
export function accesoAPortales(
  roles: readonly string[],
  mockEnabled: boolean = environment.reportingMockEnabled,
): AccesoAPortales {
  return {
    administracion: puedeVerAdministracion(roles),
    reporteria: mockEnabled && puedeVerReporteria(roles),
    insights: puedeVerInsights(roles),
  };
}

/** Cuántos portales abre la sesión. Con dos o más hay algo que elegir. */
export function cantidadDePortales(acceso: AccesoAPortales): number {
  return [acceso.administracion, acceso.reporteria, acceso.insights].filter(Boolean).length;
}

/**
 * A dónde entra una sesión recién abierta. Con dos o más accesos hay que elegir; con uno solo
 * no se agrega una pantalla de paso: quien solo ve reportería entra a su portal, quien solo ve
 * Insights entra a Insights y todos los demás, a la aplicación de siempre. Que una tarjeta exista
 * o no no autoriza nada: cada portal vuelve a validar el rol en su ruta y la API en cada petición.
 */
export function entryDestination(
  roles: readonly string[],
  mockEnabled: boolean = environment.reportingMockEnabled,
): string {
  const acceso = accesoAPortales(roles, mockEnabled);
  // Sin la maqueta no hay selector de portales: se entra a `/` (el Centro de la plataforma o el inicio de siempre).
  // Marketing puro conserva su portal (Insights) como hoy.
  if (!mockEnabled) {
    return acceso.insights && !acceso.administracion ? PORTAL_INSIGHTS_ROUTE : PORTAL_ADMINISTRACION_ROUTE;
  }
  if (cantidadDePortales(acceso) >= 2) {
    return PORTAL_SELECTOR_ROUTE;
  }
  if (acceso.reporteria) {
    return PORTAL_REPORTERIA_ROUTE;
  }
  return acceso.insights ? PORTAL_INSIGHTS_ROUTE : PORTAL_ADMINISTRACION_ROUTE;
}

/**
 * A dónde lleva «Cambiar de portal». Con la maqueta encendida hay un selector de portales; apagada no
 * existe (la ruta redirige a `/`), así que el enlace va directo al destino que `entryDestination` da
 * para quien tiene administración: el inicio de siempre.
 */
export function portalSwitchRoute(mockEnabled: boolean = environment.reportingMockEnabled): string {
  return mockEnabled ? PORTAL_SELECTOR_ROUTE : PORTAL_ADMINISTRACION_ROUTE;
}

/** Las direcciones de destino, para que nadie las escriba a mano. */
export const PORTAL_ADMINISTRACION_ROUTE = '/';
export const PORTAL_REPORTERIA_ROUTE = '/reports';
export const PORTAL_INSIGHTS_ROUTE = '/insights';
export const PORTAL_SELECTOR_ROUTE = '/portal-selector';
