import type { AppSection } from './navigation.types';

/* ============================================================================
    El menú del perfil de gestión.

    Pedido del propietario (30/10/2026): quien administra la plataforma no usa la
    app como paciente ni como médico —no tiene «Mis citas», «Mi historia
    clínica» ni «Mis resultados»—; la usa para **medir** cuánto se usa cada
    herramienta, cuánto dinero mueve y dónde falla, y para gobernar catálogos,
    datos y accesos. Mezclarle el menú de todos los perfiles esconde justo eso.

    Esto es presentación, no permiso: lo que sale del menú sigue existiendo y la
    guarda de ruta lo sigue resolviendo igual, como con `fueraDelMenuPara`. Quien
    autoriza es la API. Vive en su propio archivo porque `navigation.map.ts` está
    congelado por `scripts/check-max-lines.mjs`.
    ========================================================================== */

/**
 * Los roles que gestionan la plataforma misma. `SUPERADMIN` es el comodín del
 * backend; los demás son los del portal administrativo (`role-labels.ts`).
 */
export const ROLES_DE_GESTION: readonly string[] = [
  'SUPERADMIN',
  'PLATFORM_ADMIN',
  'SECURITY_ADMIN',
  'GOVERNANCE_ADMIN',
  'DATA_PLATFORM_ADMIN',
  'DPO',
  'SRE',
  'RELEASE_MANAGER',
  'QA_ADMIN',
  'QA_ENGINEER',
  'MARKETING_MANAGER',
  // Quien administra la reportería (portal de reportería, 30/10/2026) mide la
  // plataforma: es gestión. Sin esta línea la cuenta de pruebas `superadmin`
  // —que lo lleva junto a SUPERADMIN— dejaba de aterrizar en el Centro de la
  // plataforma y caía en el panel clínico (visto el 31/10/2026).
  'REPORTING_ADMIN',
];

/**
 * Roles **administrativos de negocio**: no son de la plataforma, pero tampoco
 * son uso personal de la app —quien administra agenda, pagos o facturación no
 * por eso tiene «Mis citas»—. Se toleran junto a un rol de plataforma sin que
 * la sesión deje de ser de gestión: la cuenta de pruebas de administración los
 * junta casi todos, y la de producción puede juntar algunos.
 */
const ROLES_ADMINISTRATIVOS: readonly string[] = [
  'SCHEDULING_ADMIN',
  'IDENTITY_ADMIN',
  'BUSINESS_ADMIN',
  'PAYMENTS_ADMIN',
  'PHARMA_LAB_ADMIN',
  'ACCOUNTING_APPROVER',
  'BILLING',
  'BILLING_OPERATOR',
  'FINANCE',
  'CASHIER',
  'PERIOP_ADMIN',
  'CLINICAL_INFORMATICIAN',
  'ADMISSIONS_REVIEWER',
  'ADMISSIONS_APPROVER',
];

/**
 * Roles que no dicen nada del uso que se le da a la app: `USER` es el rol base de
 * toda cuenta (ver `role-labels.ts`).
 */
const ROLES_NEUTROS: readonly string[] = ['USER'];

/**
 * Las secciones que el perfil de gestión conserva fuera de «Superadministración»
 * (que se conserva entera): administración de la plataforma y dinero. El glosario no está: su editor global
 * por tipo de usuario llega con la franja de catálogos (H3).
 * Todo lo que no figura —«Mis…», la operación de una aseguradora, el consultorio
 * propio— sale de su menú.
 */
const RUTAS_DE_GESTION: ReadonlySet<string> = new Set([
  'administration/patients',
  'administration/admissions',
  'administration/users',
  'administration/organizations',
  'administration/brokers',
  'administration/delegated-access',
  'administration/identity-providers',
  'administration/identity-assurance',
  'administration/terminology',
  'administration/content-packs',
  'administration/moderation',
  'administration/health-context',
  'administration/geolocation',
  'administration/services-catalog',
  'administration/medical-laboratory',
  'administration/clinical-forms',
  'administration/pharma-lab',
  'administration/accounting',
  'billing',
]);

/**
 * Si esta sesión es **sólo** de gestión de la plataforma.
 *
 * Alcanza con que tenga un rol ajeno —paciente, profesional, un clínico— para
 * que conserve su menú completo: quitarle «Mis citas» a quien
 * también las usa sería perder acceso, y esto no es una limpieza de permisos.
 */
export function esPerfilDeGestion(roles: readonly string[]): boolean {
  return (
    roles.some((rol) => ROLES_DE_GESTION.includes(rol)) &&
    roles.every(
      (rol) =>
        ROLES_DE_GESTION.includes(rol) ||
        ROLES_ADMINISTRATIVOS.includes(rol) ||
        ROLES_NEUTROS.includes(rol),
    )
  );
}

/** Si la sección ocupa un renglón en el menú del perfil de gestión. */
export function seccionDeGestion(section: AppSection): boolean {
  return section.group === 'Superadministración' || RUTAS_DE_GESTION.has(section.path);
}
