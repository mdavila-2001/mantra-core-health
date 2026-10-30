import { MEDICAL_ORGANIZATION_TYPES } from '../data-access/directory/directory.types';

/**
 * Los tipos de organización que **no** ven la cara de aseguradora del menú
 * («Mis productos», «Siniestralidad y analítica», «Solicitudes recibidas»,
 * «Pacientes de la aseguradora», «Campañas preventivas»).
 *
 * La farmacia y el laboratorio, por su menú de mostrador (D3 del 29/09/2026), y
 * las cinco organizaciones médicas, que son prestadoras y no venden seguros: a
 * una clínica, un consultorio o un centro de enfermería esas pantallas sólo le
 * ofrecían puertas que la API cierra. Una aseguradora (`PAYER`) y la
 * plataforma no cambian.
 *
 * «Solicitudes de seguro» no está en esa lista a propósito: es la cara del
 * **prestador** —lo que la organización presentó a cada aseguradora, la que
 * abre la agenda— y el personal de facturación de una clínica la usa. Para
 * una organización médica se le exige el rol que la API le exige
 * (`rolesEnTipos` en `navigation.map.ts`): la dueña (`USER`) no la ve. Ocultar
 * no es seguridad: la autoridad sigue siendo la API.
 */
export const SIN_CARA_DE_ASEGURADORA = [
  'PHARMACY',
  'DIAGNOSTIC_CENTER',
  ...MEDICAL_ORGANIZATION_TYPES,
] as const;

/**
 * Si, en este tipo de organización, la sección exige un rol que la sesión no
 * tiene (`AppSection.rolesEnTipos`).
 *
 * Nació con «Solicitudes de seguro»: la API la sirve sólo a `BILLING_OPERATOR`
 * y `SECURITY_ADMIN` (`@Roles` de `ClaimsReadController`), y la dueña de una
 * clínica —rol global `USER`— la veía en el menú y recibía un 403
 * `ROLE_INSUFFICIENT` al abrirla. Quitarla por tipo de organización no servía:
 * el personal de facturación de la misma clínica sí la usa, y el guard
 * también mira esta regla. `SUPERADMIN` la salva, como en la API. Fuera de
 * esos tipos, o sin tipo conocido, no cambia nada.
 */
export function exigeRolEnTipo(
  section: {
    readonly rolesEnTipos?: { readonly tipos: readonly string[]; readonly roles: readonly string[] };
  },
  roles: readonly string[],
  activeTenantType: string | null,
): boolean {
  const regla = section.rolesEnTipos;
  return (
    regla !== undefined &&
    activeTenantType !== null &&
    regla.tipos.includes(activeTenantType) &&
    !regla.roles.some((role) => roles.includes(role)) &&
    !roles.includes('SUPERADMIN')
  );
}
