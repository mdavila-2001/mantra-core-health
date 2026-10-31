import type { TeamCapabilities } from '../../../core/data-access/access-governance/access-governance.types';
import {
  ATOM_CATEGORY_LABELS,
  atomMeta,
} from '../../../core/data-access/support-access/support-atoms';
import {
  SUPPORT_ROLE_TEMPLATE_LABELS,
  type SupportCatalog,
  type SupportRoleTemplateCode,
  type SupportScopeTarget,
  type SupportTargetKind,
} from '../../../core/data-access/support-access/support-access.types';
import {
  dayFromToday,
  labelOfTarget,
  targetKeyOf,
  type TargetOption,
} from '../lifecycle/grant-draft/grant-draft';

/* ============================================================================
    El **techo** y el **alcance** de quien administra su equipo (CONTRATO-GOBIERNO §6.4): qué puede dar, a quién y por
    cuánto tiempo, y por qué algo queda fuera, explicado en palabras. Puro: arma lo que la pantalla muestra a partir de
    `GET /org/team/capabilities`. **No decide nada**: la API (`TeamAdminPolicy`) vuelve a validar y responde
    `ADMIN_CEILING_EXCEEDED` o `ADMIN_SCOPE_EXCEEDED`.
   ========================================================================== */

export interface TeamCeiling {
  readonly allowAtoms: readonly string[];
  readonly forbidAtoms: readonly string[];
  readonly templates: readonly string[];
  readonly maxValidDays: number | null;
}

export interface TeamScope {
  readonly option: TargetOption;
  readonly ceiling: TeamCeiling;
}

export interface TeamAbilities {
  readonly mode: 'FULL' | 'DELEGATED';
  readonly atoms: ReadonlySet<string>;
  readonly scopes: readonly TeamScope[];
}

const strings = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];

export function ceilingOf(raw: Readonly<Record<string, unknown>>): TeamCeiling {
  const days = raw['maxValidDays'];
  return {
    allowAtoms: strings(raw['allowAtoms']),
    forbidAtoms: strings(raw['forbidAtoms']),
    templates: strings(raw['templates']),
    maxValidDays: typeof days === 'number' && Number.isFinite(days) ? days : null,
  };
}

const TARGET_KINDS: ReadonlySet<string> = new Set([
  'PRACTITIONER',
  'SERVICE',
  'LOCATION',
  'PRACTITIONER_SERVICE',
  'PRACTITIONER_LOCATION',
  'SERVICE_LOCATION',
  'ALL_PRACTITIONERS',
  'ALL_SERVICES',
  'ALL_LOCATIONS',
  'ALL',
]);

function targetOf(raw: Readonly<Record<string, unknown>>): SupportScopeTarget {
  const text = (key: string): string | undefined =>
    typeof raw[key] === 'string' ? (raw[key] as string) : undefined;
  const kind = text('targetKind');
  return {
    targetKind: (kind !== undefined && TARGET_KINDS.has(kind) ? kind : 'ALL') as SupportTargetKind,
    ...(text('practitionerRoleAssignmentId') === undefined
      ? {}
      : { practitionerRoleAssignmentId: text('practitionerRoleAssignmentId')! }),
    ...(text('healthcareServiceId') === undefined
      ? {}
      : { healthcareServiceId: text('healthcareServiceId')! }),
    ...(text('careSpaceId') === undefined ? {} : { careSpaceId: text('careSpaceId')! }),
    ...(text('practiceSiteId') === undefined ? {} : { practiceSiteId: text('practiceSiteId')! }),
  };
}

export function parseCapabilities(
  capabilities: TeamCapabilities,
  catalog: SupportCatalog | null,
): TeamAbilities {
  const scopes = capabilities.assignScopes.map((scope): TeamScope => {
    const target = targetOf(scope.target);
    return {
      option: { key: targetKeyOf(target), label: labelOfTarget(target, catalog), target },
      ceiling: ceilingOf(scope.ceiling),
    };
  });
  return { mode: capabilities.mode, atoms: new Set(capabilities.atoms), scopes };
}

/** ¿Puede esta persona hacer eso (tiene el permiso `team.*` o es administrador de seguridad)? */
export function canDo(abilities: TeamAbilities, atom: string): boolean {
  return abilities.mode === 'FULL' || abilities.atoms.has(atom);
}

const patternMatches = (pattern: string, atom: string): boolean =>
  pattern.endsWith('.*') ? atom.startsWith(pattern.slice(0, -1)) : pattern === atom;

/** El texto único con el que se explica algo que queda fuera del techo. */
export const OUTSIDE_CEILING_TEXT = 'Solo el administrador de seguridad puede dar esto.';

/**
 * Por qué una persona que administra **no** puede dar un permiso, o `null` si puede. El administrador de seguridad
 * (`FULL`) solo se topa con lo que no se delega nunca.
 */
