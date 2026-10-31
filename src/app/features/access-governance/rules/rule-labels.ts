import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import type { PersonMatrix } from '../../../core/data-access/access-governance/governance-reports.types';
import type {
  ApproverKind,
  SupportCondition,
} from '../../../core/data-access/access-governance/conditions.types';
import {
  GOVERNANCE_RULE_KIND_LABELS,
  type FieldFloorVisibility,
  type GovernanceRule,
  type GovernanceRuleKind,
} from '../../../core/data-access/access-governance/governance-rules.types';
import {
  SUPPORT_ROLE_TEMPLATE_LABELS,
  type SupportRoleTemplateCode,
} from '../../../core/data-access/support-access/support-access.types';
import {
  ATOM_CATEGORY_LABELS,
  SUPPORT_ATOMS,
  atomMeta,
  type AtomCategoryCode,
} from '../../../core/data-access/support-access/support-atoms';

/* ============================================================================
    Palabras de las barandillas de la organización: lógica pura, sin Angular.
    El patrón de permiso (`billing.*`, `agenda.appointment.cancel`) se dice como la persona lo entiende.
   ========================================================================== */

const CATEGORIA_POR_MODULO: Readonly<Record<string, AtomCategoryCode>> = {
  agenda: 'SUPPORT_AGENDA',
  patients: 'SUPPORT_PATIENTS',
  messages: 'SUPPORT_MESSAGING',
  billing: 'SUPPORT_BILLING',
  reports: 'SUPPORT_REPORTS',
  team: 'SUPPORT_TEAM',
  audit: 'SUPPORT_AUDIT',
};

/** Un patrón por categoría («billing.*») con su rótulo, para el selector de permisos de una regla. */
export const CATEGORY_PATTERNS: readonly { readonly value: string; readonly label: string }[] =
  Object.entries(CATEGORIA_POR_MODULO).map(([modulo, categoria]) => ({
    value: `${modulo}.*`,
    label: `Todo lo de «${ATOM_CATEGORY_LABELS[categoria]}»`,
  }));

/** ¿Es un patrón con comodín (`billing.*`)? */
export function isWildcardPattern(pattern: string): boolean {
  return pattern.endsWith('.*');
}

/** La categoría de un permiso o de un patrón de categoría (`billing.*`, `agenda.appointment.cancel`). */
export function categoryOfPattern(pattern: string): AtomCategoryCode | undefined {
  return CATEGORIA_POR_MODULO[pattern.split('.')[0]!];
}

/** «todo lo de Facturación y caja» o el nombre del permiso. */
export function patternLabel(pattern: string): string {
  if (pattern === '*') return 'todo';
  if (isWildcardPattern(pattern)) {
    const categoria = categoryOfPattern(pattern);
    const resto = pattern.slice(0, -2).split('.');
    if (categoria !== undefined && resto.length === 1)
      return `todo lo de «${ATOM_CATEGORY_LABELS[categoria]}»`;
    const grupo = SUPPORT_ATOMS.find((a) => a.code.startsWith(pattern.slice(0, -1)));
    return grupo === undefined
      ? `los permisos «${pattern}»`
      : `los permisos de «${grupo.name}» y afines`;
  }
  return `«${atomMeta(pattern)?.name ?? pattern}»`;
}

/** Los códigos de átomo que alcanza un patrón. */
export function atomsMatching(pattern: string): readonly string[] {
  if (pattern === '*') return SUPPORT_ATOMS.map((a) => a.code);
  if (isWildcardPattern(pattern))
    return SUPPORT_ATOMS.filter((a) => a.code.startsWith(pattern.slice(0, -1))).map((a) => a.code);
  return SUPPORT_ATOMS.filter((a) => a.code === pattern).map((a) => a.code);
}

export function templateName(code: string | undefined): string | undefined {
  return code === undefined
    ? undefined
    : (SUPPORT_ROLE_TEMPLATE_LABELS[code as SupportRoleTemplateCode] ?? code);
}

const VISIBILIDAD: Readonly<Record<FieldFloorVisibility, string>> = {
  PARTIAL: 'de forma parcial (por ejemplo, «7******7»)',
  REDACT: 'tachado',
  NULLIFY: 'oculto del todo',
};
export const VISIBILITY_OPTIONS: readonly {
  readonly value: FieldFloorVisibility;
  readonly label: string;
}[] = [
  { value: 'PARTIAL', label: 'Parcial («7******7»)' },
  { value: 'REDACT', label: 'Tachado' },
  { value: 'NULLIFY', label: 'Oculto del todo' },
];

/** Con la preposición incluida: «con la aprobación del doctor». */
const APROBADOR: Readonly<Record<ApproverKind, string>> = {
  DOCTOR: 'del doctor',
  SECOND_APPROVER: 'de un segundo administrador',
  SERVICE_HEAD: 'de la jefatura del servicio',
};

