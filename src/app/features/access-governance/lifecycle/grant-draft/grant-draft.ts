import type { SimulationDraftGrant } from '../../../../core/data-access/access-governance/access-explain.types';
import type {
  ActionConditions,
  SupportCondition,
} from '../../../../core/data-access/access-governance/conditions.types';
import type { MoveGrant } from '../../../../core/data-access/access-governance/access-lifecycle.types';
import {
  atomMeta,
  expandSupportAction,
} from '../../../../core/data-access/support-access/support-atoms';
import type { SupportActionInput } from '../../../../core/data-access/support-access/support-atom-grants.types';
import type {
  SupportCatalog,
  SupportGrant,
  SupportScopeTarget,
} from '../../../../core/data-access/support-access/support-access.types';

/* ============================================================================
    El borrador de un permiso en las pantallas de gobierno (cambio de rol, administración delegada): un objetivo
    elegido de una lista, los permisos atómicos marcados y, si corresponde, hasta cuándo vale. Puro: sin red.
    La autoridad es la API (simular y guardar la vuelven a validar); esto solo arma lo que se manda.
   ========================================================================== */

/** Un objetivo que se puede elegir: su rótulo en lenguaje simple y lo que va en la petición. */
export interface TargetOption {
  readonly key: string;
  readonly label: string;
  readonly target: SupportScopeTarget;
}

export interface GrantDraft {
  /** Identidad local del borrador (no viaja a la API). */
  readonly id: string;
  readonly targetKey: string;
  readonly atoms: readonly string[];
  /** `YYYY-MM-DD` o vacío (sin vencimiento). */
  readonly validTo: string;
  /** El permiso que reemplaza, si viene de uno vigente. */
  readonly grantId?: string;
  /** `DENY` = prohibición expresa que se conserva tal cual (no se edita acá). */
  readonly effect?: 'ALLOW' | 'DENY';
  /** Las condiciones del permiso vigente: al cambiar de rol se conservan, no se pierden. */
  readonly condition?: SupportCondition;
  readonly actionConditions?: ActionConditions;
}

/** Clave estable de un objetivo: el tipo y los identificadores que le corresponden. */
export function targetKeyOf(target: SupportScopeTarget): string {
  return [
    target.targetKind,
    target.practitionerRoleAssignmentId ?? '',
    target.healthcareServiceId ?? '',
    target.careSpaceId ?? '',
    target.practiceSiteId ?? '',
  ].join('|');
}

/** Cómo se llama un objetivo, con los nombres del catálogo (o un genérico si no está). */
export function labelOfTarget(target: SupportScopeTarget, catalog: SupportCatalog | null): string {
  const doctor = catalog?.doctors.find((d) => d.id === target.practitionerRoleAssignmentId)?.name;
  const service = catalog?.services.find((s) => s.id === target.healthcareServiceId)?.name;
  const place = catalog?.locations.find(
    (l) => l.id === (target.practiceSiteId ?? target.careSpaceId),
  )?.name;
  switch (target.targetKind) {
    case 'PRACTITIONER':
      return `Doctor · ${doctor ?? 'un doctor'}`;
    case 'SERVICE':
      return `Servicio · ${service ?? 'un servicio'}`;
    case 'LOCATION':
      return `Ubicación · ${place ?? 'una ubicación'}`;
    case 'PRACTITIONER_SERVICE':
      return `${doctor ?? 'Doctor'} solo para ${service ?? 'un servicio'}`;
    case 'PRACTITIONER_LOCATION':
      return `${doctor ?? 'Doctor'} solo en ${place ?? 'una ubicación'}`;
    case 'SERVICE_LOCATION':
      return `${service ?? 'Servicio'} solo en ${place ?? 'una ubicación'}`;
    case 'ALL_PRACTITIONERS':
      return 'Todos los doctores';
    case 'ALL_SERVICES':
      return 'Todos los servicios';
    case 'ALL_LOCATIONS':
      return 'Todas las ubicaciones';
    default:
      return 'Toda la organización';
  }
}

/** Todo lo que el catálogo de la organización ofrece como objetivo: servicios, ubicaciones y doctores. */
export function optionsFromCatalog(catalog: SupportCatalog | null): readonly TargetOption[] {
  if (catalog === null) return [];
  const make = (target: SupportScopeTarget): TargetOption => ({
    key: targetKeyOf(target),
    label: labelOfTarget(target, catalog),
    target,
  });
  return [
    ...catalog.services.map((s) => make({ targetKind: 'SERVICE', healthcareServiceId: s.id })),
    ...catalog.locations.map((l) =>
      make(
        l.kind === 'SITE'
          ? { targetKind: 'LOCATION', practiceSiteId: l.id }
          : { targetKind: 'LOCATION', careSpaceId: l.id },
      ),
    ),
    ...catalog.doctors.map((d) =>
      make({ targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: d.id }),
    ),
  ];
}