export function atomBlockReason(
  atom: string,
  ceiling: TeamCeiling | null,
  mode: 'FULL' | 'DELEGATED',
): string | null {
  const meta = atomMeta(atom);
  if (meta !== undefined && !meta.supportAssignable)
    return 'Este permiso no se puede dar al personal de apoyo.';
  if (mode === 'FULL') return null;
  if (atom.startsWith('team.')) return OUTSIDE_CEILING_TEXT;
  if (ceiling === null) return OUTSIDE_CEILING_TEXT;
  if (ceiling.forbidAtoms.some((p) => patternMatches(p, atom))) return OUTSIDE_CEILING_TEXT;
  if (!ceiling.allowAtoms.some((p) => patternMatches(p, atom))) return OUTSIDE_CEILING_TEXT;
  return null;
}

const MODULE_LABELS: Readonly<Record<string, string>> = {
  agenda: ATOM_CATEGORY_LABELS.SUPPORT_AGENDA,
  patients: ATOM_CATEGORY_LABELS.SUPPORT_PATIENTS,
  messages: ATOM_CATEGORY_LABELS.SUPPORT_MESSAGING,
  billing: ATOM_CATEGORY_LABELS.SUPPORT_BILLING,
  reports: ATOM_CATEGORY_LABELS.SUPPORT_REPORTS,
  team: ATOM_CATEGORY_LABELS.SUPPORT_TEAM,
  audit: ATOM_CATEGORY_LABELS.SUPPORT_AUDIT,
};

/** `agenda.*` → «todo lo de Agenda»; un permiso suelto → su nombre. */
export function describeAllowed(pattern: string): string {
  if (pattern.endsWith('.*'))
    return `todo lo de ${(MODULE_LABELS[pattern.slice(0, -2)] ?? pattern.slice(0, -2)).toLocaleLowerCase('es')}`;
  return (atomMeta(pattern)?.name ?? pattern).toLocaleLowerCase('es');
}

/** Las oraciones del banner «Usted puede dar…» para un techo. */
export function describeCeiling(ceiling: TeamCeiling): readonly string[] {
  const lines: string[] = [];
  if (ceiling.allowAtoms.length > 0)
    lines.push(`Puede dar: ${ceiling.allowAtoms.map(describeAllowed).join('; ')}.`);
  else lines.push('No puede dar permisos: pídaselos al administrador de seguridad.');
  if (ceiling.templates.length > 0) {
    lines.push(
      `Solo a personas con el rol: ${ceiling.templates.map((t) => (SUPPORT_ROLE_TEMPLATE_LABELS[t as SupportRoleTemplateCode] ?? t).toLocaleLowerCase('es')).join(', ')}.`,
    );
  }
  if (ceiling.maxValidDays !== null)
    lines.push(`Cada permiso vale hasta ${ceiling.maxValidDays} días.`);
  return lines;
}

/** El techo que rige para un objetivo; si no se conoce el objetivo, el primero. */
export function ceilingFor(abilities: TeamAbilities, targetKey: string): TeamCeiling | null {
  return (
    (abilities.scopes.find((s) => s.option.key === targetKey) ?? abilities.scopes[0])?.ceiling ??
    null
  );
}

/** El último día que puede darse un permiso (`YYYY-MM-DD`), o vacío si no hay tope. */
export function maxValidDayFor(ceiling: TeamCeiling | null, now: Date = new Date()): string {
  return ceiling?.maxValidDays == null ? '' : dayFromToday(ceiling.maxValidDays, now);
}

/** Los roles que se pueden ofrecer en una invitación: los del techo (en un administrador delegado) o todos. */
export function inviteTemplates(abilities: TeamAbilities): readonly SupportRoleTemplateCode[] {
  if (abilities.mode === 'FULL')
    return Object.keys(SUPPORT_ROLE_TEMPLATE_LABELS) as SupportRoleTemplateCode[];
  const allowed = new Set(abilities.scopes.flatMap((s) => s.ceiling.templates));
  return (Object.keys(SUPPORT_ROLE_TEMPLATE_LABELS) as SupportRoleTemplateCode[]).filter((t) =>
    allowed.has(t),
  );
}

/** La frase «Usted administra: …» con los nombres de sus servicios y ubicaciones. */
export function scopeSentence(abilities: TeamAbilities): string {
  if (abilities.mode === 'FULL')
    return 'Usted administra toda la organización como administrador de seguridad.';
  if (abilities.scopes.length === 0)
    return 'Todavía no tiene un servicio o una ubicación asignados para administrar.';
  return `Usted administra: ${abilities.scopes.map((s) => s.option.label.replace(/^(Servicio|Ubicación|Doctor) · /, '')).join(' · ')}.`;
}
