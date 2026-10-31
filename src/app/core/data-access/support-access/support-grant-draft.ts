import type {
  NewSupportGrant,
  SupportActionCode,
  SupportCatalog,
  SupportGrant,
  SupportGrantChange,
  SupportScopeTarget,
} from './support-access.types';

/**
 * El borrador de permisos que edita la pantalla antes de guardar.
 *
 * Cada fila es un permiso. Una fila **existente** conserva su `id` (lo que
 * permite saber si cambió o se retiró); una nueva no lo tiene. Al guardar se
 * compara con lo que ya está en la API y se mandan solo las diferencias.
 */
export interface DraftGrant extends NewSupportGrant {
  /** Identidad estable dentro de la pantalla, para `@for` y para el foco. */
  readonly key: string;
  /** Presente si la fila ya existe en la API. */
  readonly id?: string;
}

/** La identidad del **objetivo** de una fila: dos filas con la misma no pueden convivir. */
export function targetKey(target: SupportScopeTarget): string {
  return [
    target.targetKind,
    target.practitionerRoleAssignmentId ?? '',
    target.healthcareServiceId ?? '',
    target.careSpaceId ?? '',
    target.practiceSiteId ?? '',
  ].join('|');
}

/** Del permiso guardado al borrador que se edita. */
export function toDraft(grant: SupportGrant): DraftGrant {
  return {
    key: grant.id,
    id: grant.id,
    targetKind: grant.targetKind,
    expansionMode: grant.expansionMode,
    actions: [...grant.actions],
    ...(grant.practitionerRoleAssignmentId === undefined ? {} : { practitionerRoleAssignmentId: grant.practitionerRoleAssignmentId }),
    ...(grant.healthcareServiceId === undefined ? {} : { healthcareServiceId: grant.healthcareServiceId }),
    ...(grant.careSpaceId === undefined ? {} : { careSpaceId: grant.careSpaceId }),
    ...(grant.practiceSiteId === undefined ? {} : { practiceSiteId: grant.practiceSiteId }),
    ...(grant.validFrom === undefined ? {} : { validFrom: grant.validFrom }),
    ...(grant.validTo === undefined ? {} : { validTo: grant.validTo }),
  };
}

function sameActions(a: readonly SupportActionCode[], b: readonly SupportActionCode[]): boolean {
  return a.length === b.length && a.every((code) => b.includes(code));
}

export interface GrantDiff {
  readonly create: readonly NewSupportGrant[];
  readonly change: readonly SupportGrantChange[];
  readonly revoke: readonly SupportGrantChange[];
}

/** Lo mínimo que hay que mandar para que la API quede como el borrador. */
export function diffGrants(existing: readonly SupportGrant[], draft: readonly DraftGrant[]): GrantDiff {
  const create: NewSupportGrant[] = [];
  const change: SupportGrantChange[] = [];

  for (const row of draft) {
    const previous = row.id === undefined ? undefined : existing.find((grant) => grant.id === row.id);
    if (previous === undefined) {
      const { key: _key, id: _id, ...body } = row;
      create.push(body);
      continue;
    }
    if (!sameActions(previous.actions, row.actions) || previous.expansionMode !== row.expansionMode) {
      change.push({ grantId: previous.id, actions: row.actions, expansionMode: row.expansionMode });
    }
  }

  const kept = new Set(draft.flatMap((row) => (row.id === undefined ? [] : [row.id])));
  const revoke = existing
    .filter((grant) => grant.status === 'ACTIVE' && !kept.has(grant.id))
    .map((grant): SupportGrantChange => ({ grantId: grant.id, revoke: true }));

  return { create, change, revoke };
}

/** Si el borrador difiere de lo guardado: habilita «Guardar». */
export function isDirty(existing: readonly SupportGrant[], draft: readonly DraftGrant[]): boolean {
  const { create, change, revoke } = diffGrants(existing, draft);
  return create.length + change.length + revoke.length > 0;
}

/** Nombre corto de un objetivo, para tablas y chips. */
export function shortTargetLabel(target: SupportScopeTarget, catalog: SupportCatalog): string {
  const doctor = catalog.doctors.find((item) => item.id === target.practitionerRoleAssignmentId)?.name ?? 'Doctor';
  const service = catalog.services.find((item) => item.id === target.healthcareServiceId)?.name ?? 'Servicio';
  const locationId = target.practiceSiteId ?? target.careSpaceId;
  const location = catalog.locations.find((item) => item.id === locationId)?.name ?? 'Ubicación';
  switch (target.targetKind) {
    case 'PRACTITIONER':
      return doctor;
    case 'SERVICE':
      return `Servicio · ${service}`;
    case 'LOCATION':
      return location;
    case 'PRACTITIONER_SERVICE':
      return `${doctor} × ${service}`;
    case 'PRACTITIONER_LOCATION':
      return `${doctor} × ${location}`;
    case 'SERVICE_LOCATION':
      return `${service} × ${location}`;
    case 'ALL_PRACTITIONERS':
      return 'Todos los doctores';
    case 'ALL_SERVICES':
      return 'Todos los servicios';
    case 'ALL_LOCATIONS':
      return 'Todas las ubicaciones';
    case 'ALL':
      return 'Toda la organización';
  }
}
