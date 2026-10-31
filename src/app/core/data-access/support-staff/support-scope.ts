import type { SupportAccess, SupportLink } from './support-staff.types';

/** Un hospital donde la secretaria trabaja, con lo único que le toca ver de él. */
export interface SupportWorkplace {
  readonly tenantId: string;
  readonly organizationName: string;
  /** Sus doctores asignados, por nombre, sin repetidos y en orden alfabético. */
  readonly doctors: readonly string[];
  /** Sus pisos, por nombre. */
  readonly floors: readonly string[];
  /** Si algún vínculo es a la organización entera. */
  readonly wholeOrganization: boolean;
}

/** Un doctor que la aceptó a ella directamente, sin que el hospital la sume. */
export interface DoctorOnlyAccess {
  readonly linkId: string;
  readonly tenantId: string;
  readonly practitionerRoleAssignmentId: string | null;
  readonly name: string;
}

/** Lo que ve: los hospitales que la sumaron, y aparte los doctores que la aceptaron por su cuenta. */
export interface SupportScope {
  readonly workplaces: readonly SupportWorkplace[];
  readonly doctorsOnly: readonly DoctorOnlyAccess[];
}

function byName(a: string, b: string): number {
  return a.localeCompare(b, 'es');
}

/**
 * Lo que la secretaria ve, **sólo** a partir de `GET /me/support-access` (vínculos
 * `ACTIVE`): sus hospitales, sus doctores y sus pisos.
 *
 * - Un hospital con `organizationAccess: false` es uno donde **sólo un doctor**
 *   la aceptó: no se muestra como lugar de trabajo ni con sus pisos; quedan
 *   sus doctores, en `doctorsOnly`, para ir a su agenda.
 * - El acceso trae los pisos por id; el nombre sale de sus propios vínculos
 *   activos (`/me/support-engagements`), nunca de la estructura del hospital,
 *   que la API no le deja leer.
 *
 * Es presentación, no autorización: la API filtra cada lectura por lo mismo.
 */
export function scopeOf(access: SupportAccess, links: readonly SupportLink[]): SupportScope {
  const nombreDePiso = new Map(
    links
      .filter((l) => l.status === 'ACTIVE' && l.targetKind === 'SPACE' && l.careSpaceId !== null)
      .map((l) => [l.careSpaceId!, l.targetName ?? 'Un piso']),
  );
  const workplaces: SupportWorkplace[] = [];
  const doctorsOnly: DoctorOnlyAccess[] = [];
  for (const tenant of access.tenants) {
    const doctors = tenant.practitioners.map((p) => ({
      linkId: p.linkId,
      tenantId: tenant.tenantId,
      practitionerRoleAssignmentId: p.practitionerRoleAssignmentId,
      name: p.name ?? 'Un doctor',
    }));
    if (!tenant.organizationAccess) {
      doctorsOnly.push(...doctors);
      continue;
    }
    workplaces.push({
      tenantId: tenant.tenantId,
      organizationName: tenant.organizationName ?? 'Organización',
      doctors: [...new Set(doctors.map((d) => d.name))].sort(byName),
      floors: [...new Set(tenant.careSpaceIds.map((id) => nombreDePiso.get(id) ?? 'Un piso'))].sort(byName),
      wholeOrganization: tenant.wholeOrganization,
    });
  }
  return {
    workplaces: workplaces.sort((a, b) => byName(a.organizationName, b.organizationName)),
    doctorsOnly: doctorsOnly.sort((a, b) => byName(a.name, b.name)),
  };
}

/** Lo que espera que **ella** decida: las invitaciones de un hospital o de un doctor. */
export function invitationsFor(links: readonly SupportLink[]): readonly SupportLink[] {
  return links.filter((l) => l.status === 'PENDING' && l.awaiting === 'SUPPORT_STAFF');
}

/** Lo que ella pidió y espera que decida otro. */
export function pendingOnOthers(links: readonly SupportLink[]): readonly SupportLink[] {
  return links.filter((l) => l.status === 'PENDING' && l.awaiting !== 'SUPPORT_STAFF');
}

/** Sin repetidos por `id`: `items` y `requests` de `/me/support-engagements` pueden traer el mismo vínculo. */
export function uniqueLinks(...lists: readonly (readonly SupportLink[])[]): readonly SupportLink[] {
  const vistos = new Map<string, SupportLink>();
  for (const list of lists) for (const link of list) vistos.set(link.id, link);
  return [...vistos.values()];
}