/** Suma a las opciones los objetivos de permisos que ya existen (combinados, «todos»…), sin repetir. */
export function withTargetsOf(
  options: readonly TargetOption[],
  targets: readonly SupportScopeTarget[],
  catalog: SupportCatalog | null,
): readonly TargetOption[] {
  const known = new Set(options.map((o) => o.key));
  const extra: TargetOption[] = [];
  for (const target of targets) {
    const key = targetKeyOf(target);
    if (known.has(key)) continue;
    known.add(key);
    extra.push({ key, label: labelOfTarget(target, catalog), target });
  }
  return [...options, ...extra];
}

let counter = 0;
export function newDraftId(): string {
  counter += 1;
  return `draft-${counter}`;
}

/** Los permisos atómicos de un permiso vigente: los átomos si vienen, o los alias antiguos ya expandidos. */
export function atomsOfGrant(grant: {
  readonly atoms?: readonly string[] | undefined;
  readonly actions?: readonly string[] | undefined;
}): readonly string[] {
  if (grant.atoms !== undefined && grant.atoms.length > 0) return grant.atoms;
  return [...new Set((grant.actions ?? []).flatMap((a) => expandSupportAction(a)))];
}

export function draftFromGrant(grant: SupportGrant): GrantDraft {
  return {
    id: newDraftId(),
    targetKey: targetKeyOf(grant),
    atoms: atomsOfGrant(grant),
    validTo: grant.validTo === undefined ? '' : grant.validTo.slice(0, 10),
    grantId: grant.id,
    ...(grant.effect === undefined ? {} : { effect: grant.effect }),
    ...(grant.condition === undefined ? {} : { condition: grant.condition }),
    ...(grant.actionConditions === undefined ? {} : { actionConditions: grant.actionConditions }),
  };
}

/**
 * ¿Algún borrador trae condiciones **por permiso** (p. ej. «anticipación mínima para cancelar»)? El cambio de rol
 * (`POST …/move`, `MoveGrantDto`) y su simulación solo aceptan la condición de todo el permiso: las de cada permiso no viajan
 * y hay que volver a ponerlas con el editor de permisos. La pantalla lo avisa antes de confirmar.
 */
export function hasPerActionConditions(drafts: readonly GrantDraft[]): boolean {
  return drafts.some(
    (d) => d.actionConditions !== undefined && Object.keys(d.actionConditions).length > 0,
  );
}

export function emptyDraft(targetKey: string): GrantDraft {
  return { id: newDraftId(), targetKey, atoms: [], validTo: '' };
}

/** `2026-12-31` → fin de ese día en la zona de la persona, como instante ISO. */
export function validToIso(day: string): string | undefined {
  if (day === '') return undefined;
  const date = new Date(`${day}T23:59:59`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** El día (`YYYY-MM-DD`) de hoy más `days`: el tope de vigencia de un administrador delegado. */
export function dayFromToday(days: number, now: Date = new Date()): string {
  const target = new Date(now.getTime() + days * 86_400_000);
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  return `${target.getFullYear()}-${month}-${day}`;
}

const SCOPE_ORDER = [
  'practitionerRoleAssignmentId',
  'healthcareServiceId',
  'careSpaceId',
  'practiceSiteId',
] as const;

function targetOf(option: TargetOption): SupportScopeTarget {
  const target: Record<string, string> = { targetKind: option.target.targetKind };
  for (const key of SCOPE_ORDER) {
    const value = option.target[key];
    if (value !== undefined) target[key] = value;
  }
  return target as unknown as SupportScopeTarget;
}

/** Lo que va en `POST …/move` para un borrador. */
export function toMoveGrant(draft: GrantDraft, option: TargetOption): MoveGrant {
  const validTo = validToIso(draft.validTo);
  return {
    ...targetOf(option),
    actions: draft.atoms as readonly SupportActionInput[],
    effect: draft.effect ?? 'ALLOW',
    expansionMode: 'DYNAMIC',
    ...(draft.condition === undefined ? {} : { condition: draft.condition }),
    ...(validTo === undefined ? {} : { validTo }),
  };
}

/** Lo que va en `POST /org/access/simulate` para un borrador (reemplaza el conjunto entero). */
export function toSimulationGrant(draft: GrantDraft, option: TargetOption): SimulationDraftGrant {
  const validTo = validToIso(draft.validTo);
  const { targetKind: _kind, ...ids } = targetOf(option);
  return {
    effect: draft.effect ?? 'ALLOW',
    actions: draft.atoms as readonly SupportActionInput[],
    ...ids,
    expansionMode: 'DYNAMIC',
    ...(draft.condition === undefined ? {} : { condition: draft.condition }),
    ...(validTo === undefined ? {} : { validTo }),
  };
}

/** Los permisos atómicos de un borrador, con su nombre en lenguaje simple. */
export function atomNames(atoms: readonly string[]): readonly string[] {
  return atoms.map((a) => atomMeta(a)?.name ?? a);
}

export function sameAtoms(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((atom) => b.includes(atom));
}
