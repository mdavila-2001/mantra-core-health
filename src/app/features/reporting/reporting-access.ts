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
 * Los roles que abren AloVida Insights (inteligencia de marketing). Son los mismos de la sección
 * `administration/marketing-insights` del registro de navegación. Es una tercera tarjeta del selector:
 * no cambia `AccesoAPortales`, así que el login y el selector de dos portales siguen igual.
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

/** Los dos accesos de una sesión, juntos. */
export function accesoAPortales(roles: readonly string[]): AccesoAPortales {
  return {
    administracion: puedeVerAdministracion(roles),
    reporteria: puedeVerReporteria(roles),
  };
}

/**
 * A dónde entra una sesión recién abierta. Con los dos accesos hay que elegir; con uno solo
 * no se agrega una pantalla de paso: quien solo ve reportería entra a su portal y todos los
 * demás, a la aplicación de siempre. Que una tarjeta exista o no no autoriza nada: cada
 * portal vuelve a validar el rol en su ruta y la API en cada petición.
 */
export function entryDestination(roles: readonly string[]): string {
  const acceso = accesoAPortales(roles);
  if (acceso.administracion && acceso.reporteria) {
    return PORTAL_SELECTOR_ROUTE;
  }
  return acceso.reporteria ? PORTAL_REPORTERIA_ROUTE : PORTAL_ADMINISTRACION_ROUTE;
}

/** Las direcciones de destino, para que nadie las escriba a mano. */
export const PORTAL_ADMINISTRACION_ROUTE = '/';
export const PORTAL_REPORTERIA_ROUTE = '/reports';
export const PORTAL_INSIGHTS_ROUTE = '/administration/marketing-insights';
export const PORTAL_SELECTOR_ROUTE = '/portal-selector';