/** Lo que exige una condición, en frases cortas: «desde la red del hospital», «con un motivo». */
export function conditionPhrases(condition: SupportCondition | undefined): readonly string[] {
  if (condition === undefined) return [];
  const frases: string[] = [];
  if (condition.network !== undefined)
    frases.push(
      condition.network.require === 'ORG_RULES'
        ? 'desde la red del hospital'
        : 'desde cualquier red',
    );
  if (condition.device?.knownOnly === true) frases.push('desde un equipo de confianza');
  if (condition.time !== undefined) frases.push('en ciertos horarios');
  if (condition.session !== undefined)
    frases.push(`con sesiones de hasta ${condition.session.maxSessionMinutes} minutos`);
  if (condition.presence !== undefined) frases.push('con el doctor conectado');
  if (condition.obligations?.requireReason !== undefined)
    frases.push(
      `con un motivo de al menos ${condition.obligations.requireReason.minLength} caracteres`,
    );
  if (condition.obligations?.stepUp !== undefined) frases.push('con verificación en dos pasos');
  if (condition.obligations?.approval !== undefined)
    frases.push(`con la aprobación ${APROBADOR[condition.obligations.approval.by]}`);
  if (condition.limits !== undefined) frases.push('con un tope de uso');
  if (condition.patients !== undefined || condition.appointment !== undefined)
    frases.push('sobre ciertos pacientes o citas');
  if (condition.amount !== undefined) frases.push('con un tope de monto');
  if (condition.fields !== undefined) frases.push('con ciertos datos parciales');
  if (condition.channels !== undefined) frases.push('por ciertos canales');
  return frases;
}

/** La regla en una oración. */
export function describeRule(
  rule: Pick<
    GovernanceRule,
    'kind' | 'permissionPattern' | 'roleTemplateCode' | 'condition' | 'maxVisibility'
  >,
): string {
  const permiso = patternLabel(rule.permissionPattern);
  const rol = templateName(rule.roleTemplateCode);
  switch (rule.kind) {
    case 'DENY_PERMISSION':
      return `Nadie${rol === undefined ? '' : ` con el rol «${rol}»`} puede tener ${permiso}.`;
    case 'CEILING':
      return `${rol === undefined ? 'Ningún rol' : `El rol «${rol}»`} nunca puede tener ${permiso}.`;
    case 'REQUIRE_CONDITION': {
      const frases = conditionPhrases(rule.condition);
      return `${capitalize(permiso)} ${rol === undefined ? '' : `para el rol «${rol}» `}solo se puede usar ${frases.length === 0 ? 'con condiciones' : frases.join(', ')}.`;
    }
    case 'FIELD_FLOOR':
      return `El dato ${permiso} se ve como máximo ${VISIBILIDAD[rule.maxVisibility ?? 'PARTIAL']}.`;
  }
}

function capitalize(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1);
}

export function kindText(kind: GovernanceRuleKind): string {
  return GOVERNANCE_RULE_KIND_LABELS[kind];
}

export function ruleStatusText(rule: Pick<GovernanceRule, 'status'>): string {
  return rule.status === 'ACTIVE' ? 'Activa' : 'Retirada';
}

export function ruleStatusTone(rule: Pick<GovernanceRule, 'status'>): BadgeVariant {
  return rule.status === 'ACTIVE' ? 'success' : 'secondary';
}

/* ---- impacto --------------------------------------------------------------------------------------------- */

export interface RuleImpact {
  readonly people: readonly { readonly name: string; readonly userId: string }[];
  readonly count: number;
}

/**
 * A quién alcanzaría hoy una regla: las personas con algún permiso (completo, condicionado o parcial) que el patrón cubre y,
 * si la regla es de un rol, de esa plantilla. Se calcula sobre la matriz de accesos por átomo que ya responde la API.
 */
export function ruleImpact(
  matrix: PersonMatrix,
  pattern: string,
  templateCode: string | undefined,
): RuleImpact {
  const alcanzados = new Set(atomsMatching(pattern));
  const columnas = matrix.columns.filter((c) => alcanzados.has(c));
  const personas = matrix.rows
    .filter((fila) => templateCode === undefined || fila.templateCode === templateCode)
    .filter((fila) => columnas.some((c) => (fila.cells[c]?.status ?? 'NONE') !== 'NONE'))
    .map((fila) => ({ name: fila.name ?? 'Una persona', userId: fila.userId }));
  return { people: personas, count: personas.length };
}

/* ---- techos por plantilla ---------------------------------------------------------------------------------------- */

export type CeilingCellKind = 'NONE' | 'LIMITED' | 'BLOCKED';
export interface CeilingCell {
  readonly kind: CeilingCellKind;
  readonly text: string;
}

/** Qué dicen las reglas de techo de la organización de una plantilla en una categoría: sin límite propio, limitada o bloqueada. */
export function ceilingCell(
  rules: readonly GovernanceRule[],
  template: string,
  category: AtomCategoryCode,
): CeilingCell {
  const vivas = rules.filter(
    (r) =>
      r.kind === 'CEILING' &&
      r.status === 'ACTIVE' &&
      (r.roleTemplateCode === undefined || r.roleTemplateCode === template),
  );
  const delaCategoria = SUPPORT_ATOMS.filter((a) => a.category === category).map((a) => a.code);
  const alcanzados = new Set(
    vivas
      .flatMap((r) => atomsMatching(r.permissionPattern))
      .filter((c) => delaCategoria.includes(c as never)),
  );
  if (alcanzados.size === 0) return { kind: 'NONE', text: 'Sin límite propio' };
  if (alcanzados.size === delaCategoria.length) return { kind: 'BLOCKED', text: 'Bloqueada' };
  return { kind: 'LIMITED', text: `Limitada (${alcanzados.size} de ${delaCategoria.length})` };
}

/** Los permisos que la plataforma nunca deja dar al personal de apoyo: el techo de la plataforma que se ve y no se edita. */
export function platformNeverAssignable(): readonly string[] {
  return SUPPORT_ATOMS.filter((a) => !a.supportAssignable).map((a) => a.name);
}
